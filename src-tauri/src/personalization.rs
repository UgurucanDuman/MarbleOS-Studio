use crate::{
    crypto::{self, DataKey},
    media, snapshot,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::path::Path;
use uuid::Uuid;

const PERSONALIZATION_SCOPE: &[u8] = b"marbleos-studio:personalization:v1";
const MAX_STATE_JSON_BYTES: usize = 131_072;
const IO_ERROR: &str = "Masaüstü ayarları yerel veritabanına kaydedilemedi.";
const READ_ERROR: &str = "Masaüstü ayarları yerel veritabanından okunamadı.";

fn parse_asset_key(asset_key: &str) -> Result<usize, &'static str> {
    if let Some(id) = asset_key.strip_prefix("logo:") {
        if snapshot::is_id(id) {
            return Ok(media::MAX_SCHOOL_LOGO_OR_SIGNATURE);
        }
        return Err(snapshot::INVALID_DATA);
    }
    if snapshot::is_id(asset_key) {
        return Ok(media::MAX_ORIGINAL);
    }
    Err(snapshot::INVALID_DATA)
}

pub fn load_state(conn: &Connection, dek: &DataKey) -> Result<Option<String>, &'static str> {
    let encrypted: Option<Vec<u8>> = conn
        .query_row(
            "SELECT encrypted_state FROM desktop_personalization WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| READ_ERROR)?;
    let Some(blob) = encrypted else {
        return Ok(None);
    };
    let bytes = crypto::open_with_key(dek, &blob, PERSONALIZATION_SCOPE).map_err(|_| READ_ERROR)?;
    let text = String::from_utf8(bytes).map_err(|_| READ_ERROR)?;
    Ok(Some(text))
}

pub fn save_state(conn: &Connection, dek: &DataKey, state_json: &str) -> Result<(), &'static str> {
    if state_json.len() < 2 || state_json.len() > MAX_STATE_JSON_BYTES {
        return Err(snapshot::INVALID_DATA);
    }
    let parsed: Value = serde_json::from_str(state_json).map_err(|_| snapshot::INVALID_DATA)?;
    if !parsed.is_object() {
        return Err(snapshot::INVALID_DATA);
    }
    let encrypted = crypto::seal_with_key(dek, state_json.as_bytes(), PERSONALIZATION_SCOPE)
        .map_err(|_| IO_ERROR)?;
    let now: String = conn
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |r| r.get(0))
        .map_err(|_| IO_ERROR)?;
    conn.execute(
        "INSERT INTO desktop_personalization (id, encrypted_state, updated_at)
         VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET encrypted_state = excluded.encrypted_state, updated_at = excluded.updated_at",
        params![encrypted, now],
    )
    .map_err(|_| IO_ERROR)?;
    Ok(())
}

pub fn save_asset(
    conn: &Connection,
    media_root: &Path,
    dek: &DataKey,
    asset_key: &str,
    data_url: &str,
) -> Result<(), &'static str> {
    let max_bytes = parse_asset_key(asset_key)?;
    let old_file_id: Option<String> = conn
        .query_row(
            "SELECT file_id FROM desktop_assets WHERE asset_key = ?1",
            [asset_key],
            |r| r.get(0),
        )
        .optional()
        .map_err(|_| READ_ERROR)?;

    let file_id = Uuid::new_v4().hyphenated().to_string();
    media::save_desktop_asset(media_root, dek, &file_id, data_url, max_bytes)?;

    let now: String = conn
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |r| r.get(0))
        .map_err(|_| {
            let _ = media::remove_desktop_asset(media_root, &file_id);
            IO_ERROR
        })?;

    if let Err(_) = conn.execute(
        "INSERT INTO desktop_assets (asset_key, file_id, created_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(asset_key) DO UPDATE SET file_id = excluded.file_id, created_at = excluded.created_at",
        params![asset_key, file_id, now],
    ) {
        let _ = media::remove_desktop_asset(media_root, &file_id);
        return Err(IO_ERROR);
    }

    if let Some(prev) = old_file_id {
        let _ = media::remove_desktop_asset(media_root, &prev);
    }
    Ok(())
}

pub fn load_asset(
    conn: &Connection,
    media_root: &Path,
    dek: &DataKey,
    asset_key: &str,
) -> Result<Option<String>, &'static str> {
    let max_bytes = parse_asset_key(asset_key)?;
    let file_id: Option<String> = conn
        .query_row(
            "SELECT file_id FROM desktop_assets WHERE asset_key = ?1",
            [asset_key],
            |r| r.get(0),
        )
        .optional()
        .map_err(|_| READ_ERROR)?;
    let Some(file_id) = file_id else {
        return Ok(None);
    };
    media::load_desktop_asset(media_root, dek, &file_id, max_bytes).map(Some)
}

pub fn delete_asset(
    conn: &Connection,
    media_root: &Path,
    asset_key: &str,
) -> Result<(), &'static str> {
    parse_asset_key(asset_key)?;
    let file_id: Option<String> = conn
        .query_row(
            "SELECT file_id FROM desktop_assets WHERE asset_key = ?1",
            [asset_key],
            |r| r.get(0),
        )
        .optional()
        .map_err(|_| READ_ERROR)?;
    conn.execute("DELETE FROM desktop_assets WHERE asset_key = ?1", [asset_key])
        .map_err(|_| IO_ERROR)?;
    if let Some(id) = file_id {
        let _ = media::remove_desktop_asset(media_root, &id);
    }
    Ok(())
}

