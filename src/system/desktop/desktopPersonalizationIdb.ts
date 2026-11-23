const DB_NAME = 'marbleos-desktop-assets';
const DB_VERSION = 2;
export const WALLPAPER_STORE = 'wallpapers';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'personalization-v2';

let dbOpening: Promise<IDBDatabase> | undefined;

export function openDesktopAssetsDb(): Promise<IDBDatabase> | null {
  if (typeof globalThis.indexedDB === 'undefined') return null;
  dbOpening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(WALLPAPER_STORE)) {
        req.result.createObjectStore(WALLPAPER_STORE);
      }
      if (!req.result.objectStoreNames.contains(SETTINGS_STORE)) {
        req.result.createObjectStore(SETTINGS_STORE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbOpening = undefined;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  }).catch((err: unknown) => {
    dbOpening = undefined;
    throw err;
  });
  return dbOpening;
}

export async function savePersonalizationToIdb(data: unknown): Promise<void> {
  const opening = openDesktopAssetsDb();
  if (!opening) return;
  const db = await opening;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(data, SETTINGS_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadPersonalizationFromIdb(): Promise<unknown | null> {
  const opening = openDesktopAssetsDb();
  if (!opening) return null;
  const db = await opening;
  return new Promise<unknown>((resolve, reject) => {
    const req = db.transaction(SETTINGS_STORE, 'readonly').objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPersonalizationIdb(): Promise<void> {
  const opening = openDesktopAssetsDb();
  if (!opening) return;
  try {
    const db = await opening;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      tx.objectStore(SETTINGS_STORE).delete(SETTINGS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cleanup failures
  }
}

