import { invoke } from '@tauri-apps/api/core';
import { PHOTO_IMPORT_LIMITS } from '../storage/photoImport';
import { openDesktopAssetsDb, WALLPAPER_STORE } from './desktopPersonalizationIdb';
import { usesDesktopStorage } from './desktopStorage';

const COMPANY_LOGO_MAX_BYTES = 3_000_000;
const ASSET_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const memoryAssets = new Map<string, string>();

function mimeForFile(name: string): string | null {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  return null;
}

function readAsBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error('Duvar kağıdı dosyası okunamadı.'));
    reader.onerror = reader.onabort = fail;
    reader.onload = () => (reader.result instanceof ArrayBuffer ? resolve(reader.result) : fail());
    reader.readAsArrayBuffer(file);
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error('Duvar kağıdı verisi çözümlenemedi.'));
    reader.onerror = reader.onabort = fail;
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : fail());
    reader.readAsDataURL(file);
  });
}

async function validateDesktopImageFile(
  file: File,
  maxBytes: number,
  label: string,
): Promise<string> {
  const mime = mimeForFile(file.name);
  if (!mime) throw new Error(`${label} için JPEG, PNG veya WebP dosyası seçin.`);
  if (file.size <= 0 || file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / 1_000_000);
    throw new Error(`${label} ${maxMb} MB veya daha küçük olmalıdır.`);
  }
  const buffer = await readAsBuffer(file);
  const header = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));
  const valid = mime === 'image/jpeg'
    ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : mime === 'image/png'
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, idx) => header[idx] === b)
      : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
  if (!valid) throw new Error('Seçilen dosya geçerli bir JPEG, PNG veya WebP görüntüsü değil.');
  const dataUrl = await readAsDataUrl(file.slice(0, file.size, mime));
  if (!ASSET_DATA_URL_RE.test(dataUrl)) {
    throw new Error(`${label} görseli doğrulanamadı.`);
  }
  return dataUrl;
}

async function saveDesktopAssetBlob(
  storageKey: string,
  file: File,
  maxBytes: number,
  label: string,
): Promise<string> {
  const dataUrl = await validateDesktopImageFile(file, maxBytes, label);
  memoryAssets.set(storageKey, dataUrl);
  if (usesDesktopStorage) {
    await invoke('studio_save_desktop_asset', { assetKey: storageKey, dataUrl });
    return dataUrl;
  }
  const opening = openDesktopAssetsDb();
  if (!opening) return dataUrl;
  try {
    const db = await opening;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WALLPAPER_STORE, 'readwrite');
      tx.objectStore(WALLPAPER_STORE).put(dataUrl, storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Bellek önbelleği aynı oturumda devrede kalır.
  }
  return dataUrl;
}

async function loadDesktopAssetDataUrl(storageKey: string): Promise<string | null> {
  const cached = memoryAssets.get(storageKey);
  if (cached) return cached;
  if (usesDesktopStorage) {
    try {
      const loaded = await invoke<string | null>('studio_load_desktop_asset', { assetKey: storageKey });
      if (typeof loaded === 'string' && ASSET_DATA_URL_RE.test(loaded)) {
        memoryAssets.set(storageKey, loaded);
        return loaded;
      }
    } catch {
      return null;
    }
    return null;
  }
  const opening = openDesktopAssetsDb();
  if (!opening) return null;
  try {
    const db = await opening;
    const value = await new Promise<unknown>((resolve, reject) => {
      const req = db.transaction(WALLPAPER_STORE, 'readonly').objectStore(WALLPAPER_STORE).get(storageKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (typeof value === 'string' && ASSET_DATA_URL_RE.test(value)) {
      memoryAssets.set(storageKey, value);
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

async function deleteDesktopAssetBlob(storageKey: string): Promise<void> {
  memoryAssets.delete(storageKey);
  if (usesDesktopStorage) {
    try {
      await invoke('studio_delete_desktop_asset', { assetKey: storageKey });
    } catch {
      // Silme hatasında bellek kaydı temizlendi.
    }
    return;
  }
  const opening = openDesktopAssetsDb();
  if (!opening) return;
  try {
    const db = await opening;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WALLPAPER_STORE, 'readwrite');
      tx.objectStore(WALLPAPER_STORE).delete(storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silme hatasında bellek kaydı zaten temizlendi.
  }
}

export async function saveCustomWallpaperBlob(id: string, file: File): Promise<string> {
  return saveDesktopAssetBlob(id, file, PHOTO_IMPORT_LIMITS.fileBytes, 'Duvar kağıdı');
}

export async function loadCustomWallpaperDataUrl(id: string): Promise<string | null> {
  return loadDesktopAssetDataUrl(id);
}

export async function deleteCustomWallpaperBlob(id: string): Promise<void> {
  return deleteDesktopAssetBlob(id);
}

export async function saveCompanyLogoBlob(assetId: string, file: File): Promise<string> {
  return saveDesktopAssetBlob(`logo:${assetId}`, file, COMPANY_LOGO_MAX_BYTES, 'Şirket logosu');
}

export async function loadCompanyLogoDataUrl(assetId: string): Promise<string | null> {
  return loadDesktopAssetDataUrl(`logo:${assetId}`);
}

export async function deleteCompanyLogoBlob(assetId: string): Promise<void> {
  return deleteDesktopAssetBlob(`logo:${assetId}`);
}

export function clearCustomWallpaperMemoryCache(): void {
  memoryAssets.clear();
}
