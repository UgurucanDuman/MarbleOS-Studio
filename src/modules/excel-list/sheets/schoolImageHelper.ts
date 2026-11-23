import { SCHOOL_LIMITS } from '../../../system/schemas/schoolSchemas';

/**
 * Okul görselleri (logo, müdür/müdür yrd. imzası, okul resmi) için dosya doğrulama yardımcısı.
 * - Okul Logosu ve İmzalar: en fazla 3 MB
 * - Okul Resmi (kütük defteri kapağı): en fazla 8 MB
 * Orijinal dosya baytları değiştirilmez; MIME, boyut ve dosya başlık imzası doğrulanır.
 */

export type SchoolImageSlotKind = 'logo' | 'signature' | 'cover';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Dosyanın ilk 12 baytından gerçek görüntü imzasını (JPEG / PNG / WebP) doğrular. */
export function hasValidImageSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isJpeg || isPng || isWebp;
}

function readHeaderBytes(file: File): Promise<Uint8Array> {
  const slice = file.slice(0, 12);
  if (typeof slice.arrayBuffer === 'function') {
    return slice.arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(new Uint8Array(reader.result))
        : reject(new Error('Görsel başlığı okunamadı.'));
    reader.onerror = reader.onabort = () => reject(new Error('Görsel başlığı okunamadı.'));
    reader.readAsArrayBuffer(slice);
  });
}

/** Seçilen görsel dosyasını türüne göre (3 MB veya 8 MB) doğrular ve Data URL döndürür. */
export async function readValidatedSchoolImage(
  file: File,
  kind: SchoolImageSlotKind = 'logo',
): Promise<string> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Yalnızca PNG, JPEG veya WebP görsel seçilebilir.');
  }
  const maxBytes =
    kind === 'cover' ? SCHOOL_LIMITS.schoolPhotoBytesMax : SCHOOL_LIMITS.logoAndSignatureBytesMax;
  if (file.size === 0 || file.size > maxBytes) {
    throw new Error(
      kind === 'cover'
        ? 'Okul resmi en fazla 8 MB olabilir.'
        : 'Logo ve imza görselleri en fazla 3 MB olabilir.',
    );
  }
  const header = await readHeaderBytes(file);
  if (!hasValidImageSignature(header)) {
    throw new Error('Dosya geçerli bir PNG, JPEG veya WebP görüntüsü değil.');
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Görsel okunamadı.'));
    reader.onerror = reader.onabort = () => reject(new Error('Görsel okunamadı; değişiklik yapılmadı.'));
    reader.readAsDataURL(file);
  });
}
