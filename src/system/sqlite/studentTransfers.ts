import { transferStudentSchema, type TransferStudentInput } from '../schemas/studioSchemas';
import { isStaffBranch } from './rosterImportActions';
import { appendSyncLog } from './syncLog';
import type { ClassRecord, StudioDatabaseSnapshot } from './types';

export function canTransferStudentToClass(source: ClassRecord, target: ClassRecord): boolean {
  return source.id !== target.id &&
    source.schoolId === target.schoolId &&
    source.academicYear === target.academicYear &&
    !isStaffBranch(source.name) && !isStaffBranch(target.name);
}

export function planStudentTransfer(state: StudioDatabaseSnapshot, rawInput: TransferStudentInput) {
  const { studentId, sourceClassId, targetClassId } = transferStudentSchema.parse(rawInput);
  const student = state.students.find((record) => record.id === studentId);
  if (!student || student.classId !== sourceClassId) {
    throw new Error('Öğrencinin sınıfı değişmiş olabilir. Listeyi kontrol edip tekrar deneyin.');
  }
  const source = state.classes.find((record) => record.id === sourceClassId);
  const target = state.classes.find((record) => record.id === targetClassId);
  if (!source || !target || !canTransferStudentToClass(source, target)) {
    throw new Error('Aynı okul ve dönemde farklı bir öğrenci sınıfı seçin.');
  }
  if (state.students.some((record) => record.classId === target.id && record.studentNumber === student.studentNumber)) {
    throw new Error(`${target.name} sınıfında ${student.studentNumber} okul numarası zaten kullanılıyor.`);
  }

  const snapshot: StudioDatabaseSnapshot = {
    ...state,
    students: [
      ...state.students.filter((record) => record.id !== student.id),
      { ...student, classId: target.id, printReady: false, updatedAt: new Date().toISOString() },
    ],
    photos: student.matchedPhotoId
      ? state.photos.map((photo) => photo.id === student.matchedPhotoId
          ? { ...photo, classId: target.id, approvedForPrint: false }
          : photo)
      : state.photos,
    syncQueue: appendSyncLog('student', student.id, 'UPDATE', 'Öğrencinin sınıfı değiştirildi', state.syncQueue),
  };
  return { snapshot, targetClassName: target.name };
}
