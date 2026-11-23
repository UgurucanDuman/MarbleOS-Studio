import {
  batchPatchClassStudentsSchema,
  deleteClassSchema,
  duplicateClassSchema,
  moveStudentOrderSchema,
  sortClassStudentsSchema,
  updateClassSchema,
  type TransferStudentInput,
} from '../schemas/studioSchemas';
import { sortClassRecords } from './classOrder';
import { planStudentTransfer } from './studentTransfers';
import { appendSyncLog } from './syncLog';
import type { StudioDatabaseSnapshot } from './types';

/**
 * İZOLE SİSTEM KATMANI: Şube ve Öğrenci Sıra/Kadro Aksiyonları (src/system/sqlite/classStudentActions.ts)
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function createClassStudentActions(
  readSnapshot: () => StudioDatabaseSnapshot,
  commitSnapshot: (next: StudioDatabaseSnapshot) => void,
) {
  return {
    transferStudent(input: TransferStudentInput) {
      const { snapshot, targetClassName } = planStudentTransfer(readSnapshot(), input);
      commitSnapshot(snapshot);
      return targetClassName;
    },

    updateClass(rawInput: {
      id: string;
      name: string;
      teacherName?: string;
      deputyPrincipalName?: string;
    }) {
      const state = readSnapshot();
      const input = updateClassSchema.parse(rawInput);
      const current = state.classes.find((c) => c.id === input.id);
      if (!current) throw new Error('Şube bulunamadı.');
      const cleanName = input.name.toLocaleUpperCase('tr-TR');
      const duplicate = state.classes.some(
        (c) =>
          c.id !== input.id &&
          c.schoolId === current.schoolId &&
          c.academicYear === current.academicYear &&
          c.name === cleanName,
      );
      if (duplicate) throw new Error('Bu okul ve dönemde aynı şube adı zaten var.');

      commitSnapshot({
        ...state,
        classes: sortClassRecords(
          state.classes.map((c) =>
            c.id === input.id
              ? {
                  ...c,
                  name: cleanName,
                  teacherName: (input.teacherName ?? '').trim(),
                  deputyPrincipalName: (input.deputyPrincipalName ?? '').trim(),
                }
              : c,
          ),
        ),
        syncQueue: appendSyncLog('class', input.id, 'UPDATE', `${cleanName} şube bilgileri güncellendi`, state.syncQueue),
      });
    },

    deleteClass(rawClassId: string) {
      const state = readSnapshot();
      const classId = deleteClassSchema.parse(rawClassId);
      const target = state.classes.find((c) => c.id === classId);
      if (!target) return;
      const studentIds = new Set(state.students.filter((s) => s.classId === classId).map((s) => s.id));
      const remainingClasses = state.classes.filter((c) => c.id !== classId);
      const nextSelectedClassId =
        state.albumConfig.selectedClassId === classId
          ? (remainingClasses.find((c) => c.schoolId === target.schoolId)?.id ?? '')
          : state.albumConfig.selectedClassId;

      commitSnapshot({
        ...state,
        classes: remainingClasses,
        students: state.students.filter((s) => s.classId !== classId),
        photos: state.photos.map((p) =>
          p.classId === classId || (p.studentId && studentIds.has(p.studentId))
            ? { ...p, classId: undefined, studentId: null, approvedForPrint: false }
            : p,
        ),
        albumConfig: { ...state.albumConfig, selectedClassId: nextSelectedClassId },
        syncQueue: appendSyncLog('class', classId, 'DELETE', `${target.name} şubesi silindi`, state.syncQueue),
      });
    },

    duplicateClass(rawClassId: string): string {
      const state = readSnapshot();
      const classId = duplicateClassSchema.parse(rawClassId);
      const source = state.classes.find((c) => c.id === classId);
      if (!source) throw new Error('Çoğaltılacak şube bulunamadı.');

      const baseName =
        source.name
          .replace(/(?:-\d+)+-*$/, '')
          .replace(/-+$/, '')
          .trim() || '1-A';
      const makeCandidate = (n: number) => {
        const tag = `-${n}`;
        return `${baseName.slice(0, Math.max(1, 20 - tag.length))}${tag}`;
      };
      let suffix = 2;
      let candidateName = makeCandidate(suffix);
      while (
        state.classes.some(
          (c) =>
            c.schoolId === source.schoolId &&
            c.academicYear === source.academicYear &&
            c.name === candidateName,
        )
      ) {
        suffix += 1;
        if (suffix > 999) throw new Error('En fazla 999 kopya şube oluşturulabilir.');
        candidateName = makeCandidate(suffix);
      }

      const now = new Date().toISOString();
      const newClassId = crypto.randomUUID();
      const sourceStudents = state.students.filter((s) => s.classId === classId);
      const clonedStudents = sourceStudents.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        classId: newClassId,
        matchedPhotoId: null,
        printReady: false,
        updatedAt: now,
      }));

      commitSnapshot({
        ...state,
        classes: sortClassRecords([
          ...state.classes,
          {
            ...source,
            id: newClassId,
            name: candidateName,
            createdAt: now,
          },
        ]),
        students: [...state.students, ...clonedStudents],
        albumConfig: { ...state.albumConfig, selectedClassId: newClassId },
        syncQueue: appendSyncLog('class', newClassId, 'INSERT', `${source.name} → ${candidateName} çoğaltıldı`, state.syncQueue),
      });
      return newClassId;
    },

    sortClassStudents(rawClassId: string, rawBy: 'number' | 'name') {
      const state = readSnapshot();
      const { classId, by } = sortClassStudentsSchema.parse({ classId: rawClassId, by: rawBy });
      const classStudents = state.students.filter((s) => s.classId === classId);
      if (classStudents.length < 2) return;

      const sorted = [...classStudents].sort((a, b) => {
        if (by === 'number') {
          return a.studentNumber.localeCompare(b.studentNumber, 'tr-TR', { numeric: true });
        }
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'tr-TR');
      });

      let cursor = 0;
      commitSnapshot({
        ...state,
        students: state.students.map((s) => (s.classId === classId ? sorted[cursor++] : s)),
      });
    },

    moveStudentOrder(rawStudentId: string, rawDirection: 'up' | 'down') {
      const state = readSnapshot();
      const { studentId, direction } = moveStudentOrderSchema.parse({
        studentId: rawStudentId,
        direction: rawDirection,
      });
      const target = state.students.find((s) => s.id === studentId);
      if (!target) return;
      const classIndices = state.students
        .map((s, idx) => (s.classId === target.classId ? idx : -1))
        .filter((idx) => idx >= 0);
      const posInClass = classIndices.findIndex((idx) => state.students[idx].id === studentId);
      const swapPosInClass = direction === 'up' ? posInClass - 1 : posInClass + 1;
      if (posInClass < 0 || swapPosInClass < 0 || swapPosInClass >= classIndices.length) return;

      const idxA = classIndices[posInClass];
      const idxB = classIndices[swapPosInClass];
      const nextStudents = [...state.students];
      [nextStudents[idxA], nextStudents[idxB]] = [nextStudents[idxB], nextStudents[idxA]];
      commitSnapshot({ ...state, students: nextStudents });
    },

    batchPatchClassStudents(rawInput: {
      classId: string;
      studentIds?: string[];
      showInAlbum?: boolean;
      groupCode?: string;
    }) {
      const state = readSnapshot();
      const input = batchPatchClassStudentsSchema.parse(rawInput);
      const idFilter = input.studentIds?.length ? new Set(input.studentIds) : null;
      const now = new Date().toISOString();

      commitSnapshot({
        ...state,
        students: state.students.map((s) => {
          if (s.classId !== input.classId) return s;
          if (idFilter && !idFilter.has(s.id)) return s;
          return {
            ...s,
            showInAlbum: input.showInAlbum !== undefined ? input.showInAlbum : s.showInAlbum,
            groupCode: input.groupCode !== undefined ? input.groupCode : s.groupCode,
            updatedAt: now,
          };
        }),
      });
    },
  };
}

