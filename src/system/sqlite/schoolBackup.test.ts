import { expect, test } from 'vitest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';
import { createEmptyStudioSnapshot } from './emptySnapshot';
import { buildSchoolBackupPackage, computeBackupChecksum, restoreSchoolFromBackupJson } from './schoolBackup';
import { validatePrototypeSnapshot } from './prototypePersistence';

test('exports a school backup package and restores it into an empty snapshot with valid relations', () => {
  const pkg = buildSchoolBackupPackage(INITIAL_STUDIO_SEED, 'sch-1');
  expect(pkg.fileName).toContain('00001_');

  const restored = restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), pkg.json, '00001');
  expect(() => validatePrototypeSnapshot(restored)).not.toThrow();
  expect(restored.schools).toHaveLength(1);
  expect(restored.classes).toHaveLength(3);
  expect(restored.students).toHaveLength(6);
  expect(restored.photos).toHaveLength(5);
  expect(restored.students.every((s) => !s.printReady)).toBe(true);
});

test('refuses corrupted or tampered backup files without mutating state', () => {
  const pkg = buildSchoolBackupPackage(INITIAL_STUDIO_SEED, 'sch-1');
  const tampered = pkg.json.replace('Atatürk Anadolu Lisesi', 'Başka Lise');
  expect(() => restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), tampered, '00001'))
    .toThrow('bozuk veya bütünlük doğrulaması başarısız');
});

test('preserves idCard registry details, isPrincipal flag and photo rotation across backup/restore', () => {
  const richSeed = structuredClone(INITIAL_STUDIO_SEED);
  richSeed.students[0] = {
    ...richSeed.students[0],
    isPrincipal: true,
    role: 'Okul Müdürü',
    idCard: {
      nationalId: '10987654321',
      bloodType: '0 Rh+',
      fatherName: 'Mehmet',
      motherName: 'Ayşe',
      birthPlace: 'Ankara',
      birthDate: '19.05.2012',
      province: 'Ankara',
      district: 'Çankaya',
      neighborhood: 'Bahçelievler',
      volumeNo: '0012',
      familySerialNo: '00045',
      serialNo: '0003',
      documentNo: 'A12B34567',
      registryNo: '2026-101',
    },
  };
  richSeed.photos[0] = {
    ...richSeed.photos[0],
    adjustments: { ...richSeed.photos[0].adjustments, rotation: 90 },
  };
  const pkg = buildSchoolBackupPackage(richSeed, 'sch-1');
  const restored = restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), pkg.json, '00001');
  expect(restored.students[0]?.isPrincipal).toBe(true);
  expect(restored.students[0]?.idCard?.nationalId).toBe('10987654321');
  expect(restored.students[0]?.idCard?.neighborhood).toBe('Bahçelievler');
  expect(restored.photos[0]?.adjustments.rotation).toBe(90);
});

test('rejects SVG data URLs, Unicode Bidi spoofing, and inconsistent student-photo links in backups', () => {
  const pkg = buildSchoolBackupPackage(INITIAL_STUDIO_SEED, 'sch-1');

  const withSvg = JSON.parse(pkg.json);
  withSvg.payload.photos[0].dataUrl = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+';
  withSvg.checksum = computeBackupChecksum(JSON.stringify(withSvg.payload));
  expect(() => restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), JSON.stringify(withSvg), '00001'))
    .toThrow('biçimi geçersiz');

  const withBidi = JSON.parse(pkg.json);
  withBidi.payload.students[0].firstName = 'Elif\u202Eexe';
  withBidi.checksum = computeBackupChecksum(JSON.stringify(withBidi.payload));
  expect(() => restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), JSON.stringify(withBidi), '00001'))
    .toThrow('biçimi geçersiz');

  const withBrokenLink = JSON.parse(pkg.json);
  withBrokenLink.payload.photos[0].studentId = 'stu-108';
  withBrokenLink.checksum = computeBackupChecksum(JSON.stringify(withBrokenLink.payload));
  expect(() => restoreSchoolFromBackupJson(createEmptyStudioSnapshot(), JSON.stringify(withBrokenLink), '00001'))
    .toThrow();
});

