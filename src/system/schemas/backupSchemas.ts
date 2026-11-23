import { z } from 'zod';

/**
 * Şifreli okul/kasa yedeği ve 256-bit Kurtarma Anahtarı için Zod şemaları.
 * - Parola kuralı yedek alırken uygulanır; geri yüklerken yalnız boş/aşırı uzun girişler reddedilir.
 * - Zarf alanları tam uzunluk ve sınırlarla doğrulanır; PBKDF2 turu sınır dışıysa anahtar türetilmeden reddedilir.
 * - Kurtarma Anahtarı 56 Crockford Base32 karakterinden (32 bayt CSPRNG + 3 bayt SHA-256 sağlama toplamı) oluşur.
 */

export const BACKUP_FORMAT_ENCRYPTED = 'marbleos-school-backup-v2-encrypted';
export const WORKSPACE_BACKUP_FORMAT_ENCRYPTED = 'marbleos-workspace-backup-v1-encrypted';
export const BACKUP_KDF_ITERATIONS = 600_000;
export const BACKUP_KDF_MIN_ITERATIONS = 100_000;
export const BACKUP_KDF_MAX_ITERATIONS = 2_000_000;
export const BACKUP_PASSWORD_MIN = 10;
export const BACKUP_PASSWORD_MAX = 128;
/** Şifreli dosya üst sınırı: 115 MB düz yedek, base64 ile ~%34 büyür + başlık payı. */
export const ENCRYPTED_BACKUP_FILE_MAX = 160_000_000;

const CROCKFORD_RE = /^[0-9A-HJ-KM-NP-TV-Z]{56}$/;

const base64 = (bytes: number) =>
  z.string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Yedek dosyası biçimi geçersiz.')
    .refine((value) => value.length === Math.ceil(bytes / 3) * 4, 'Yedek dosyası biçimi geçersiz.');

const kdfSchema = z.object({
  name: z.literal('PBKDF2'),
  hash: z.literal('SHA-256'),
  iterations: z.number().int().min(BACKUP_KDF_MIN_ITERATIONS).max(BACKUP_KDF_MAX_ITERATIONS),
  salt: base64(16),
}).strict();

const cipherSchema = z.object({
  name: z.literal('AES-GCM'),
  iv: base64(12),
}).strict();

const ciphertextSchema = z.string()
  .min(24, 'Yedek dosyası biçimi geçersiz.')
  .max(ENCRYPTED_BACKUP_FILE_MAX)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Yedek dosyası biçimi geçersiz.');

export const encryptedBackupEnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT_ENCRYPTED),
  kdf: kdfSchema,
  cipher: cipherSchema,
  ciphertext: ciphertextSchema,
}).strict();

export const encryptedWorkspaceEnvelopeSchema = z.object({
  format: z.literal(WORKSPACE_BACKUP_FORMAT_ENCRYPTED),
  kdf: kdfSchema,
  cipher: cipherSchema,
  ciphertext: ciphertextSchema,
}).strict();

/** Yedek alırken: en az 10 karakter, harf ve rakam/simge içermeli, iki giriş aynı olmalı. */
export const backupPasswordSchema = z.object({
  password: z.string()
    .min(BACKUP_PASSWORD_MIN, `Parola en az ${BACKUP_PASSWORD_MIN} karakter olmalı.`)
    .max(BACKUP_PASSWORD_MAX, `Parola en fazla ${BACKUP_PASSWORD_MAX} karakter olabilir.`)
    .refine((value) => /\p{L}/u.test(value) && /[\p{N}\p{P}\p{S}]/u.test(value),
      'Parola en az bir harf ve bir rakam veya simge içermeli.'),
  confirm: z.string(),
}).refine((value) => value.password === value.confirm, {
  message: 'Parolalar birbiriyle aynı değil.',
  path: ['confirm'],
});

/** Geri yüklerken: kural dayatılmaz (eski parola değişmiş olabilir), yalnız boş ve aşırı uzun giriş reddedilir. */
export const backupUnlockPasswordSchema = z.string()
  .min(1, 'Yedeğin parolasını girin.')
  .max(BACKUP_PASSWORD_MAX, `Parola en fazla ${BACKUP_PASSWORD_MAX} karakter olabilir.`);

/** Kullanıcı girişinden tire/boşlukları temizler ve Crockford eşdeğerlerini (O→0, I/L→1) normalize eder. */
export function normalizeRecoveryKeyCompact(raw: string): string {
  return raw
    .replace(/[-\s]+/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function formatRecoveryKeyGroups(compact: string): string {
  return compact.match(/.{1,8}/g)?.join('-') ?? compact;
}

export const recoveryKeyInputSchema = z.string()
  .min(1, 'Kurtarma anahtarını girin.')
  .max(128, 'Kurtarma anahtarı çok uzun.')
  .transform(normalizeRecoveryKeyCompact)
  .refine((val) => CROCKFORD_RE.test(val), 'Kurtarma anahtarı 56 geçerli karakterden (7×8 grup) oluşmalıdır.')
  .transform(formatRecoveryKeyGroups);

export const vaultStatusSchema = z.object({
  locked: z.boolean(),
  hasRecoveryKey: z.boolean(),
  recoveryFingerprint: z.string().regex(/^[0-9A-F]{8}$/).nullable(),
  recoveryConfiguredAt: z.string().min(1).max(50).nullable(),
}).strict();

export const generatedRecoveryKeySchema = z.object({
  recoveryKey: z.string().regex(/^(?:[0-9A-HJ-KM-NP-TV-Z]{8}-){6}[0-9A-HJ-KM-NP-TV-Z]{8}$/),
  recoveryFingerprint: z.string().regex(/^[0-9A-F]{8}$/),
  recoveryConfiguredAt: z.string().min(1).max(50),
}).strict();

export type VaultStatus = z.infer<typeof vaultStatusSchema>;
export type GeneratedRecoveryKey = z.infer<typeof generatedRecoveryKeySchema>;
