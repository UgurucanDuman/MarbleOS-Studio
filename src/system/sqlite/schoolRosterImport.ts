import { importSchoolRosterSchema, type ImportSchoolRosterInput } from '../schemas/schoolSchemas';
import { sortClassRecords } from './classOrder';
import {
  cleanStudentIdCard,
  isStaffBranch,
  normalizeBranchClassName,
  rosterNameKey,
} from './rosterImportActions';
import { appendSyncLog } from './syncLog';
import type { ClassRecord, StudentRecord, StudioDatabaseSnapshot } from './types';

export interface SchoolRosterImportResult {
  createdClasses: number;
  addedStudents: number;
  skippedStudents: number;
  firstClassId: string;
}

export function schoolRosterImportNotice(result: SchoolRosterImportResult): string {
  const clsPart = result.createdClasses > 0 ? `${result.createdClasses} yeni şube açıldı, ` : '';
  const skipPart = result.skippedStudents > 0 ? ` (${result.skippedStudents} mevcut kayıt atlandı)` : '';
  return `${clsPart}${result.addedStudents} öğrenci aktarıldı${skipPart}.`;
}

export function applySchoolRosterImport(
  state: StudioDatabaseSnapshot,
  rawInput: ImportSchoolRosterInput,
): { nextSnapshot: StudioDatabaseSnapshot; result: SchoolRosterImportResult } {
  const parsed = importSchoolRosterSchema.parse(rawInput);
  const school = state.schools.find((item) => item.id === parsed.schoolId);
  if (!school) throw new Error('Okul bulunamadı. Önce okulu kaydedin.');

  const mergedByBranch = new Map<string, (typeof parsed.classes)[number]['rows']>();
  for (const group of parsed.classes) {
    const cleanName = normalizeBranchClassName(group.className);
    if (cleanName.length < 1 || cleanName.length > 20) {
      throw new Error(`"${group.className}" şube adı 1–20 karakter aralığında olmalıdır.`);
    }
    const bucket = mergedByBranch.get(cleanName) ?? [];
    bucket.push(...group.rows);
    mergedByBranch.set(cleanName, bucket);
  }

  const now = new Date().toISOString();
  const newClasses: ClassRecord[] = [];
  const newStudents: StudentRecord[] = [];
  let skippedStudents = 0;
  let firstClassId = '';

  for (const [cleanName, rows] of mergedByBranch.entries()) {
    let targetClass = state.classes.find(
      (c) => c.schoolId === school.id && c.academicYear === parsed.academicYear && c.name === cleanName,
    );
    if (!targetClass) {
      targetClass = {
        id: crypto.randomUUID(),
        schoolId: school.id,
        academicYear: parsed.academicYear,
        name: cleanName,
        teacherName: '',
        deputyPrincipalName: '',
        createdAt: now,
      };
      newClasses.push(targetClass);
    }
    if (!firstClassId) firstClassId = targetClass.id;

    const existingClassStudents = state.students.filter((s) => s.classId === targetClass!.id);
    const existingByNumber = new Map(existingClassStudents.map((s) => [s.studentNumber, s]));
    const usedNumbers = new Set(existingClassStudents.map((s) => s.studentNumber));
    const seenStaffNames = new Set(
      existingClassStudents.map((s) => `${rosterNameKey(s.firstName)}::${rosterNameKey(s.lastName)}`),
    );
    const batchByNumber = new Map<string, { firstName: string; lastName: string }>();
    const staffMode = isStaffBranch(cleanName);

    rows.forEach((row, idx) => {
      let num = row.studentNumber.trim();
      if (staffMode && num === '0') {
        const staffKey = `${rosterNameKey(row.firstName)}::${rosterNameKey(row.lastName)}`;
        if (seenStaffNames.has(staffKey)) {
          skippedStudents++;
          return;
        }
        seenStaffNames.add(staffKey);
        if (usedNumbers.has(num)) {
          let seq = existingClassStudents.length + idx + 1;
          while (usedNumbers.has(`0-${seq}`)) seq++;
          num = `0-${seq}`;
        }
      } else {
        const previous = existingByNumber.get(num) ?? batchByNumber.get(num);
        if (previous) {
          if (
            rosterNameKey(previous.firstName) !== rosterNameKey(row.firstName) ||
            rosterNameKey(previous.lastName) !== rosterNameKey(row.lastName)
          ) {
            throw new Error(
              `${cleanName} şubesinde ${num} numarası farklı bir ad/soyadla kayıtlı. Hiçbir şube değiştirilmedi.`,
            );
          }
          skippedStudents++;
          return;
        }
      }

      usedNumbers.add(num);
      batchByNumber.set(num, { firstName: row.firstName, lastName: row.lastName });
      const idCard = cleanStudentIdCard(row.idCard);
      newStudents.push({
        id: crypto.randomUUID(),
        classId: targetClass!.id,
        studentNumber: num,
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        role: (row.role ?? '').trim() || (row.isPrincipal ? 'MDR.' : ''),
        ...(row.isPrincipal !== undefined ? { isPrincipal: row.isPrincipal } : {}),
        showInAlbum: row.showInAlbum ?? true,
        groupCode: (row.groupCode ?? '').trim(),
        ...(idCard ? { idCard } : {}),
        matchedPhotoId: null,
        printReady: false,
        updatedAt: now,
      });
    });
  }

  if (state.classes.length + newClasses.length > 2000) {
    throw new Error('Toplam şube sayısı sınırına (2000) ulaşıldı.');
  }
  if (state.students.length + newStudents.length > 20_000) {
    throw new Error('Toplam öğrenci sayısı sınırına (20.000) ulaşıldı.');
  }

  const nextSnapshot: StudioDatabaseSnapshot = {
    ...state,
    activeSchoolId: school.id,
    classes: sortClassRecords([...state.classes, ...newClasses]),
    students: [...state.students, ...newStudents],
    albumConfig: {
      ...state.albumConfig,
      selectedClassId: state.albumConfig.selectedClassId || firstClassId,
    },
    syncQueue: appendSyncLog(
      'school',
      school.id,
      'UPDATE',
      `${school.name} okuluna Excel'den ${newClasses.length} şube ve ${newStudents.length} öğrenci aktarıldı`,
      state.syncQueue,
    ),
  };

  return {
    nextSnapshot,
    result: {
      createdClasses: newClasses.length,
      addedStudents: newStudents.length,
      skippedStudents,
      firstClassId,
    },
  };
}
