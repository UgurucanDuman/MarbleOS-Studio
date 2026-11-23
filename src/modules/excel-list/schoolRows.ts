import type { SchoolRecord, StudioDatabaseSnapshot } from '../../system/sqlite/types';

export interface SchoolRow {
  school: SchoolRecord;
  classCount: number;
  studentCount: number;
}

/** Okul listesi satırları: kod sırasıyla, her okulun şube ve öğrenci sayısı kayıtlardan hesaplanır. */
export function buildSchoolRows(db: Pick<StudioDatabaseSnapshot, 'schools' | 'classes' | 'students'>): SchoolRow[] {
  const classSchool = new Map(db.classes.map((item) => [item.id, item.schoolId]));
  const classCounts = new Map<string, number>();
  const studentCounts = new Map<string, number>();
  for (const item of db.classes) classCounts.set(item.schoolId, (classCounts.get(item.schoolId) ?? 0) + 1);
  for (const student of db.students) {
    const schoolId = classSchool.get(student.classId);
    if (schoolId) studentCounts.set(schoolId, (studentCounts.get(schoolId) ?? 0) + 1);
  }
  return [...db.schools]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((school) => ({
      school,
      classCount: classCounts.get(school.id) ?? 0,
      studentCount: studentCounts.get(school.id) ?? 0,
    }));
}

/** Ad, okul kodu veya kurum kodunda arar; Türkçe büyük/küçük harf farkı yok sayılır. */
export function filterSchoolRows(rows: SchoolRow[], query: string): SchoolRow[] {
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  if (!needle) return rows;
  return rows.filter(({ school }) =>
    school.name.toLocaleLowerCase('tr-TR').includes(needle)
    || school.code.includes(needle)
    || (school.institutionCode !== '' && school.institutionCode.includes(needle)));
}

