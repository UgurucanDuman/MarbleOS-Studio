use crate::win32_ops;
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};

pub const APP_VERSION: &str = "1.0.0";
pub const APP_EXE_NAME: &str = "marbleos-studio.exe";
pub const SHORTCUT_NAME: &str = "MarbleOS Studio.lnk";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallOptions {
    pub install_dir: String,
    pub create_desktop_shortcut: bool,
    pub create_start_menu_shortcut: bool,
    pub auto_start: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgressEvent {
    pub percent: u8,
    pub phase: String,
    pub detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallOutcome {
    pub install_dir: String,
    pub exe_path: String,
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// Kurulum hedef klasörünü sistem dizinlerine, kök sürücülere ve yol kaçışına karşı doğrular.
pub fn validate_install_dir(raw: &str) -> Result<PathBuf, &'static str> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.encode_utf16().count() > 200 {
        return Err("Geçerli bir kurulum klasörü seçin (en fazla 200 karakter).");
    }
    if trimmed.chars().any(|c| c.is_control() || matches!(c, '*' | '?' | '"' | '<' | '>' | '|')) {
        return Err("Kurulum yolu geçersiz karakter içeriyor.");
    }
    if trimmed.starts_with("\\\\") || trimmed.starts_with("//") {
        return Err("Ağ paylaşımı (UNC) yerine yerel bir klasör seçin.");
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("Kurulum yolu tam (mutlak) bir yerel klasör olmalıdır.");
    }
    let mut normal_depth = 0usize;
    for comp in path.components() {
        match comp {
            Component::ParentDir | Component::CurDir => {
                return Err("Kurulum yolu göreceli (..) segment içeremez.");
            }
            Component::Normal(_) => normal_depth += 1,
            _ => {}
        }
    }
    if normal_depth < 1 {
        return Err("Doğrudan sürücü köküne (örn. C:\\) kurulum yapılamaz; bir alt klasör seçin.");
    }
    let lower = trimmed.replace('/', "\\").to_ascii_lowercase();
    for forbidden in ["\\windows", "\\system32", "\\syswow64", "\\programdata\\microsoft"] {
        if lower.contains(forbidden) {
            return Err("Windows sistem klasörlerine kurulum yapılamaz.");
        }
    }
    if let Ok(meta) = fs::symlink_metadata(&path) {
        if meta.file_type().is_symlink() || !meta.is_dir() {
            return Err("Seçilen hedef geçerli bir klasör değil.");
        }
    }
    Ok(path)
}

pub fn decompress_and_verify_payload(
    gz_bytes: &[u8],
    expected_sha256: &str,
) -> Result<Vec<u8>, &'static str> {
    let mut decoder = GzDecoder::new(gz_bytes);
    let mut out = Vec::new();
    decoder
        .read_to_end(&mut out)
        .map_err(|_| "Kurulum paketi açılamadı; dosya bozulmuş olabilir.")?;
    let actual = hex_lower(&Sha256::digest(&out));
    if actual != expected_sha256 {
        return Err("Kurulum paketi SHA-256 bütünlük doğrulamasından geçemedi.");
    }
    Ok(out)
}

pub fn default_install_dir() -> PathBuf {
    win32_ops::local_app_data_dir()
        .unwrap_or_else(|| PathBuf::from("C:\\MarbleOS"))
        .join("Programs")
        .join("MarbleOS Studio")
}

pub fn user_data_dir() -> PathBuf {
    win32_ops::local_app_data_dir()
        .unwrap_or_else(|| PathBuf::from("C:\\MarbleOS"))
        .join("MarbleOS-Studio")
}

fn write_atomic(target: &Path, bytes: &[u8]) -> Result<(), &'static str> {
    let tmp = target.with_extension("tmp");
    let mut f = fs::File::create(&tmp).map_err(|_| "Kurulum dosyası yazılamadı. Klasör iznini kontrol edin.")?;
    f.write_all(bytes).map_err(|_| "Kurulum dosyası yazılamadı; disk alanını kontrol edin.")?;
    f.sync_all().map_err(|_| "Kurulum dosyası diske kaydedilemedi.")?;
    drop(f);
    if target.exists() {
        let _ = fs::remove_file(target);
    }
    fs::rename(&tmp, target).map_err(|_| {
        let _ = fs::remove_file(&tmp);
        "Uygulama dosyası güncellenemedi; açık olan MarbleOS Studio penceresini kapatıp tekrar deneyin."
    })
}

pub fn execute_install(
    options: InstallOptions,
    payload_gz: &[u8],
    expected_sha256: &str,
    mut report: impl FnMut(u8, &str, &str),
) -> Result<InstallOutcome, &'static str> {
    let install_dir = validate_install_dir(&options.install_dir)?;

    report(12, "Çalışan uygulama denetleniyor", "Açık MarbleOS Studio oturumu varsa güvenle kapatılıyor…");
    win32_ops::terminate_running_app();

    report(28, "Kurulum klasörü hazırlanıyor", &install_dir.to_string_lossy());
    fs::create_dir_all(&install_dir).map_err(|_| "Kurulum klasörü oluşturulamadı.")?;

    report(52, "MarbleOS Studio çıkarılıyor", "Uygulama çekirdeği açılıyor ve SHA-256 ile doğrulanıyor…");
    let exe_bytes = decompress_and_verify_payload(payload_gz, expected_sha256)?;
    let exe_path = install_dir.join(APP_EXE_NAME);
    write_atomic(&exe_path, &exe_bytes)?;

    report(72, "Kaldırma yardımcısı yapılandırılıyor", "Windows Ayarlar → Uygulamalar kaldırma desteği ekleniyor…");
    if let Ok(self_exe) = std::env::current_exe() {
        let uninst_path = install_dir.join("uninstall.exe");
        if self_exe != uninst_path {
            let _ = fs::copy(&self_exe, &uninst_path);
        }
    }

    report(88, "Kısayollar ve Windows kaydı yazılıyor", "Seçili modüller ve kısayollar oluşturuluyor…");
    if let Some(desktop) = win32_ops::desktop_dir() {
        let lnk = desktop.join(SHORTCUT_NAME);
        if options.create_desktop_shortcut {
            win32_ops::create_shortcut(&exe_path, &install_dir, &lnk, "MarbleOS Studio — Okul Fotoğrafçılığı & 300 DPI Baskı")?;
        } else {
            let _ = fs::remove_file(&lnk);
        }
    }
    if let Some(programs) = win32_ops::start_programs_dir() {
        let lnk = programs.join(SHORTCUT_NAME);
        if options.create_start_menu_shortcut {
            win32_ops::create_shortcut(&exe_path, &install_dir, &lnk, "MarbleOS Studio — Okul Fotoğrafçılığı & 300 DPI Baskı")?;
        } else {
            let _ = fs::remove_file(&lnk);
        }
    }
    win32_ops::set_autorun_entry(options.auto_start.then_some(exe_path.as_path()))?;

    let estimated_kb = ((exe_bytes.len() as u64) / 1024 + 4_096).min(u32::MAX as u64) as u32;
    win32_ops::register_uninstall_entry(&install_dir, APP_VERSION, estimated_kb)?;

    report(100, "Kurulum doğrulandı", "MarbleOS Studio kullanıma hazır.");
    Ok(InstallOutcome {
        install_dir: install_dir.to_string_lossy().into_owned(),
        exe_path: exe_path.to_string_lossy().into_owned(),
    })
}

pub fn execute_uninstall(mut report: impl FnMut(u8, &str, &str)) -> Result<(), &'static str> {
    report(18, "Çalışan uygulama kapatılıyor", "Açık MarbleOS Studio oturumları sonlandırılıyor…");
    win32_ops::terminate_running_app();

    let install_dir = win32_ops::read_existing_install_dir()
        .or_else(|| std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)))
        .ok_or("Kurulum klasörü tespit edilemedi.")?;

    report(48, "Kısayollar ve kayıtlar temizleniyor", "Masaüstü, Başlat Menüsü ve Windows kaydı kaldırılıyor…");
    if let Some(desktop) = win32_ops::desktop_dir() {
        let _ = fs::remove_file(desktop.join(SHORTCUT_NAME));
    }
    if let Some(programs) = win32_ops::start_programs_dir() {
        let _ = fs::remove_file(programs.join(SHORTCUT_NAME));
    }
    let _ = win32_ops::set_autorun_entry(None);
    win32_ops::remove_uninstall_entry();

    report(80, "Uygulama dosyaları kaldırılıyor", "Yerel okul ve fotoğraf verileriniz (%LOCALAPPDATA%\\MarbleOS-Studio) korunur.");
    let exe_path = install_dir.join(APP_EXE_NAME);
    if exe_path.exists() {
        let _ = fs::remove_file(&exe_path);
    }
    win32_ops::schedule_self_delete(&install_dir);

    report(100, "Kaldırma tamamlandı", "MarbleOS Studio bilgisayardan temiz şekilde kaldırıldı.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{decompress_and_verify_payload, validate_install_dir};
    use flate2::{write::GzEncoder, Compression};
    use sha2::{Digest, Sha256};
    use std::io::Write;

    #[test]
    fn validates_install_paths_and_rejects_system_or_root_dirs() {
        assert!(validate_install_dir("C:\\Users\\Test\\AppData\\Local\\Programs\\MarbleOS Studio").is_ok());
        assert!(validate_install_dir("C:\\").is_err());
        assert!(validate_install_dir("C:\\Windows\\System32\\MarbleOS").is_err());
        assert!(validate_install_dir("\\\\server\\share\\MarbleOS").is_err());
        assert!(validate_install_dir("relative\\dir").is_err());
        assert!(validate_install_dir("C:\\Users\\Test\\..\\Bad").is_err());
    }

    #[test]
    fn decompresses_and_verifies_sha256_integrity() {
        let raw = b"MZ_FAKE_MARBLEOS_BINARY_PAYLOAD";
        let mut enc = GzEncoder::new(Vec::new(), Compression::default());
        enc.write_all(raw).unwrap();
        let gz = enc.finish().unwrap();
        let digest = Sha256::digest(raw);
        let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();

        assert_eq!(decompress_and_verify_payload(&gz, &hex).unwrap(), raw);
        assert!(decompress_and_verify_payload(&gz, "0000").is_err());
    }
}
