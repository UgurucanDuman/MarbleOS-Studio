#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use marbleos_studio::{
    pick_photo_folder, DirectPrintRequest, GeneratedRecoveryKey, LicenseManager, LicenseStatus,
    LoadedWorkspace, PickedPhotoFolder, PrintedJobReceipt, SavedExportInfo, SelectedSchoolResult,
    StudioStorage, SystemPrinterInfo,
};
use tauri::{Manager, State};

async fn run_storage<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, &'static str> + Send + 'static,
) -> Result<T, &'static str> {
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|_| "Yerel veri işlemi tamamlanamadı.")?
}

#[tauri::command]
async fn studio_load(store: State<'_, StudioStorage>, license: State<'_, LicenseManager>) -> Result<LoadedWorkspace, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.load()).await
}

#[tauri::command]
async fn studio_commit(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    expected_revision: i64,
    snapshot_json: String,
    deleted_photo_ids: Option<Vec<String>>,
) -> Result<LoadedWorkspace, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || match deleted_photo_ids {
        Some(ids) => store.commit_with_deletions(expected_revision, &snapshot_json, &ids),
        None => store.commit(expected_revision, &snapshot_json),
    }).await
}

#[tauri::command]
async fn studio_select_school(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    expected_revision: i64,
    school_id: Option<String>,
) -> Result<SelectedSchoolResult, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.select_school(expected_revision, school_id.as_deref())).await
}

#[tauri::command]
async fn studio_photo_preview(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    photo_id: String,
) -> Result<String, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.preview(&photo_id)).await
}

#[tauri::command]
async fn studio_photo_original(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    photo_id: String,
    expected_hash: Option<String>,
) -> Result<String, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.original(&photo_id, expected_hash.as_deref())).await
}

#[tauri::command]
async fn studio_generate_recovery_key(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    confirm_rotate: bool,
) -> Result<GeneratedRecoveryKey, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.generate_recovery_key(confirm_rotate)).await
}

#[tauri::command]
async fn studio_unlock_with_recovery_key(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    recovery_key: String,
) -> Result<LoadedWorkspace, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.unlock_with_recovery_key(&recovery_key)).await
}

#[tauri::command]
async fn studio_save_export(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    subfolder: String,
    file_name: String,
    bytes_base64: String,
) -> Result<SavedExportInfo, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.save_export(&subfolder, &file_name, &bytes_base64)).await
}

#[tauri::command]
async fn studio_save_export_in_folder(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    subfolder: String,
    folder_name: String,
    relative_path: String,
    bytes_base64: String,
) -> Result<SavedExportInfo, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || {
        store.save_export_in_folder(&subfolder, &folder_name, &relative_path, &bytes_base64)
    })
    .await
}

#[tauri::command]
async fn studio_open_export_folder(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    subfolder: String,
    folder_name: String,
) -> Result<(), &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.open_export_folder(&subfolder, &folder_name)).await
}

#[tauri::command]
async fn studio_open_managed_dir(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    target: String,
) -> Result<(), &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.open_managed_dir(&target)).await
}

#[tauri::command]
async fn studio_pick_photo_folder(
    window: tauri::Window,
    license: State<'_, LicenseManager>,
) -> Result<Option<PickedPhotoFolder>, &'static str> {
    license.ensure()?;
    #[cfg(windows)]
    let owner_hwnd = window.hwnd().map(|h| h.0 as isize).unwrap_or(0);
    #[cfg(not(windows))]
    let owner_hwnd = {
        let _ = window;
        0isize
    };
    run_storage(move || pick_photo_folder(owner_hwnd)).await
}

#[tauri::command]
async fn studio_list_printers(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
) -> Result<Vec<SystemPrinterInfo>, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.list_printers()).await
}

#[tauri::command]
async fn studio_print_pages(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    request: DirectPrintRequest,
) -> Result<PrintedJobReceipt, &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.print_pages(request)).await
}

#[tauri::command]
async fn studio_load_personalization(
    store: State<'_, StudioStorage>,
) -> Result<Option<String>, &'static str> {
    let store = store.inner().clone();
    run_storage(move || store.load_personalization()).await
}

#[tauri::command]
async fn studio_save_personalization(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    state_json: String,
) -> Result<(), &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.save_personalization(&state_json)).await
}

#[tauri::command]
async fn studio_save_desktop_asset(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    asset_key: String,
    data_url: String,
) -> Result<(), &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.save_desktop_asset(&asset_key, &data_url)).await
}

#[tauri::command]
async fn studio_load_desktop_asset(
    store: State<'_, StudioStorage>,
    asset_key: String,
) -> Result<Option<String>, &'static str> {
    let store = store.inner().clone();
    run_storage(move || store.load_desktop_asset(&asset_key)).await
}

#[tauri::command]
async fn studio_delete_desktop_asset(
    store: State<'_, StudioStorage>,
    license: State<'_, LicenseManager>,
    asset_key: String,
) -> Result<(), &'static str> {
    license.ensure()?;
    let store = store.inner().clone();
    run_storage(move || store.delete_desktop_asset(&asset_key)).await
}

#[tauri::command]
fn studio_license_status(license: State<'_, LicenseManager>) -> LicenseStatus {
    license.status()
}

#[tauri::command]
async fn studio_license_activate(
    license: State<'_, LicenseManager>,
    product_key: String,
    activation_code: String,
) -> Result<LicenseStatus, &'static str> {
    license.activate(&product_key, &activation_code)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let root = app.path().local_data_dir()?.join("MarbleOS-Studio");
            app.manage(LicenseManager::new(root.clone()));
            app.manage(StudioStorage::new(root));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            studio_load,
            studio_commit,
            studio_select_school,
            studio_photo_preview,
            studio_photo_original,
            studio_generate_recovery_key,
            studio_unlock_with_recovery_key,
            studio_save_export,
            studio_save_export_in_folder,
            studio_open_export_folder,
            studio_open_managed_dir,
            studio_pick_photo_folder,
            studio_list_printers,
            studio_print_pages,
            studio_load_personalization,
            studio_save_personalization,
            studio_save_desktop_asset,
            studio_load_desktop_asset,
            studio_delete_desktop_asset,
            studio_license_status,
            studio_license_activate
        ])
        .run(tauri::generate_context!())
        .expect("MarbleOS Studio başlatılamadı");
}
