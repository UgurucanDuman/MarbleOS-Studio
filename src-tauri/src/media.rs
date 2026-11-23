use crate::crypto::{self, DataKey};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageFormat, ImageReader, Limits};
use std::{
    fs::{self, File, Metadata},
    io::{self, Cursor, Read, Write},
    path::{Path, PathBuf},
};
use tempfile::NamedTempFile;
use sha2::{Digest, Sha256};

pub const MAX_ORIGINAL: usize = 10_000_000;
pub const MAX_SCHOOL_LOGO_OR_SIGNATURE: usize = 3 * 1024 * 1024;
pub const MAX_SCHOOL_PHOTO: usize = 8 * 1024 * 1024;
pub const SCHOOL_MEDIA_FOLDER: &str = "schools";
pub const DESKTOP_MEDIA_FOLDER: &str = "desktop";
const MAX_PREVIEW: usize = 2_000_000;
const MAX_PENDING_WRITE_BYTES: usize = 96 * 1024 * 1024;
const PHOTO_ERROR: &str = "Fotoğraf okunamadı. Geçerli JPEG, PNG veya WebP ve boyut sınırını kontrol edin.";
const WRITE_ERROR: &str = "Fotoğraf dosyası kaydedilemedi. İşlem geri alındı.";

pub fn is_redirected(meta: &Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        meta.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        meta.file_type().is_symlink()
    }
}

pub fn directory(path: &Path) -> io::Result<()> {
    match fs::create_dir(path) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
        Err(error) => return Err(error),
    }
    let meta = fs::symlink_metadata(path)?;
    if !meta.is_dir() || is_redirected(&meta) {
        return Err(io::ErrorKind::InvalidInput.into());
    }
    Ok(())
}

fn jpeg_exif_orientation(bytes: &[u8]) -> u8 {
    if bytes.len() < 16 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return 1;
    }
    let mut pos = 2usize;
    while pos + 4 <= bytes.len() {
        if bytes[pos] != 0xFF {
            return 1;
        }
        while pos < bytes.len() && bytes[pos] == 0xFF {
            pos += 1;
        }
        if pos >= bytes.len() {
            return 1;
        }
        let marker = bytes[pos];
        pos += 1;
        if marker == 0x00 || marker == 0x01 || (0xD0..=0xD8).contains(&marker) {
            continue;
        }
        if marker == 0xDA || marker == 0xD9 {
            break;
        }
        let Some(len_bytes) = bytes.get(pos..pos + 2) else {
            return 1;
        };
        let seg_len = u16::from_be_bytes([len_bytes[0], len_bytes[1]]) as usize;
        if seg_len < 2 {
            return 1;
        }
        let Some(payload) = bytes.get(pos + 2..pos + seg_len) else {
            return 1;
        };
        if marker == 0xE1 && payload.len() >= 14 && &payload[..6] == b"Exif\0\0" {
            let tiff = &payload[6..];
            let le = match &tiff[..2] {
                b"II" => true,
                b"MM" => false,
                _ => return 1,
            };
            let rd16 = |off: usize| -> Option<u16> {
                let s = tiff.get(off..off + 2)?;
                Some(if le { u16::from_le_bytes([s[0], s[1]]) } else { u16::from_be_bytes([s[0], s[1]]) })
            };
            let rd32 = |off: usize| -> Option<u32> {
                let s = tiff.get(off..off + 4)?;
                Some(if le {
                    u32::from_le_bytes([s[0], s[1], s[2], s[3]])
                } else {
                    u32::from_be_bytes([s[0], s[1], s[2], s[3]])
                })
            };
            if rd16(2) != Some(0x002A) {
                return 1;
            }
            let Some(ifd_off) = rd32(4).map(|v| v as usize) else {
                return 1;
            };
            let Some(count) = rd16(ifd_off).map(|v| (v as usize).min(256)) else {
                return 1;
            };
            for idx in 0..count {
                let Some(entry) = ifd_off.checked_add(2).and_then(|b| b.checked_add(idx * 12)) else {
                    return 1;
                };
                if entry + 12 > tiff.len() {
                    break;
                }
                if rd16(entry) == Some(0x0112) {
                    let field_type = rd16(entry + 2).unwrap_or(0);
                    let val = match field_type {
                        3 => rd16(entry + 8).map(u32::from),
                        4 => rd32(entry + 8),
                        _ => None,
                    };
                    return match val {
                        Some(v @ 1..=8) => v as u8,
                        _ => 1,
                    };
                }
            }
            return 1;
        }
        pos += seg_len;
    }
    1
}

fn apply_exif_orientation(image: DynamicImage, orientation: u8) -> DynamicImage {
    match orientation {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.rotate90().fliph(),
        6 => image.rotate90(),
        7 => image.rotate270().fliph(),
        8 => image.rotate270(),
        _ => image,
    }
}

fn decode_image(url: &str, max_original: usize) -> Result<(Vec<u8>, Vec<u8>), &'static str> {
    let (mime, b64) = url.split_once(",").ok_or(PHOTO_ERROR)?;
    let format = match mime {
        "data:image/jpeg;base64" => ImageFormat::Jpeg,
        "data:image/png;base64" => ImageFormat::Png,
        "data:image/webp;base64" => ImageFormat::WebP,
        _ => return Err(PHOTO_ERROR),
    };
    let original = STANDARD.decode(b64).map_err(|_| PHOTO_ERROR)?;
    if original.is_empty() || original.len() > max_original
        || image::guess_format(&original).ok() != Some(format)
    {
        return Err(PHOTO_ERROR);
    }
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(256 * 1024 * 1024);
    let mut header = ImageReader::with_format(Cursor::new(&original), format);
    header.limits(limits.clone());
    let (w, h) = header.into_dimensions().map_err(|_| PHOTO_ERROR)?;
    if w == 0 || h == 0 || u64::from(w) * u64::from(h) > 40_000_000 {
        return Err(PHOTO_ERROR);
    }
    let mut reader = ImageReader::with_format(Cursor::new(&original), format);
    reader.limits(limits);
    let image = reader.decode().map_err(|_| PHOTO_ERROR)?;
    let oriented = if format == ImageFormat::Jpeg {
        apply_exif_orientation(image, jpeg_exif_orientation(&original))
    } else {
        image
    };
    let preview_image = if oriented.width() > 512 || oriented.height() > 512 {
        oriented.thumbnail(512, 512)
    } else {
        oriented
    };
    let mut preview = Cursor::new(Vec::new());
    preview_image.write_to(&mut preview, ImageFormat::Png).map_err(|_| PHOTO_ERROR)?;
    let preview = preview.into_inner();
    if preview.len() > MAX_PREVIEW {
        return Err(PHOTO_ERROR);
    }
    Ok((original, preview))
}

fn write_encrypted(key: &DataKey, file: &Path, bytes: &[u8], scope: &str, replace: bool) -> io::Result<()> {
    let encrypted = crypto::seal_with_key(key, bytes, scope.as_bytes())?;
    let parent = file.parent().ok_or(io::ErrorKind::InvalidInput)?;
    let mut temp = NamedTempFile::new_in(parent)?;
    temp.write_all(&encrypted)?;
    temp.as_file().sync_all()?;
    if replace {
        temp.persist(file).map_err(|error| error.error)?;
    } else {
        temp.persist_noclobber(file).map_err(|error| error.error)?;
    }
    Ok(())
}

pub struct PendingFiles {
    key: DataKey,
    paths: Vec<PathBuf>,
    written_bytes: usize,
    committed: bool,
}

impl PendingFiles {
    pub fn new(key: DataKey) -> Self {
        Self { key, paths: Vec::new(), written_bytes: 0, committed: false }
    }

    pub fn add(&mut self, root: &Path, id: &str, url: &str, folder: Option<&str>, expected_hash: Option<&str>) -> Result<String, &'static str> {
        let (original, preview) = decode_image(url, MAX_ORIGINAL)?;
        let hash = format!("{:x}", Sha256::digest(&original));
        if expected_hash.is_some_and(|expected| expected != hash) {
            return Err("Fotoğrafın içerik doğrulaması başarısız.");
        }
        self.write_pair(root, id, folder, &original, &preview)?;
        Ok(hash)
    }

    pub fn add_school_asset(&mut self, root: &Path, id: &str, url: &str, max_bytes: usize) -> Result<(), &'static str> {
        let (original, preview) = decode_image(url, max_bytes)?;
        self.write_pair(root, id, Some(SCHOOL_MEDIA_FOLDER), &original, &preview)
    }

    pub fn clone_existing(
        &mut self,
        root: &Path,
        src_id: &str,
        src_folder: Option<&str>,
        dst_id: &str,
        dst_folder: Option<&str>,
        expected_hash: Option<&str>,
    ) -> Result<String, &'static str> {
        let original = read_decrypted_asset(root, &self.key, "originals", src_id, src_folder, MAX_ORIGINAL)?;
        if !matches!(image::guess_format(&original).ok(), Some(ImageFormat::Jpeg | ImageFormat::Png | ImageFormat::WebP)) {
            return Err(PHOTO_ERROR);
        }
        let hash = format!("{:x}", Sha256::digest(&original));
        if expected_hash.is_some_and(|expected| expected != hash) {
            return Err("Fotoğrafın içerik doğrulaması başarısız.");
        }
        let preview = read_decrypted_asset(root, &self.key, "previews", src_id, src_folder, MAX_PREVIEW)?;
        if image::guess_format(&preview).ok() != Some(ImageFormat::Png) {
            return Err(PHOTO_ERROR);
        }
        self.write_pair(root, dst_id, dst_folder, &original, &preview)?;
        Ok(hash)
    }

    fn write_pair(&mut self, root: &Path, id: &str, folder: Option<&str>, original: &[u8], preview: &[u8]) -> Result<(), &'static str> {
        self.written_bytes = self.written_bytes.saturating_add(original.len().saturating_add(preview.len()));
        if self.written_bytes > MAX_PENDING_WRITE_BYTES {
            return Err("Bir kayıt veya yedek grubu fotoğraf boyut sınırını aşıyor.");
        }
        for (kind, bytes) in [("originals", original), ("previews", preview)] {
            let parent = asset_parent(root, kind, folder).map_err(|_| WRITE_ERROR)?;
            let file = parent.join(format!("{id}.dpapi"));
            let scope = format!("marbleos-studio:{kind}:v1:{id}");
            write_encrypted(&self.key, &file, bytes, &scope, false).map_err(|_| WRITE_ERROR)?;
            self.paths.push(file);
        }
        Ok(())
    }

    pub fn committed(mut self) {
        self.committed = true;
    }
}

impl Drop for PendingFiles {
    fn drop(&mut self) {
        if !self.committed {
            for path in &self.paths {
                let _ = fs::remove_file(path);
            }
        }
    }
}

fn read_decrypted_asset(
    root: &Path,
    key: &DataKey,
    kind: &str,
    id: &str,
    folder: Option<&str>,
    max_len: usize,
) -> Result<Vec<u8>, &'static str> {
    let parent = asset_parent(root, kind, folder).map_err(|_| PHOTO_ERROR)?;
    let file = parent.join(format!("{id}.dpapi"));
    let meta = fs::symlink_metadata(&file).map_err(|_| PHOTO_ERROR)?;
    if !meta.is_file() || is_redirected(&meta) {
        return Err(PHOTO_ERROR);
    }
    let cap = (max_len + 4096) as u64;
    let mut encrypted = Vec::new();
    File::open(file).and_then(|handle| handle.take(cap + 1).read_to_end(&mut encrypted))
        .map_err(|_| PHOTO_ERROR)?;
    if encrypted.len() as u64 > cap {
        return Err(PHOTO_ERROR);
    }
    let scope = format!("marbleos-studio:{kind}:v1:{id}");
    let bytes = crypto::open_with_key(key, &encrypted, scope.as_bytes()).map_err(|_| PHOTO_ERROR)?;
    if bytes.is_empty() || bytes.len() > max_len {
        return Err(PHOTO_ERROR);
    }
    Ok(bytes)
}

pub fn migrate_asset_to_dek(root: &Path, key: &DataKey, id: &str, folder: Option<&str>) -> Result<(), &'static str> {
    if !crate::snapshot::is_id(id) {
        return Err(PHOTO_ERROR);
    }
    for (kind, max_len) in [("originals", MAX_ORIGINAL), ("previews", MAX_PREVIEW)] {
        let parent = asset_parent(root, kind, folder).map_err(|_| PHOTO_ERROR)?;
        let file = parent.join(format!("{id}.dpapi"));
        let meta = fs::symlink_metadata(&file).map_err(|_| PHOTO_ERROR)?;
        if !meta.is_file() || is_redirected(&meta) {
            return Err(PHOTO_ERROR);
        }
        let mut head = [0u8; 8];
        let is_aead = File::open(&file)
            .and_then(|mut f| f.read_exact(&mut head))
            .is_ok_and(|()| crypto::is_aead_blob(&head));
        if is_aead {
            continue;
        }
        let bytes = read_decrypted_asset(root, key, kind, id, folder, max_len)?;
        let scope = format!("marbleos-studio:{kind}:v1:{id}");
        write_encrypted(key, &file, &bytes, &scope, true).map_err(|_| WRITE_ERROR)?;
    }
    Ok(())
}

pub fn preview(root: &Path, key: &DataKey, id: &str, folder: Option<&str>) -> Result<String, &'static str> {
    let bytes = read_decrypted_asset(root, key, "previews", id, folder, MAX_PREVIEW)?;
    if image::guess_format(&bytes).ok() != Some(ImageFormat::Png) {
        return Err(PHOTO_ERROR);
    }
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}

fn image_mime(bytes: &[u8]) -> Result<&'static str, &'static str> {
    match image::guess_format(bytes).ok() {
        Some(ImageFormat::Jpeg) => Ok("image/jpeg"),
        Some(ImageFormat::Png) => Ok("image/png"),
        Some(ImageFormat::WebP) => Ok("image/webp"),
        _ => Err(PHOTO_ERROR),
    }
}

pub fn original(
    root: &Path,
    key: &DataKey,
    id: &str,
    folder: Option<&str>,
    expected_hash: Option<&str>,
) -> Result<String, &'static str> {
    let bytes = read_decrypted_asset(root, key, "originals", id, folder, MAX_ORIGINAL)?;
    let mime = image_mime(&bytes)?;
    if let Some(expected) = expected_hash {
        let actual = format!("{:x}", Sha256::digest(&bytes));
        if actual != expected {
            return Err("Fotoğrafın içerik doğrulaması başarısız.");
        }
    }
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

pub(crate) fn save_desktop_asset(
    root: &Path,
    key: &DataKey,
    file_id: &str,
    url: &str,
    max_bytes: usize,
) -> Result<(), &'static str> {
    if !crate::snapshot::is_id(file_id) {
        return Err(crate::snapshot::INVALID_DATA);
    }
    let (original, _) = decode_image(url, max_bytes)?;
    let parent = asset_parent(root, DESKTOP_MEDIA_FOLDER, None).map_err(|_| WRITE_ERROR)?;
    let file = parent.join(format!("{file_id}.dpapi"));
    let scope = format!("marbleos-studio:{DESKTOP_MEDIA_FOLDER}:v1:{file_id}");
    write_encrypted(key, &file, &original, &scope, true).map_err(|_| WRITE_ERROR)
}

pub(crate) fn load_desktop_asset(
    root: &Path,
    key: &DataKey,
    file_id: &str,
    max_bytes: usize,
) -> Result<String, &'static str> {
    if !crate::snapshot::is_id(file_id) {
        return Err(crate::snapshot::INVALID_DATA);
    }
    let bytes = read_decrypted_asset(root, key, DESKTOP_MEDIA_FOLDER, file_id, None, max_bytes)?;
    let mime = image_mime(&bytes)?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

pub(crate) fn remove_desktop_asset(root: &Path, file_id: &str) -> io::Result<()> {
    if !crate::snapshot::is_id(file_id) {
        return Err(io::ErrorKind::InvalidInput.into());
    }
    let parent = asset_parent(root, DESKTOP_MEDIA_FOLDER, None)?;
    let file = parent.join(format!("{file_id}.dpapi"));
    match fs::symlink_metadata(&file) {
        Ok(meta) if meta.is_file() && !is_redirected(&meta) => fs::remove_file(file),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
        _ => Err(io::ErrorKind::InvalidInput.into()),
    }
}

fn asset_parent(root: &Path, kind: &str, folder: Option<&str>) -> io::Result<PathBuf> {
    directory(root)?;
    let mut parent = root.join(kind);
    directory(&parent)?;
    if let Some(name) = folder {
        if name.is_empty() || name.len() > 64
            || !name.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(io::ErrorKind::InvalidInput.into());
        }
        parent = parent.join(name);
        directory(&parent)?;
    }
    Ok(parent)
}

pub fn remove_managed_photo(root: &Path, id: &str, folder: Option<&str>) -> io::Result<()> {
    for kind in ["originals", "previews"] {
        let parent = asset_parent(root, kind, folder)?;
        let file = parent.join(format!("{id}.dpapi"));
        match fs::symlink_metadata(&file) {
            Ok(meta) if meta.is_file() && !is_redirected(&meta) => fs::remove_file(file)?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
            _ => return Err(io::ErrorKind::InvalidInput.into()),
        }
    }
    Ok(())
}
