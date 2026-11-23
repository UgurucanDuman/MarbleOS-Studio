import {
  BACKUP_FORMAT_ENCRYPTED,
  BACKUP_KDF_ITERATIONS,
  BACKUP_KDF_MIN_ITERATIONS,
  WORKSPACE_BACKUP_FORMAT_ENCRYPTED,
  encryptedBackupEnvelopeSchema,
  encryptedWorkspaceEnvelopeSchema,
} from '../schemas/backupSchemas';

/**
 * Okul ve çalışma alanı yedeği şifreleme çekirdeği (yerel, ağsız):
 * - Parola NFC'ye normalize edilir → PBKDF2-SHA256 (varsayılan 600.000 tur, 16 bayt rastgele tuz) → AES-256-GCM anahtarı.
 * - Her yedekte yeni rastgele 12 bayt IV kullanılır; aynı veri iki kez şifrelense bile çıktı farklıdır.
 * - Biçim, tur sayısı, tuz ve IV, AES-GCM ek doğrulama verisine (AAD) bağlanır: başlıktaki veya şifreli
 *   gövdedeki tek bir değişiklik çözmeyi başarısız kılar. Parola hiçbir yere yazılmaz ve saklanmaz.
 */

const DECRYPT_ERROR = 'Parola yanlış veya yedek dosyası bozuk/değiştirilmiş. Kayıtlar değiştirilmedi.';
const encoder = new TextEncoder();

type AnyEnvelopeHeader = {
  format: typeof BACKUP_FORMAT_ENCRYPTED | typeof WORKSPACE_BACKUP_FORMAT_ENCRYPTED;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
};

export type BackupFileKind = 'encrypted' | 'encrypted-workspace' | 'legacy-plain' | 'unknown';

function subtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Bu ortamda güvenli şifreleme kullanılamıyor; yedek oluşturulmadı.');
  return subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function randomBytes(length: number): ArrayBuffer {
  const buffer = new ArrayBuffer(length);
  globalThis.crypto.getRandomValues(new Uint8Array(buffer));
  return buffer;
}

function utf8(value: string): ArrayBuffer {
  const encoded = encoder.encode(value);
  const buffer = new ArrayBuffer(encoded.length);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

function headerAad(envelope: AnyEnvelopeHeader): ArrayBuffer {
  const { format, kdf, cipher } = envelope;
  return utf8([format, kdf.name, kdf.hash, kdf.iterations, kdf.salt, cipher.name, cipher.iv].join('|'));
}

async function deriveKey(password: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
  const subtle = subtleCrypto();
  const base = await subtle.importKey('raw', utf8(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function sealBackupWithFormat(
  format: AnyEnvelopeHeader['format'],
  plainJson: string,
  password: string,
  options: { iterations?: number } = {},
): Promise<string> {
  const iterations = Math.max(BACKUP_KDF_MIN_ITERATIONS, options.iterations ?? BACKUP_KDF_ITERATIONS);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const header: AnyEnvelopeHeader = {
    format,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(new Uint8Array(salt)) },
    cipher: { name: 'AES-GCM', iv: toBase64(new Uint8Array(iv)) },
  };
  const key = await deriveKey(password, salt, iterations);
  const sealed = await subtleCrypto().encrypt(
    { name: 'AES-GCM', iv, additionalData: headerAad(header), tagLength: 128 },
    key,
    utf8(plainJson),
  );
  const raw = { ...header, ciphertext: toBase64(new Uint8Array(sealed)) };
  const envelope = format === BACKUP_FORMAT_ENCRYPTED
    ? encryptedBackupEnvelopeSchema.parse(raw)
    : encryptedWorkspaceEnvelopeSchema.parse(raw);
  return JSON.stringify(envelope);
}

export function encryptSchoolBackup(
  plainJson: string,
  password: string,
  options: { iterations?: number } = {},
): Promise<string> {
  return sealBackupWithFormat(BACKUP_FORMAT_ENCRYPTED, plainJson, password, options);
}

export function encryptWorkspaceBackup(
  plainJson: string,
  password: string,
  options: { iterations?: number } = {},
): Promise<string> {
  return sealBackupWithFormat(WORKSPACE_BACKUP_FORMAT_ENCRYPTED, plainJson, password, options);
}

/** Dosya metninin türünü güvenle belirler; JSON değilse veya tanınmıyorsa `unknown` döner. */
export function detectBackupKind(fileText: string): BackupFileKind {
  try {
    const parsed: unknown = JSON.parse(fileText);
    if (!parsed || typeof parsed !== 'object') return 'unknown';
    const format = (parsed as { format?: unknown }).format;
    if (format === BACKUP_FORMAT_ENCRYPTED) return 'encrypted';
    if (format === WORKSPACE_BACKUP_FORMAT_ENCRYPTED) return 'encrypted-workspace';
    if (format === 'marbleos-school-backup-v1') return 'legacy-plain';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function openBackupEnvelope(
  fileText: string,
  password: string,
  expectedFormat: AnyEnvelopeHeader['format'],
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error('Yedek dosyası okunamadı; biçim geçersiz.');
  }
  const checked = expectedFormat === BACKUP_FORMAT_ENCRYPTED
    ? encryptedBackupEnvelopeSchema.safeParse(parsed)
    : encryptedWorkspaceEnvelopeSchema.safeParse(parsed);
  if (!checked.success) throw new Error('Şifreli yedek biçimi geçersiz veya desteklenmeyen sürüm.');
  const envelope = checked.data;
  const subtle = subtleCrypto();
  try {
    const key = await deriveKey(password, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv), additionalData: headerAad(envelope), tagLength: 128 },
      key,
      fromBase64(envelope.ciphertext),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch {
    throw new Error(DECRYPT_ERROR);
  }
}

export function decryptSchoolBackup(fileText: string, password: string): Promise<string> {
  return openBackupEnvelope(fileText, password, BACKUP_FORMAT_ENCRYPTED);
}

export function decryptWorkspaceBackup(fileText: string, password: string): Promise<string> {
  return openBackupEnvelope(fileText, password, WORKSPACE_BACKUP_FORMAT_ENCRYPTED);
}
