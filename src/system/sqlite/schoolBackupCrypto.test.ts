import { expect, test } from 'vitest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';
import {
  BACKUP_KDF_ITERATIONS, backupPasswordSchema, backupUnlockPasswordSchema,
} from '../schemas/backupSchemas';
import { createEmptyStudioSnapshot } from './emptySnapshot';
import { buildSchoolBackupPackage, restoreSchoolFromBackupJson } from './schoolBackup';
import { decryptSchoolBackup, detectBackupKind, encryptSchoolBackup } from './schoolBackupCrypto';
import { validatePrototypeSnapshot } from './prototypePersistence';

const FAST = { iterations: 100_000 };
const PASSWORD = 'Okul-Yedek-2026!';

function richSeed() {
  const seed = structuredClone(INITIAL_STUDIO_SEED);
  seed.students[0] = { ...seed.students[0], idCard: { nationalId: '10987654321', bloodType: '0 Rh+' } };
  return seed;
}

test('encrypted backup round-trips with the production KDF and restores valid relations', async () => {
  const plain = buildSchoolBackupPackage(richSeed(), 'sch-1').json;
  const fileText = await encryptSchoolBackup(plain, PASSWORD);
  expect(JSON.parse(fileText).kdf.iterations).toBe(BACKUP_KDF_ITERATIONS);
  expect(detectBackupKind(fileText)).toBe('encrypted');

  const decrypted = await decryptSchoolBackup(fileText, PASSWORD);
  expect(decrypted).toBe(plain);
  const restored = restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), decrypted, '00001');
  expect(() => validatePrototypeSnapshot(restored)).not.toThrow();
  expect(restored.students[0]?.idCard?.nationalId).toBe('10987654321');
}, 20_000);

test('encrypted file contains no readable personal data', async () => {
  const seed = richSeed();
  seed.students[0] = { ...seed.students[0]!, firstName: 'Gökçen Şule', lastName: 'Doğan Çelik' };
  const fileText = await encryptSchoolBackup(buildSchoolBackupPackage(seed, 'sch-1').json, PASSWORD, FAST);
  // Hepsi base64 alfabesinde bulunmayan karakter (boşluk, Türkçe harf, +/-) veya 11 hane içerir; tesadüfen eşleşemez.
  for (const secret of ['10987654321', '0 Rh+', 'Gökçen Şule', 'Doğan Çelik', 'Ayşe Yılmaz', seed.schools[0]!.name]) {
    expect(fileText).not.toContain(secret);
  }
  expect(fileText).not.toContain(PASSWORD);
  expect(Object.keys(JSON.parse(fileText)).sort()).toEqual(['cipher', 'ciphertext', 'format', 'kdf']);
});

test('the same data encrypts differently every time (fresh salt and IV)', async () => {
  const plain = buildSchoolBackupPackage(richSeed(), 'sch-1').json;
  const a = JSON.parse(await encryptSchoolBackup(plain, PASSWORD, FAST));
  const b = JSON.parse(await encryptSchoolBackup(plain, PASSWORD, FAST));
  expect(a.kdf.salt).not.toBe(b.kdf.salt);
  expect(a.cipher.iv).not.toBe(b.cipher.iv);
  expect(a.ciphertext).not.toBe(b.ciphertext);
});

test('wrong password is rejected without revealing data', async () => {
  const fileText = await encryptSchoolBackup('{"secret":"10987654321"}', PASSWORD, FAST);
  await expect(decryptSchoolBackup(fileText, 'Okul-Yedek-2027!')).rejects.toThrow('Parola yanlış');
  await expect(decryptSchoolBackup(fileText, '')).rejects.toThrow('Parola yanlış');
});

test('a single changed byte in the ciphertext or header makes the backup unreadable', async () => {
  const envelope = JSON.parse(await encryptSchoolBackup('{"a":1}', PASSWORD, FAST));

  const body = envelope.ciphertext as string;
  const flipped = (body[5] === 'A' ? 'B' : 'A');
  const tamperedBody = { ...envelope, ciphertext: body.slice(0, 5) + flipped + body.slice(6) };
  await expect(decryptSchoolBackup(JSON.stringify(tamperedBody), PASSWORD)).rejects.toThrow('Parola yanlış');

  const tamperedRounds = { ...envelope, kdf: { ...envelope.kdf, iterations: envelope.kdf.iterations + 1 } };
  await expect(decryptSchoolBackup(JSON.stringify(tamperedRounds), PASSWORD)).rejects.toThrow('Parola yanlış');
});

test('ciphertext is bound to its header: the right key without the header AAD cannot open it', async () => {
  const envelope = JSON.parse(await encryptSchoolBackup('{"a":1}', PASSWORD, FAST));
  const b64 = (v: string): ArrayBuffer => {
    const buffer = new ArrayBuffer(atob(v).length);
    new Uint8Array(buffer).set(Array.from(atob(v), (c) => c.charCodeAt(0)));
    return buffer;
  };
  const text = (v: string): ArrayBuffer => {
    const encoded = new TextEncoder().encode(v);
    const buffer = new ArrayBuffer(encoded.length);
    new Uint8Array(buffer).set(encoded);
    return buffer;
  };
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey('raw', text(PASSWORD), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64(envelope.kdf.salt), iterations: envelope.kdf.iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  const open = (additionalData?: ArrayBuffer) => subtle.decrypt(
    { name: 'AES-GCM', iv: b64(envelope.cipher.iv), ...(additionalData ? { additionalData } : {}) },
    key, b64(envelope.ciphertext),
  );
  await expect(open()).rejects.toBeDefined();
  const { format, kdf, cipher } = envelope;
  const aad = text([format, kdf.name, kdf.hash, kdf.iterations, kdf.salt, cipher.name, cipher.iv].join('|'));
  expect(new TextDecoder().decode(await open(aad))).toBe('{"a":1}');
});

test('header limits are enforced before any key derivation', async () => {
  const envelope = JSON.parse(await encryptSchoolBackup('{"a":1}', PASSWORD, FAST));
  const cases = [
    { ...envelope, kdf: { ...envelope.kdf, iterations: 1_000 } },
    { ...envelope, kdf: { ...envelope.kdf, iterations: 50_000_000 } },
    { ...envelope, kdf: { ...envelope.kdf, salt: 'AAAA' } },
    { ...envelope, cipher: { ...envelope.cipher, iv: 'AAAA' } },
    { ...envelope, extra: 'x' },
  ];
  for (const bad of cases) {
    await expect(decryptSchoolBackup(JSON.stringify(bad), PASSWORD)).rejects.toThrow('Şifreli yedek biçimi geçersiz');
  }
  await expect(decryptSchoolBackup('not json', PASSWORD)).rejects.toThrow('biçim geçersiz');
});

test('composed and decomposed Unicode passwords unlock the same backup', async () => {
  const composed = 'Şifre-Öğrenci-2026';
  const fileText = await encryptSchoolBackup('{"a":1}', composed, FAST);
  await expect(decryptSchoolBackup(fileText, composed.normalize('NFD'))).resolves.toBe('{"a":1}');
});

test('legacy plain backups are still recognized so existing files are not lost', () => {
  const plain = buildSchoolBackupPackage(INITIAL_STUDIO_SEED, 'sch-1').json;
  expect(detectBackupKind(plain)).toBe('legacy-plain');
  expect(detectBackupKind('{"format":"other"}')).toBe('unknown');
  expect(detectBackupKind('')).toBe('unknown');
});

test('backup password policy blocks weak or mismatched passwords', () => {
  expect(backupPasswordSchema.safeParse({ password: 'kisa1', confirm: 'kisa1' }).success).toBe(false);
  expect(backupPasswordSchema.safeParse({ password: 'sadeceharfler', confirm: 'sadeceharfler' }).success).toBe(false);
  expect(backupPasswordSchema.safeParse({ password: '1234567890', confirm: '1234567890' }).success).toBe(false);
  const mismatch = backupPasswordSchema.safeParse({ password: PASSWORD, confirm: `${PASSWORD}x` });
  expect(mismatch.success).toBe(false);
  expect(mismatch.error?.issues[0]?.message).toBe('Parolalar birbiriyle aynı değil.');
  expect(backupPasswordSchema.safeParse({ password: PASSWORD, confirm: PASSWORD }).success).toBe(true);
  expect(backupUnlockPasswordSchema.safeParse('').success).toBe(false);
  expect(backupUnlockPasswordSchema.safeParse('x'.repeat(129)).success).toBe(false);
});
