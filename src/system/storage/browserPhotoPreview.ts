import { loadBrowserPhoto } from './browserWorkspace';

const MAX_PREVIEW_SIDE = 512;
const MAX_PREVIEW_CACHE = 250;
const MAX_CONCURRENT_DECODES = 2;

const previewCache = new Map<string, string>();
const inflightPreviews = new Map<string, Promise<string>>();
let activeDecodes = 0;
const decodeWaiters: Array<() => void> = [];

function acquireDecodeSlot(): Promise<void> {
  if (activeDecodes < MAX_CONCURRENT_DECODES) {
    activeDecodes += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    decodeWaiters.push(() => {
      activeDecodes += 1;
      resolve();
    });
  });
}

function releaseDecodeSlot() {
  activeDecodes = Math.max(0, activeDecodes - 1);
  const next = decodeWaiters.shift();
  if (next) next();
}

function revokeIfBlobUrl(url: string | undefined) {
  if (url && url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function rememberPreview(photoId: string, url: string): string {
  const previous = previewCache.get(photoId);
  if (previous && previous !== url) revokeIfBlobUrl(previous);
  previewCache.delete(photoId);
  while (previewCache.size >= MAX_PREVIEW_CACHE) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey === undefined) break;
    revokeIfBlobUrl(previewCache.get(oldestKey));
    previewCache.delete(oldestKey);
  }
  previewCache.set(photoId, url);
  return url;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIdx);
  const mimeMatch = /^data:(image\/(?:jpeg|png|webp));base64$/i.exec(header);
  const mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
  const binary = atob(dataUrl.slice(commaIdx + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function renderCanvasBlob(bitmap: ImageBitmap, width: number, height: number, mime: string): Promise<Blob | null> {
  const outType = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = outType === 'image/jpeg' ? 0.85 : undefined;
  const ctxOpts: CanvasRenderingContext2DSettings = {
    alpha: outType === 'image/png',
    willReadFrequently: false,
  };
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', ctxOpts) ?? canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      if (typeof canvas.convertToBlob === 'function') {
        return canvas.convertToBlob({ type: outType, quality });
      }
    }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', ctxOpts) ?? canvas.getContext('2d');
    if (ctx && typeof canvas.toBlob === 'function') {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      return new Promise((resolve) => canvas.toBlob(resolve, outType, quality));
    }
  }
  return null;
}

async function buildDownscaledPreviewUrl(dataUrl: string): Promise<string> {
  if (typeof createImageBitmap !== 'function' || typeof URL.createObjectURL !== 'function') {
    return dataUrl;
  }
  await acquireDecodeSlot();
  let bitmap: ImageBitmap | null = null;
  try {
    const sourceBlob = dataUrlToBlob(dataUrl);
    try {
      bitmap = await createImageBitmap(sourceBlob, { imageOrientation: 'from-image' });
    } catch {
      bitmap = await createImageBitmap(sourceBlob);
    }
    const longestSide = Math.max(bitmap.width, bitmap.height);
    if (longestSide <= MAX_PREVIEW_SIDE && sourceBlob.size <= 150_000) {
      return URL.createObjectURL(sourceBlob);
    }
    const scale = Math.min(1, MAX_PREVIEW_SIDE / Math.max(1, longestSide));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const previewBlob = await renderCanvasBlob(bitmap, width, height, sourceBlob.type);
    return URL.createObjectURL(previewBlob ?? sourceBlob);
  } catch {
    return dataUrl;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    releaseDecodeSlot();
  }
}

export function getCachedBrowserPhotoPreview(photoId: string): string | undefined {
  const cached = previewCache.get(photoId);
  if (cached !== undefined) {
    previewCache.delete(photoId);
    previewCache.set(photoId, cached);
  }
  return cached;
}

export function loadBrowserPhotoPreview(photoId: string): Promise<string> {
  const cached = getCachedBrowserPhotoPreview(photoId);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = inflightPreviews.get(photoId);
  if (existing) return existing;

  const task = loadBrowserPhoto(photoId)
    .then((dataUrl) => buildDownscaledPreviewUrl(dataUrl))
    .then((previewUrl) => rememberPreview(photoId, previewUrl))
    .finally(() => {
      inflightPreviews.delete(photoId);
    });

  inflightPreviews.set(photoId, task);
  return task;
}

export function evictBrowserPhotoPreviews(photoIds: Iterable<string>) {
  for (const id of photoIds) {
    revokeIfBlobUrl(previewCache.get(id));
    previewCache.delete(id);
    inflightPreviews.delete(id);
  }
}

