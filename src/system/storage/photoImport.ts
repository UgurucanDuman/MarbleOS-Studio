export const PHOTO_IMPORT_LIMITS = { count: 150, fileBytes: 10_000_000, batchBytes: 16_000_000 };
export const PHOTO_DATA_URL_LIMIT = Math.ceil(PHOTO_IMPORT_LIMITS.fileBytes / 3) * 4 + 24;

export type PhotoImportCounts = { imported: number; matched: number; unmatched: number; skipped?: number };
type SelectedPhoto = { file: File; mime: string };

export function formatPhotoSize(bytes: number) {
  const unit = bytes >= 1_000_000_000 ? 'GB' : 'MB';
  const size = bytes / (unit === 'GB' ? 1_000_000_000 : 1_000_000);
  return `${size.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${unit}`;
}

function formatForName(name: string) {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return null;
}

function readPhoto(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error('Fotoğraf okunamadı.'));
    reader.onerror = reader.onabort = fail;
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : fail();
    reader.readAsDataURL(file);
  });
}

function readBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error('Fotoğraf başlığı okunamadı.'));
    reader.onerror = reader.onabort = fail;
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : fail();
    reader.readAsArrayBuffer(file);
  });
}

export function preparePhotoSelection(fileList: File[], folder = false) {
  const photos = fileList.flatMap((file) => {
    const mime = formatForName(file.name);
    if (mime) {
      if (folder && file.webkitRelativePath.split('/').length > 2) {
        throw new Error('Alt klasörlerde fotoğraf bulundu. Yalnızca seçili sınıfın fotoğraf klasörünü açın.');
      }
      return [{ file, mime }];
    }
    if (folder) return [];
    throw new Error('JPEG, PNG veya WebP dosyası seçin. Aktarım yapılmadı.');
  });
  if (photos.length === 0) throw new Error('Aktarılabilecek JPEG, PNG veya WebP bulunamadı.');
  if (photos.length > PHOTO_IMPORT_LIMITS.count || photos.some(({ file }) =>
    file.size === 0 || file.size > PHOTO_IMPORT_LIMITS.fileBytes,
  )) {
    throw new Error('En fazla 150 fotoğraf seçin. Her fotoğraf 10 MB veya daha küçük olmalı.');
  }
  return { photos, totalBytes: photos.reduce((size, { file }) => size + file.size, 0) };
}

async function encodePhotos(photos: SelectedPhoto[]) {
  const result = [];
  for (const { file, mime } of photos) {
    const buffer = await readBuffer(file);
    const header = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
    const valid = mime === 'image/jpeg' ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      : mime === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
      : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
    if (!valid) throw new Error(`${file.name} geçerli bir fotoğraf olarak okunamadı.`);
    const digest = globalThis.crypto?.subtle
      ? new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)) : undefined;
    const contentHash = digest && Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    result.push({
      fileName: file.name, dataUrl: await readPhoto(file.slice(0, file.size, mime)),
      ...(contentHash ? { contentHash } : {}),
    });
  }
  return result;
}

export function readPhotoFilesAsDataUrls(files: File[]) {
  return encodePhotos(preparePhotoSelection(files).photos);
}

export async function importPhotoSelection(
  selection: ReturnType<typeof preparePhotoSelection>,
  inSequence: boolean,
  save: (files: Awaited<ReturnType<typeof encodePhotos>>) => Promise<PhotoImportCounts>,
  onProgress: (counts: PhotoImportCounts, savedBytes: number) => void,
) {
  const ordered = [...selection.photos];
  if (inSequence) {
    ordered.sort((a, b) => comparePhotoNames(a.file.name, b.file.name));
  }
  const batches: { files: SelectedPhoto[]; bytes: number }[] = [];
  for (const photo of ordered) {
    let batch = batches[batches.length - 1];
    if (!batch || batch.bytes + photo.file.size > PHOTO_IMPORT_LIMITS.batchBytes) {
      batch = { files: [], bytes: 0 };
      batches.push(batch);
    }
    batch.files.push(photo);
    batch.bytes += photo.file.size;
  }

  const counts: PhotoImportCounts = { imported: 0, matched: 0, unmatched: 0 };
  let savedBytes = 0;
  onProgress({ ...counts }, savedBytes);
  for (const batch of batches) {
    try {
      const result = await save(await encodePhotos(batch.files));
      counts.imported += result.imported;
      counts.matched += result.matched;
      counts.unmatched += result.unmatched;
      if (result.skipped) counts.skipped = (counts.skipped ?? 0) + result.skipped;
      savedBytes += batch.bytes;
      onProgress({ ...counts }, savedBytes);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Fotoğraf kaydedilemedi.';
      const remaining = ordered.length - counts.imported - (counts.skipped ?? 0);
      throw new Error(`${detail} ${counts.imported} fotoğraf kaydedildi, ${remaining} fotoğraf aktarılmadı. Klasörü yeniden seçebilirsiniz, mevcut fotoğraflar atlanır.`);
    }
  }
  return counts;
}

const photoNameCollator = new Intl.Collator('tr-TR', { numeric: true });
export function comparePhotoNames(a: string, b: string) {
  return photoNameCollator.compare(a, b) || a.localeCompare(b);
}

export function photoImportNotice(result: PhotoImportCounts) {
  return `${result.imported} yeni fotoğraf kaydedildi. ${result.matched} eşleşti, ${result.unmatched} elle eşleştirme bekliyor.` +
    (result.skipped ? ` ${result.skipped} mevcut fotoğraf atlandı.` : '');
}
