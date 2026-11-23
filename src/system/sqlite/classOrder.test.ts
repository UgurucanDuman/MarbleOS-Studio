import { beforeEach, expect, test, vi } from 'vitest';
import { compareClassBranchNames } from './classOrder';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

test('sorts Turkish grades, single-letter branches, preschool/prep, and staff branches naturally', () => {
  const mixed = [
    'ÖĞRETMEN',
    '10-A',
    '2-C',
    '1-F',
    '1-Ç',
    '1-C',
    '1-A',
    '9-B',
    'ANASINIFI-B',
    'ANASINIFI-A',
    'HAZIRLIK-A',
  ];
  expect([...mixed].sort(compareClassBranchNames)).toEqual([
    'ANASINIFI-A',
    'ANASINIFI-B',
    'HAZIRLIK-A',
    '1-A',
    '1-C',
    '1-Ç',
    '1-F',
    '2-C',
    '9-B',
    '10-A',
    'ÖĞRETMEN',
  ]);
});

test('re-adding a deleted A (or 1-A) branch inserts it in alphabetical order instead of at the end', async () => {
  const db = await import('./studioDatabase');
  const schoolId = db.studioDbActions.createSchool({
    name: 'Atatürk İlkokulu',
    institutionCode: '',
    address: '',
    notes: '',
    makeBiometric: false,
    makeVesikalik: true,
  });

  // Tek harfli şubeler: A silinir, C-D-E-F kalır, A tekrar eklendiğinde en başa yerleşir
  const idA = db.studioDbActions.addClass('A', '', schoolId, '2026-2027');
  db.studioDbActions.addClass('C', '', schoolId, '2026-2027');
  db.studioDbActions.addClass('D', '', schoolId, '2026-2027');
  db.studioDbActions.addClass('E', '', schoolId, '2026-2027');
  db.studioDbActions.addClass('F', '', schoolId, '2026-2027');
  db.studioDbActions.deleteClass(idA);
  expect(db.getStudioDatabaseSnapshot().classes.map((c) => c.name)).toEqual(['C', 'D', 'E', 'F']);

  db.studioDbActions.addClass('a', '', schoolId, '2026-2027');
  expect(db.getStudioDatabaseSnapshot().classes.map((c) => c.name)).toEqual(['A', 'C', 'D', 'E', 'F']);

  // Yeniden adlandırma da akıllı sırayı korur (F → B olduğunda A ile C arasına geçer)
  const idF = db.getStudioDatabaseSnapshot().classes.find((c) => c.name === 'F')!.id;
  db.studioDbActions.updateClass({ id: idF, name: 'B' });
  expect(db.getStudioDatabaseSnapshot().classes.map((c) => c.name)).toEqual(['A', 'B', 'C', 'D', 'E']);

  // Numaralı sınıflarda da 1-A silinip yeniden eklenince 1-C'nin önüne oturur
  const id1A = db.studioDbActions.addClass('1-A', '', schoolId, '2027-2028');
  db.studioDbActions.addClass('1-C', '', schoolId, '2027-2028');
  db.studioDbActions.addClass('1-D', '', schoolId, '2027-2028');
  db.studioDbActions.addClass('10-A', '', schoolId, '2027-2028');
  db.studioDbActions.addClass('2-A', '', schoolId, '2027-2028');
  db.studioDbActions.deleteClass(id1A);
  db.studioDbActions.addClass('1-A', '', schoolId, '2027-2028');

  const nextYearNames = db
    .getStudioDatabaseSnapshot()
    .classes.filter((c) => c.academicYear === '2027-2028')
    .map((c) => c.name);
  expect(nextYearNames).toEqual(['1-A', '1-C', '1-D', '2-A', '10-A']);
});
