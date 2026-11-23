use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use std::io;
use zeroize::Zeroizing;

pub const AEAD_MAGIC: &[u8; 8] = b"MBLAEAD1";
const NONCE_LEN: usize = 12;
const TAG_LEN: usize = 16;

#[derive(Clone)]
pub struct DataKey(Zeroizing<[u8; 32]>);

impl DataKey {
    pub fn generate() -> Self {
        let mut bytes = Zeroizing::new([0u8; 32]);
        OsRng.fill_bytes(bytes.as_mut());
        Self(bytes)
    }

    pub fn from_slice(slice: &[u8]) -> io::Result<Self> {
        if slice.len() != 32 {
            return Err(io::ErrorKind::InvalidData.into());
        }
        let mut bytes = Zeroizing::new([0u8; 32]);
        bytes.copy_from_slice(slice);
        Ok(Self(bytes))
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

pub fn is_aead_blob(bytes: &[u8]) -> bool {
    bytes.starts_with(AEAD_MAGIC)
}

pub fn seal_with_key(key: &DataKey, plaintext: &[u8], scope: &[u8]) -> io::Result<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(key.as_bytes())
        .map_err(|_| io::Error::from(io::ErrorKind::InvalidInput))?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), Payload { msg: plaintext, aad: scope })
        .map_err(|_| io::Error::from(io::ErrorKind::InvalidData))?;
    let mut out = Vec::with_capacity(AEAD_MAGIC.len() + NONCE_LEN + ciphertext.len());
    out.extend_from_slice(AEAD_MAGIC);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn open_with_key(key: &DataKey, blob: &[u8], scope: &[u8]) -> io::Result<Vec<u8>> {
    if is_aead_blob(blob) {
        if blob.len() < AEAD_MAGIC.len() + NONCE_LEN + TAG_LEN {
            return Err(io::ErrorKind::InvalidData.into());
        }
        let nonce = Nonce::from_slice(&blob[AEAD_MAGIC.len()..AEAD_MAGIC.len() + NONCE_LEN]);
        let ciphertext = &blob[AEAD_MAGIC.len() + NONCE_LEN..];
        let cipher = Aes256Gcm::new_from_slice(key.as_bytes())
            .map_err(|_| io::Error::from(io::ErrorKind::InvalidInput))?;
        return cipher
            .decrypt(nonce, Payload { msg: ciphertext, aad: scope })
            .map_err(|_| io::Error::from(io::ErrorKind::InvalidData));
    }
    open(blob, scope)
}

#[cfg(windows)]
fn protect_windows(bytes: &[u8], scope: &[u8], seal: bool) -> io::Result<Vec<u8>> {
    use std::{ptr, slice};
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    };

    fn blob(bytes: &[u8]) -> io::Result<CRYPT_INTEGER_BLOB> {
        Ok(CRYPT_INTEGER_BLOB {
            cbData: bytes.len().try_into().map_err(|_| io::ErrorKind::InvalidInput)?,
            pbData: bytes.as_ptr().cast_mut(),
        })
    }

    let input = blob(bytes)?;
    let entropy = blob(scope)?;
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: ptr::null_mut() };
    let success = unsafe {
        if seal {
            CryptProtectData(
                &input, ptr::null(), &entropy, ptr::null(), ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN, &mut output,
            )
        } else {
            CryptUnprotectData(
                &input, ptr::null_mut(), &entropy, ptr::null(), ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN, &mut output,
            )
        }
    };
    if success == 0 {
        return Err(io::Error::last_os_error());
    }
    if output.pbData.is_null() {
        return Err(io::ErrorKind::InvalidData.into());
    }
    unsafe {
        let buffer = slice::from_raw_parts_mut(output.pbData, output.cbData as usize);
        let copy = buffer.to_vec();
        if !seal {
            for byte in buffer {
                ptr::write_volatile(byte, 0);
            }
        }
        LocalFree(output.pbData.cast());
        Ok(copy)
    }
}

#[cfg(not(windows))]
fn protect_windows(_: &[u8], _: &[u8], _: bool) -> io::Result<Vec<u8>> {
    Err(io::ErrorKind::Unsupported.into())
}

pub fn seal(bytes: &[u8], scope: &[u8]) -> io::Result<Vec<u8>> {
    protect_windows(bytes, scope, true)
}

pub fn open(bytes: &[u8], scope: &[u8]) -> io::Result<Vec<u8>> {
    protect_windows(bytes, scope, false)
}
