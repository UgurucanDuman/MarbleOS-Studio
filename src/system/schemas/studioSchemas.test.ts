import { expect, test } from 'vitest';
import { backupStudentRecordSchema } from '../sqlite/backupShared';
import { healPvcAlbumFields } from '../storage/pvc-cards/healPvcConfig';
import { pvcCustomDesignSchema, pvcDesignNameSchema } from './pvcCardSchemas';
import { schoolInputSchema } from './schoolSchemas';
import {
  albumConfigPatchSchema,
  batchPatchClassStudentsSchema,
  createClassSchema,
  photoAdjustmentsSchema,
  studentInputSchema,
  updateClassSchema,
} from './studioSchemas';

/**
 * İZOLE ŞEMA KATMANI TESTİ: Zod Veri Doğrulama ve Siber Güvenlik Birim Testleri
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function runStudioSchemasUnitTests(): boolean {
  const validClass = createClassSchema.safeParse({
    name: '10-A',
    teacherName: 'Murat Kaya',
    schoolId: 'okul-1',
    academicYear: '2026-2027',
  });
  if (!validClass.success) {
    throw new Error('Geçerli sınıf şeması başarısız oldu');
  }

  const invalidStudent = studentInputSchema.safeParse({
    studentNumber: '',
    firstName: 'A',
    lastName: '',
  });
  if (invalidStudent.success) {
    throw new Error('Boş öğrenci numarası Zod tarafından reddedilmeliydi');
  }

  const validPhoto = photoAdjustmentsSchema.safeParse({
    zoom: 1.1,
    brightness: 105,
    contrast: 100,
    warmth: 4,
  });
  if (!validPhoto.success) {
    throw new Error('Geçerli stüdyo ışık kalibrasyonu başarısız oldu');
  }

  return true;
}

test('class, student and photo input contracts', runStudioSchemasUnitTests);

test('blocks spreadsheet formula prefixes, negative student numbers, and Unicode Bidi spoofing at schema boundary', () => {
  for (const evil of ['=CMD|" /C calc"!A0', '+HYPERLINK("http://x")', '-2+3', '@SUM(1,2)', 'Ali\u202Eexe']) {
    expect(
      studentInputSchema.safeParse({ studentNumber: '101', firstName: evil, lastName: 'Yılmaz' }).success,
    ).toBe(false);
    expect(
      schoolInputSchema.safeParse({
        name: evil,
        institutionCode: '123456',
        address: '',
        notes: '',
        makeBiometric: false,
        makeVesikalik: true,
      }).success,
    ).toBe(false);
  }

  // Okul numarası tire (-) ile başlayamaz
  expect(
    studentInputSchema.safeParse({ studentNumber: '-101', firstName: 'Ayşe', lastName: 'Kaya' }).success,
  ).toBe(false);

  // Ayrışık (NFD) Türkçe harfler NFC'ye normalize edilir; notlarda madde işareti (-) serbesttir
  const nfdSchool = schoolInputSchema.parse({
    name: 'S\u0327ehitler Lisesi',
    institutionCode: '000123',
    address: 'Merkez',
    notes: '- Pazartesi sabah çekim',
    makeBiometric: false,
    makeVesikalik: true,
  });
  expect(nfdSchool.name).toBe('Şehitler Lisesi');

  // Şube öğretmen ataması, grup kodu ve albüm başlığı da aynı enjeksiyon ve Bidi sınırlarıyla korunur
  expect(
    updateClassSchema.safeParse({ id: 'cls-1', name: '9-A', teacherName: '=HYPERLINK("x")' }).success,
  ).toBe(false);
  expect(
    batchPatchClassStudentsSchema.safeParse({ classId: 'cls-1', groupCode: '@SUM(1)' }).success,
  ).toBe(false);
  expect(
    albumConfigPatchSchema.safeParse({ headerTitle: '=CMD|calc' }).success,
  ).toBe(false);
  expect(
    albumConfigPatchSchema.parse({ headerTitle: '2026 C\u0327izelge' }).headerTitle,
  ).toBe('2026 Çizelge');

  // Öğrenci / öğretmen adı, soyadı ve görevi 60 karaktere kadar kabul edilir; 61 reddedilir
  expect(
    studentInputSchema.safeParse({
      studentNumber: '301',
      firstName: 'A'.repeat(60),
      lastName: 'B'.repeat(60),
      role: 'C'.repeat(60),
    }).success,
  ).toBe(true);
  expect(
    studentInputSchema.safeParse({
      studentNumber: '301',
      firstName: 'A'.repeat(61),
      lastName: 'B'.repeat(60),
    }).success,
  ).toBe(false);

  // Yedekleme şeması da 60 karakterli ad/soyad/görev alanlarıyla birebir uyumludur
  expect(
    backupStudentRecordSchema.safeParse({
      id: 'stu-60',
      classId: 'cls-1',
      studentNumber: '301',
      firstName: 'A'.repeat(60),
      lastName: 'B'.repeat(60),
      role: 'C'.repeat(60),
      matchedPhotoId: null,
      printReady: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }).success,
  ).toBe(true);
});

test('enforces strict PVC Zod validation (SVG/XSS, formula, Bidi, duplicate layer IDs) and heals corrupted storage safely', () => {
  expect(pvcDesignNameSchema.safeParse('=CMD|calc').success).toBe(false);
  expect(pvcDesignNameSchema.safeParse('Kart\u202EAdi').success).toBe(false);
  expect(pvcDesignNameSchema.parse('  C\u0327izgili Kart  ')).toBe('Çizgili Kart');

  const baseEl = { id: 'el-1', kind: 'text' as const, xMm: 4, yMm: 4, wMm: 40, hMm: 6, text: 'Merhaba' };
  const validDesign = {
    id: 'custom-1',
    name: 'Okul Kimlik 2026',
    orientation: 'landscape' as const,
    cardRadiusMm: 3.18,
    front: { backgroundColor: '#ffffff', elements: [baseEl] },
    back: { backgroundColor: '#ffffff', elements: [] },
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  expect(pvcCustomDesignSchema.safeParse(validDesign).success).toBe(true);

  // SVG data URL, yinelenen katman ID'si, formül metni ve bilinmeyen alanlar kesinlikle reddedilir
  expect(
    pvcCustomDesignSchema.safeParse({
      ...validDesign,
      front: { backgroundColor: '#ffffff', backgroundDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', elements: [] },
    }).success,
  ).toBe(false);
  expect(
    pvcCustomDesignSchema.safeParse({
      ...validDesign,
      front: { backgroundColor: '#ffffff', elements: [baseEl, baseEl] },
    }).success,
  ).toBe(false);
  expect(
    pvcCustomDesignSchema.safeParse({
      ...validDesign,
      front: { backgroundColor: '#ffffff', elements: [{ ...baseEl, text: '@SUM(1,2)' }] },
    }).success,
  ).toBe(false);
  expect(
    albumConfigPatchSchema.safeParse({ pvcHeaderTopText: 'T.C.\u202EMEB' }).success,
  ).toBe(false);
  expect(
    albumConfigPatchSchema.safeParse({ pvcPhotoZoom: 9.9 }).success,
  ).toBe(false);

  // healPvcAlbumFields bozuk Bidi karakterlerini temizler ve yinelenen özel tasarım kimliklerini tekilleştirir
  const healed = healPvcAlbumFields({
    pvcHeaderTopText: 'T.C.\u202EMEB',
    pvcCustomDesigns: [validDesign, validDesign],
  });
  expect(healed.pvcHeaderTopText).toBe('T.C. MEB');
  expect((healed.pvcCustomDesigns as unknown[]).length).toBe(1);
});
