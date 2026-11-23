import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createEmptyStudioSnapshot } from './emptySnapshot';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));

const className = '1-A';
const schoolName = 'b1f5a3c2-6d4e-4f7a-8b9c-0d1e2f3a4b5c'; // okul kimliği
const school = {
  id: schoolName, code: '00001', institutionCode: '', name: 'Okul', address: '', notes: '',
  makeBiometric: false, makeVesikalik: false, createdAt: '2026-11-06', updatedAt: '2026-11-06',
};
const seeded = { ...createEmptyStudioSnapshot(), schools: [school], activeSchoolId: school.id };
const emptyResponse = { revision: 1, snapshotJson: JSON.stringify(seeded) };

beforeEach(() => {
  vi.resetModules();
  invoke.mockReset();
});

afterEach(() => vi.restoreAllMocks());

test('desktop waits for the native commit and avoids browser storage', async () => {
  const getItem = vi.spyOn(Storage.prototype, 'getItem');
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  let acknowledge: (() => void) | undefined;
  invoke.mockImplementation((command: string, args?: { snapshotJson: string }) => {
    if (command === 'studio_load') return Promise.resolve(emptyResponse);
    return new Promise((resolve) => {
      acknowledge = () => resolve({ revision: 2, snapshotJson: args?.snapshotJson });
    });
  });
  const db = await import('./studioDatabase');
  const startup = db.startDesktopWorkspace();
  expect(db.startDesktopWorkspace()).toBe(startup);
  await startup;
  const { result, rerender } = renderHook(({ enabled }) => db.useStudioDatabase(enabled), { initialProps: { enabled: true } });
  const visibleSnapshot = result.current;
  rerender({ enabled: false });
  const pending = db.runStudioMutation((actions) => actions.addClass(className, '', schoolName, '2026'));
  await vi.waitFor(() => expect(acknowledge).toBeTypeOf('function'));
  expect(db.getStudioDatabaseSnapshot().classes).toEqual([]);
  await act(async () => { acknowledge!(); await pending; });
  expect(result.current).toBe(visibleSnapshot);
  rerender({ enabled: true });
  expect(result.current.classes[0].name).toBe(className);
  expect(invoke.mock.calls.map(([command]) => command)).toEqual(['studio_load', 'studio_commit']);
  expect(db.getStudioDatabaseSnapshot().classes[0].name).toBe(className);
  expect(getItem).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
});

test('native writes serialize and the next action uses the new committed revision', async () => {
  invoke.mockImplementation(async (command: string, args?: { expectedRevision: number; snapshotJson: string }) => {
    if (command === 'studio_load') return emptyResponse;
    return { revision: args!.expectedRevision + 1, snapshotJson: args!.snapshotJson };
  });
  const db = await import('./studioDatabase');
  await Promise.all([
    db.runStudioMutation((actions) => actions.addClass('1-A', '', schoolName, '2026')),
    db.runStudioMutation((actions) => actions.addClass('1-B', '', schoolName, '2026')),
  ]);
  const writes = invoke.mock.calls.filter(([cmd]) => cmd === 'studio_commit');
  expect(writes.map(([, args]) => args.expectedRevision)).toEqual([1, 2]);
  expect(db.getStudioDatabaseSnapshot().classes.map((item) => item.name)).toEqual(['1-A', '1-B']);
});

test('native read failure blocks writes and never falls back to browser data', async () => {
  invoke.mockRejectedValue('Bozuk kayıt');
  const storage = vi.spyOn(Storage.prototype, 'getItem');
  const db = await import('./studioDatabase');
  await expect(db.runStudioMutation((actions) => actions.addClass(className, '', schoolName, '2026')))
    .rejects.toThrow('Var olan kayıtlar korundu');
  expect(invoke.mock.calls).toEqual([['studio_load', undefined]]);
  expect(storage).not.toHaveBeenCalled();
});

test('rejected commit refreshes concurrent data without reporting the requested change as saved', async () => {
  const db = await import('./studioDatabase');
  const competitor = {
    ...seeded,
    classes: [{
      id: '51967cae-a326-45f1-87a7-eb413e068a1d', schoolId: schoolName,
      academicYear: '2026', name: '1-C', teacherName: '', createdAt: '2026-11-06',
    }],
  };
  invoke.mockResolvedValueOnce(emptyResponse).mockRejectedValueOnce('Kayıt başka bir pencerede değişti.')
    .mockResolvedValueOnce({ revision: 2, snapshotJson: JSON.stringify(competitor) });
  await expect(db.runStudioMutation((actions) => actions.addClass('1-A', '', schoolName, '2026')))
    .rejects.toThrow('başka bir pencerede');
  expect(db.getStudioDatabaseSnapshot().classes.map((item) => item.name)).toEqual(['1-C']);
  expect(invoke.mock.calls.map(([command]) => command)).toEqual(['studio_load', 'studio_commit', 'studio_load']);
});

test('desktop school backup reads DPAPI originals with hash check, encrypts, and restores cleanly', async () => {
  const { loadDesktopPhotoOriginal } = await import('../desktop/desktopStorage');
  const { prepareSchoolBackupPackage } = await import('./schoolBackup');
  const { decryptSchoolBackup, encryptSchoolBackup } = await import('./schoolBackupCrypto');
  const classId = '51967cae-a326-45f1-87a7-eb413e068a1d';
  const studentId = '3e9d8f40-2a14-4d61-8f25-7b8e9a0c1d2e';
  const photoId = '16274a4a-16c7-43ec-a868-e7b503244c9e';
  const hash = 'a'.repeat(64);
  const originalUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==';
  const fullSchool = {
    ...school, logoDataUrl: '', transparentLogoOpacity: 35, principalSignatureDataUrl: '',
    deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1,
  };
  const withPhoto = {
    ...seeded,
    schools: [fullSchool],
    classes: [{ id: classId, schoolId: school.id, academicYear: '2026-2027', name: '1-A', teacherName: '', createdAt: '2026-11-06' }],
    students: [{
      id: studentId, classId, studentNumber: '101', firstName: 'Ece', lastName: 'Kaya',
      matchedPhotoId: photoId, printReady: true, updatedAt: '2026-11-06',
    }],
    photos: [{
      id: photoId, fileName: '101.jpg', dataUrl: '', classId, contentHash: hash,
      studentId, adjustments: { zoom: 1.1, brightness: 102, contrast: 100, warmth: 0 },
      approvedForPrint: true, createdAt: '2026-11-06',
    }],
  };

  await expect(loadDesktopPhotoOriginal('../originals')).rejects.toThrow();
  invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'studio_photo_original') {
      expect(args).toEqual({ photoId, expectedHash: hash });
      return originalUrl;
    }
    if (command === 'studio_load') return { revision: 0, snapshotJson: null };
    const committed = JSON.parse(String(args?.snapshotJson));
    expect(committed.photos[0].dataUrl).toBe(originalUrl);
    expect(committed.photos[0].contentHash).toBe(hash);
    expect(committed.photos[0].approvedForPrint).toBe(false);
    committed.photos[0].dataUrl = '';
    return { revision: 1, snapshotJson: JSON.stringify(committed) };
  });

  const pkg = await prepareSchoolBackupPackage(withPhoto, school.id, loadDesktopPhotoOriginal);
  const sealed = await encryptSchoolBackup(pkg.json, 'Masaustu-Yedek-9!', { iterations: 100_000 });
  expect(sealed).not.toContain('Ece');
  expect(sealed).not.toContain('/9j/4AAQ');

  const db = await import('./studioDatabase');
  const plain = await decryptSchoolBackup(sealed, 'Masaustu-Yedek-9!');
  await db.runStudioMutation((actions) => actions.restoreSchoolBackup(plain));
  const snap = db.getStudioDatabaseSnapshot();
  expect(snap.schools).toHaveLength(1);
  expect(snap.students[0]?.firstName).toBe('Ece');
  expect(snap.students[0]?.printReady).toBe(false);
  expect(snap.photos[0]?.dataUrl).toBe('');
  expect(snap.photos[0]?.id).toBe(snap.students[0]?.matchedPhotoId);
});

test('desktop enforces managed school asset pointers and hydrates them on backup export', async () => {
  const { loadDesktopPhotoOriginal, loadDesktopWorkspace } = await import('../desktop/desktopStorage');
  const { buildSchoolBackupPackage, prepareSchoolBackupPackage } = await import('./schoolBackup');
  const logoAssetId = '9d4283b8-15e1-4c2a-9a3f-5b6c7d8e9f01';
  const coverAssetId = 'c3a7e1f4-8b29-4e6d-a1c3-9f8e7d6c5b4a';
  const newLogoId = 'aa112233-4455-4666-8777-8899aabbccdd';
  const pngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  const leakedInline = {
    ...seeded,
    schools: [{
      ...school, logoDataUrl: pngUrl, transparentLogoOpacity: 35, principalSignatureDataUrl: '',
      deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1,
    }],
  };
  invoke.mockResolvedValueOnce({ revision: 1, snapshotJson: JSON.stringify(leakedInline) });
  await expect(loadDesktopWorkspace()).rejects.toThrow('Yerel okul görseli kaydı geçersiz.');

  const managedState = {
    ...seeded,
    schools: [{
      ...school,
      logoDataUrl: `marbleos-school-asset:${logoAssetId}`,
      transparentLogoOpacity: 40,
      principalSignatureDataUrl: '',
      deputySignatureDataUrl: '',
      schoolPhotoDataUrl: `marbleos-school-asset:${coverAssetId}`,
      schoolPhotoZoom: 1.2,
    }],
  };
  expect(() => buildSchoolBackupPackage(managedState, school.id)).toThrow();

  invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'studio_photo_original') {
      expect([logoAssetId, coverAssetId]).toContain(args?.photoId);
      expect(args?.expectedHash).toBeUndefined();
      return pngUrl;
    }
    if (command === 'studio_load') return { revision: 0, snapshotJson: null };
    const committed = JSON.parse(String(args?.snapshotJson));
    expect(committed.schools[0].logoDataUrl).toBe(pngUrl);
    expect(committed.schools[0].schoolPhotoDataUrl).toBe(pngUrl);
    committed.schools[0].logoDataUrl = `marbleos-school-asset:${newLogoId}`;
    committed.schools[0].schoolPhotoDataUrl = `marbleos-school-asset:${coverAssetId}`;
    return { revision: 1, snapshotJson: JSON.stringify(committed) };
  });

  const pkg = await prepareSchoolBackupPackage(managedState, school.id, loadDesktopPhotoOriginal);
  expect(pkg.json).not.toContain('marbleos-school-asset:');
  expect(pkg.json).toContain(pngUrl);

  const db = await import('./studioDatabase');
  await db.runStudioMutation((actions) => actions.restoreSchoolBackup(pkg.json));
  expect(db.getStudioDatabaseSnapshot().schools[0]?.logoDataUrl).toBe(`marbleos-school-asset:${newLogoId}`);
});

test('desktop mergeSchools sends managed photo copy token instead of empty dataUrl', async () => {
  const secondSchoolId = 'c4f9b2a1-7e5d-4c8b-9a1e-2f3d4c5b6a79';
  const classId = '51967cae-a326-45f1-87a7-eb413e068a1d';
  const studentId = '3e9d8f40-2a14-4d61-8f25-7b8e9a0c1d2e';
  const photoId = '16274a4a-16c7-43ec-a868-e7b503244c9e';
  const initial = {
    ...seeded,
    schools: [
      { ...school, logoDataUrl: '', transparentLogoOpacity: 35, principalSignatureDataUrl: '', deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1 },
      { ...school, id: secondSchoolId, code: '00002', name: 'İkinci Okul', logoDataUrl: '', transparentLogoOpacity: 35, principalSignatureDataUrl: '', deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1 },
    ],
    classes: [{ id: classId, schoolId: school.id, academicYear: '2026-2027', name: '1-A', teacherName: '', createdAt: '2026-11-06' }],
    students: [{ id: studentId, classId, studentNumber: '101', firstName: 'Ece', lastName: 'Kaya', matchedPhotoId: photoId, printReady: false, updatedAt: '2026-11-06' }],
    photos: [{ id: photoId, fileName: '101.jpg', dataUrl: '', classId, studentId, adjustments: { zoom: 1, brightness: 100, contrast: 100, warmth: 0 }, approvedForPrint: false, createdAt: '2026-11-06' }],
  };
  invoke.mockImplementation(async (command: string, args?: { snapshotJson: string }) => {
    if (command === 'studio_load') return { revision: 1, snapshotJson: JSON.stringify(initial) };
    const committed = JSON.parse(String(args?.snapshotJson));
    expect(committed.photos).toHaveLength(2);
    expect(committed.photos[1].dataUrl).toBe(`marbleos-photo-copy:${photoId}`);
    committed.photos[1].dataUrl = '';
    return { revision: 2, snapshotJson: JSON.stringify(committed) };
  });
  const db = await import('./studioDatabase');
  await db.runStudioMutation((actions) => actions.mergeSchools({ newSchoolName: 'Birleşik Kampüs', schoolIds: [school.id, secondSchoolId] }));
  expect(db.getStudioDatabaseSnapshot().photos).toHaveLength(2);
  expect(db.getStudioDatabaseSnapshot().photos.every((p) => p.dataUrl === '')).toBe(true);
});
