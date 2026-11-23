fn main() {
    #[cfg(feature = "desktop")]
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "studio_load",
                "studio_commit",
                "studio_select_school",
                "studio_photo_preview",
                "studio_photo_original",
                "studio_generate_recovery_key",
                "studio_unlock_with_recovery_key",
                "studio_save_export",
                "studio_save_export_in_folder",
                "studio_open_export_folder",
                "studio_open_managed_dir",
                "studio_pick_photo_folder",
                "studio_list_printers",
                "studio_print_pages",
                "studio_load_personalization",
                "studio_save_personalization",
                "studio_save_desktop_asset",
                "studio_load_desktop_asset",
                "studio_delete_desktop_asset",
                "studio_license_status",
                "studio_license_activate",
            ]),
        ),
    )
    .expect("Tauri application manifest");
}
