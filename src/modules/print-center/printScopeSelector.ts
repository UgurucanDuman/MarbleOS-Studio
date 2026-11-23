import { sortClassRecords } from '../../system/sqlite/classOrder';
import type {
  ClassRecord,
  SchoolRecord,
  StudentRecord,
  StudioDatabaseSnapshot,
} from '../../system/sqlite/types';
import {
  extractDeputyPrincipalOptions,
  isKutukStaffBranchName,
  normalizeTrText,
} from '../../system/storage/yearbook-kutuk/paginationMath';
import type { DeputyScopeOption } from '../../system/storage/yearbook-kutuk/types';
import type { PrintableStudentEntry, PrintProductId } from './printSpecs';

/**
 * İZOLE MODÜL 04 KAPSAM SEÇİCİSİ:
 * Aktif okul, seçili şube (veya sorumlu Md. Yrd. kapsamı) ve ürüne göre basılabilir portreleri hesaplar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PrintScopeDerivedData {
  activeSchool: SchoolRecord | null;
  scopedClasses: ClassRecord[];
  validScopeClass: ClassRecord | null;
  deputyScopeName: string | null;
  deputyOptions: DeputyScopeOption[];
  effectiveScopeId: string;
  scopedStudents: StudentRecord[];
  classStatsMap: Map<string, { total: number; ready: number }>;
  readyStudents: number;
  missingPhotos: StudentRecord[];
  approvedEntries: PrintableStudentEntry[];
  allMatchedEntries: PrintableStudentEntry[];
  schoolStaffEntries: PrintableStudentEntry[];
}

export function derivePrintScopeData(
  db: StudioDatabaseSnapshot,
  scopeClassId: string,
  productId: PrintProductId,
): PrintScopeDerivedData {
  const activeSchool = db.schools.find((s) => s.id === db.activeSchoolId) ?? db.schools[0] ?? null;
  const scopedClasses = sortClassRecords(
    activeSchool ? db.classes.filter((c) => c.schoolId === activeSchool.id) : db.classes,
  );

  const classById = new Map(scopedClasses.map((c) => [c.id, c]));
  const photoById = new Map(db.photos.map((p) => [p.id, p]));
  const scopedStudents = activeSchool
    ? db.students.filter((s) => classById.has(s.classId))
    : db.students;

  const deputyOptions = extractDeputyPrincipalOptions(scopedClasses, scopedStudents).filter(
    (d) => d.branchCount > 0,
  );
  const validScopeClass = scopedClasses.find((c) => c.id === scopeClassId) ?? null;

  let deputyScopeName: string | null = null;
  const deputyClassIds = new Set<string>();
  if (!validScopeClass && scopeClassId.startsWith('DEPUTY:')) {
    const rawDep = scopeClassId.slice('DEPUTY:'.length).trim();
    const normDep = normalizeTrText(rawDep);
    for (const cls of scopedClasses) {
      if (!isKutukStaffBranchName(cls.name) && normalizeTrText(cls.deputyPrincipalName) === normDep) {
        deputyClassIds.add(cls.id);
        if (!deputyScopeName) deputyScopeName = (cls.deputyPrincipalName ?? rawDep).trim();
      }
    }
  }

  const effectiveScopeId = validScopeClass
    ? validScopeClass.id
    : deputyScopeName
      ? `DEPUTY:${deputyScopeName}`
      : 'ALL';

  const classStatsMap = new Map<string, { total: number; ready: number }>();
  let readyStudents = 0;
  const missingPhotos: StudentRecord[] = [];
  const approvedEntries: PrintableStudentEntry[] = [];
  const allMatchedEntries: PrintableStudentEntry[] = [];
  const schoolStaffEntries: PrintableStudentEntry[] = [];

  for (const stu of scopedStudents) {
    const stat = classStatsMap.get(stu.classId) ?? { total: 0, ready: 0 };
    stat.total += 1;
    if (stu.printReady) {
      stat.ready += 1;
      readyStudents += 1;
    }
    classStatsMap.set(stu.classId, stat);

    const cls = classById.get(stu.classId);
    const photo = stu.matchedPhotoId ? photoById.get(stu.matchedPhotoId) : undefined;
    if (photo && cls && isKutukStaffBranchName(cls.name) && stu.showInAlbum !== false) {
      schoolStaffEntries.push({
        student: stu,
        photo,
        classRecord: cls,
        className: cls.name,
      });
    }

    const inScope =
      effectiveScopeId === 'ALL'
        ? true
        : deputyScopeName
          ? deputyClassIds.has(stu.classId)
          : stu.classId === effectiveScopeId;
    if (!inScope) continue;
    if (productId !== 'e-okul-zip' && stu.showInAlbum === false) continue;

    if (!photo) {
      missingPhotos.push(stu);
      continue;
    }
    const entry: PrintableStudentEntry = {
      student: stu,
      photo,
      classRecord: cls,
      className: cls?.name ?? '',
    };
    allMatchedEntries.push(entry);
    if (stu.printReady) approvedEntries.push(entry);
  }

  return {
    activeSchool,
    scopedClasses,
    validScopeClass,
    deputyScopeName,
    deputyOptions,
    effectiveScopeId,
    scopedStudents,
    classStatsMap,
    readyStudents,
    missingPhotos,
    approvedEntries,
    allMatchedEntries,
    schoolStaffEntries,
  };
}
