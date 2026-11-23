import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';

const legacyKey = 'marbleos_studio_local_prototype_v4';
const dataUrl = `data:image/png;base64,${'YWFh'.repeat(2_667_000)}`;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('migrates a legacy roster, stores a large photo separately and survives reload', async () => {
  const legacy = JSON.stringify(INITIAL_STUDIO_SEED);
  localStorage.setItem(legacyKey, legacy);
  const db = await import('../sqlite/studioDatabase');
  const { loadBrowserPhoto } = await import('./browserWorkspace');
  await db.startDesktopWorkspace();
  const result = await db.runStudioMutation((actions) =>
    actions.uploadPhotos([{ fileName: '119.png', dataUrl }], 'cls-9a'),
  );
  expect(result).toEqual({ imported: 1, matched: 1, unmatched: 0 });
  const [photo] = db.getStudioDatabaseSnapshot().photos.slice(-1);
  expect(photo).toMatchObject({ studentId: 'stu-119', classId: 'cls-9a', dataUrl: '' });
  expect(await loadBrowserPhoto(photo.id)).toBe(dataUrl);
  expect(localStorage.getItem(legacyKey)).toBe(legacy);

  vi.resetModules();
  const reopened = await import('../sqlite/studioDatabase');
  await reopened.startDesktopWorkspace();
  expect(reopened.getStudioDatabaseSnapshot().photos.slice(-1)[0]?.id).toBe(photo.id);
});

test('quota failure rolls back both roster and media', async () => {
  const { saveBrowserWorkspace, loadBrowserWorkspace, loadBrowserPhoto } = await import('./browserWorkspace');
  const photo = { ...INITIAL_STUDIO_SEED.photos[0], dataUrl };
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
  await expect(saveBrowserWorkspace(0, { ...INITIAL_STUDIO_SEED, photos: [photo] })).rejects
    .toHaveProperty('name', 'QuotaExceededError');
  expect((await loadBrowserWorkspace()).revision).toBe(0);
  await expect(loadBrowserPhoto(photo.id)).rejects.toThrow('okunamadı');
});
