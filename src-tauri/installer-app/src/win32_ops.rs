//! Yerel Windows COM / Kayıt Defteri / DWM / Kısayol Yardımcıları (sıfır PowerShell, sıfır harici araç)

#[cfg(not(windows))]
use std::path::{Path, PathBuf};

#[cfg(windows)]
mod imp {
    use std::{
        ffi::c_void,
        path::{Path, PathBuf},
        ptr::{null, null_mut},
    };
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyW, RegDeleteTreeW, RegDeleteValueW, RegOpenKeyExW,
        RegQueryValueExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
        KEY_READ, REG_DWORD, REG_SZ,
    };

    const COINIT_APARTMENTTHREADED: u32 = 0x2;
    const COINIT_DISABLE_OLE1DDE: u32 = 0x4;
    const CLSCTX_INPROC_SERVER: u32 = 0x1;
    const FOS_PICKFOLDERS: u32 = 0x0000_0020;
    const FOS_FORCEFILESYSTEM: u32 = 0x0000_0040;
    const FOS_PATHMUSTEXIST: u32 = 0x0000_0800;
    const SIGDN_FILESYSPATH: u32 = 0x8005_8000;
    const HRESULT_CANCELLED: i32 = 0x8007_04C7u32 as i32;
    const DWMWA_USE_IMMERSIVE_DARK_MODE: u32 = 20;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_ROUND: u32 = 2;

    const UNINSTALL_SUBKEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MarbleOS Studio";
    const RUN_SUBKEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const RUN_VALUE_NAME: &str = "MarbleOS Studio";
    const WV2_CLIENT_GUID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

    #[repr(C)]
    struct Guid {
        data1: u32,
        data2: u16,
        data3: u16,
        data4: [u8; 8],
    }

    const CLSID_FILE_OPEN_DIALOG: Guid = Guid {
        data1: 0xDC1C_5A9C, data2: 0xE88A, data3: 0x4DDE,
        data4: [0xA5, 0xA1, 0x60, 0xF8, 0x2A, 0x20, 0xAE, 0xF7],
    };
    const IID_IFILE_DIALOG: Guid = Guid {
        data1: 0x42F8_5136, data2: 0xDB7E, data3: 0x439C,
        data4: [0x85, 0xF1, 0xE4, 0x07, 0x5D, 0x13, 0x5F, 0xC8],
    };
    const CLSID_SHELL_LINK: Guid = Guid {
        data1: 0x0002_1401, data2: 0x0000, data3: 0x0000,
        data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
    };
    const IID_ISHELL_LINK_W: Guid = Guid {
        data1: 0x0002_14F9, data2: 0x0000, data3: 0x0000,
        data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
    };
    const IID_IPERSIST_FILE: Guid = Guid {
        data1: 0x0000_010B, data2: 0x0000, data3: 0x0000,
        data4: [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
    };
    const FOLDERID_DESKTOP: Guid = Guid {
        data1: 0xB4BF_CC3A, data2: 0xDB2C, data3: 0x424C,
        data4: [0xB0, 0x29, 0x7F, 0xE9, 0x9A, 0x87, 0xC6, 0x41],
    };
    const FOLDERID_PROGRAMS: Guid = Guid {
        data1: 0xA77F_5D77, data2: 0x2E2B, data3: 0x44C3,
        data4: [0xA6, 0xA2, 0xAB, 0xA6, 0x01, 0x05, 0x4A, 0x51],
    };
    const FOLDERID_LOCAL_APP_DATA: Guid = Guid {
        data1: 0xF1B3_2785, data2: 0x6FBA, data3: 0x4FCF,
        data4: [0x9D, 0x55, 0x7B, 0x8E, 0x7F, 0x15, 0x70, 0x91],
    };

    #[repr(C)]
    struct ComObject {
        vtable: *const *const c_void,
    }

    #[link(name = "ole32")]
    extern "system" {
        fn CoInitializeEx(pv_reserved: *const c_void, dw_co_init: u32) -> i32;
        fn CoUninitialize();
        fn CoCreateInstance(
            rclsid: *const Guid,
            p_unk_outer: *mut c_void,
            dw_cls_context: u32,
            riid: *const Guid,
            ppv: *mut *mut c_void,
        ) -> i32;
        fn CoTaskMemFree(pv: *mut c_void);
    }

    #[link(name = "shell32")]
    extern "system" {
        fn SHGetKnownFolderPath(
            rfid: *const Guid,
            dw_flags: u32,
            h_token: *mut c_void,
            ppsz_path: *mut *mut u16,
        ) -> i32;
    }

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(hwnd: isize, attr: u32, pv: *const c_void, cb: u32) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            dir_name: *const u16,
            free_avail: *mut u64,
            total_bytes: *mut u64,
            total_free: *mut u64,
        ) -> i32;
    }

    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, utype: u32) -> i32;
    }

    struct ComGuard(bool);
    impl Drop for ComGuard {
        fn drop(&mut self) {
            if self.0 {
                unsafe { CoUninitialize() };
            }
        }
    }

    struct UnknownGuard(*mut ComObject);
    impl Drop for UnknownGuard {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    let release: extern "system" fn(*mut ComObject) -> u32 =
                        std::mem::transmute(*(*self.0).vtable.add(2));
                    let _ = release(self.0);
                }
            }
        }
    }

    fn to_wide_z(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn wide_ptr_to_string(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0usize;
        while len < 32_768 && *ptr.add(len) != 0 {
            len += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
    }

    fn known_folder(id: &Guid) -> Option<PathBuf> {
        unsafe {
            let mut ptr: *mut u16 = null_mut();
            if SHGetKnownFolderPath(id, 0, null_mut(), &mut ptr) < 0 || ptr.is_null() {
                return None;
            }
            let text = wide_ptr_to_string(ptr);
            CoTaskMemFree(ptr as *mut c_void);
            (!text.is_empty()).then(|| PathBuf::from(text))
        }
    }

    pub fn desktop_dir() -> Option<PathBuf> { known_folder(&FOLDERID_DESKTOP) }
    pub fn start_programs_dir() -> Option<PathBuf> { known_folder(&FOLDERID_PROGRAMS) }
    pub fn local_app_data_dir() -> Option<PathBuf> { known_folder(&FOLDERID_LOCAL_APP_DATA) }

    pub fn apply_win11_dark_frame(hwnd: isize) {
        if hwnd == 0 { return; }
        unsafe {
            let dark: u32 = 1;
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, &dark as *const u32 as *const c_void, 4);
            let corner: u32 = DWMWCP_ROUND;
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, &corner as *const u32 as *const c_void, 4);
        }
    }

    fn query_reg_sz(root: HKEY, subkey: &str, value_name: &str) -> Option<String> {
        unsafe {
            let sub_w = to_wide_z(subkey);
            let mut hkey: HKEY = null_mut();
            if RegOpenKeyExW(root, sub_w.as_ptr(), 0, KEY_READ, &mut hkey) != 0 {
                return None;
            }
            let val_w = to_wide_z(value_name);
            let mut byte_len: u32 = 0;
            let mut reg_type: u32 = 0;
            let ok1 = RegQueryValueExW(hkey, val_w.as_ptr(), null(), &mut reg_type, null_mut(), &mut byte_len);
            if ok1 != 0 || reg_type != REG_SZ || byte_len < 2 || byte_len > 65_536 {
                let _ = RegCloseKey(hkey);
                return None;
            }
            let mut buf = vec![0u16; (byte_len as usize).div_ceil(2)];
            let ok2 = RegQueryValueExW(hkey, val_w.as_ptr(), null(), &mut reg_type, buf.as_mut_ptr() as *mut u8, &mut byte_len);
            let _ = RegCloseKey(hkey);
            if ok2 != 0 { return None; }
            let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            let s = String::from_utf16_lossy(&buf[..end]).trim().to_owned();
            (!s.is_empty()).then_some(s)
        }
    }

    pub fn is_webview2_installed() -> bool {
        let paths = [
            (HKEY_LOCAL_MACHINE, format!("SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{WV2_CLIENT_GUID}")),
            (HKEY_LOCAL_MACHINE, format!("SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{WV2_CLIENT_GUID}")),
            (HKEY_CURRENT_USER, format!("Software\\Microsoft\\EdgeUpdate\\Clients\\{WV2_CLIENT_GUID}")),
        ];
        paths.iter().any(|(root, key)| {
            query_reg_sz(*root, key, "pv").is_some_and(|pv| pv != "0.0.0.0")
        })
    }

    pub fn show_missing_webview2_box() {
        let title = to_wide_z("MarbleOS Studio Kurulumu");
        let msg = to_wide_z(
            "Bu bilgisayarda Microsoft Edge WebView2 çalışma ortamı bulunamadı.\n\n\
             Lütfen Windows Güncelleştirmelerini tamamlayın veya Microsoft Edge WebView2 Runtime paketini kurup kurulumu yeniden başlatın.",
        );
        unsafe {
            let _ = MessageBoxW(0, msg.as_ptr(), title.as_ptr(), 0x0000_0010);
        }
    }

    pub fn read_existing_install_dir() -> Option<PathBuf> {
        query_reg_sz(HKEY_CURRENT_USER, UNINSTALL_SUBKEY, "InstallLocation").map(PathBuf::from)
    }

    pub fn free_disk_bytes(path: &Path) -> u64 {
        let mut probe = path.to_path_buf();
        while !probe.exists() {
            if !probe.pop() { break; }
        }
        let target = if probe.as_os_str().is_empty() {
            PathBuf::from("C:\\")
        } else {
            probe
        };
        let wide = to_wide_z(&target.to_string_lossy());
        let mut free_avail: u64 = 0;
        let mut total: u64 = 0;
        let mut total_free: u64 = 0;
        unsafe {
            if GetDiskFreeSpaceExW(wide.as_ptr(), &mut free_avail, &mut total, &mut total_free) != 0 {
                free_avail
            } else {
                0
            }
        }
    }

    pub fn pick_install_folder(owner_hwnd: isize) -> Result<Option<PathBuf>, &'static str> {
        std::thread::spawn(move || unsafe {
            let hr_init = CoInitializeEx(null(), COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            let _com = ComGuard(hr_init >= 0);

            let mut raw_dialog: *mut c_void = null_mut();
            if CoCreateInstance(&CLSID_FILE_OPEN_DIALOG, null_mut(), CLSCTX_INPROC_SERVER, &IID_IFILE_DIALOG, &mut raw_dialog) < 0 || raw_dialog.is_null() {
                return Err("Windows klasör seçici açılamadı.");
            }
            let dialog = UnknownGuard(raw_dialog as *mut ComObject);
            let vtbl = (*dialog.0).vtable;
            let get_options: extern "system" fn(*mut ComObject, *mut u32) -> i32 = std::mem::transmute(*vtbl.add(10));
            let set_options: extern "system" fn(*mut ComObject, u32) -> i32 = std::mem::transmute(*vtbl.add(9));
            let set_title: extern "system" fn(*mut ComObject, *const u16) -> i32 = std::mem::transmute(*vtbl.add(17));
            let set_ok: extern "system" fn(*mut ComObject, *const u16) -> i32 = std::mem::transmute(*vtbl.add(18));
            let show: extern "system" fn(*mut ComObject, isize) -> i32 = std::mem::transmute(*vtbl.add(3));
            let get_result: extern "system" fn(*mut ComObject, *mut *mut ComObject) -> i32 = std::mem::transmute(*vtbl.add(20));

            let mut opts: u32 = 0;
            if get_options(dialog.0, &mut opts) >= 0 {
                let _ = set_options(dialog.0, opts | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
            }
            let title_w = to_wide_z("MarbleOS Studio Kurulum Klasörünü Seç");
            let ok_w = to_wide_z("Bu Klasörü Seç");
            let _ = set_title(dialog.0, title_w.as_ptr());
            let _ = set_ok(dialog.0, ok_w.as_ptr());

            let hr = show(dialog.0, owner_hwnd);
            if hr == HRESULT_CANCELLED { return Ok(None); }
            if hr < 0 { return Err("Klasör seçimi tamamlanamadı."); }

            let mut raw_item: *mut ComObject = null_mut();
            if get_result(dialog.0, &mut raw_item) < 0 || raw_item.is_null() {
                return Err("Seçilen klasör okunamadı.");
            }
            let item = UnknownGuard(raw_item);
            let get_name: extern "system" fn(*mut ComObject, u32, *mut *mut u16) -> i32 =
                std::mem::transmute(*(*item.0).vtable.add(5));
            let mut ptr: *mut u16 = null_mut();
            if get_name(item.0, SIGDN_FILESYSPATH, &mut ptr) < 0 || ptr.is_null() {
                return Err("Seçilen klasör yolu okunamadı.");
            }
            let text = wide_ptr_to_string(ptr);
            CoTaskMemFree(ptr as *mut c_void);
            Ok((!text.trim().is_empty()).then(|| PathBuf::from(text)))
        })
        .join()
        .map_err(|_| "Klasör seçici beklenmedik biçimde kapandı.")?
    }

    pub fn create_shortcut(
        target_exe: &Path,
        working_dir: &Path,
        shortcut_path: &Path,
        description: &str,
    ) -> Result<(), &'static str> {
        let exe_s = target_exe.to_string_lossy().into_owned();
        let dir_s = working_dir.to_string_lossy().into_owned();
        let lnk_s = shortcut_path.to_string_lossy().into_owned();
        let desc_s = description.to_owned();

        std::thread::spawn(move || unsafe {
            let hr_init = CoInitializeEx(null(), COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            let _com = ComGuard(hr_init >= 0);

            let mut raw_link: *mut c_void = null_mut();
            if CoCreateInstance(&CLSID_SHELL_LINK, null_mut(), CLSCTX_INPROC_SERVER, &IID_ISHELL_LINK_W, &mut raw_link) < 0 || raw_link.is_null() {
                return Err("Windows kısayol servisi başlatılamadı.");
            }
            let link = UnknownGuard(raw_link as *mut ComObject);
            let vtbl = (*link.0).vtable;
            let qi: extern "system" fn(*mut ComObject, *const Guid, *mut *mut c_void) -> i32 = std::mem::transmute(*vtbl.add(0));
            let set_desc: extern "system" fn(*mut ComObject, *const u16) -> i32 = std::mem::transmute(*vtbl.add(7));
            let set_dir: extern "system" fn(*mut ComObject, *const u16) -> i32 = std::mem::transmute(*vtbl.add(9));
            let set_icon: extern "system" fn(*mut ComObject, *const u16, i32) -> i32 = std::mem::transmute(*vtbl.add(17));
            let set_path: extern "system" fn(*mut ComObject, *const u16) -> i32 = std::mem::transmute(*vtbl.add(20));

            let exe_w = to_wide_z(&exe_s);
            let dir_w = to_wide_z(&dir_s);
            let desc_w = to_wide_z(&desc_s);
            if set_path(link.0, exe_w.as_ptr()) < 0
                || set_dir(link.0, dir_w.as_ptr()) < 0
                || set_desc(link.0, desc_w.as_ptr()) < 0
                || set_icon(link.0, exe_w.as_ptr(), 0) < 0
            {
                return Err("Kısayol özellikleri ayarlanamadı.");
            }

            let mut raw_pf: *mut c_void = null_mut();
            if qi(link.0, &IID_IPERSIST_FILE, &mut raw_pf) < 0 || raw_pf.is_null() {
                return Err("Kısayol kayıt arayüzü açılamadı.");
            }
            let pf = UnknownGuard(raw_pf as *mut ComObject);
            let save: extern "system" fn(*mut ComObject, *const u16, i32) -> i32 =
                std::mem::transmute(*(*pf.0).vtable.add(6));
            let lnk_w = to_wide_z(&lnk_s);
            if save(pf.0, lnk_w.as_ptr(), 1) < 0 {
                return Err("Kısayol dosyası kaydedilemedi.");
            }
            Ok(())
        })
        .join()
        .map_err(|_| "Kısayol oluşturulamadı.")?
    }

    unsafe fn set_reg_sz(hkey: HKEY, name: &str, value: &str) -> Result<(), &'static str> {
        let n_w = to_wide_z(name);
        let v_w = to_wide_z(value);
        let ok = RegSetValueExW(hkey, n_w.as_ptr(), 0, REG_SZ, v_w.as_ptr() as *const u8, (v_w.len() * 2) as u32);
        if ok == 0 { Ok(()) } else { Err("Kayıt defteri bilgisi yazılamadı.") }
    }

    unsafe fn set_reg_dword(hkey: HKEY, name: &str, value: u32) -> Result<(), &'static str> {
        let n_w = to_wide_z(name);
        let ok = RegSetValueExW(hkey, n_w.as_ptr(), 0, REG_DWORD, &value as *const u32 as *const u8, 4);
        if ok == 0 { Ok(()) } else { Err("Kayıt defteri sayısal değeri yazılamadı.") }
    }

    pub fn register_uninstall_entry(install_dir: &Path, version: &str, estimated_kb: u32) -> Result<(), &'static str> {
        unsafe {
            let sub_w = to_wide_z(UNINSTALL_SUBKEY);
            let mut hkey: HKEY = null_mut();
            if RegCreateKeyW(HKEY_CURRENT_USER, sub_w.as_ptr(), &mut hkey) != 0 {
                return Err("Windows programlar kaydı oluşturulamadı.");
            }
            let exe = install_dir.join("marbleos-studio.exe");
            let uninst = install_dir.join("uninstall.exe");
            let res = (|| {
                set_reg_sz(hkey, "DisplayName", "MarbleOS Studio")?;
                set_reg_sz(hkey, "DisplayVersion", version)?;
                set_reg_sz(hkey, "Publisher", "MarbleOS")?;
                set_reg_sz(hkey, "InstallLocation", &install_dir.to_string_lossy())?;
                set_reg_sz(hkey, "DisplayIcon", &format!("{},0", exe.to_string_lossy()))?;
                set_reg_sz(hkey, "UninstallString", &format!("\"{}\" --uninstall", uninst.to_string_lossy()))?;
                set_reg_sz(hkey, "QuietUninstallString", &format!("\"{}\" --uninstall", uninst.to_string_lossy()))?;
                set_reg_dword(hkey, "EstimatedSize", estimated_kb)?;
                set_reg_dword(hkey, "NoModify", 1)?;
                set_reg_dword(hkey, "NoRepair", 1)?;
                Ok(())
            })();
            let _ = RegCloseKey(hkey);
            res
        }
    }

    pub fn remove_uninstall_entry() {
        unsafe {
            let sub_w = to_wide_z(UNINSTALL_SUBKEY);
            let _ = RegDeleteTreeW(HKEY_CURRENT_USER, sub_w.as_ptr());
        }
    }

    pub fn set_autorun_entry(exe_path: Option<&Path>) -> Result<(), &'static str> {
        unsafe {
            let sub_w = to_wide_z(RUN_SUBKEY);
            let mut hkey: HKEY = null_mut();
            if RegCreateKeyW(HKEY_CURRENT_USER, sub_w.as_ptr(), &mut hkey) != 0 {
                return Err("Otomatik başlatma kaydı açılamadı.");
            }
            let res = match exe_path {
                Some(path) => set_reg_sz(hkey, RUN_VALUE_NAME, &format!("\"{}\"", path.to_string_lossy())),
                None => {
                    let n_w = to_wide_z(RUN_VALUE_NAME);
                    let _ = RegDeleteValueW(hkey, n_w.as_ptr());
                    Ok(())
                }
            };
            let _ = RegCloseKey(hkey);
            res
        }
    }

    pub fn terminate_running_app() {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = std::process::Command::new("taskkill.exe")
            .args(["/IM", "marbleos-studio.exe", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        std::thread::sleep(std::time::Duration::from_millis(240));
    }

    pub fn schedule_self_delete(install_dir: &Path) {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let dir = install_dir.to_string_lossy();
        let uninst = install_dir.join("uninstall.exe");
        let cmd = format!(
            "ping 127.0.0.1 -n 3 >nul & del /f /q \"{}\" >nul 2>&1 & rmdir \"{}\" >nul 2>&1",
            uninst.to_string_lossy(),
            dir
        );
        let _ = std::process::Command::new("cmd.exe")
            .args(["/C", &cmd])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
}

#[cfg(windows)]
pub use imp::*;

#[cfg(not(windows))]
pub fn desktop_dir() -> Option<PathBuf> { None }
#[cfg(not(windows))]
pub fn start_programs_dir() -> Option<PathBuf> { None }
#[cfg(not(windows))]
pub fn local_app_data_dir() -> Option<PathBuf> { None }
#[cfg(not(windows))]
pub fn apply_win11_dark_frame(_hwnd: isize) {}
#[cfg(not(windows))]
pub fn is_webview2_installed() -> bool { true }
#[cfg(not(windows))]
pub fn show_missing_webview2_box() {}
#[cfg(not(windows))]
pub fn read_existing_install_dir() -> Option<PathBuf> { None }
#[cfg(not(windows))]
pub fn free_disk_bytes(_path: &Path) -> u64 { 0 }
#[cfg(not(windows))]
pub fn pick_install_folder(_owner_hwnd: isize) -> Result<Option<PathBuf>, &'static str> { Ok(None) }
#[cfg(not(windows))]
pub fn create_shortcut(_t: &Path, _w: &Path, _s: &Path, _d: &str) -> Result<(), &'static str> { Ok(()) }
#[cfg(not(windows))]
pub fn register_uninstall_entry(_d: &Path, _v: &str, _k: u32) -> Result<(), &'static str> { Ok(()) }
#[cfg(not(windows))]
pub fn remove_uninstall_entry() {}
#[cfg(not(windows))]
pub fn set_autorun_entry(_p: Option<&Path>) -> Result<(), &'static str> { Ok(()) }
#[cfg(not(windows))]
pub fn terminate_running_app() {}
#[cfg(not(windows))]
pub fn schedule_self_delete(_d: &Path) {}
