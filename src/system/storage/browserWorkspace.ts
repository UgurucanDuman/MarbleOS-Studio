import { createEmptyStudioSnapshot } from '../sqlite/emptySnapshot';
import { healPrototypeSnapshotObject } from '../sqlite/healPrototypeSnapshot';
import { loadPrototypeSnapshot, validatePrototypeSnapshot } from '../sqlite/prototypePersistence';
import type { StudioDatabaseSnapshot } from '../sqlite/types';

type Workspace = { revision: number; snapshot: StudioDatabaseSnapshot };
const WORKSPACE = 'workspace';
const MEDIA = 'media';
export const BROWSER_PHOTO_REFERENCE = 'browser-photo:';
let opening: Promise<IDBDatabase> | undefined;

function openDatabase() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('marbleos-studio-preview', 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE)) request.result.createObjectStore(WORKSPACE);
      if (!request.result.objectStoreNames.contains(MEDIA)) request.result.createObjectStore(MEDIA);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

async function readRecord(store: string, key: string): Promise<unknown> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class BrowserWorkspaceConflict extends Error {
  constructor() {
    super('Kayıt başka bir sekmede değişti. Görünüm yenilendi. İşlemi tekrar deneyin.');
  }
}

export async function saveBrowserWorkspace(
  expectedRevision: number, snapshot: StudioDatabaseSnapshot, deletedPhotoIds: string[] = [],
): Promise<Workspace> {
  const database = await openDatabase();
  const next = {
    revision: expectedRevision + 1,
    snapshot: { ...snapshot, photos: snapshot.photos.map((photo) => ({ ...photo, dataUrl: '' })) },
  };
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([WORKSPACE, MEDIA], 'readwrite');
    const workspace = transaction.objectStore(WORKSPACE);
    const media = transaction.objectStore(MEDIA);
    const current = workspace.get(WORKSPACE);
    let failure: unknown;
    transaction.oncomplete = () => resolve(next);
    transaction.onabort = () => reject(failure ?? transaction.error);
    current.onsuccess = () => {
      if ((current.result?.revision ?? 0) !== expectedRevision) {
        failure = new BrowserWorkspaceConflict();
        transaction.abort();
        return;
      }
      try {
        const remainingIds = new Set(snapshot.photos.map(({ id }) => id));
        const previousIds = new Set<string>((current.result as Workspace | undefined)?.snapshot.photos.map(({ id }) => id));
        const removed = [...previousIds].filter((id) => !remainingIds.has(id));
        if (removed.length !== deletedPhotoIds.length || deletedPhotoIds.some((id) => !previousIds.has(id) || remainingIds.has(id)) ||
          new Set(deletedPhotoIds).size !== deletedPhotoIds.length) {
          throw new Error('Silinecek fotoğraf kayıtları geçersiz.');
        }
        for (const photo of snapshot.photos) {
          if (photo.dataUrl.startsWith(BROWSER_PHOTO_REFERENCE)) {
            const source = media.get(photo.dataUrl.slice(BROWSER_PHOTO_REFERENCE.length));
            source.onsuccess = () => {
              if (typeof source.result === 'string') {
                media.put(source.result, photo.id);
              } else {
                failure = new Error('Kopyalanacak yerel fotoğraf bulunamadı.');
                transaction.abort();
              }
            };
          } else if (photo.dataUrl) {
            media.put(photo.dataUrl, photo.id);
          }
        }
        for (const id of deletedPhotoIds) media.delete(id);
        workspace.put(next, WORKSPACE);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
  });
}

export async function loadBrowserWorkspace(): Promise<Workspace> {
  const saved = await readRecord(WORKSPACE, WORKSPACE) as Workspace | undefined;
  if (saved !== undefined) {
    if (!Number.isSafeInteger(saved?.revision) || saved.revision < 1) throw new Error('Yerel kayıt sürümü geçersiz.');
    const snapshot = validatePrototypeSnapshot(healPrototypeSnapshotObject(saved.snapshot));
    if (!snapshot.photos.some((photo) => photo.dataUrl)) return { revision: saved.revision, snapshot };
    return migrateBrowserWorkspace(saved.revision, snapshot);
  }
  const legacy = loadPrototypeSnapshot({ rewrite: false });
  if (legacy.error) throw new Error(legacy.error);
  if (!legacy.hasLegacyData) return { revision: 0, snapshot: createEmptyStudioSnapshot() };
  return migrateBrowserWorkspace(0, legacy.snapshot);
}

async function migrateBrowserWorkspace(revision: number, snapshot: StudioDatabaseSnapshot): Promise<Workspace> {
  try {
    return await saveBrowserWorkspace(revision, snapshot);
  } catch (error) {
    if (error instanceof BrowserWorkspaceConflict) return loadBrowserWorkspace();
    throw error;
  }
}

export async function loadBrowserPhoto(photoId: string): Promise<string> {
  const value = await readRecord(MEDIA, photoId);
  if (typeof value !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Yerel fotoğraf okunamadı.');
  }
  return value;
}

