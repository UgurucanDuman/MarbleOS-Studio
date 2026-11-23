import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createEmptyStudioSnapshot } from './emptySnapshot';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));

const schoolId = 'b1f5a3c2-6d4e-4f7a-8b9c-0d1e2f3a4b5c';
const school = {
  id: schoolId, code: '00001', institutionCode: '887766', name: 'Kurtarılan Okul',
  address: '', notes: '', makeBiometric: false, makeVesikalik: true,
  logoDataUrl: '', transparentLogoOpacity: 35, principalSignatureDataUrl: '',
  deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1,
  createdAt: '2026-11-09', updatedAt: '2026-11-09',
};
const seeded = { ...createEmptyStudioSnapshot(), schools: [school], activeSchoolId: school.id };

beforeEach(() => {
  vi.resetModules();
  invoke.mockReset();
});

afterEach(() => vi.restoreAllMocks());

test('locked DPAPI vault blocks mutations until unlocked with 256-bit recovery key', async () => {
  const formattedKey = 'ABCDEFGH-1100PQRS-TVWXYZ23-456789AB-CDEFGHJK-MNPQRSTV-WXZ23456';
  const messyUserKey = 'abcd efgh  iloo pqrs  tvwx yz23  4567 89ab  cdef ghjk  mnpq rstv  wxz2 3456';

  invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'studio_load') {
      return {
        revision: 0,
        snapshotJson: null,
        vault: {
          locked: true,
          hasRecoveryKey: true,
          recoveryFingerprint: '7F3A91C2',
          recoveryConfiguredAt: '1700000000',
        },
      };
    }
    if (command === 'studio_unlock_with_recovery_key') {
      expect(args).toEqual({ recoveryKey: formattedKey });
      return {
        revision: 3,
        snapshotJson: JSON.stringify(seeded),
        vault: {
          locked: false,
          hasRecoveryKey: true,
          recoveryFingerprint: '7F3A91C2',
          recoveryConfiguredAt: '1700000000',
        },
      };
    }
    if (command === 'studio_commit') {
      return {
        revision: Number(args?.expectedRevision) + 1,
        snapshotJson: args?.snapshotJson,
        vault: {
          locked: false,
          hasRecoveryKey: true,
          recoveryFingerprint: '7F3A91C2',
          recoveryConfiguredAt: '1700000000',
        },
      };
    }
    throw new Error(`Beklenmeyen komut: ${command}`);
  });

  const db = await import('./studioDatabase');
  await db.startDesktopWorkspace();

  // Kasa kilitliyken veri sızmaz ve mutasyon reddedilir
  expect(db.getStudioDatabaseSnapshot().schools).toEqual([]);
  await expect(db.runStudioMutation((actions) => actions.addClass('1-A', '', schoolId, '2026-2027')))
    .rejects.toThrow('Veri kasası kilitli');

  // Kurtarma anahtarı normalize edilerek gönderilir; kasa açılır ve yazma devam eder
  await db.unlockStudioVault(messyUserKey);
  expect(db.getStudioDatabaseSnapshot().schools[0]?.name).toBe('Kurtarılan Okul');
  await db.runStudioMutation((actions) => actions.addClass('1-A', '', schoolId, '2026-2027'));
  expect(db.getStudioDatabaseSnapshot().classes[0]?.name).toBe('1-A');
});

test('generateStudioRecoveryKey validates IPC payload and rejects leaked locked snapshots', async () => {
  const { loadDesktopWorkspace } = await import('../desktop/desktopStorage');
  invoke.mockResolvedValueOnce({
    revision: 1,
    snapshotJson: JSON.stringify(seeded),
    vault: { locked: true, hasRecoveryKey: false, recoveryFingerprint: null, recoveryConfiguredAt: null },
  });
  await expect(loadDesktopWorkspace()).rejects.toThrow('Kilitli kasa yanıtı geçersiz.');

  const generatedKey = '23456789-ABCDEFGH-JKMNPQRS-TVWXYZ23-456789AB-CDEFGHJK-MNPQRSTV';
  invoke.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
    if (command === 'studio_load') {
      return {
        revision: 1,
        snapshotJson: JSON.stringify(seeded),
        vault: { locked: false, hasRecoveryKey: false, recoveryFingerprint: null, recoveryConfiguredAt: null },
      };
    }
    if (command === 'studio_generate_recovery_key') {
      expect(args).toEqual({ confirmRotate: false });
      return {
        recoveryKey: generatedKey,
        recoveryFingerprint: 'A1B2C3D4',
        recoveryConfiguredAt: '1700000500',
      };
    }
    throw new Error(`Beklenmeyen komut: ${command}`);
  });

  const db = await import('./studioDatabase');
  const out = await db.generateStudioRecoveryKey(false);
  expect(out.recoveryKey).toBe(generatedKey);
  expect(out.recoveryFingerprint).toBe('A1B2C3D4');
});

