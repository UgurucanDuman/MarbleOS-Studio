import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createEmptyStudioSnapshot } from './emptySnapshot';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));

const schoolAId = 'b1f5a3c2-6d4e-4f7a-8b9c-0d1e2f3a4b5c';
const schoolBId = 'c4f9b2a1-7e5d-4c8b-9a1e-2f3d4c5b6a79';
const missingId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const baseSchool = {
  institutionCode: '', address: '', notes: '', makeBiometric: false, makeVesikalik: false,
  logoDataUrl: '', transparentLogoOpacity: 35, principalSignatureDataUrl: '',
  deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1,
  createdAt: '2026-11-06', updatedAt: '2026-11-06',
};
const seeded = {
  ...createEmptyStudioSnapshot(),
  schools: [
    { ...baseSchool, id: schoolAId, code: '00001', name: 'Birinci Okul' },
    { ...baseSchool, id: schoolBId, code: '00002', name: 'İkinci Okul' },
  ],
  activeSchoolId: schoolAId,
};

beforeEach(() => {
  vi.resetModules();
  invoke.mockReset();
});

afterEach(() => vi.restoreAllMocks());

test('desktop selectStudioSchool uses lightweight native command, keeps references, and advances revision', async () => {
  let acknowledge: (() => void) | undefined;
  invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
    if (command === 'studio_load') return Promise.resolve({ revision: 1, snapshotJson: JSON.stringify(seeded) });
    if (command === 'studio_select_school') {
      expect(args).toEqual({ expectedRevision: 1, schoolId: schoolBId });
      return new Promise((resolve) => {
        acknowledge = () => resolve({ revision: 2, activeSchoolId: schoolBId });
      });
    }
    if (command === 'studio_commit') {
      expect(args?.expectedRevision).toBe(2);
      return Promise.resolve({ revision: 3, snapshotJson: args?.snapshotJson });
    }
    throw new Error(`Unexpected command: ${command}`);
  });

  const db = await import('./studioDatabase');
  await db.startDesktopWorkspace();
  const before = db.getStudioDatabaseSnapshot();

  const pending = db.selectStudioSchool(schoolBId);
  await vi.waitFor(() => expect(acknowledge).toBeTypeOf('function'));
  expect(db.getStudioDatabaseSnapshot().activeSchoolId).toBe(schoolAId);

  acknowledge!();
  await pending;

  const after = db.getStudioDatabaseSnapshot();
  expect(after.activeSchoolId).toBe(schoolBId);
  expect(after.schools).toBe(before.schools);
  expect(after.classes).toBe(before.classes);
  expect(after.students).toBe(before.students);
  expect(after.photos).toBe(before.photos);

  // Aynı okul tekrar seçildiğinde gereksiz IPC yapılmaz.
  await db.selectStudioSchool(schoolBId);
  expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(['studio_load', 'studio_select_school']);

  // Sonraki tam mutasyon güncel revizyon (2) ile gönderilir.
  await db.runStudioMutation((actions) => actions.addClass('1-A', '', schoolBId, '2026-2027'));
  expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(['studio_load', 'studio_select_school', 'studio_commit']);
});

test('desktop selectStudioSchool rejects unknown school before IPC and recovers on conflict', async () => {
  const competitor = { ...seeded, activeSchoolId: schoolBId };
  invoke
    .mockResolvedValueOnce({ revision: 1, snapshotJson: JSON.stringify(seeded) })
    .mockRejectedValueOnce('Kayıt başka bir pencerede değişti.')
    .mockResolvedValueOnce({ revision: 4, snapshotJson: JSON.stringify(competitor) });

  const db = await import('./studioDatabase');
  await db.startDesktopWorkspace();

  await expect(db.selectStudioSchool(missingId)).rejects.toThrow('Okul bulunamadı.');
  expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(['studio_load']);

  await expect(db.selectStudioSchool(schoolBId)).rejects.toThrow('başka bir pencerede');
  expect(db.getStudioDatabaseSnapshot().activeSchoolId).toBe(schoolBId);
  expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(['studio_load', 'studio_select_school', 'studio_load']);
});

test('desktop selectStudioSchool blocks writes when vault is locked', async () => {
  invoke.mockResolvedValueOnce({
    revision: 0,
    snapshotJson: null,
    vault: { locked: true, hasRecoveryKey: true, recoveryFingerprint: 'AABBCCDD', recoveryConfiguredAt: '2026-11-06' },
  });
  const db = await import('./studioDatabase');
  await db.startDesktopWorkspace();

  await expect(db.selectStudioSchool(schoolBId)).rejects.toThrow('kilitli');
  expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(['studio_load']);
});
