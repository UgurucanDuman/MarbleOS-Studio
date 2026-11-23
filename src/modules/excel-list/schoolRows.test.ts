import { expect, test } from 'vitest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';
import { buildSchoolRows, filterSchoolRows } from './schoolRows';

const second = {
  ...INITIAL_STUDIO_SEED.schools[0], id: 'sch-2', code: '00002', institutionCode: '765432', name: 'İnönü İlkokulu',
};
const db = { ...INITIAL_STUDIO_SEED, schools: [second, ...INITIAL_STUDIO_SEED.schools] };

test('rows are ordered by code and counts come from real classes and students', () => {
  const rows = buildSchoolRows(db);
  expect(rows.map((row) => row.school.code)).toEqual(['00001', '00002']);
  expect(rows.map((row) => [row.classCount, row.studentCount])).toEqual([[3, 6], [0, 0]]);
});

test('search matches name with Turkish case, school code and institution code', () => {
  const rows = buildSchoolRows(db);
  expect(filterSchoolRows(rows, 'inönü').map((r) => r.school.id)).toEqual(['sch-2']);
  expect(filterSchoolRows(rows, 'İNÖNÜ').map((r) => r.school.id)).toEqual(['sch-2']);
  expect(filterSchoolRows(rows, '00001').map((r) => r.school.id)).toEqual(['sch-1']);
  expect(filterSchoolRows(rows, '7654').map((r) => r.school.id)).toEqual(['sch-2']);
  expect(filterSchoolRows(rows, '  ')).toHaveLength(2);
});

