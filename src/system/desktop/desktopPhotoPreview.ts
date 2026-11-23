import { loadDesktopPhotoPreview } from './desktopStorage';

const MAX_DESKTOP_PREVIEW_CACHE = 320;
const MAX_CONCURRENT_IPC_PREVIEWS = 6;

const desktopPreviewCache = new Map<string, string>();
const inflightDesktopPreviews = new Map<string, Promise<string>>();
let activeIpcLoads = 0;
const ipcWaiters: Array<() => void> = [];

function acquireIpcSlot(): Promise<void> {
  if (activeIpcLoads < MAX_CONCURRENT_IPC_PREVIEWS) {
    activeIpcLoads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ipcWaiters.push(() => {
      activeIpcLoads += 1;
      resolve();
    });
  });
}

function releaseIpcSlot() {
  activeIpcLoads = Math.max(0, activeIpcLoads - 1);
  const next = ipcWaiters.shift();
  if (next) next();
}

function revokeBlobUrl(url: string | undefined) {
  if (url && url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function rememberDesktopPreview(assetId: string, url: string): string {
  const prev = desktopPreviewCache.get(assetId);
  if (prev && prev !== url) revokeBlobUrl(prev);
  desktopPreviewCache.delete(assetId);
  while (desktopPreviewCache.size >= MAX_DESKTOP_PREVIEW_CACHE) {
    const oldestKey = desktopPreviewCache.keys().next().value;
    if (oldestKey === undefined) break;
    revokeBlobUrl(desktopPreviewCache.get(oldestKey));
    desktopPreviewCache.delete(oldestKey);
  }
  desktopPreviewCache.set(assetId, url);
  return url;
}

function dataUrlToObjectUrl(dataUrl: string): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return dataUrl;
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return dataUrl;
  const header = dataUrl.slice(0, commaIdx);
  const match = /^data:(image\/(?:png|jpeg|webp));base64$/i.exec(header);
  const mime = match ? match[1].toLowerCase() : 'image/png';
  try {
    const binary = atob(dataUrl.slice(commaIdx + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return dataUrl;
  }
}

export function getCachedDesktopPhotoPreview(assetId: string): string | undefined {
  const cached = desktopPreviewCache.get(assetId);
  if (cached !== undefined) {
    desktopPreviewCache.delete(assetId);
    desktopPreviewCache.set(assetId, cached);
  }
  return cached;
}

export function loadCachedDesktopPhotoPreview(assetId: string): Promise<string> {
  const cached = getCachedDesktopPhotoPreview(assetId);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inflightDesktopPreviews.get(assetId);
  if (existing) return existing;

  const task = acquireIpcSlot()
    .then(() => loadDesktopPhotoPreview(assetId))
    .then((dataUrl) => rememberDesktopPreview(assetId, dataUrlToObjectUrl(dataUrl)))
    .finally(() => {
      releaseIpcSlot();
      inflightDesktopPreviews.delete(assetId);
    });

  inflightDesktopPreviews.set(assetId, task);
  return task;
}

export function evictDesktopPhotoPreviews(assetIds: Iterable<string>): void {
  for (const id of assetIds) {
    revokeBlobUrl(desktopPreviewCache.get(id));
    desktopPreviewCache.delete(id);
    inflightDesktopPreviews.delete(id);
  }
}
