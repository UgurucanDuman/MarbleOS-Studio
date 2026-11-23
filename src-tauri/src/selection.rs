use crate::{
    crypto::{self, DataKey},
    snapshot,
    vault::VaultStatus,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

const IO_ERROR: &str = "Yerel veri deposu açılamadı veya kayıt tamamlanamadı.";
const READ_ERROR: &str = "Yerel kayıt okunamadı. Var olan veri korundu.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedSchoolResult {
    pub revision: i64,
    pub active_school_id: Option<String>,
    pub vault: VaultStatus,
}

pub struct SelectionRow {
    pub selection_revision: i64,
    pub active_school_id: Option<String>,
    pub school_ids: Vec<String>,
}

fn active_school_scope(selection_revision: i64) -> String {
    format!("marbleos-studio:active-school:v1:{selection_revision}")
}

fn school_ids_scope(snapshot_revision: i64) -> String {
    format!("marbleos-studio:school-ids:v1:{snapshot_revision}")
}

pub fn has_selection_row(conn: &Connection) -> Result<bool, &'static str> {
    conn.query_row("SELECT EXISTS(SELECT 1 FROM workspace_selection WHERE id = 1)", [], |r| r.get(0))
        .map_err(|_| READ_ERROR)
}

pub fn sync_selection_row(
    tx: &Connection,
    dek: &DataKey,
    snapshot_revision: i64,
    selection_revision: i64,
    active_school_id: Option<&str>,
    school_ids: &[String],
) -> Result<(), &'static str> {
    let active_json = serde_json::to_vec(&active_school_id).map_err(|_| IO_ERROR)?;
    let ids_json = serde_json::to_vec(school_ids).map_err(|_| IO_ERROR)?;
    let active_scope = active_school_scope(selection_revision);
    let ids_scope = school_ids_scope(snapshot_revision);
    let encrypted_active = crypto::seal_with_key(dek, &active_json, active_scope.as_bytes())
        .map_err(|_| IO_ERROR)?;
    let encrypted_ids = crypto::seal_with_key(dek, &ids_json, ids_scope.as_bytes())
        .map_err(|_| IO_ERROR)?;
    tx.execute(
        "INSERT INTO workspace_selection
            (id, snapshot_revision, selection_revision, encrypted_active_school, encrypted_school_ids)
         VALUES (1, ?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
            snapshot_revision = excluded.snapshot_revision,
            selection_revision = excluded.selection_revision,
            encrypted_active_school = excluded.encrypted_active_school,
            encrypted_school_ids = excluded.encrypted_school_ids",
        params![snapshot_revision, selection_revision, encrypted_active, encrypted_ids],
    )
    .map_err(|_| IO_ERROR)?;
    Ok(())
}

pub fn update_active_school_row(
    tx: &Connection,
    dek: &DataKey,
    selection_revision: i64,
    active_school_id: Option<&str>,
) -> Result<(), &'static str> {
    let active_json = serde_json::to_vec(&active_school_id).map_err(|_| IO_ERROR)?;
    let active_scope = active_school_scope(selection_revision);
    let encrypted_active = crypto::seal_with_key(dek, &active_json, active_scope.as_bytes())
        .map_err(|_| IO_ERROR)?;
    let updated = tx
        .execute(
            "UPDATE workspace_selection
             SET selection_revision = ?1, encrypted_active_school = ?2
             WHERE id = 1",
            params![selection_revision, encrypted_active],
        )
        .map_err(|_| IO_ERROR)?;
    if updated != 1 {
        return Err(IO_ERROR);
    }
    Ok(())
}

pub fn read_selection_row(
    conn: &Connection,
    dek: &DataKey,
    ws_revision: i64,
) -> Result<Option<SelectionRow>, &'static str> {
    let row = conn
        .query_row(
            "SELECT snapshot_revision, selection_revision, encrypted_active_school, encrypted_school_ids
             FROM workspace_selection WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, Vec<u8>>(2)?,
                    r.get::<_, Vec<u8>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|_| READ_ERROR)?;

    let Some((snapshot_revision, selection_revision, enc_active, enc_ids)) = row else {
        return Ok(None);
    };
    if snapshot_revision != ws_revision || selection_revision < ws_revision {
        return Err(READ_ERROR);
    }
    let ids_scope = school_ids_scope(snapshot_revision);
    let ids_bytes = crypto::open_with_key(dek, &enc_ids, ids_scope.as_bytes())
        .map_err(|_| READ_ERROR)?;
    let school_ids: Vec<String> = serde_json::from_slice(&ids_bytes).map_err(|_| READ_ERROR)?;
    if school_ids.len() > 500 || school_ids.iter().any(|id| !snapshot::is_id(id)) {
        return Err(READ_ERROR);
    }
    let active_scope = active_school_scope(selection_revision);
    let active_bytes = crypto::open_with_key(dek, &enc_active, active_scope.as_bytes())
        .map_err(|_| READ_ERROR)?;
    let active_school_id: Option<String> = serde_json::from_slice(&active_bytes)
        .map_err(|_| READ_ERROR)?;
    if let Some(ref id) = active_school_id {
        if !snapshot::is_id(id) || !school_ids.iter().any(|known| known == id) {
            return Err(READ_ERROR);
        }
    }
    Ok(Some(SelectionRow {
        selection_revision,
        active_school_id,
        school_ids,
    }))
}
