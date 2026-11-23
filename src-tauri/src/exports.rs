use crate::{media, snapshot};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{fs, io::Write, path::Path};
use tempfile::NamedTempFile;

pub const MAX_EXPORT_BYTES: usize = 96 * 1024 * 1024;
const MAX_EXPORT_B64_LEN: usize = (MAX_EXPORT_BYTES / 3) * 4 + 64;
const EXPORT_WRITE_ERROR: &str = "Çıktı dosyası yerel klasöre kaydedilemedi.";
const EXPORT_OPEN_ERROR: &str = "Yerel çalışma klasörü açılamadı.";

const ALLOWED_SUBFOLDERS: &[&str] = &[
    "print-ready",
    "vesikalik",
    "biyometrik",
    "kimlik",
    "album",
    "e-okul",
    "excel",
    "manifest",
];

const RESERVED_WIN_STEMS: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

fn validate_dir_segment(raw: &str, max_len: usize) -> Result<&str, &'static str> {
    if raw.is_empty()
        || raw.encode_utf16().count() > max_len
        || raw != raw.trim()
        || raw == "."
        || raw == ".."
        || raw.starts_with('.')
        || raw.ends_with('.')
        || raw.contains("..")
        || raw.chars().any(|ch| {
            ch.is_control()
                || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        })
    {
        return Err(snapshot::INVALID_DATA);
    }
    let stem = raw.split('.').next().unwrap_or("");
    if stem.is_empty()
        || RESERVED_WIN_STEMS
            .iter()
            .any(|reserved| stem.eq_ignore_ascii_case(reserved))
    {
        return Err(snapshot::INVALID_DATA);
    }
    Ok(raw)
}

#[derive(Clone, Copy)]
enum ExportExt {
    Pdf,
    Jpeg,
    Zip,
    Xlsx,
    Csv,
    Json,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedExportInfo {
    pub relative_path: String,
    pub byte_length: usize,
}

fn validate_export_file_name(raw: &str) -> Result<(&str, ExportExt), &'static str> {
    if raw.is_empty()
        || raw.encode_utf16().count() > 160
        || raw != raw.trim()
        || raw.starts_with('.')
        || raw.ends_with('.')
        || raw.contains("..")
        || raw.chars().any(|ch| {
            ch.is_control()
                || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        })
    {
        return Err(snapshot::INVALID_DATA);
    }
    let stem = raw.split('.').next().unwrap_or("");
    if stem.is_empty()
        || RESERVED_WIN_STEMS
            .iter()
            .any(|reserved| stem.eq_ignore_ascii_case(reserved))
    {
        return Err(snapshot::INVALID_DATA);
    }
    let (_, ext_raw) = raw.rsplit_once('.').ok_or(snapshot::INVALID_DATA)?;
    let ext = if ext_raw.eq_ignore_ascii_case("pdf") {
        ExportExt::Pdf
    } else if ext_raw.eq_ignore_ascii_case("jpg") || ext_raw.eq_ignore_ascii_case("jpeg") {
        ExportExt::Jpeg
    } else if ext_raw.eq_ignore_ascii_case("zip") {
        ExportExt::Zip
    } else if ext_raw.eq_ignore_ascii_case("xlsx") {
        ExportExt::Xlsx
    } else if ext_raw.eq_ignore_ascii_case("csv") {
        ExportExt::Csv
    } else if ext_raw.eq_ignore_ascii_case("json") {
        ExportExt::Json
    } else {
        return Err(snapshot::INVALID_DATA);
    };
    Ok((raw, ext))
}

fn validate_export_bytes(ext: ExportExt, bytes: &[u8]) -> Result<(), &'static str> {
    if bytes.is_empty() || bytes.len() > MAX_EXPORT_BYTES {
        return Err(snapshot::INVALID_DATA);
    }
    let valid = match ext {
        ExportExt::Pdf => {
            let tail_start = bytes.len().saturating_sub(64);
            bytes.starts_with(b"%PDF-1.")
                && bytes[tail_start..].windows(5).any(|w| w == b"%%EOF")
        }
        ExportExt::Jpeg => bytes.len() >= 4 && bytes.starts_with(&[0xFF, 0xD8, 0xFF]),
        ExportExt::Zip | ExportExt::Xlsx => bytes.len() >= 22 && bytes.starts_with(b"PK\x03\x04"),
        ExportExt::Csv | ExportExt::Json => std::str::from_utf8(bytes).is_ok(),
    };
    if !valid {
        return Err(snapshot::INVALID_DATA);
    }
    Ok(())
}

pub fn write_managed_export(
    root: &Path,
    subfolder: &str,
    file_name: &str,
    bytes_b64: &str,
) -> Result<SavedExportInfo, &'static str> {
    if !ALLOWED_SUBFOLDERS.contains(&subfolder) {
        return Err(snapshot::INVALID_DATA);
    }
    let (clean_name, ext) = validate_export_file_name(file_name)?;
    let trimmed_b64 = bytes_b64.trim();
    if trimmed_b64.is_empty() || trimmed_b64.len() > MAX_EXPORT_B64_LEN {
        return Err(snapshot::INVALID_DATA);
    }
    let bytes = STANDARD.decode(trimmed_b64).map_err(|_| snapshot::INVALID_DATA)?;
    validate_export_bytes(ext, &bytes)?;

    media::directory(root).map_err(|_| EXPORT_WRITE_ERROR)?;
    let exports_dir = root.join("exports");
    media::directory(&exports_dir).map_err(|_| EXPORT_WRITE_ERROR)?;
    let target_dir = exports_dir.join(subfolder);
    media::directory(&target_dir).map_err(|_| EXPORT_WRITE_ERROR)?;

    let target_file = target_dir.join(clean_name);
    match fs::symlink_metadata(&target_file) {
        Ok(meta) if meta.is_file() && !media::is_redirected(&meta) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        _ => return Err(EXPORT_WRITE_ERROR),
    }

    let mut temp = NamedTempFile::new_in(&target_dir).map_err(|_| EXPORT_WRITE_ERROR)?;
    temp.write_all(&bytes).map_err(|_| EXPORT_WRITE_ERROR)?;
    temp.as_file().sync_all().map_err(|_| EXPORT_WRITE_ERROR)?;
    temp.persist(&target_file).map_err(|_| EXPORT_WRITE_ERROR)?;

    Ok(SavedExportInfo {
        relative_path: format!("exports/{subfolder}/{clean_name}"),
        byte_length: bytes.len(),
    })
}

/// JPG ve rapor dosyalarını `.zip` paketlemeden doğrudan `exports/<subfolder>/<folder_name>/` klasörüne yazar.
pub fn write_managed_export_in_folder(
    root: &Path,
    subfolder: &str,
    folder_name: &str,
    relative_path: &str,
    bytes_b64: &str,
) -> Result<SavedExportInfo, &'static str> {
    if !ALLOWED_SUBFOLDERS.contains(&subfolder) {
        return Err(snapshot::INVALID_DATA);
    }
    let clean_folder = validate_dir_segment(folder_name, 110)?;
    let parts: Vec<&str> = relative_path.split('/').collect();
    if parts.is_empty() || parts.len() > 2 {
        return Err(snapshot::INVALID_DATA);
    }
    let (nested_dir, raw_file) = if parts.len() == 2 {
        (Some(validate_dir_segment(parts[0], 72)?), parts[1])
    } else {
        (None, parts[0])
    };
    let (clean_file, ext) = validate_export_file_name(raw_file)?;
    if !matches!(ext, ExportExt::Jpeg | ExportExt::Json | ExportExt::Csv) {
        return Err(snapshot::INVALID_DATA);
    }
    let trimmed_b64 = bytes_b64.trim();
    if trimmed_b64.is_empty() || trimmed_b64.len() > MAX_EXPORT_B64_LEN {
        return Err(snapshot::INVALID_DATA);
    }
    let bytes = STANDARD.decode(trimmed_b64).map_err(|_| snapshot::INVALID_DATA)?;
    validate_export_bytes(ext, &bytes)?;

    media::directory(root).map_err(|_| EXPORT_WRITE_ERROR)?;
    let exports_dir = root.join("exports");
    media::directory(&exports_dir).map_err(|_| EXPORT_WRITE_ERROR)?;
    let sub_dir = exports_dir.join(subfolder);
    media::directory(&sub_dir).map_err(|_| EXPORT_WRITE_ERROR)?;
    let bundle_dir = sub_dir.join(clean_folder);
    media::directory(&bundle_dir).map_err(|_| EXPORT_WRITE_ERROR)?;
    let target_dir = if let Some(branch) = nested_dir {
        let dir = bundle_dir.join(branch);
        media::directory(&dir).map_err(|_| EXPORT_WRITE_ERROR)?;
        dir
    } else {
        bundle_dir
    };

    let target_file = target_dir.join(clean_file);
    match fs::symlink_metadata(&target_file) {
        Ok(meta) if meta.is_file() && !media::is_redirected(&meta) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        _ => return Err(EXPORT_WRITE_ERROR),
    }

    let mut temp = NamedTempFile::new_in(&target_dir).map_err(|_| EXPORT_WRITE_ERROR)?;
    temp.write_all(&bytes).map_err(|_| EXPORT_WRITE_ERROR)?;
    temp.as_file().sync_all().map_err(|_| EXPORT_WRITE_ERROR)?;
    temp.persist(&target_file).map_err(|_| EXPORT_WRITE_ERROR)?;

    let rel_display = match nested_dir {
        Some(branch) => format!("exports/{subfolder}/{clean_folder}/{branch}/{clean_file}"),
        None => format!("exports/{subfolder}/{clean_folder}/{clean_file}"),
    };
    Ok(SavedExportInfo {
        relative_path: rel_display,
        byte_length: bytes.len(),
    })
}

pub fn open_managed_export_folder(root: &Path, subfolder: &str, folder_name: &str) -> Result<(), &'static str> {
    if !ALLOWED_SUBFOLDERS.contains(&subfolder) {
        return Err(snapshot::INVALID_DATA);
    }
    let clean_folder = validate_dir_segment(folder_name, 110)?;
    let target = root.join("exports").join(subfolder).join(clean_folder);
    let meta = fs::symlink_metadata(&target).map_err(|_| EXPORT_OPEN_ERROR)?;
    if !meta.is_dir() || media::is_redirected(&meta) {
        return Err(EXPORT_OPEN_ERROR);
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(&target)
            .spawn()
            .map(|_| ())
            .map_err(|_| EXPORT_OPEN_ERROR)?;
    }
    #[cfg(not(windows))]
    {
        let _ = target;
    }
    Ok(())
}

pub fn open_managed_directory(root: &Path, target: &str) -> Result<(), &'static str> {
    media::directory(root).map_err(|_| EXPORT_OPEN_ERROR)?;
    let dir = match target {
        "root" => {
            for sub in ["data", "media", "exports", "backups"] {
                media::directory(&root.join(sub)).map_err(|_| EXPORT_OPEN_ERROR)?;
            }
            root.to_path_buf()
        }
        "exports" => {
            let exports_dir = root.join("exports");
            media::directory(&exports_dir).map_err(|_| EXPORT_OPEN_ERROR)?;
            exports_dir
        }
        _ => return Err(snapshot::INVALID_DATA),
    };

    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(&dir)
            .spawn()
            .map(|_| ())
            .map_err(|_| EXPORT_OPEN_ERROR)?;
    }
    #[cfg(not(windows))]
    {
        let _ = dir;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::write_managed_export_in_folder;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use tempfile::tempdir;

    #[test]
    fn writes_nested_jpg_and_manifest_folder_and_rejects_traversal() {
        let dir = tempdir().unwrap();
        let jpg_b64 = STANDARD.encode([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0xFF, 0xD9]);
        let json_b64 = STANDARD.encode(br#"{"dpi":300}"#);

        let r1 = write_managed_export_in_folder(
            dir.path(), "biyometrik", "Ataturk_10x15_300dpi_jpg", "1-A/702_Zeynep.jpg", &jpg_b64,
        ).unwrap();
        assert_eq!(r1.relative_path, "exports/biyometrik/Ataturk_10x15_300dpi_jpg/1-A/702_Zeynep.jpg");
        assert!(dir.path().join("exports/biyometrik/Ataturk_10x15_300dpi_jpg/1-A/702_Zeynep.jpg").is_file());

        let r2 = write_managed_export_in_folder(
            dir.path(), "biyometrik", "Ataturk_10x15_300dpi_jpg", "_rapor/manifest.json", &json_b64,
        ).unwrap();
        assert!(r2.relative_path.ends_with("_rapor/manifest.json"));

        assert!(write_managed_export_in_folder(dir.path(), "biyometrik", "../escape", "a.jpg", &jpg_b64).is_err());
        assert!(write_managed_export_in_folder(dir.path(), "biyometrik", "ok_dir", "1-A/../evil.jpg", &jpg_b64).is_err());
        assert!(write_managed_export_in_folder(dir.path(), "biyometrik", "ok_dir", "a/b/c.jpg", &jpg_b64).is_err());
        assert!(write_managed_export_in_folder(dir.path(), "biyometrik", "ok_dir", "a.pdf", &jpg_b64).is_err());
    }
}
