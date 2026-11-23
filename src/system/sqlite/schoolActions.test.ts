import { beforeEach, expect, test, vi } from 'vitest';
import { nextSchoolCode } from './schoolActions';
import { validatePrototypeSnapshot } from './prototypePersistence';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

const base = {
  name: 'Kendi Okulum', institutionCode: '', address: '', notes: '',
  makeBiometric: false, makeVesikalik: true,
};

async function open() {
  return (await import('./studioDatabase'));
}

test('codes are sequential text and the new school becomes the active school', async () => {
  const db = await open();
  const first = db.studioDbActions.createSchool(base);
  const second = db.studioDbActions.createSchool({ ...base, name: 'İkinci Okul' });
  const { schools, activeSchoolId } = db.getStudioDatabaseSnapshot();
  expect(schools.map((s) => s.code)).toEqual(['00001', '00002']);
  expect(activeSchoolId).toBe(second);
  expect(first).not.toBe(second);
});

test('institution code keeps leading zeros and must be unique when filled', async () => {
  const db = await open();
  db.studioDbActions.createSchool({ ...base, institutionCode: '000123' });
  expect(db.getStudioDatabaseSnapshot().schools[0].institutionCode).toBe('000123');
  expect(() => db.studioDbActions.createSchool({ ...base, name: 'Başka', institutionCode: '000123' }))
    .toThrow('kurum kodu');
  db.studioDbActions.createSchool({ ...base, name: 'Kodsuz Bir', institutionCode: '' });
  db.studioDbActions.createSchool({ ...base, name: 'Kodsuz İki', institutionCode: '' });
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(3);
  expect(() => db.studioDbActions.createSchool({ ...base, name: 'Harfli', institutionCode: '12A' }))
    .toThrow('yalnızca rakam');
});

test('duplicate names are blocked regardless of Turkish case and extra spaces', async () => {
  const db = await open();
  db.studioDbActions.createSchool({ ...base, name: 'İnönü İlkokulu' });
  expect(() => db.studioDbActions.createSchool({ ...base, name: '  inönü   ilkokulu ' })).toThrow('zaten var');
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(1);
});

test('multi-line address is allowed but control characters are rejected', async () => {
  const db = await open();
  db.studioDbActions.createSchool({ ...base, address: 'Mahalle\nİlçe / İl' });
  expect(db.getStudioDatabaseSnapshot().schools[0].address).toBe('Mahalle\nİlçe / İl');
  expect(() => db.studioDbActions.createSchool({ ...base, name: 'Zil\u0007 Okulu' })).toThrow('Geçersiz karakter');
  expect(() => db.studioDbActions.createSchool({ ...base, name: 'Başka', notes: 'a\u0000b' })).toThrow('Geçersiz karakter');
});

test('update keeps code and creation date and still enforces uniqueness', async () => {
  const db = await open();
  const id = db.studioDbActions.createSchool(base);
  db.studioDbActions.createSchool({ ...base, name: 'Komşu Okul', institutionCode: '765432' });
  const before = db.getStudioDatabaseSnapshot().schools[0];
  db.studioDbActions.updateSchool({ ...base, id, name: 'Yeni Ad', notes: 'Kapı 2' });
  const after = db.getStudioDatabaseSnapshot().schools[0];
  expect([after.name, after.notes, after.code, after.createdAt]).toEqual(['Yeni Ad', 'Kapı 2', before.code, before.createdAt]);
  expect(() => db.studioDbActions.updateSchool({ ...base, id, name: 'komşu okul' })).toThrow('zaten var');
  expect(() => db.studioDbActions.updateSchool({ ...base, id, institutionCode: '765432' })).toThrow('kurum kodu');
  expect(() => db.studioDbActions.updateSchool({ ...base, id: 'missing' })).toThrow('bulunamadı');
});

test('selecting an unknown school is rejected; clearing the selection is allowed', async () => {
  const db = await open();
  const id = db.studioDbActions.createSchool(base);
  expect(() => db.studioDbActions.selectSchool('missing')).toThrow('bulunamadı');
  expect(db.getStudioDatabaseSnapshot().activeSchoolId).toBe(id);
  db.studioDbActions.selectSchool(null);
  expect(db.getStudioDatabaseSnapshot().activeSchoolId).toBeNull();
});

test('stored data with orphan classes, missing active school or duplicate codes is refused', () => {
  const valid = structuredClone(INITIAL_STUDIO_SEED);
  expect(() => validatePrototypeSnapshot(valid)).not.toThrow();
  expect(() => validatePrototypeSnapshot({ ...valid, activeSchoolId: 'yok' })).toThrow('Seçili okul');
  expect(() => validatePrototypeSnapshot({
    ...valid, classes: valid.classes.map((c) => ({ ...c, schoolId: 'yok' })),
  })).toThrow('okulu bulunamadı');
  expect(() => validatePrototypeSnapshot({
    ...valid, schools: [...valid.schools, { ...valid.schools[0], id: 'sch-2', name: 'Diğer', institutionCode: '' }],
  })).toThrow('Yinelenen okul');
});

test('next code skips past the highest existing code', () => {
  const school = INITIAL_STUDIO_SEED.schools[0];
  expect(nextSchoolCode([])).toBe('00001');
  expect(nextSchoolCode([{ ...school, code: '00007' }, { ...school, code: '00003' }])).toBe('00008');
});

test('addSchoolsBatch imports multiple schools atomically and rolls back on duplicate', async () => {
  const db = await open();
  const count = db.studioDbActions.addSchoolsBatch([
    { ...base, name: 'Birinci Okul', institutionCode: '000111' },
    { ...base, name: 'İkinci Okul', institutionCode: '000222' },
  ]);
  expect(count).toBe(2);
  expect(db.getStudioDatabaseSnapshot().schools.map((s) => s.code)).toEqual(['00001', '00002']);

  expect(() => db.studioDbActions.addSchoolsBatch([
    { ...base, name: 'Üçüncü Okul' },
    { ...base, name: '  birinci okul ' },
  ])).toThrow('zaten var');
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(2);
});

test('mergeSchools combines selected schools under a new school name and deleteSchool removes school with its classes', async () => {
  const db = await open();
  const s1 = db.studioDbActions.createSchool({ ...base, name: 'Atatürk İlkokulu' });
  const c1 = db.studioDbActions.addClass('4-A', 'Öğrt 1', s1, '2026-2027');
  db.studioDbActions.addStudentsBatch(c1, [{ studentNumber: '101', firstName: 'Ece', lastName: 'Kaya' }]);

  const s2 = db.studioDbActions.createSchool({ ...base, name: 'Atatürk Ortaokulu' });
  const c2 = db.studioDbActions.addClass('5-A', 'Öğrt 2', s2, '2026-2027');
  db.studioDbActions.addStudentsBatch(c2, [{ studentNumber: '201', firstName: 'Mert', lastName: 'Demir' }]);

  const mergedId = db.studioDbActions.mergeSchools({
    newSchoolName: 'Atatürk İlk ve Ortaokulu',
    schoolIds: [s1, s2],
  });
  const afterMerge = db.getStudioDatabaseSnapshot();
  expect(afterMerge.activeSchoolId).toBe(mergedId);
  const mergedClasses = afterMerge.classes.filter((c) => c.schoolId === mergedId);
  expect(mergedClasses.map((c) => c.name)).toEqual(['4-A', '5-A']);

  db.studioDbActions.deleteSchool(s1);
  expect(db.getStudioDatabaseSnapshot().schools.some((s) => s.id === s1)).toBe(false);
  expect(db.getStudioDatabaseSnapshot().classes.some((c) => c.schoolId === s1)).toBe(false);
});



