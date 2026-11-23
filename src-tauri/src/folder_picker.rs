use crate::media;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{fs, path::Path};

const MAX_FOLDER_PHOTOS: usize = 150;
const MAX_SINGLE_PHOTO_BYTES: usize = 10_000_000;
const MAX_TOTAL_FOLDER_BYTES: usize = 250 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedPhotoFile {
    pub file_name: String,
    pub mime_type: String,
    pub size_bytes: usize,
    pub bytes_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedPhotoFolder {
    pub folder_name: String,
    pub total_bytes: usize,
    pub files: Vec<PickedPhotoFile>,
}

fn mime_for_photo_name(name: &str) -> Option<&'static str> {
    let (_, ext) = name.rsplit_once('.')?;
    if ext.eq_ignore_ascii_case("jpg") || ext.eq_ignore_ascii_case("jpeg") {
        Some("image/jpeg")
    } else if ext.eq_ignore_ascii_case("png") {
        Some("image/png")
    } else if ext.eq_ignore_ascii_case("webp") {
        Some("image/webp")
    } else {
        None
    }
}

fn has_valid_magic_header(mime: &str, bytes: &[u8]) -> bool {
    match mime {
        "image/jpeg" => bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF,
        "image/png" => bytes.len() >= 8 && bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]),
        "image/webp" => bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        _ => false,
    }
}

fn subdir_contains_photo(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten().take(256) {
        let Ok(meta) = fs::symlink_metadata(entry.path()) else {
            continue;
        };
        if media::is_redirected(&meta) {
            continue;
        }
        if meta.is_file() {
            if let Some(name) = entry.file_name().to_str() {
                if mime_for_photo_name(name).is_some() {
                    return true;
                }
            }
        }
    }
    false
}

/// İşletim sisteminin seçtiği klasörü güvenli sınırlar (<= 150 kare, <= 10 MB, imza doğrulama) ile okur.
pub fn read_validated_photo_folder(dir: &Path) -> Result<PickedPhotoFolder, &'static str> {
    let dir_meta = fs::symlink_metadata(dir).map_err(|_| "Seçilen klasöre erişilemedi.")?;
    if !dir_meta.is_dir() || media::is_redirected(&dir_meta) {
        return Err("Geçerli bir yerel fotoğraf klasörü seçin.");
    }

    let folder_name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Fotoğraf Klasörü")
        .to_owned();

    let entries = fs::read_dir(dir).map_err(|_| "Klasör içeriği okunamadı.")?;
    let mut candidates: Vec<(String, std::path::PathBuf, &'static str, usize)> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|_| "Klasör içeriği okunamadı.")?;
        let path = entry.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if media::is_redirected(&meta) {
            continue;
        }
        if meta.is_dir() {
            if subdir_contains_photo(&path) {
                return Err("Alt klasörlerde fotoğraf bulundu. Yalnızca seçili sınıfın fotoğraf klasörünü açın.");
            }
            continue;
        }
        if !meta.is_file() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        let Some(mime) = mime_for_photo_name(&name) else {
            continue;
        };
        let len = meta.len() as usize;
        if len == 0 || len > MAX_SINGLE_PHOTO_BYTES {
            return Err("En fazla 150 fotoğraf seçin. Her fotoğraf 10 MB veya daha küçük olmalı.");
        }
        candidates.push((name, path, mime, len));
        if candidates.len() > MAX_FOLDER_PHOTOS {
            return Err("En fazla 150 fotoğraf seçin. Her fotoğraf 10 MB veya daha küçük olmalı.");
        }
    }

    if candidates.is_empty() {
        return Err("Aktarılabilecek JPEG, PNG veya WebP bulunamadı.");
    }

    candidates.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));

    let mut total_bytes = 0usize;
    let mut files = Vec::with_capacity(candidates.len());
    for (file_name, path, mime, _) in candidates {
        let bytes = fs::read(&path).map_err(|_| "Fotoğraf dosyası okunamadı.")?;
        if bytes.is_empty() || bytes.len() > MAX_SINGLE_PHOTO_BYTES {
            return Err("En fazla 150 fotoğraf seçin. Her fotoğraf 10 MB veya daha küçük olmalı.");
        }
        if !has_valid_magic_header(mime, &bytes) {
            return Err("Klasördeki bir fotoğraf dosyası geçersiz veya bozuk.");
        }
        total_bytes = total_bytes.saturating_add(bytes.len());
        if total_bytes > MAX_TOTAL_FOLDER_BYTES {
            return Err("Klasör toplam boyutu 250 MB sınırını aşıyor.");
        }
        files.push(PickedPhotoFile {
            file_name,
            mime_type: mime.to_owned(),
            size_bytes: bytes.len(),
            bytes_base64: STANDARD.encode(&bytes),
        });
    }

    Ok(PickedPhotoFolder {
        folder_name,
        total_bytes,
        files,
    })
}

pub fn pick_photo_folder(owner_hwnd: isize) -> Result<Option<PickedPhotoFolder>, &'static str> {
    #[cfg(windows)]
    {
        let Some(selected_dir) = win32_folder_dialog::select_folder(owner_hwnd)? else {
            return Ok(None);
        };
        Ok(Some(read_validated_photo_folder(&selected_dir)?))
    }
    #[cfg(not(windows))]
    {
        let _ = owner_hwnd;
        Err("Yerel klasör seçici yalnız Windows masaüstü uygulamasında kullanılabilir.")
    }
}

#[cfg(windows)]
mod win32_folder_dialog {
    use std::{
        ffi::c_void,
        path::PathBuf,
        ptr::{null, null_mut},
    };

    const COINIT_APARTMENTTHREADED: u32 = 0x2;
    const COINIT_DISABLE_OLE1DDE: u32 = 0x4;
    const CLSCTX_INPROC_SERVER: u32 = 0x1;
    const FOS_PICKFOLDERS: u32 = 0x0000_0020;
    const FOS_FORCEFILESYSTEM: u32 = 0x0000_0040;
    const FOS_PATHMUSTEXIST: u32 = 0x0000_0800;
    const SIGDN_FILESYSPATH: u32 = 0x8005_8000;
    const HRESULT_CANCELLED: i32 = 0x8007_04C7u32 as i32;

    #[repr(C)]
    struct Guid {
        data1: u32,
        data2: u16,
        data3: u16,
        data4: [u8; 8],
    }

    const CLSID_FILE_OPEN_DIALOG: Guid = Guid {
        data1: 0xDC1C_5A9C,
        data2: 0xE88A,
        data3: 0x4DDE,
        data4: [0xA5, 0xA1, 0x60, 0xF8, 0x2A, 0x20, 0xAE, 0xF7],
    };
    const IID_IFILE_DIALOG: Guid = Guid {
        data1: 0x42F8_5136,
        data2: 0xDB7E,
        data3: 0x439C,
        data4: [0x85, 0xF1, 0xE4, 0x07, 0x5D, 0x13, 0x5F, 0xC8],
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

    /// Windows modern IFileOpenDialog (FOS_PICKFOLDERS) penceresini temiz bir STA iş parçacığında açar.
    pub fn select_folder(owner_hwnd: isize) -> Result<Option<PathBuf>, &'static str> {
        std::thread::spawn(move || unsafe {
            let hr_init = CoInitializeEx(null(), COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            let _com = ComGuard(hr_init >= 0);

            let mut raw_dialog: *mut c_void = null_mut();
            let hr_create = CoCreateInstance(
                &CLSID_FILE_OPEN_DIALOG,
                null_mut(),
                CLSCTX_INPROC_SERVER,
                &IID_IFILE_DIALOG,
                &mut raw_dialog,
            );
            if hr_create < 0 || raw_dialog.is_null() {
                return Err("Windows klasör seçici açılamadı.");
            }
            let dialog = UnknownGuard(raw_dialog as *mut ComObject);
            let vtbl = (*dialog.0).vtable;

            let get_options: extern "system" fn(*mut ComObject, *mut u32) -> i32 =
                std::mem::transmute(*vtbl.add(10));
            let set_options: extern "system" fn(*mut ComObject, u32) -> i32 =
                std::mem::transmute(*vtbl.add(9));
            let set_title: extern "system" fn(*mut ComObject, *const u16) -> i32 =
                std::mem::transmute(*vtbl.add(17));
            let set_ok_label: extern "system" fn(*mut ComObject, *const u16) -> i32 =
                std::mem::transmute(*vtbl.add(18));
            let show: extern "system" fn(*mut ComObject, isize) -> i32 =
                std::mem::transmute(*vtbl.add(3));
            let get_result: extern "system" fn(*mut ComObject, *mut *mut ComObject) -> i32 =
                std::mem::transmute(*vtbl.add(20));

            let mut opts: u32 = 0;
            if get_options(dialog.0, &mut opts) >= 0 {
                let _ = set_options(dialog.0, opts | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
            }
            let title_w = to_wide_z("Sınıf Fotoğraf Klasörünü Seç");
            let ok_w = to_wide_z("Klasörü Seç");
            let _ = set_title(dialog.0, title_w.as_ptr());
            let _ = set_ok_label(dialog.0, ok_w.as_ptr());

            let hr_show = show(dialog.0, owner_hwnd);
            if hr_show == HRESULT_CANCELLED {
                return Ok(None);
            }
            if hr_show < 0 {
                return Err("Klasör seçimi tamamlanamadı.");
            }

            let mut raw_item: *mut ComObject = null_mut();
            if get_result(dialog.0, &mut raw_item) < 0 || raw_item.is_null() {
                return Err("Seçilen klasör yolu okunamadı.");
            }
            let item = UnknownGuard(raw_item);
            let get_display_name: extern "system" fn(*mut ComObject, u32, *mut *mut u16) -> i32 =
                std::mem::transmute(*(*item.0).vtable.add(5));

            let mut path_ptr: *mut u16 = null_mut();
            if get_display_name(item.0, SIGDN_FILESYSPATH, &mut path_ptr) < 0 || path_ptr.is_null() {
                return Err("Seçilen klasör yolu çözümlenemedi.");
            }

            let mut len = 0usize;
            while len < 32_768 && *path_ptr.add(len) != 0 {
                len += 1;
            }
            let text = String::from_utf16_lossy(std::slice::from_raw_parts(path_ptr, len));
            CoTaskMemFree(path_ptr as *mut c_void);
            if text.trim().is_empty() {
                return Ok(None);
            }
            Ok(Some(PathBuf::from(text)))
        })
        .join()
        .map_err(|_| "Windows klasör seçici beklenmedik şekilde kapandı.")?
    }
}

#[cfg(test)]
mod tests {
    use super::read_validated_photo_folder;
    use std::fs;
    use tempfile::tempdir;

    const TINY_PNG: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6,
        0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 0, 0,
        3, 1, 1, 0, 24, 221, 141, 176, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];

    #[test]
    fn reads_valid_photos_and_ignores_non_image_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("02.png"), TINY_PNG).unwrap();
        fs::write(dir.path().join("01.jpg"), &[0xFF, 0xD8, 0xFF, 0xE0, 0, 16]).unwrap();
        fs::write(dir.path().join("Thumbs.db"), b"ignored").unwrap();

        let picked = read_validated_photo_folder(dir.path()).unwrap();
        assert_eq!(picked.files.len(), 2);
        assert_eq!(picked.files[0].file_name, "01.jpg");
        assert_eq!(picked.files[0].mime_type, "image/jpeg");
        assert_eq!(picked.files[1].file_name, "02.png");
        assert_eq!(picked.files[1].mime_type, "image/png");
    }

    #[test]
    fn rejects_nested_photo_subdirectories_and_corrupted_headers() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("1-B");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("01.png"), TINY_PNG).unwrap();
        let err = read_validated_photo_folder(dir.path()).unwrap_err();
        assert!(err.contains("Alt klasörlerde"));

        let bad_dir = tempdir().unwrap();
        fs::write(bad_dir.path().join("fake.jpg"), b"NOT_A_JPEG").unwrap();
        assert!(read_validated_photo_folder(bad_dir.path()).is_err());
    }
}
