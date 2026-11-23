import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const sampleDataUrl = 'data:image/jpeg;base64,YQ==';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('downscales oversized browser photos to 512px blob URLs, closes ImageBitmap, caches previews and revokes on delete', async () => {
  let concurrent = 0;
  let maxObservedConcurrent = 0;
  const closeSpy = vi.fn();
  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  let blobSeq = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:studio-preview-${++blobSeq}`);

  vi.stubGlobal('createImageBitmap', vi.fn(async () => {
    concurrent += 1;
    maxObservedConcurrent = Math.max(maxObservedConcurrent, concurrent);
    await new Promise((resolve) => setTimeout(resolve, 10));
    concurrent -= 1;
    return { width: 4000, height: 6000, close: closeSpy };
  }));

  const drawImageSpy = vi.fn();
  vi.stubGlobal('OffscreenCanvas', class {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return { drawImage: drawImageSpy };
    }
    async convertToBlob() {
      return new Blob(['preview'], { type: 'image/jpeg' });
    }
  });

  const db = await import('../sqlite/studioDatabase');
  const {
    evictBrowserPhotoPreviews,
    getCachedBrowserPhotoPreview,
    loadBrowserPhotoPreview,
  } = await import('./browserPhotoPreview');

  await db.startDesktopWorkspace();
  const schoolId = await db.runStudioMutation((actions) =>
    actions.createSchool({
      name: 'Önizleme Okulu',
      institutionCode: '',
      address: '',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    }),
  );
  const classId = await db.runStudioMutation((actions) =>
    actions.addClass('1-A', 'Öğretmen', schoolId, '2026-2027'),
  );
  await db.runStudioMutation((actions) =>
    actions.uploadPhotos(
      [
        { fileName: '1.jpg', dataUrl: sampleDataUrl },
        { fileName: '2.jpg', dataUrl: sampleDataUrl },
        { fileName: '3.jpg', dataUrl: sampleDataUrl },
        { fileName: '4.jpg', dataUrl: sampleDataUrl },
      ],
      classId,
    ),
  );

  const photos = db.getStudioDatabaseSnapshot().photos;
  expect(photos).toHaveLength(4);

  const urls = await Promise.all(photos.map((photo) => loadBrowserPhotoPreview(photo.id)));
  expect(urls).toEqual([
    'blob:studio-preview-1',
    'blob:studio-preview-2',
    'blob:studio-preview-3',
    'blob:studio-preview-4',
  ]);
  expect(maxObservedConcurrent).toBeLessThanOrEqual(2);
  expect(closeSpy).toHaveBeenCalledTimes(4);
  expect(drawImageSpy).toHaveBeenCalledWith(expect.anything(), 0, 0, 341, 512);

  // Subsequent lookup hits in-memory LRU cache without re-decoding
  expect(getCachedBrowserPhotoPreview(photos[0].id)).toBe('blob:studio-preview-1');
  expect(await loadBrowserPhotoPreview(photos[0].id)).toBe('blob:studio-preview-1');
  expect(closeSpy).toHaveBeenCalledTimes(4);

  evictBrowserPhotoPreviews([photos[0].id]);
  expect(revokeSpy).toHaveBeenCalledWith('blob:studio-preview-1');
  expect(getCachedBrowserPhotoPreview(photos[0].id)).toBeUndefined();
});

test('omits CSS filter and transform GPU surfaces when adjustments are at default values', async () => {
  const { photoAdjustmentStyle } = await import('./StudioPhotoImage');
  expect(photoAdjustmentStyle({ zoom: 1, brightness: 100, contrast: 100, warmth: 0 })).toBeUndefined();
  expect(photoAdjustmentStyle({ zoom: 1, brightness: 100, contrast: 100, warmth: 0 }, true, true)).toEqual({
    transform: 'translate3d(0, 0, 0)',
    backfaceVisibility: 'hidden',
  });
  expect(photoAdjustmentStyle({ zoom: 1.15, brightness: 100, contrast: 100, warmth: 0 })).toEqual({
    transform: 'scale3d(1.15, 1.15, 1)',
    filter: undefined,
    backfaceVisibility: 'hidden',
  });
  expect(photoAdjustmentStyle({ zoom: 1, brightness: 110, contrast: 95, warmth: 10 }, true)).toEqual({
    transform: undefined,
    filter: 'brightness(110%) contrast(95%) sepia(8.5%) saturate(102.5%)',
  });
  expect(
    photoAdjustmentStyle({
      zoom: 1.6,
      panX: 12,
      panY: -15,
      tilt: 3,
      rotation: 90,
      brightness: 100,
      contrast: 100,
      warmth: 0,
    }),
  ).toEqual({
    transform: 'scale3d(1.6, 1.6, 1) rotate(3deg) translate3d(12%, -15%, 0) rotate(90deg)',
    filter: undefined,
    backfaceVisibility: 'hidden',
  });
});


