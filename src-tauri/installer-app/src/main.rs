#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod installer_engine;
mod win32_ops;

include!(concat!(env!("OUT_DIR"), "/payload_meta.rs"));

use installer_engine::{
    default_install_dir, execute_install, execute_uninstall, user_data_dir, validate_install_dir,
    InstallOptions, InstallOutcome, InstallProgressEvent, APP_VERSION,
};
use serde::Serialize;
use tauri::{Emitter, Manager};

const LICENSE_TEXT: &str = include_str!("../../installer/LICENSE.txt");

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallerInitPayload {
    version: &'static str,
    mode: &'static str,
    default_install_dir: String,
    existing_install_dir: Option<String>,
    data_dir: String,
    payload_bytes: u64,
    free_disk_bytes: u64,
    license_text: &'static str,
    is_upgrade: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedDirResult {
    path: String,
    free_disk_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirCheckResult {
    valid: bool,
    error: Option<String>,
    free_disk_bytes: u64,
}

fn is_uninstall_mode() -> bool {
    std::env::args().any(|a| a.eq_ignore_ascii_case("--uninstall"))
}

#[tauri::command]
fn installer_init() -> InstallerInitPayload {
    let existing = win32_ops::read_existing_install_dir();
    let default_dir = existing.clone().unwrap_or_else(default_install_dir);
    let free = win32_ops::free_disk_bytes(&default_dir);
    InstallerInitPayload {
        version: APP_VERSION,
        mode: if is_uninstall_mode() { "uninstall" } else { "install" },
        default_install_dir: default_dir.to_string_lossy().into_owned(),
        existing_install_dir: existing.as_ref().map(|p| p.to_string_lossy().into_owned()),
        data_dir: user_data_dir().to_string_lossy().into_owned(),
        payload_bytes: PAYLOAD_RAW_BYTES,
        free_disk_bytes: free,
        license_text: LICENSE_TEXT,
        is_upgrade: existing.is_some(),
    }
}

#[tauri::command]
async fn installer_pick_dir(window: tauri::Window) -> Result<Option<PickedDirResult>, &'static str> {
    #[cfg(windows)]
    let owner_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
    #[cfg(not(windows))]
    let owner_hwnd = { let _ = window; 0isize };

    tauri::async_runtime::spawn_blocking(move || {
        let Some(chosen) = win32_ops::pick_install_folder(owner_hwnd)? else {
            return Ok(None);
        };
        let final_dir = if chosen
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.eq_ignore_ascii_case("MarbleOS Studio"))
        {
            chosen
        } else {
            chosen.join("MarbleOS Studio")
        };
        let validated = validate_install_dir(&final_dir.to_string_lossy())?;
        let free = win32_ops::free_disk_bytes(&validated);
        Ok(Some(PickedDirResult {
            path: validated.to_string_lossy().into_owned(),
            free_disk_bytes: free,
        }))
    })
    .await
    .map_err(|_| "Klasör seçici tamamlanamadı.")?
}

#[tauri::command]
fn installer_check_dir(path: String) -> DirCheckResult {
    match validate_install_dir(&path) {
        Ok(valid_path) => DirCheckResult {
            valid: true,
            error: None,
            free_disk_bytes: win32_ops::free_disk_bytes(&valid_path),
        },
        Err(msg) => DirCheckResult {
            valid: false,
            error: Some(msg.to_owned()),
            free_disk_bytes: 0,
        },
    }
}

#[tauri::command]
async fn installer_run_install(
    window: tauri::Window,
    options: InstallOptions,
) -> Result<InstallOutcome, &'static str> {
    let win = window.clone();
    tauri::async_runtime::spawn_blocking(move || {
        execute_install(options, PAYLOAD_GZ, PAYLOAD_SHA256, |percent, phase, detail| {
            let _ = win.emit(
                "installer-progress",
                InstallProgressEvent {
                    percent,
                    phase: phase.to_owned(),
                    detail: detail.to_owned(),
                },
            );
        })
    })
    .await
    .map_err(|_| "Kurulum işlemi beklenmedik şekilde sonlandı.")?
}

#[tauri::command]
async fn installer_run_uninstall(window: tauri::Window) -> Result<(), &'static str> {
    let win = window.clone();
    tauri::async_runtime::spawn_blocking(move || {
        execute_uninstall(|percent, phase, detail| {
            let _ = win.emit(
                "installer-progress",
                InstallProgressEvent {
                    percent,
                    phase: phase.to_owned(),
                    detail: detail.to_owned(),
                },
            );
        })
    })
    .await
    .map_err(|_| "Kaldırma işlemi tamamlanamadı.")?
}

#[tauri::command]
fn installer_launch_app(exe_path: String) -> Result<(), &'static str> {
    let p = std::path::PathBuf::from(exe_path.trim());
    let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if !file_name.eq_ignore_ascii_case("marbleos-studio.exe") || !p.is_file() {
        return Err("Başlatılacak uygulama dosyası bulunamadı.");
    }
    let dir = p.parent().ok_or("Uygulama klasörü bulunamadı.")?;
    std::process::Command::new(&p)
        .current_dir(dir)
        .spawn()
        .map(|_| ())
        .map_err(|_| "MarbleOS Studio başlatılamadı.")
}

fn main() {
    if !win32_ops::is_webview2_installed() {
        win32_ops::show_missing_webview2_box();
        return;
    }
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(windows)]
            if let Some(win) = app.get_webview_window("main") {
                if let Ok(hwnd) = win.hwnd() {
                    win32_ops::apply_win11_dark_frame(hwnd.0 as isize);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            installer_init,
            installer_pick_dir,
            installer_check_dir,
            installer_run_install,
            installer_run_uninstall,
            installer_launch_app
        ])
        .run(tauri::generate_context!())
        .expect("MarbleOS Studio Kurulumu başlatılamadı");
}
