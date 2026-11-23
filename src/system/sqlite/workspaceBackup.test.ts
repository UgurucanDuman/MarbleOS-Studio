import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT_ENCRYPTED,
  recoveryKeyInputSchema,
  WORKSPACE_BACKUP_FORMAT_ENCRYPTED,
} from '../schemas/backupSchemas';
import { createEmptyStudioSnapshot } from './emptySnapshot';
import { nextSchoolCode } from './schoolActions';
import {
  decryptSchoolBackup,
  decryptWorkspaceBackup,
  detectBackupKind,
  encryptWorkspaceBackup,
} from './schoolBackupCrypto';
import { prepareWorkspaceBackupPackage, restoreWorkspaceFromBackupJson } from './workspaceBackup';

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('workspaceBackup & recoveryKeyInputSchema', () => {
  it('hydrates managed school assets and photos, seals with AES-256-GCM AAD, and restores multi-school state', async () => {
    const logoAssetId = '9d4283b8-15e1-4c2a-9a3f-5b6c7d8e9f01';
    const photoId = '16274a4a-16c7-43ec-a868-e7b503244c9e';
    const school1Id = 'b1f5a3c2-6d4e-4f7a-8b9c-0d1e2f3a4b5c';
    const school2Id = 'c4f9b2a1-7e5d-4c8b-9a1e-2f3d4c5b6a79';
    const class1Id = '51967cae-a326-45f1-87a7-eb413e068a1d';
    const student1Id = '3e9d8f40-2a14-4d61-8f25-7b8e9a0c1d2e';
    const hash = 'b'.repeat(64);

    const state = {
      ...createEmptyStudioSnapshot(),
      activeSchoolId: school2Id,
      schools: [
        {
          id: school1Id, code: '00001', institutionCode: '111222', name: 'Atatürk Anadolu Lisesi',
          address: 'Merkez', notes: '', makeBiometric: true, makeVesikalik: false,
          logoDataUrl: `marbleos-school-asset:${logoAssetId}`, transparentLogoOpacity: 40,
          principalSignatureDataUrl: '', deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1,
          createdAt: '2026-11-01', updatedAt: '2026-11-01',
        },
        {
          id: school2Id, code: '00002', institutionCode: '333444', name: 'Cumhuriyet Fen Lisesi',
          address: 'Kampüs', notes: 'Not', makeBiometric: false, makeVesikalik: true,
          logoDataUrl: '', transparentLogoOpacity: 35,
          principalSignatureDataUrl: '', deputySignatureDataUrl: '', schoolPhotoDataUrl: '', schoolPhotoZoom: 1,
          createdAt: '2026-11-02', updatedAt: '2026-11-02',
        },
      ],
      classes: [{
        id: class1Id, schoolId: school1Id, academicYear: '2026-2027',
        name: '12-A', teacherName: 'Selin Demir', createdAt: '2026-11-01',
      }],
      students: [{
        id: student1Id, classId: class1Id, studentNumber: '1201',
        firstName: 'Zeynep', lastName: 'Yılmaz', matchedPhotoId: photoId,
        printReady: true, updatedAt: '2026-11-01',
      }],
      photos: [{
        id: photoId, fileName: '1201.png', dataUrl: '', classId: class1Id, contentHash: hash,
        studentId: student1Id, adjustments: { zoom: 1.2, brightness: 103, contrast: 100, warmth: 1 },
        approvedForPrint: true, createdAt: '2026-11-01',
      }],
      albumConfig: {
        selectedClassId: class1Id, layoutKind: 'yearbook-spread' as const,
        headerTitle: 'Mezuniyet 2027', accentColor: '#2563eb', columns: 4,
        showStudentNumbers: true, showTeacherBadge: true,
      },
    };

    const pkg = await prepareWorkspaceBackupPackage(state, async (id, expectedHash) => {
      if (id === logoAssetId) return TINY_PNG;
      if (id === photoId && expectedHash === hash) return TINY_PNG;
      throw new Error(`Beklenmeyen varlık: ${id}`);
    });
    expect(pkg.fileName).toMatch(/\.marbleos-kasa$/);
    expect(pkg.json).not.toContain('marbleos-school-asset:');

    const sealed = await encryptWorkspaceBackup(pkg.json, 'Kasa-Parolasi-2026!', { iterations: 100_000 });
    expect(detectBackupKind(sealed)).toBe('encrypted-workspace');
    expect(sealed).not.toContain('Atatürk Anadolu Lisesi');
    expect(sealed).not.toContain('Zeynep');

    // Yanlış parola ve format/AAD takası reddedilir
    await expect(decryptWorkspaceBackup(sealed, 'Yanlis-Parola-9!')).rejects.toThrow('Parola yanlış');
    const swappedFormat = sealed.replace(WORKSPACE_BACKUP_FORMAT_ENCRYPTED, BACKUP_FORMAT_ENCRYPTED);
    await expect(decryptSchoolBackup(swappedFormat, 'Kasa-Parolasi-2026!')).rejects.toThrow();

    const plain = await decryptWorkspaceBackup(sealed, 'Kasa-Parolasi-2026!');
    const restored = restoreWorkspaceFromBackupJson(createEmptyStudioSnapshot(), plain, nextSchoolCode);
    expect(restored.schools.map((s) => s.name)).toEqual(['Atatürk Anadolu Lisesi', 'Cumhuriyet Fen Lisesi']);
    expect(restored.schools[0]?.logoDataUrl).toBe(TINY_PNG);
    expect(restored.activeSchoolId).toBe(restored.schools[1]?.id);
    expect(restored.students[0]?.firstName).toBe('Zeynep');
    expect(restored.students[0]?.printReady).toBe(false);
    expect(restored.photos[0]?.approvedForPrint).toBe(false);
    expect(restored.photos[0]?.id).toBe(restored.students[0]?.matchedPhotoId);
    expect(restored.albumConfig.selectedClassId).toBe(restored.classes[0]?.id);
    expect(restored.albumConfig.headerTitle).toBe('Mezuniyet 2027');

    // Aynı kasa ikinci kez üstüne yüklenmek istenirse çakışan okul adını reddeder
    expect(() => restoreWorkspaceFromBackupJson(restored, plain, nextSchoolCode)).toThrow('zaten var');
  });

  it('normalizes Crockford Base32 recovery keys and rejects invalid length or symbols', () => {
    const raw = 'abcd efgh - iloo pqrs - tuvw xyz2 - 3456 789a - bcde fghj - kmnp qrst - vwxz 2345';
    // Not: 'u' Crockford alfabesinde yoktur; geçerli karakterlerle test edelim:
    const validMessy = 'abcd efgh - iloo pqrs - tvwx yz23 - 4567 89ab - cdef ghjk - mnpq rstv - wxz2 3456';
    const parsed = recoveryKeyInputSchema.parse(validMessy);
    expect(parsed).toBe('ABCDEFGH-1100PQRS-TVWXYZ23-456789AB-CDEFGHJK-MNPQRSTV-WXZ23456');

    expect(() => recoveryKeyInputSchema.parse(raw)).toThrow();
    expect(() => recoveryKeyInputSchema.parse('ABCDEFGH-12345678')).toThrow();
  });
});

