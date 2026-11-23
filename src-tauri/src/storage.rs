use crate::{
    crypto::{self, DataKey},
    exports::{self, SavedExportInfo},
    media, personalization,
    printer::{self, DirectPrintRequest, PrintedJobReceipt, SystemPrinterInfo},
    selection::{self, SelectedSchoolResult},
    snapshot::{self, Snapshot, SNAPSHOT_LIMIT},
    vault::{self, GeneratedRecoveryKey, VaultOpenOutcome, VaultStatus},
};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    fs, io,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use zeroize::Zeroizing;

const IO_ERROR: &str = "Yerel veri deposu açılamadı veya kayıt tamamlanamadı.";
const READ_ERROR: &str = "Yerel kayıt okunamadı. Var olan veri korundu.";
const CONFLICT: &str = "Kayıt başka bir pencerede değişti. Görünüm yenilendi; işlemi tekrar deneyin.";
const RATE_LIMIT_ERROR: &str = "Çok fazla başarısız kurtarma denemesi yapıldı. Birkaç saniye bekleyip tekrar deneyin.";
const INITIAL_MIGRATION: &str = include_str!("../migrations/001_local_workspace.sql");
const CLEANUP_MIGRATION: &str = include_str!("../migrations/002_asset_cleanup.sql");
const FOLDER_MIGRATION: &str = include_str!("../migrations/003_asset_folders.sql");
const VAULT_MIGRATION: &str = include_str!("../migrations/004_vault_key.sql");
const PERSONALIZATION_MIGRATION: &str = include_str!("../migrations/005_desktop_personalization.sql");
const SELECTION_MIGRATION: &str = include_str!("../migrations/006_active_school_selection.sql");
const MAX_REVISION: i64 = 9_007_199_254_740_991;
const MAX_COMMIT_ADDITIONS: usize = 600;
const MAX_COMMIT_SCHOOL_ASSET_ADDITIONS: usize = 2_000;
const MAX_COMMIT_ORIGINAL_BYTES: usize = 64_000_000;

#[derive(Clone)]
pub struct StudioStorage {
    root: PathBuf,
    unlock_guard: Arc<Mutex<(u32, Option<Instant>)>>,
    cached_dek: Arc<Mutex<Option<(Vec<u8>, DataKey)>>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedWorkspace {
    pub revision: i64,
    pub snapshot_json: Option<String>,
    pub vault: VaultStatus,
}

fn snapshot_scope(revision: i64) -> String {
    format!("marbleos-studio:snapshot:v1:{revision}")
}

fn known_assets_by_kind(tx: &Connection, school_only: bool) -> Result<HashSet<String>, &'static str> {
    let sql = if school_only {
        "SELECT id FROM assets WHERE folder = ?1"
    } else {
        "SELECT id FROM assets WHERE folder IS NULL OR folder != ?1"
    };
    let mut query = tx.prepare(sql).map_err(|_| READ_ERROR)?;
    let rows = query.query_map([media::SCHOOL_MEDIA_FOLDER], |row| row.get(0)).map_err(|_| READ_ERROR)?;
    rows.collect::<Result<_, _>>().map_err(|_| READ_ERROR)
}

fn persist_school_assets(
    media_root: &Path,
    tx: &Connection,
    snapshot: &mut Snapshot,
    allowed_existing: &HashSet<String>,
    pending: &mut media::PendingFiles,
    max_additions: usize,
) -> Result<(), &'static str> {
    let mut additions = 0usize;
    for school in &mut snapshot.schools {
        for (field, max_bytes) in [
            (&mut school.logo_data_url, media::MAX_SCHOOL_LOGO_OR_SIGNATURE),
            (&mut school.principal_signature_data_url, media::MAX_SCHOOL_LOGO_OR_SIGNATURE),
            (&mut school.deputy_signature_data_url, media::MAX_SCHOOL_LOGO_OR_SIGNATURE),
            (&mut school.school_photo_data_url, media::MAX_SCHOOL_PHOTO),
        ] {
            if field.is_empty() {
                continue;
            }
            if let Some(asset_id) = snapshot::parse_school_asset_id(field) {
                if !allowed_existing.contains(asset_id) {
                    return Err(snapshot::INVALID_DATA);
                }
                continue;
            }
            additions += 1;
            if additions > max_additions {
                return Err(snapshot::INVALID_DATA);
            }
            let asset_id = uuid::Uuid::new_v4().hyphenated().to_string();
            let queued: bool = tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM asset_cleanup WHERE id=?1)", [&asset_id], |row| row.get(0),
            ).map_err(|_| READ_ERROR)?;
            if queued {
                return Err(IO_ERROR);
            }
            pending.add_school_asset(media_root, &asset_id, field, max_bytes)?;
            tx.execute(
                "INSERT INTO assets (id, folder) VALUES (?1, ?2)",
                params![asset_id, media::SCHOOL_MEDIA_FOLDER],
            ).map_err(|_| IO_ERROR)?;
            *field = format!("{}{asset_id}", snapshot::SCHOOL_ASSET_PREFIX);
        }
    }
    Ok(())
}

fn read_workspace(conn: &Connection, dek: &DataKey, vault: VaultStatus) -> Result<LoadedWorkspace, &'static str> {
    let row = conn.query_row(
        "SELECT revision, CASE WHEN length(encrypted_snapshot) <= ?1 THEN encrypted_snapshot END
         FROM workspace WHERE id = 1",
        [(SNAPSHOT_LIMIT + 4096) as i64],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<Vec<u8>>>(1)?)),
    ).optional().map_err(|_| READ_ERROR)?;
    let Some((revision, encrypted)) = row else {
        if selection::has_selection_row(conn)? {
            return Err(READ_ERROR);
        }
        return Ok(LoadedWorkspace { revision: 0, snapshot_json: None, vault });
    };
    let scope = snapshot_scope(revision);
    let bytes = crypto::open_with_key(dek, &encrypted.ok_or(READ_ERROR)?, scope.as_bytes())
        .map_err(|_| READ_ERROR)?;
    let mut snapshot = Snapshot::decode(&bytes).map_err(|_| READ_ERROR)?;
    if snapshot.photos.iter().any(|photo| !photo.data_url.is_empty()) {
        return Err(READ_ERROR);
    }
    if let Some(overlay) = selection::read_selection_row(conn, dek, revision)? {
        if overlay.active_school_id.as_deref().is_some_and(|id| !snapshot.has_school(id)) {
            return Err(READ_ERROR);
        }
        let snapshot_json = if snapshot.active_school_id() != overlay.active_school_id.as_deref() {
            snapshot.set_active_school_id(overlay.active_school_id);
            serde_json::to_string(&snapshot).map_err(|_| READ_ERROR)?
        } else {
            String::from_utf8(bytes).map_err(|_| READ_ERROR)?
        };
        return Ok(LoadedWorkspace {
            revision: overlay.selection_revision,
            snapshot_json: Some(snapshot_json),
            vault,
        });
    }
    Ok(LoadedWorkspace {
        revision,
        snapshot_json: Some(String::from_utf8(bytes).map_err(|_| READ_ERROR)?),
        vault,
    })
}

impl StudioStorage {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            unlock_guard: Arc::new(Mutex::new((0, None))),
            cached_dek: Arc::new(Mutex::new(None)),
        }
    }

    fn connect(&self) -> Result<Connection, &'static str> {
        let media_root = self.root.join("media");
        let data = self.root.join("data");
        for dir in [&self.root, &data, &media_root, &media_root.join("originals"), &media_root.join("previews")] {
            media::directory(dir).map_err(|_| IO_ERROR)?;
        }
        let database = data.join("marbleos_studio.db");
        for path in [&database, &data.join("marbleos_studio.db-journal"),
            &data.join("marbleos_studio.db-wal"), &data.join("marbleos_studio.db-shm")] {
            match fs::symlink_metadata(path) {
                Ok(meta) if meta.is_file() && !media::is_redirected(&meta) => {}
                Err(error) if error.kind() == io::ErrorKind::NotFound => {}
                _ => return Err(IO_ERROR),
            }
        }
        let mut conn = Connection::open(database).map_err(|_| IO_ERROR)?;
        conn.busy_timeout(Duration::from_secs(5)).map_err(|_| IO_ERROR)?;
        conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;")
            .map_err(|_| IO_ERROR)?;
        let version = |conn: &Connection| conn.pragma_query_value(None, "user_version", |row| row.get::<_, i64>(0));
        if version(&conn).map_err(|_| READ_ERROR)? < 6 {
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
            if version(&tx).map_err(|_| READ_ERROR)? == 0 {
                let objects: i64 = tx.query_row("SELECT count(*) FROM sqlite_schema", [], |row| row.get(0))
                    .map_err(|_| READ_ERROR)?;
                if objects != 0 {
                    return Err(READ_ERROR);
                }
                tx.execute_batch(INITIAL_MIGRATION).map_err(|_| IO_ERROR)?;
            }
            if version(&tx).map_err(|_| READ_ERROR)? == 1 {
                tx.execute_batch(CLEANUP_MIGRATION).map_err(|_| IO_ERROR)?;
            }
            if version(&tx).map_err(|_| READ_ERROR)? == 2 {
                tx.execute_batch(FOLDER_MIGRATION).map_err(|_| IO_ERROR)?;
            }
            if version(&tx).map_err(|_| READ_ERROR)? == 3 {
                tx.execute_batch(VAULT_MIGRATION).map_err(|_| IO_ERROR)?;
            }
            if version(&tx).map_err(|_| READ_ERROR)? == 4 {
                tx.execute_batch(PERSONALIZATION_MIGRATION).map_err(|_| IO_ERROR)?;
            }
            if version(&tx).map_err(|_| READ_ERROR)? == 5 {
                tx.execute_batch(SELECTION_MIGRATION).map_err(|_| IO_ERROR)?;
            }
            tx.commit().map_err(|_| IO_ERROR)?;
        }
        if version(&conn).map_err(|_| READ_ERROR)? != 6 {
            return Err("Yerel veritabanı sürümü desteklenmiyor. Var olan veri korundu.");
        }
        Ok(conn)
    }

    fn open_vault(&self, conn: &mut Connection) -> Result<VaultOpenOutcome, &'static str> {
        if let Some(outcome) = vault::read_existing_vault(conn, &self.cached_dek)? {
            return Ok(outcome);
        }
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let outcome = vault::open_or_init_vault(&tx)?;
        if let VaultOpenOutcome::Unlocked(ref dek, _) = outcome {
            if let Ok(blob) = tx.query_row("SELECT dpapi_wrapped_dek FROM vault_key WHERE id = 1", [], |r| r.get::<_, Vec<u8>>(0)) {
                if let Ok(mut guard) = self.cached_dek.lock() {
                    *guard = Some((blob, dek.clone()));
                }
            }
        }
        tx.commit().map_err(|_| IO_ERROR)?;
        Ok(outcome)
    }

    fn migrate_legacy_dpapi(&self, conn: &mut Connection, dek: &DataKey) -> Result<(), &'static str> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let assets: Vec<(String, Option<String>)> = {
            let mut stmt = tx.prepare("SELECT id, folder FROM assets").map_err(|_| READ_ERROR)?;
            let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|_| READ_ERROR)?;
            rows.collect::<Result<_, _>>().map_err(|_| READ_ERROR)?
        };
        let media_root = self.root.join("media");
        for (id, folder) in assets {
            media::migrate_asset_to_dek(&media_root, dek, &id, folder.as_deref())?;
        }
        let legacy_ws: Option<(i64, Option<Vec<u8>>)> = tx.query_row(
            "SELECT revision, CASE WHEN length(encrypted_snapshot) <= ?1 THEN encrypted_snapshot END
             FROM workspace WHERE id = 1 AND substr(encrypted_snapshot, 1, length(?2)) != ?2",
            params![(SNAPSHOT_LIMIT + 4096) as i64, crypto::AEAD_MAGIC.as_slice()],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).optional().map_err(|_| READ_ERROR)?;
        if let Some((revision, blob)) = legacy_ws {
            let scope = snapshot_scope(revision);
            let plain = Zeroizing::new(
                crypto::open_with_key(dek, &blob.ok_or(READ_ERROR)?, scope.as_bytes()).map_err(|_| READ_ERROR)?,
            );
            let _ = Snapshot::decode(&plain).map_err(|_| READ_ERROR)?;
            let resealed = crypto::seal_with_key(dek, &plain, scope.as_bytes()).map_err(|_| IO_ERROR)?;
            tx.execute("UPDATE workspace SET encrypted_snapshot = ?1 WHERE id = 1", [resealed])
                .map_err(|_| IO_ERROR)?;
        }
        tx.commit().map_err(|_| IO_ERROR)
    }

    pub fn load(&self) -> Result<LoadedWorkspace, &'static str> {
        let mut conn = self.connect()?;
        let (dek, vault) = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Locked(vault) => {
                return Ok(LoadedWorkspace { revision: 0, snapshot_json: None, vault });
            }
            VaultOpenOutcome::Unlocked(dek, vault) => (dek, vault),
        };
        self.migrate_legacy_dpapi(&mut conn, &dek)?;
        let mut workspace = read_workspace(&conn, &dek, vault.clone())?;
        if let Some(ref json) = workspace.snapshot_json {
            if Snapshot::decode(json.as_bytes())?.has_inline_school_images() {
                workspace = self.migrate_inline_school_assets(&mut conn, &dek, vault)?;
            }
        }
        self.retry_asset_cleanup(&mut conn);
        Ok(workspace)
    }

    fn migrate_inline_school_assets(
        &self,
        conn: &mut Connection,
        dek: &DataKey,
        vault: VaultStatus,
    ) -> Result<LoadedWorkspace, &'static str> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let current = read_workspace(&tx, dek, vault.clone())?;
        let Some(ref json) = current.snapshot_json else {
            return Ok(current);
        };
        let mut snapshot = Snapshot::decode(json.as_bytes())?;
        if !snapshot.has_inline_school_images() {
            return Ok(current);
        }
        let revision = current.revision.checked_add(1).filter(|r| *r <= MAX_REVISION).ok_or(IO_ERROR)?;
        let known_school = known_assets_by_kind(&tx, true)?;
        let allowed: HashSet<String> = snapshot.referenced_school_assets()
            .into_iter().filter(|id| known_school.contains(id)).collect();
        let mut pending = media::PendingFiles::new(dek.clone());
        persist_school_assets(&self.root.join("media"), &tx, &mut snapshot, &allowed, &mut pending, usize::MAX)?;
        let snapshot_json = serde_json::to_string(&snapshot).map_err(|_| IO_ERROR)?;
        if snapshot_json.len() > SNAPSHOT_LIMIT {
            return Err("Kayıt boyutu yerel sürümün sınırını aşıyor.");
        }
        let scope = snapshot_scope(revision);
        let encrypted = crypto::seal_with_key(dek, snapshot_json.as_bytes(), scope.as_bytes()).map_err(|_| IO_ERROR)?;
        tx.execute(
            "UPDATE workspace SET revision=?1, encrypted_snapshot=?2 WHERE id=1",
            params![revision, encrypted],
        ).map_err(|_| IO_ERROR)?;
        let school_ids = snapshot.school_ids();
        selection::sync_selection_row(&tx, dek, revision, revision, snapshot.active_school_id(), &school_ids)?;
        tx.commit().map_err(|_| IO_ERROR)?;
        pending.committed();
        Ok(LoadedWorkspace { revision, snapshot_json: Some(snapshot_json), vault })
    }

    pub fn generate_recovery_key(&self, confirm_rotate: bool) -> Result<GeneratedRecoveryKey, &'static str> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let (dek, status) = match vault::open_or_init_vault(&tx)? {
            VaultOpenOutcome::Unlocked(dek, status) => (dek, status),
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let generated = vault::generate_recovery_key(&tx, &dek, status.has_recovery_key, confirm_rotate)?;
        tx.commit().map_err(|_| IO_ERROR)?;
        Ok(generated)
    }

    pub fn unlock_with_recovery_key(&self, raw_key: &str) -> Result<LoadedWorkspace, &'static str> {
        let _ = vault::decode_recovery_key(raw_key)?;
        {
            let guard = self.unlock_guard.lock().map_err(|_| IO_ERROR)?;
            if guard.1.is_some_and(|until| Instant::now() < until) {
                return Err(RATE_LIMIT_ERROR);
            }
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        match vault::unlock_with_recovery_key(&tx, raw_key) {
            Ok(_dek) => {
                tx.commit().map_err(|_| IO_ERROR)?;
                if let Ok(mut guard) = self.cached_dek.lock() {
                    *guard = None;
                }
                if let Ok(mut guard) = self.unlock_guard.lock() {
                    *guard = (0, None);
                }
                self.load()
            }
            Err(err) => {
                if let Ok(mut guard) = self.unlock_guard.lock() {
                    guard.0 = guard.0.saturating_add(1);
                    if guard.0 >= 3 {
                        let secs = 2u64.saturating_pow((guard.0 - 2).min(5));
                        guard.1 = Some(Instant::now() + Duration::from_secs(secs));
                    }
                }
                Err(err)
            }
        }
    }

    pub fn commit(&self, expected_revision: i64, json: &str) -> Result<LoadedWorkspace, &'static str> {
        self.commit_with_deletions(expected_revision, json, &[])
    }

    pub fn commit_with_deletions(
        &self, expected_revision: i64, json: &str, deleted_ids: &[String],
    ) -> Result<LoadedWorkspace, &'static str> {
        let removed: HashSet<&str> = deleted_ids.iter().map(String::as_str).collect();
        if removed.len() != deleted_ids.len() || removed.len() > 20_000
            || removed.iter().any(|id| !snapshot::is_id(id))
        {
            return Err(snapshot::INVALID_DATA);
        }
        let mut snapshot = Snapshot::decode_commit(json.as_bytes())?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let (dek, vault) = match vault::open_or_init_vault(&tx)? {
            VaultOpenOutcome::Unlocked(dek, vault) => (dek, vault),
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let current = read_workspace(&tx, &dek, vault.clone())?;
        if current.revision != expected_revision {
            return Err(CONFLICT);
        }
        let previous = current.snapshot_json.as_deref()
            .map(|json| Snapshot::decode(json.as_bytes())).transpose()?;
        snapshot.validate_update(previous.as_ref())?;
        let revision = expected_revision.checked_add(1).filter(|r| *r <= MAX_REVISION).ok_or(IO_ERROR)?;
        let known = known_assets_by_kind(&tx, false)?;
        let known_school = known_assets_by_kind(&tx, true)?;
        let previous_school_assets = previous.as_ref()
            .map_or_else(HashSet::new, Snapshot::referenced_school_assets);
        let allowed_school_assets: HashSet<String> = previous_school_assets.iter()
            .filter(|id| known_school.contains(*id)).cloned().collect();
        let next_ids: HashSet<&str> = snapshot.photos.iter().map(|photo| photo.id.as_str()).collect();
        let actual_removed: HashSet<&str> = known.iter().map(String::as_str)
            .filter(|id| !next_ids.contains(id)).collect();
        if actual_removed != removed {
            return Err(snapshot::INVALID_DATA);
        }
        let retained = snapshot.photos.iter().filter(|photo| known.contains(&photo.id)).count();
        let additions = snapshot.photos.len() - retained;
        if additions > MAX_COMMIT_ADDITIONS || (additions > 0 && !removed.is_empty()) {
            return Err(snapshot::INVALID_DATA);
        }
        let original_bytes: usize = snapshot.photos.iter()
            .filter(|photo| !known.contains(&photo.id))
            .filter_map(|photo| photo.data_url.split_once(',').map(|(_, encoded)| {
                (encoded.len() * 3 / 4).saturating_sub(encoded.len() - encoded.trim_end_matches('=').len())
            }))
            .sum();
        if original_bytes > MAX_COMMIT_ORIGINAL_BYTES {
            return Err("Bir kayıt veya yedek grubu 64 MB fotoğraf sınırını aşıyor.");
        }
        let mut pending = media::PendingFiles::new(dek.clone());
        let media_root = self.root.join("media");
        persist_school_assets(
            &media_root, &tx, &mut snapshot, &allowed_school_assets,
            &mut pending, MAX_COMMIT_SCHOOL_ASSET_ADDITIONS,
        )?;
        let next_school_assets = snapshot.referenced_school_assets();
        let removed_school_assets: Vec<String> = previous_school_assets
            .difference(&next_school_assets).cloned().collect();
        let folders: HashMap<_, _> = snapshot.photos.iter()
            .filter(|photo| !known.contains(&photo.id))
            .map(|photo| (photo.id.clone(), snapshot.folder_for_photo(photo)))
            .collect();
        for photo in &mut snapshot.photos {
            if known.contains(&photo.id) {
                if !photo.data_url.is_empty() {
                    return Err(snapshot::INVALID_DATA);
                }
                continue;
            }
            let queued: bool = tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM asset_cleanup WHERE id=?1)", [&photo.id], |row| row.get(0),
            ).map_err(|_| READ_ERROR)?;
            if queued {
                return Err(snapshot::INVALID_DATA);
            }
            let folder = folders.get(&photo.id).and_then(Option::as_deref);
            let hash = if let Some(src_id) = snapshot::parse_photo_copy_id(&photo.data_url) {
                if !known.contains(src_id) {
                    return Err(snapshot::INVALID_DATA);
                }
                let src_folder: Option<String> = tx.query_row(
                    "SELECT folder FROM assets WHERE id=?1", [src_id], |row| row.get(0),
                ).map_err(|_| READ_ERROR)?;
                pending.clone_existing(
                    &media_root, src_id, src_folder.as_deref(),
                    &photo.id, folder, photo.content_hash.as_deref(),
                )?
            } else {
                pending.add(&media_root, &photo.id, &photo.data_url, folder, photo.content_hash.as_deref())?
            };
            photo.content_hash = Some(hash);
            tx.execute("INSERT INTO assets (id, folder) VALUES (?1, ?2)", params![photo.id, folder]).map_err(|_| IO_ERROR)?;
            photo.data_url.clear();
        }
        for id in &removed {
            tx.execute("INSERT INTO asset_cleanup (id, folder) SELECT id, folder FROM assets WHERE id=?1", [id]).map_err(|_| IO_ERROR)?;
            tx.execute("DELETE FROM assets WHERE id=?1", [id]).map_err(|_| IO_ERROR)?;
        }
        for old_id in &removed_school_assets {
            tx.execute(
                "INSERT INTO asset_cleanup (id, folder) SELECT id, folder FROM assets WHERE id=?1 AND folder=?2",
                params![old_id, media::SCHOOL_MEDIA_FOLDER],
            ).map_err(|_| IO_ERROR)?;
            tx.execute(
                "DELETE FROM assets WHERE id=?1 AND folder=?2",
                params![old_id, media::SCHOOL_MEDIA_FOLDER],
            ).map_err(|_| IO_ERROR)?;
        }
        let snapshot_json = serde_json::to_string(&snapshot).map_err(|_| IO_ERROR)?;
        if snapshot_json.len() > SNAPSHOT_LIMIT {
            return Err("Kayıt boyutu yerel sürümün sınırını aşıyor.");
        }
        let scope = snapshot_scope(revision);
        let encrypted = crypto::seal_with_key(&dek, snapshot_json.as_bytes(), scope.as_bytes()).map_err(|_| IO_ERROR)?;
        tx.execute(
            "INSERT INTO workspace (id, revision, encrypted_snapshot) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, encrypted_snapshot=excluded.encrypted_snapshot",
            params![revision, encrypted],
        ).map_err(|_| IO_ERROR)?;
        let school_ids = snapshot.school_ids();
        selection::sync_selection_row(&tx, &dek, revision, revision, snapshot.active_school_id(), &school_ids)?;
        tx.commit().map_err(|_| IO_ERROR)?;
        pending.committed();
        if !removed.is_empty() || !removed_school_assets.is_empty() {
            self.retry_asset_cleanup(&mut conn);
        }
        Ok(LoadedWorkspace { revision, snapshot_json: Some(snapshot_json), vault })
    }

    fn open_vault_in_tx(&self, tx: &Connection) -> Result<VaultOpenOutcome, &'static str> {
        if let Some(outcome) = vault::read_existing_vault(tx, &self.cached_dek)? {
            return Ok(outcome);
        }
        vault::open_or_init_vault(tx)
    }

    pub fn select_school(
        &self,
        expected_revision: i64,
        school_id: Option<&str>,
    ) -> Result<SelectedSchoolResult, &'static str> {
        if !(0..=MAX_REVISION).contains(&expected_revision) {
            return Err(snapshot::INVALID_DATA);
        }
        if let Some(id) = school_id {
            if !snapshot::is_id(id) {
                return Err(snapshot::INVALID_DATA);
            }
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let (dek, vault) = match self.open_vault_in_tx(&tx)? {
            VaultOpenOutcome::Unlocked(dek, vault) => (dek, vault),
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let ws_revision: Option<i64> = tx
            .query_row("SELECT revision FROM workspace WHERE id = 1", [], |row| row.get(0))
            .optional()
            .map_err(|_| READ_ERROR)?;
        let Some(ws_revision) = ws_revision else {
            if selection::has_selection_row(&tx)? {
                return Err(READ_ERROR);
            }
            if expected_revision != 0 {
                return Err(CONFLICT);
            }
            if school_id.is_some() {
                return Err("Okul bulunamadı.");
            }
            return Ok(SelectedSchoolResult { revision: 0, active_school_id: None, vault });
        };

        if let Some(overlay) = selection::read_selection_row(&tx, &dek, ws_revision)? {
            if overlay.selection_revision != expected_revision {
                return Err(CONFLICT);
            }
            if let Some(id) = school_id {
                if !overlay.school_ids.iter().any(|known| known == id) {
                    return Err("Okul bulunamadı.");
                }
            }
            if overlay.active_school_id.as_deref() == school_id {
                return Ok(SelectedSchoolResult {
                    revision: overlay.selection_revision,
                    active_school_id: overlay.active_school_id,
                    vault,
                });
            }
            let next_revision = overlay
                .selection_revision
                .checked_add(1)
                .filter(|r| *r <= MAX_REVISION)
                .ok_or(IO_ERROR)?;
            selection::update_active_school_row(&tx, &dek, next_revision, school_id)?;
            tx.commit().map_err(|_| IO_ERROR)?;
            return Ok(SelectedSchoolResult {
                revision: next_revision,
                active_school_id: school_id.map(str::to_owned),
                vault,
            });
        }

        if ws_revision != expected_revision {
            return Err(CONFLICT);
        }
        let current = read_workspace(&tx, &dek, vault.clone())?;
        let json = current.snapshot_json.as_deref().ok_or(READ_ERROR)?;
        let snapshot = Snapshot::decode(json.as_bytes()).map_err(|_| READ_ERROR)?;
        let school_ids = snapshot.school_ids();
        if let Some(id) = school_id {
            if !school_ids.iter().any(|known| known == id) {
                return Err("Okul bulunamadı.");
            }
        }
        let next_revision = if snapshot.active_school_id() == school_id {
            ws_revision
        } else {
            ws_revision.checked_add(1).filter(|r| *r <= MAX_REVISION).ok_or(IO_ERROR)?
        };
        selection::sync_selection_row(&tx, &dek, ws_revision, next_revision, school_id, &school_ids)?;
        tx.commit().map_err(|_| IO_ERROR)?;
        Ok(SelectedSchoolResult {
            revision: next_revision,
            active_school_id: school_id.map(str::to_owned),
            vault,
        })
    }

    fn retry_asset_cleanup(&self, conn: &mut Connection) {
        let has_pending = conn.query_row("SELECT EXISTS(SELECT 1 FROM asset_cleanup)", [], |row| row.get::<_, bool>(0));
        if !matches!(has_pending, Ok(true)) {
            return;
        }
        let _ = self.purge_removed_assets(conn);
    }

    fn purge_removed_assets(&self, conn: &mut Connection) -> Result<(), &'static str> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        let ids = {
            let mut query = tx.prepare(
                "SELECT id, folder FROM asset_cleanup WHERE NOT EXISTS (SELECT 1 FROM assets WHERE assets.id = asset_cleanup.id)",
            ).map_err(|_| READ_ERROR)?;
            let rows = query.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))).map_err(|_| READ_ERROR)?;
            rows.collect::<Result<Vec<_>, _>>().map_err(|_| READ_ERROR)?
        };
        let root = self.root.join("media");
        for (id, folder) in ids {
            if snapshot::is_id(&id) && media::remove_managed_photo(&root, &id, folder.as_deref()).is_ok() {
                tx.execute("DELETE FROM asset_cleanup WHERE id=?1", [&id]).map_err(|_| IO_ERROR)?;
            }
        }
        tx.commit().map_err(|_| IO_ERROR)
    }

    pub fn preview(&self, id: &str) -> Result<String, &'static str> {
        if !snapshot::is_id(id) {
            return Err(snapshot::INVALID_DATA);
        }
        let mut conn = self.connect()?;
        let dek = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(dek, _) => dek,
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let folder: Option<Option<String>> = conn.query_row(
            "SELECT folder FROM assets WHERE id=?1", [id], |row| row.get(0),
        ).optional().map_err(|_| READ_ERROR)?;
        let folder = folder.ok_or("Fotoğraf bulunamadı.")?;
        media::preview(&self.root.join("media"), &dek, id, folder.as_deref())
    }

    pub fn original(&self, id: &str, expected_hash: Option<&str>) -> Result<String, &'static str> {
        if !snapshot::is_id(id) {
            return Err(snapshot::INVALID_DATA);
        }
        if expected_hash.is_some_and(|hash| hash.len() != 64
            || !hash.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)))
        {
            return Err(snapshot::INVALID_DATA);
        }
        let mut conn = self.connect()?;
        let dek = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(dek, _) => dek,
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let folder: Option<Option<String>> = conn.query_row(
            "SELECT folder FROM assets WHERE id=?1", [id], |row| row.get(0),
        ).optional().map_err(|_| READ_ERROR)?;
        let folder = folder.ok_or("Fotoğraf bulunamadı.")?;
        media::original(&self.root.join("media"), &dek, id, folder.as_deref(), expected_hash)
    }

    pub fn save_export(
        &self,
        subfolder: &str,
        file_name: &str,
        bytes_b64: &str,
    ) -> Result<SavedExportInfo, &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        exports::write_managed_export(&self.root, subfolder, file_name, bytes_b64)
    }

    pub fn save_export_in_folder(
        &self,
        subfolder: &str,
        folder_name: &str,
        relative_path: &str,
        bytes_b64: &str,
    ) -> Result<SavedExportInfo, &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        exports::write_managed_export_in_folder(&self.root, subfolder, folder_name, relative_path, bytes_b64)
    }

    pub fn open_export_folder(&self, subfolder: &str, folder_name: &str) -> Result<(), &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        exports::open_managed_export_folder(&self.root, subfolder, folder_name)
    }

    pub fn open_managed_dir(&self, target: &str) -> Result<(), &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        exports::open_managed_directory(&self.root, target)
    }

    pub fn list_printers(&self) -> Result<Vec<SystemPrinterInfo>, &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        printer::list_system_printers()
    }

    pub fn print_pages(&self, request: DirectPrintRequest) -> Result<PrintedJobReceipt, &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        printer::execute_direct_print(request)
    }

    pub fn load_personalization(&self) -> Result<Option<String>, &'static str> {
        let mut conn = self.connect()?;
        let dek = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(dek, _) => dek,
            VaultOpenOutcome::Locked(_) => return Ok(None),
        };
        personalization::load_state(&conn, &dek)
    }

    pub fn save_personalization(&self, state_json: &str) -> Result<(), &'static str> {
        let mut conn = self.connect()?;
        let dek = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(dek, _) => dek,
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        personalization::save_state(&tx, &dek, state_json)?;
        tx.commit().map_err(|_| IO_ERROR)
    }

    pub fn save_desktop_asset(&self, asset_key: &str, data_url: &str) -> Result<(), &'static str> {
        let mut conn = self.connect()?;
        let dek = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(dek, _) => dek,
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        };
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        personalization::save_asset(&tx, &self.root.join("media"), &dek, asset_key, data_url)?;
        tx.commit().map_err(|_| IO_ERROR)
    }

    pub fn load_desktop_asset(&self, asset_key: &str) -> Result<Option<String>, &'static str> {
        let mut conn = self.connect()?;
        let dek = match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(dek, _) => dek,
            VaultOpenOutcome::Locked(_) => return Ok(None),
        };
        personalization::load_asset(&conn, &self.root.join("media"), &dek, asset_key)
    }

    pub fn delete_desktop_asset(&self, asset_key: &str) -> Result<(), &'static str> {
        let mut conn = self.connect()?;
        match self.open_vault(&mut conn)? {
            VaultOpenOutcome::Unlocked(_, _) => {}
            VaultOpenOutcome::Locked(_) => return Err(vault::VAULT_LOCKED_ERROR),
        }
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate).map_err(|_| IO_ERROR)?;
        personalization::delete_asset(&tx, &self.root.join("media"), asset_key)?;
        tx.commit().map_err(|_| IO_ERROR)
    }
}

#[cfg(all(test, windows))]
#[path = "storage_tests.rs"]
mod tests;
