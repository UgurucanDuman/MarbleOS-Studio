//! Çevrimdışı lisans etkinleştirme (MarbleOS Studio 1.0)
//!
//! - Ürün anahtarı: 128-bit kriptografik rastgele değer (Crockford Base32, 26 karakter).
//!   Uygulamaya anahtarların kendisi değil, alan ayrımlı SHA-256 özetleri gömülür.
//! - Makine kimliği: Windows `MachineGuid` değerinin alan ayrımlı SHA-256 özetinin ilk 120 biti.
//! - Etkinleştirme kodu: satıcının ECDSA P-256 (SHA-256) imzası; mesaj = alan + anahtar özeti + makine kimliği.
//!   Doğrulama Windows CNG (`bcrypt.dll`) ile yapılır; özel anahtar uygulamada bulunmaz.
//! - Lisans dosyası her açılışta yeniden doğrulanır; başka bilgisayara kopyalanırsa geçersizdir.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

const KEY_DOMAIN: &[u8] = b"MarbleOS-Studio/license-key/v1\0";
const MACHINE_DOMAIN: &[u8] = b"MarbleOS-Studio/machine/v1\0";
const ACTIVATION_DOMAIN: &[u8] = b"MarbleOS-Studio/activation/v1\0";
const LICENSE_FILE: &str = "license.json";
const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const NOT_LICENSED: &str = "MarbleOS Studio lisansı bu bilgisayarda etkinleştirilmemiş.";
const INVALID_KEY: &str = "Ürün anahtarı geçersiz.";
const INVALID_ACTIVATION: &str = "Etkinleştirme kodu bu bilgisayar ve ürün anahtarı için geçerli değil.";
const MACHINE_UNAVAILABLE: &str = "Bu bilgisayarın Windows kimliği okunamadı.";
const SAVE_FAILED: &str = "Lisans bilgisi kaydedilemedi.";

const PUBLIC_KEY_X: [u8; 32] = [0x7e, 0xac, 0x1f, 0x75, 0xf8, 0x97, 0x15, 0xaf, 0x26, 0x43, 0xfb, 0x18, 0xfe, 0xab, 0x4c, 0x26, 0x5d, 0x4e, 0x80, 0x35, 0x96, 0x51, 0x7d, 0x39, 0x20, 0xfe, 0x3d, 0x5d, 0xe9, 0x74, 0x90, 0x65];
const PUBLIC_KEY_Y: [u8; 32] = [0xff, 0xcd, 0x69, 0xa5, 0xc9, 0x90, 0x7a, 0xd7, 0xe2, 0xb3, 0x60, 0x95, 0x61, 0x65, 0xf3, 0xab, 0x91, 0x4e, 0xd1, 0xaf, 0x94, 0x8a, 0x83, 0xa8, 0x87, 0x66, 0x30, 0x19, 0x96, 0x90, 0x53, 0x0f];

const PRODUCT_KEY_HASHES: [[u8; 32]; 10] = [
    [0x56, 0xe0, 0xff, 0x42, 0xe0, 0x99, 0xe6, 0x12, 0xe9, 0x63, 0x02, 0x7e, 0xd9, 0xd5, 0x22, 0xb0, 0x62, 0x0f, 0x55, 0x5d, 0x0a, 0x16, 0xa9, 0xc4, 0x6e, 0x65, 0xde, 0x86, 0x2c, 0x10, 0x22, 0x8f],
    [0x22, 0xb1, 0x36, 0x1d, 0x7f, 0xad, 0x9f, 0x0a, 0x22, 0x0a, 0xb8, 0xd7, 0x60, 0xc4, 0xf4, 0xeb, 0x6e, 0xce, 0xc5, 0x9c, 0x05, 0xbd, 0xe7, 0x26, 0xe9, 0x4d, 0xe6, 0x82, 0xe1, 0x0a, 0x63, 0x52],
    [0x3d, 0x28, 0xf8, 0xdd, 0xd6, 0x41, 0x51, 0x04, 0xe3, 0x00, 0xe3, 0x42, 0x24, 0x45, 0xc5, 0x3b, 0xbd, 0x06, 0x7f, 0x14, 0x58, 0x4c, 0xd9, 0x10, 0xc4, 0x70, 0x97, 0xc6, 0xfc, 0x25, 0x7d, 0xca],
    [0x6f, 0x48, 0xd2, 0x16, 0x1c, 0x87, 0x46, 0xe1, 0x0d, 0x72, 0x0e, 0x0e, 0xf4, 0x77, 0x96, 0x12, 0xae, 0xdc, 0x93, 0x3e, 0x3b, 0x66, 0xde, 0x25, 0x22, 0xf3, 0xa4, 0xe2, 0x88, 0x9b, 0x3f, 0xd2],
    [0x94, 0x20, 0xea, 0x11, 0x57, 0x29, 0x03, 0x5b, 0xce, 0x29, 0xb4, 0x77, 0x05, 0x5b, 0xd5, 0xf4, 0xe3, 0xc3, 0x45, 0x8f, 0x5b, 0x0c, 0x4b, 0x79, 0xaa, 0x14, 0x48, 0x30, 0xf4, 0x3e, 0x0f, 0x0a],
    [0xb0, 0xb0, 0x51, 0xd0, 0x43, 0xae, 0x27, 0x4a, 0x54, 0xa5, 0xe9, 0x9e, 0x1b, 0x12, 0xe0, 0xd5, 0xec, 0xcd, 0xab, 0x77, 0x42, 0xb8, 0x61, 0x07, 0x1c, 0x58, 0x69, 0x69, 0xea, 0x9d, 0x97, 0x7e],
    [0xe4, 0x42, 0xc4, 0xd7, 0x0e, 0xec, 0xac, 0xb9, 0xed, 0x03, 0xd1, 0x48, 0xc2, 0xcb, 0xdd, 0xb6, 0x10, 0x53, 0x54, 0x5b, 0xad, 0x01, 0xf2, 0x3b, 0x54, 0xc0, 0x43, 0x2b, 0xbc, 0xfa, 0x8b, 0xd4],
    [0x45, 0x9d, 0x7c, 0xcb, 0x8e, 0x28, 0xa2, 0xd4, 0x56, 0x1e, 0xfb, 0x2a, 0x11, 0x6b, 0x18, 0x00, 0xd7, 0x2e, 0x09, 0x23, 0xc5, 0xa3, 0xdd, 0x93, 0xab, 0x34, 0x3a, 0x30, 0xfa, 0x58, 0xa3, 0x2e],
    [0x74, 0x5e, 0xee, 0xcc, 0x7d, 0x7c, 0xcd, 0x3d, 0x19, 0x91, 0x23, 0x06, 0x9a, 0x6a, 0x51, 0xdc, 0xbd, 0x0c, 0x3c, 0xdb, 0x25, 0xd6, 0xc1, 0x62, 0x8c, 0x47, 0x3b, 0xda, 0x60, 0xb8, 0x36, 0xae],
    [0xb5, 0xde, 0xa8, 0xe7, 0x77, 0x06, 0xd3, 0xca, 0xec, 0x4c, 0xa0, 0x4e, 0xfd, 0x29, 0x6a, 0xee, 0x06, 0x3c, 0x7a, 0x89, 0xaa, 0x7f, 0xe0, 0x48, 0x35, 0xc8, 0x7d, 0xd6, 0xf6, 0x12, 0x90, 0x9a],
];

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub activated: bool,
    pub machine_code: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredLicense {
    product_key: String,
    activation_code: String,
}

pub struct LicenseManager {
    root: PathBuf,
    machine_id: Option<[u8; 15]>,
    activated: AtomicBool,
}

impl LicenseManager {
    pub fn new(root: PathBuf) -> Self {
        let enforce = cfg!(feature = "license-gate");
        Self::with_machine_id(root, read_machine_guid().map(|guid| machine_id_from_guid(&guid)), enforce)
    }

    fn with_machine_id(root: PathBuf, machine_id: Option<[u8; 15]>, enforce: bool) -> Self {
        if !enforce {
            return Self { root, machine_id, activated: AtomicBool::new(true) };
        }
        let manager = Self { root, machine_id, activated: AtomicBool::new(false) };
        if let (Some(machine), Ok(raw)) = (machine_id, fs::read(manager.path())) {
            if raw.len() <= 4096 {
                if let Ok(stored) = serde_json::from_slice::<StoredLicense>(&raw) {
                    let valid = verify_activation(&stored.product_key, &stored.activation_code, &machine).is_ok();
                    manager.activated.store(valid, Ordering::SeqCst);
                }
            }
        }
        manager
    }

    fn path(&self) -> PathBuf {
        self.root.join(LICENSE_FILE)
    }

    pub fn status(&self) -> LicenseStatus {
        LicenseStatus {
            activated: self.activated.load(Ordering::SeqCst),
            machine_code: self.machine_id.map(|m| format_machine_code(&m)).unwrap_or_default(),
        }
    }

    pub fn ensure(&self) -> Result<(), &'static str> {
        if self.activated.load(Ordering::SeqCst) { Ok(()) } else { Err(NOT_LICENSED) }
    }

    pub fn activate(&self, product_key: &str, activation_code: &str) -> Result<LicenseStatus, &'static str> {
        if product_key.len() > 64 {
            return Err(INVALID_KEY);
        }
        if activation_code.len() > 256 {
            return Err(INVALID_ACTIVATION);
        }
        let machine = self.machine_id.ok_or(MACHINE_UNAVAILABLE)?;
        let (key_norm, code_norm) = verify_activation(product_key, activation_code, &machine)?;
        let json = serde_json::to_vec(&StoredLicense { product_key: key_norm, activation_code: code_norm })
            .map_err(|_| SAVE_FAILED)?;
        fs::create_dir_all(&self.root).map_err(|_| SAVE_FAILED)?;
        let mut tmp = tempfile::NamedTempFile::new_in(&self.root).map_err(|_| SAVE_FAILED)?;
        tmp.write_all(&json).map_err(|_| SAVE_FAILED)?;
        tmp.as_file().sync_all().map_err(|_| SAVE_FAILED)?;
        tmp.persist(self.path()).map_err(|_| SAVE_FAILED)?;
        self.activated.store(true, Ordering::SeqCst);
        Ok(self.status())
    }
}

fn clean_code(raw: &str) -> String {
    raw.chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            other => other,
        })
        .collect()
}

fn decode_exact(chars: &str, byte_len: usize) -> Option<Vec<u8>> {
    if chars.len() != (byte_len * 8).div_ceil(5) {
        return None;
    }
    let mut out = Vec::with_capacity(byte_len);
    let (mut acc, mut bits) = (0u32, 0u32);
    for ch in chars.bytes() {
        let value = ALPHABET.iter().position(|&a| a == ch)? as u32;
        acc = (acc << 5) | value;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    (out.len() == byte_len && acc == 0).then_some(out)
}

fn encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity((bytes.len() * 8).div_ceil(5));
    let (mut acc, mut bits) = (0u32, 0u32);
    for &byte in bytes {
        acc = (acc << 8) | byte as u32;
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            out.push(ALPHABET[((acc >> bits) & 31) as usize] as char);
        }
        acc &= (1 << bits) - 1;
    }
    if bits > 0 {
        out.push(ALPHABET[((acc << (5 - bits)) & 31) as usize] as char);
    }
    out
}

fn product_key_hash(raw: &str) -> Option<[u8; 32]> {
    let upper: String = raw.chars().filter(|c| !c.is_whitespace() && *c != '-').collect::<String>().to_ascii_uppercase();
    let body = if upper.len() == 29 && upper.starts_with("MOS") { &upper[3..] } else { upper.as_str() };
    let bytes = decode_exact(&clean_code(body), 16)?;
    Some(Sha256::new().chain_update(KEY_DOMAIN).chain_update(&bytes).finalize().into())
}

fn format_product_key(hash_source: &str) -> String {
    let upper: String = hash_source.chars().filter(|c| !c.is_whitespace() && *c != '-').collect::<String>().to_ascii_uppercase();
    let body = clean_code(if upper.len() == 29 && upper.starts_with("MOS") { &upper[3..] } else { &upper });
    format!("MOS-{}-{}-{}-{}-{}", &body[..6], &body[6..11], &body[11..16], &body[16..21], &body[21..])
}

fn machine_id_from_guid(guid: &str) -> [u8; 15] {
    let digest = Sha256::new().chain_update(MACHINE_DOMAIN).chain_update(guid.trim().to_ascii_lowercase().as_bytes()).finalize();
    let mut id = [0u8; 15];
    id.copy_from_slice(&digest[..15]);
    id
}

fn format_machine_code(machine: &[u8; 15]) -> String {
    let code = encode(machine);
    code.as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap_or_default()).collect::<Vec<_>>().join("-")
}

fn signature_digest(key_hash: &[u8; 32], machine: &[u8; 15]) -> [u8; 32] {
    Sha256::new().chain_update(ACTIVATION_DOMAIN).chain_update(key_hash).chain_update(machine).finalize().into()
}

fn verify_activation(product_key: &str, activation_code: &str, machine: &[u8; 15]) -> Result<(String, String), &'static str> {
    let key_hash = product_key_hash(product_key).ok_or(INVALID_KEY)?;
    if !PRODUCT_KEY_HASHES.iter().any(|known| known == &key_hash) {
        return Err(INVALID_KEY);
    }
    let code = clean_code(activation_code);
    let signature: [u8; 64] = decode_exact(&code, 64).and_then(|v| v.try_into().ok()).ok_or(INVALID_ACTIVATION)?;
    if !verify_p256(&signature_digest(&key_hash, machine), &signature) {
        return Err(INVALID_ACTIVATION);
    }
    Ok((format_product_key(product_key), code))
}

#[cfg(windows)]
fn read_machine_guid() -> Option<String> {
    use windows_sys::core::w;
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ, RRF_SUBKEY_WOW6464KEY};
    let mut buffer = [0u16; 128];
    let mut byte_len = (buffer.len() * 2) as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            w!("SOFTWARE\\Microsoft\\Cryptography"),
            w!("MachineGuid"),
            RRF_RT_REG_SZ | RRF_SUBKEY_WOW6464KEY,
            std::ptr::null_mut(),
            buffer.as_mut_ptr().cast(),
            &mut byte_len,
        )
    };
    if status != 0 {
        return None;
    }
    let chars = (byte_len as usize / 2).min(buffer.len());
    let guid = String::from_utf16(&buffer[..chars]).ok()?;
    let guid = guid.trim_end_matches('\0').trim().to_ascii_lowercase();
    (guid.len() >= 16).then_some(guid)
}

#[cfg(not(windows))]
fn read_machine_guid() -> Option<String> {
    None
}

#[cfg(windows)]
fn verify_p256(digest: &[u8; 32], signature: &[u8; 64]) -> bool {
    use std::ptr;
    use windows_sys::Win32::Security::Cryptography::{
        BCryptCloseAlgorithmProvider, BCryptDestroyKey, BCryptImportKeyPair, BCryptOpenAlgorithmProvider,
        BCryptVerifySignature, BCRYPT_ALG_HANDLE, BCRYPT_ECCPUBLIC_BLOB, BCRYPT_ECDSA_P256_ALGORITHM,
        BCRYPT_ECDSA_PUBLIC_P256_MAGIC, BCRYPT_KEY_HANDLE,
    };
    let mut blob = Vec::with_capacity(72);
    blob.extend_from_slice(&BCRYPT_ECDSA_PUBLIC_P256_MAGIC.to_le_bytes());
    blob.extend_from_slice(&32u32.to_le_bytes());
    blob.extend_from_slice(&PUBLIC_KEY_X);
    blob.extend_from_slice(&PUBLIC_KEY_Y);
    unsafe {
        let mut alg: BCRYPT_ALG_HANDLE = ptr::null_mut();
        if BCryptOpenAlgorithmProvider(&mut alg, BCRYPT_ECDSA_P256_ALGORITHM, ptr::null(), 0) != 0 {
            return false;
        }
        let mut key: BCRYPT_KEY_HANDLE = ptr::null_mut();
        let ok = if BCryptImportKeyPair(alg, ptr::null_mut(), BCRYPT_ECCPUBLIC_BLOB, &mut key, blob.as_ptr(), blob.len() as u32, 0) == 0 {
            let status = BCryptVerifySignature(key, ptr::null(), digest.as_ptr(), 32, signature.as_ptr(), 64, 0);
            BCryptDestroyKey(key);
            status == 0
        } else {
            false
        };
        BCryptCloseAlgorithmProvider(alg, 0);
        ok
    }
}

#[cfg(not(windows))]
fn verify_p256(_: &[u8; 32], _: &[u8; 64]) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    // Gerçek bir bilgisayara ait olamayacak sabit sahte makine kimliği için satıcı imzası.
    const TEST_MACHINE: [u8; 15] = [0xa5; 15];
    const TEST_SIGNATURE: [u8; 64] = [0x88, 0x9e, 0x85, 0x2f, 0x35, 0x56, 0x16, 0x21, 0x0f, 0x2e, 0xba, 0x0b, 0xed, 0x94, 0x7b, 0x04, 0x05, 0x6a, 0xf3, 0x7d, 0xe2, 0xe9, 0x31, 0x8c, 0xa7, 0xb4, 0x62, 0x81, 0xc8, 0x8c, 0xe7, 0x69, 0x50, 0x82, 0x03, 0xb9, 0x8d, 0x1c, 0xae, 0x43, 0x0e, 0xe4, 0x2e, 0x66, 0x7a, 0xec, 0x0f, 0x13, 0xe1, 0xb1, 0x54, 0xa3, 0xd5, 0x2f, 0x07, 0x00, 0xb0, 0x21, 0x6d, 0x3c, 0xf8, 0x75, 0x26, 0x06];

    #[test]
    fn base32_roundtrip_and_strict_padding() {
        let bytes: Vec<u8> = (0u8..64).map(|i| i.wrapping_mul(37)).collect();
        let text = encode(&bytes);
        assert_eq!(text.len(), 103);
        assert_eq!(decode_exact(&text, 64).unwrap(), bytes);
        let mut bad = text.clone();
        bad.pop();
        bad.push('Z'); // Doldurma bitleri sıfır değil
        assert!(decode_exact(&bad, 64).is_none());
        assert!(decode_exact(&text[1..], 64).is_none());
        let mut bad_char = text.clone();
        bad_char.replace_range(0..1, "U"); // Crockford alfabesinde olmayan karakter
        assert!(decode_exact(&bad_char, 64).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn vendor_signature_verifies_only_for_exact_key_and_machine() {
        let key_hash = PRODUCT_KEY_HASHES[0];
        assert!(verify_p256(&signature_digest(&key_hash, &TEST_MACHINE), &TEST_SIGNATURE));

        let mut other_machine = TEST_MACHINE;
        other_machine[0] ^= 1;
        assert!(!verify_p256(&signature_digest(&key_hash, &other_machine), &TEST_SIGNATURE));
        assert!(!verify_p256(&signature_digest(&PRODUCT_KEY_HASHES[1], &TEST_MACHINE), &TEST_SIGNATURE));
        let mut tampered = TEST_SIGNATURE;
        tampered[10] ^= 0x40;
        assert!(!verify_p256(&signature_digest(&key_hash, &TEST_MACHINE), &tampered));
    }

    #[cfg(windows)]
    #[test]
    fn reads_stable_windows_machine_identity() {
        let guid = read_machine_guid().expect("MachineGuid");
        assert_eq!(machine_id_from_guid(&guid), machine_id_from_guid(&guid.to_ascii_uppercase()));
        let code = format_machine_code(&machine_id_from_guid(&guid));
        assert_eq!(code.len(), 29);
        assert_eq!(code.matches('-').count(), 5);
    }

    #[test]
    fn rejects_unknown_or_malformed_keys_and_never_unlocks_without_valid_activation() {
        let random_key = format!("MOS-{}", encode(&[7u8; 16]));
        assert!(product_key_hash(&random_key).is_some());
        assert_eq!(verify_activation(&random_key, &encode(&TEST_SIGNATURE), &TEST_MACHINE), Err(INVALID_KEY));
        assert!(product_key_hash("MOS-KISA").is_none());

        let dir = tempfile::tempdir().unwrap();
        let manager = LicenseManager::with_machine_id(dir.path().to_path_buf(), Some(TEST_MACHINE), true);
        assert_eq!(manager.ensure(), Err(NOT_LICENSED));
        assert!(manager.activate(&random_key, &encode(&TEST_SIGNATURE)).is_err());
        assert!(manager.activate(&"A".repeat(65), "x").is_err());
        assert!(!manager.status().activated);

        // Elle yazılmış sahte lisans dosyası yeniden açılışta kabul edilmez
        fs::write(dir.path().join(LICENSE_FILE), format!(r#"{{"productKey":"{random_key}","activationCode":"{}"}}"#, encode(&TEST_SIGNATURE))).unwrap();
        let reopened = LicenseManager::with_machine_id(dir.path().to_path_buf(), Some(TEST_MACHINE), true);
        assert_eq!(reopened.ensure(), Err(NOT_LICENSED));
        let no_machine = LicenseManager::with_machine_id(dir.path().to_path_buf(), None, true);
        assert_eq!(no_machine.activate(&random_key, "x"), Err(MACHINE_UNAVAILABLE));
    }

    #[cfg(feature = "license-gate")]
    #[test]
    fn default_licensed_build_requires_activation_on_fresh_dir() {
        let dir = tempfile::tempdir().unwrap();
        let manager = LicenseManager::new(dir.path().to_path_buf());
        assert!(!manager.status().activated);
        assert_eq!(manager.ensure(), Err(NOT_LICENSED));
    }

    #[cfg(not(feature = "license-gate"))]
    #[test]
    fn default_unlicensed_build_opens_directly_without_activation() {
        let dir = tempfile::tempdir().unwrap();
        let manager = LicenseManager::new(dir.path().to_path_buf());
        assert!(manager.status().activated);
        assert_eq!(manager.ensure(), Ok(()));
    }
}
