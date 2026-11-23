use crate::crypto::{self, DataKey};
use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use zeroize::Zeroizing;

pub const DPAPI_DEK_SCOPE: &[u8] = b"marbleos-studio:vault-dek:v1";
const RECOVERY_WRAP_MAGIC: &[u8; 8] = b"MBLRECV1";
const RECOVERY_AAD_PREFIX: &[u8] = b"marbleos-studio:recovery-dek:v1:";
const CHECKSUM_DOMAIN: &[u8] = b"marbleos-rk-check:v1:";
const FINGERPRINT_DOMAIN: &[u8] = b"marbleos-rk-fp:v1:";
const CROCKFORD: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ARGON_M_COST_KIB: u32 = 65_536; // 64 MiB
const ARGON_T_COST: u32 = 3;
const ARGON_P_COST: u32 = 1;

pub const VAULT_LOCKED_ERROR: &str =
    "Veri kasası bu Windows oturumunda kilitli. Devam etmek için Kurtarma Anahtarınızı girin.";
const KEY_FORMAT_ERROR: &str =
    "Kurtarma anahtarı 56 karakterden (7×8 grup) oluşmalıdır.";
const KEY_TYPO_ERROR: &str =
    "Kurtarma anahtarında yazım hatası var; karakterleri kontrol edin.";
const KEY_AUTH_ERROR: &str =
    "Kurtarma anahtarı doğrulanamadı. Anahtarı kontrol edip tekrar deneyin.";
const VAULT_IO_ERROR: &str = "Veri kasası anahtarı okunamadı veya kaydedilemedi.";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub locked: bool,
    pub has_recovery_key: bool,
    pub recovery_fingerprint: Option<String>,
    pub recovery_configured_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedRecoveryKey {
    pub recovery_key: String,
    pub recovery_fingerprint: String,
    pub recovery_configured_at: String,
}

pub enum VaultOpenOutcome {
    Unlocked(DataKey, VaultStatus),
    Locked(VaultStatus),
}

fn compute_checksum(secret: &[u8; 32]) -> [u8; 3] {
    let mut hasher = Sha256::new();
    hasher.update(CHECKSUM_DOMAIN);
    hasher.update(secret);
    let digest = hasher.finalize();
    [digest[0], digest[1], digest[2]]
}

fn compute_fingerprint(secret: &[u8; 32]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(FINGERPRINT_DOMAIN);
    hasher.update(secret);
    let d = hasher.finalize();
    format!("{:02X}{:02X}{:02X}{:02X}", d[0], d[1], d[2], d[3])
}

pub fn encode_recovery_key(secret: &[u8; 32]) -> String {
    let check = compute_checksum(secret);
    let mut raw = Zeroizing::new([0u8; 35]);
    raw[..32].copy_from_slice(secret);
    raw[32..].copy_from_slice(&check);

    let mut chars = Vec::with_capacity(62);
    let mut acc: u32 = 0;
    let mut bits: u8 = 0;
    let mut emitted = 0usize;
    for &byte in raw.iter() {
        acc = (acc << 8) | u32::from(byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            if emitted > 0 && emitted % 8 == 0 {
                chars.push(b'-');
            }
            chars.push(CROCKFORD[((acc >> bits) & 0x1f) as usize]);
            emitted += 1;
        }
    }
    String::from_utf8(chars).expect("ASCII Crockford Base32")
}

pub fn decode_recovery_key(input: &str) -> Result<Zeroizing<[u8; 32]>, &'static str> {
    if input.len() > 128 {
        return Err(KEY_FORMAT_ERROR);
    }
    let mut values = Zeroizing::new([0u8; 56]);
    let mut count = 0usize;
    for ch in input.bytes() {
        if matches!(ch, b'-' | b' ' | b'\t' | b'\r' | b'\n') {
            continue;
        }
        let norm = match ch.to_ascii_uppercase() {
            b'O' => b'0',
            b'I' | b'L' => b'1',
            other => other,
        };
        let Some(pos) = CROCKFORD.iter().position(|&c| c == norm) else {
            return Err(KEY_FORMAT_ERROR);
        };
        if count >= 56 {
            return Err(KEY_FORMAT_ERROR);
        }
        values[count] = pos as u8;
        count += 1;
    }
    if count != 56 {
        return Err(KEY_FORMAT_ERROR);
    }

    let mut raw = Zeroizing::new([0u8; 35]);
    let mut acc: u32 = 0;
    let mut bits: u8 = 0;
    let mut out_idx = 0usize;
    for &val in values.iter() {
        acc = (acc << 5) | u32::from(val);
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            raw[out_idx] = ((acc >> bits) & 0xff) as u8;
            out_idx += 1;
        }
    }
    let mut secret = Zeroizing::new([0u8; 32]);
    secret.copy_from_slice(&raw[..32]);
    let expected = compute_checksum(&secret);
    let diff = (raw[32] ^ expected[0]) | (raw[33] ^ expected[1]) | (raw[34] ^ expected[2]);
    if diff != 0 {
        return Err(KEY_TYPO_ERROR);
    }
    Ok(secret)
}

fn derive_kek(secret: &[u8; 32], salt: &[u8; 16]) -> Result<Zeroizing<[u8; 32]>, &'static str> {
    let params = Params::new(ARGON_M_COST_KIB, ARGON_T_COST, ARGON_P_COST, Some(32))
        .map_err(|_| VAULT_IO_ERROR)?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut kek = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(secret.as_slice(), salt.as_slice(), kek.as_mut())
        .map_err(|_| VAULT_IO_ERROR)?;
    Ok(kek)
}

fn recovery_aad(salt: &[u8], fingerprint: &str) -> Vec<u8> {
    let mut aad = Vec::with_capacity(RECOVERY_AAD_PREFIX.len() + salt.len() + fingerprint.len());
    aad.extend_from_slice(RECOVERY_AAD_PREFIX);
    aad.extend_from_slice(salt);
    aad.extend_from_slice(fingerprint.as_bytes());
    aad
}

pub fn read_existing_vault(
    conn: &Connection,
    cached: &Mutex<Option<(Vec<u8>, DataKey)>>,
) -> Result<Option<VaultOpenOutcome>, &'static str> {
    let row = conn
        .query_row(
            "SELECT dpapi_wrapped_dek, recovery_wrapped_dek, recovery_fingerprint, recovery_configured_at
             FROM vault_key WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, Vec<u8>>(0)?,
                    r.get::<_, Option<Vec<u8>>>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|_| VAULT_IO_ERROR)?;

    let Some((dpapi_blob, recovery_blob, fingerprint, configured_at)) = row else {
        return Ok(None);
    };
    let has_recovery_key = recovery_blob.is_some();

    if let Ok(guard) = cached.lock() {
        if let Some((ref cached_blob, ref dek)) = *guard {
            if cached_blob == &dpapi_blob {
                return Ok(Some(VaultOpenOutcome::Unlocked(
                    dek.clone(),
                    VaultStatus {
                        locked: false,
                        has_recovery_key,
                        recovery_fingerprint: fingerprint,
                        recovery_configured_at: configured_at,
                    },
                )));
            }
        }
    }

    match crypto::open(&dpapi_blob, DPAPI_DEK_SCOPE)
        .map(Zeroizing::new)
        .and_then(|raw| DataKey::from_slice(&raw))
    {
        Ok(dek) => {
            if let Ok(mut guard) = cached.lock() {
                *guard = Some((dpapi_blob, dek.clone()));
            }
            Ok(Some(VaultOpenOutcome::Unlocked(
                dek,
                VaultStatus {
                    locked: false,
                    has_recovery_key,
                    recovery_fingerprint: fingerprint,
                    recovery_configured_at: configured_at,
                },
            )))
        }
        Err(_) => {
            if let Ok(mut guard) = cached.lock() {
                *guard = None;
            }
            Ok(Some(VaultOpenOutcome::Locked(VaultStatus {
                locked: true,
                has_recovery_key,
                recovery_fingerprint: fingerprint,
                recovery_configured_at: configured_at,
            })))
        }
    }
}

pub fn open_or_init_vault(tx: &Connection) -> Result<VaultOpenOutcome, &'static str> {
    let row = tx
        .query_row(
            "SELECT dpapi_wrapped_dek, recovery_wrapped_dek, recovery_fingerprint, recovery_configured_at
             FROM vault_key WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, Vec<u8>>(0)?,
                    r.get::<_, Option<Vec<u8>>>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|_| VAULT_IO_ERROR)?;

    if let Some((dpapi_blob, recovery_blob, fingerprint, configured_at)) = row {
        let has_recovery_key = recovery_blob.is_some();
        match crypto::open(&dpapi_blob, DPAPI_DEK_SCOPE)
            .map(Zeroizing::new)
            .and_then(|raw| DataKey::from_slice(&raw))
        {
            Ok(dek) => Ok(VaultOpenOutcome::Unlocked(
                dek,
                VaultStatus {
                    locked: false,
                    has_recovery_key,
                    recovery_fingerprint: fingerprint,
                    recovery_configured_at: configured_at,
                },
            )),
            Err(_) => Ok(VaultOpenOutcome::Locked(VaultStatus {
                locked: true,
                has_recovery_key,
                recovery_fingerprint: fingerprint,
                recovery_configured_at: configured_at,
            })),
        }
    } else {
        let dek = DataKey::generate();
        let wrapped = crypto::seal(dek.as_bytes(), DPAPI_DEK_SCOPE).map_err(|_| VAULT_IO_ERROR)?;
        tx.execute(
            "INSERT INTO vault_key (id, dpapi_wrapped_dek) VALUES (1, ?1)",
            [wrapped],
        )
        .map_err(|_| VAULT_IO_ERROR)?;
        Ok(VaultOpenOutcome::Unlocked(
            dek,
            VaultStatus {
                locked: false,
                has_recovery_key: false,
                recovery_fingerprint: None,
                recovery_configured_at: None,
            },
        ))
    }
}

pub fn generate_recovery_key(
    tx: &Connection,
    dek: &DataKey,
    has_existing: bool,
    confirm_rotate: bool,
) -> Result<GeneratedRecoveryKey, &'static str> {
    if has_existing && !confirm_rotate {
        return Err("Mevcut kurtarma anahtarını yenilemek için onay kutusunu işaretleyin.");
    }
    let mut secret = Zeroizing::new([0u8; 32]);
    OsRng.fill_bytes(secret.as_mut());
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);

    let fingerprint = compute_fingerprint(&secret);
    let kek = derive_kek(&secret, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(kek.as_slice()).map_err(|_| VAULT_IO_ERROR)?;
    let aad = recovery_aad(&salt, &fingerprint);
    let ct = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), Payload { msg: dek.as_bytes(), aad: &aad })
        .map_err(|_| VAULT_IO_ERROR)?;

    let mut wrapped = Vec::with_capacity(68);
    wrapped.extend_from_slice(RECOVERY_WRAP_MAGIC);
    wrapped.extend_from_slice(&nonce_bytes);
    wrapped.extend_from_slice(&ct);

    let configured_at: String = tx
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%SZ', 'now')", [], |r| r.get(0))
        .map_err(|_| VAULT_IO_ERROR)?;

    tx.execute(
        "UPDATE vault_key
         SET recovery_wrapped_dek = ?1, recovery_salt = ?2,
             recovery_fingerprint = ?3, recovery_configured_at = ?4
         WHERE id = 1",
        params![wrapped, salt.as_slice(), &fingerprint, &configured_at],
    )
    .map_err(|_| VAULT_IO_ERROR)?;

    Ok(GeneratedRecoveryKey {
        recovery_key: encode_recovery_key(&secret),
        recovery_fingerprint: fingerprint,
        recovery_configured_at: configured_at,
    })
}

pub fn unlock_with_recovery_key(tx: &Connection, raw_key: &str) -> Result<DataKey, &'static str> {
    let secret = decode_recovery_key(raw_key)?;
    let row = tx
        .query_row(
            "SELECT recovery_wrapped_dek, recovery_salt, recovery_fingerprint FROM vault_key WHERE id = 1",
            [],
            |r| {
                Ok((
                    r.get::<_, Option<Vec<u8>>>(0)?,
                    r.get::<_, Option<Vec<u8>>>(1)?,
                    r.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .map_err(|_| VAULT_IO_ERROR)?
        .ok_or(VAULT_IO_ERROR)?;

    let (Some(wrapped), Some(salt_vec), Some(stored_fp)) = row else {
        return Err("Bu veri kasası için tanımlanmış bir kurtarma anahtarı bulunmuyor.");
    };
    if wrapped.len() != 68 || !wrapped.starts_with(RECOVERY_WRAP_MAGIC) || salt_vec.len() != 16 {
        return Err(VAULT_IO_ERROR);
    }
    let mut salt = [0u8; 16];
    salt.copy_from_slice(&salt_vec);
    let kek = derive_kek(&secret, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(kek.as_slice()).map_err(|_| VAULT_IO_ERROR)?;
    let aad = recovery_aad(&salt, &stored_fp);
    let dek_raw = Zeroizing::new(
        cipher
            .decrypt(Nonce::from_slice(&wrapped[8..20]), Payload { msg: &wrapped[20..], aad: &aad })
            .map_err(|_| KEY_AUTH_ERROR)?,
    );
    if compute_fingerprint(&secret) != stored_fp {
        return Err(KEY_AUTH_ERROR);
    }
    let dek = DataKey::from_slice(&dek_raw).map_err(|_| VAULT_IO_ERROR)?;
    let new_dpapi = crypto::seal(dek.as_bytes(), DPAPI_DEK_SCOPE).map_err(|_| VAULT_IO_ERROR)?;
    tx.execute("UPDATE vault_key SET dpapi_wrapped_dek = ?1 WHERE id = 1", [new_dpapi])
        .map_err(|_| VAULT_IO_ERROR)?;
    Ok(dek)
}
