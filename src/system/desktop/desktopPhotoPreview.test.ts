import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const loadDesktopPhotoPreview = vi.hoisted(() => vi.fn());
vi.mock('./desktopStorage', () => ({
  loadDesktopPhotoPreview,
}));

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

beforeEach(() => {
  vi.resetModules();
  loadDesktopPhotoPreview.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('desktopPhotoPreview converts base64 IPC previews into cached blob URLs, bounds concurrency, and revokes on eviction', async () => {
  const createdUrls: string[] = [];
  const revokedUrls: string[] = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        expect(blob.type).toBe('image/png');
        const url = `blob:desktop-preview-${createdUrls.length + 1}`;
        createdUrls.push(url);
        return url;
      }),
      revokeObjectURL: vi.fn((url: string) => {
        revokedUrls.push(url);
      }),
    }),
  );

  let inFlight = 0;
  let peakInFlight = 0;
  loadDesktopPhotoPreview.mockImplementation(async () => {
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return TINY_PNG;
  });

  const {
    evictDesktopPhotoPreviews,
    getCachedDesktopPhotoPreview,
    loadCachedDesktopPhotoPreview,
  } = await import('./desktopPhotoPreview');

  // Same ID concurrent calls deduplicate into a single IPC call
  const [sameA, sameB] = await Promise.all([
    loadCachedDesktopPhotoPreview('id-0'),
    loadCachedDesktopPhotoPreview('id-0'),
  ]);
  expect(sameA).toBe('blob:desktop-preview-1');
  expect(sameB).toBe(sameA);
  expect(loadDesktopPhotoPreview).toHaveBeenCalledTimes(1);
  expect(getCachedDesktopPhotoPreview('id-0')).toBe('blob:desktop-preview-1');

  // 14 parallel preview loads cap concurrent IPC requests to <= 6
  await Promise.all(
    Array.from({ length: 14 }, (_, idx) => loadCachedDesktopPhotoPreview(`batch-${idx}`)),
  );
  expect(peakInFlight).toBeLessThanOrEqual(6);

  // Evicting deleted photo IDs revokes blob URLs immediately
  evictDesktopPhotoPreviews(['id-0']);
  expect(revokedUrls).toContain('blob:desktop-preview-1');
  expect(getCachedDesktopPhotoPreview('id-0')).toBeUndefined();
});
