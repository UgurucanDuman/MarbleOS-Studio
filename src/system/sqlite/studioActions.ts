import { createPhotoActions } from './photoActions';
import { createClassStudentActions } from './classStudentActions';
import { sortClassRecords } from './classOrder';
import { createSchoolActions } from './schoolActions';
import { createPhotoManagementActions, type CommitWorkspace } from './photoManagementActions';
import { cleanStudentIdCard, isStaffBranch, planRosterImport } from './rosterImportActions';
import { appendSyncLog } from './syncLog';
import {
  addStudentsBatchSchema, albumConfigPatchSchema, createClassSchema,
  deleteStudentsBatchSchema, deleteStudentSchema, updateStudentSchema,
} from '../schemas/studioSchemas';
import type { AlbumTemplateConfig, StudentIdCardDetails, StudioDatabaseSnapshot } from './types';

export function createStudioActions(
  readSnapshot: () => StudioDatabaseSnapshot,
  commitSnapshot: CommitWorkspace,
) {
  return {
    ...createSchoolActions(readSnapshot, commitSnapshot),
    ...createClassStudentActions(readSnapshot, commitSnapshot),
    ...createPhotoManagementActions(readSnapshot, commitSnapshot),
    ...createPhotoActions(readSnapshot, commitSnapshot),

    importClassRoster(input: Parameters<typeof planRosterImport>[1]) {
      const plan = planRosterImport(readSnapshot(), input);
      const added = plan.rows.length ? this.addStudentsBatch(plan.classId, plan.rows) : 0;
      return { added, skipped: plan.skipped };
    },

    addClass(name: string, teacherName: string, schoolId: string, academicYear: string, deputyPrincipalName?: string) {
      const snapshotState = readSnapshot();
      const input = createClassSchema.parse({ name, teacherName, deputyPrincipalName, schoolId, academicYear });
      if (!snapshotState.schools.some((school) => school.id === input.schoolId)) {
        throw new Error('Okul bulunamadı. Önce okulu kaydedin.');
      }
      const cleanName = input.name.toLocaleUpperCase('tr-TR');
      if (snapshotState.classes.some((item) => item.name === cleanName &&
          item.schoolId === input.schoolId && item.academicYear === input.academicYear)) {
        throw new Error('Bu okul ve dönemde aynı sınıf zaten var.');
      }
      const id = crypto.randomUUID();
      const newClass = {
        id, schoolId: input.schoolId, academicYear: input.academicYear, name: cleanName,
        teacherName: input.teacherName ?? '', deputyPrincipalName: input.deputyPrincipalName ?? '',
        createdAt: new Date().toISOString(),
      };
      commitSnapshot({
        ...snapshotState,
        classes: sortClassRecords([...snapshotState.classes, newClass]),
        albumConfig: { ...snapshotState.albumConfig, selectedClassId: id },
        syncQueue: appendSyncLog('class', id, 'INSERT', `${cleanName} sınıfı oluşturuldu`, snapshotState.syncQueue),
      });
      return id;
    },

    addStudentsBatch(
      classId: string,
      rows: Array<{
        studentNumber: string; firstName: string; lastName: string;
        role?: string; isPrincipal?: boolean; showInAlbum?: boolean; groupCode?: string;
        idCard?: StudentIdCardDetails;
      }>,
    ) {
      const snapshotState = readSnapshot();
      ({ classId, rows } = addStudentsBatchSchema.parse({ classId, rows }));
      const targetClass = snapshotState.classes.find((item) => item.id === classId);
      if (!targetClass) throw new Error('Sınıf bulunamadı.');
      const isStaffList = isStaffBranch(targetClass.name);
      const existingNumbers = new Set(snapshotState.students.filter((item) => item.classId === classId).map((item) => item.studentNumber));
      const batchNumbers = new Set<string>();
      const resolvedRows: typeof rows = [];
      rows.forEach((row, idx) => {
        let num = row.studentNumber.trim();
        if (isStaffList && num === '0' && (existingNumbers.has(num) || batchNumbers.has(num))) {
          let seq = snapshotState.students.filter((s) => s.classId === classId).length + idx + 1;
          while (existingNumbers.has(`0-${seq}`) || batchNumbers.has(`0-${seq}`)) seq += 1;
          num = `0-${seq}`;
        }
        if (batchNumbers.has(num)) throw new Error(`Bu sınıfta yinelenen okul numarası: ${num}`);
        batchNumbers.add(num);
        if (existingNumbers.has(num)) {
          if (rows.length === 1) throw new Error(`Bu sınıfta yinelenen okul numarası: ${num}`);
          return;
        }
        resolvedRows.push({ ...row, studentNumber: num });
      });
      if (resolvedRows.length === 0) {
        throw new Error('Bu sınıfta yinelenen okul numarası: listedeki tüm öğrenciler zaten kayıtlı; aynı liste ikinci kez yüklenmedi.');
      }
      const now = new Date().toISOString();
      const added = resolvedRows.map((r) => {
        const idCard = cleanStudentIdCard(r.idCard);
        return {
          id: crypto.randomUUID(),
          classId,
          studentNumber: r.studentNumber,
          firstName: r.firstName.trim(),
          lastName: r.lastName.trim(),
          role: (r.role ?? '').trim() || (r.isPrincipal ? 'MDR.' : ''),
          ...(r.isPrincipal !== undefined ? { isPrincipal: r.isPrincipal } : {}),
          showInAlbum: r.showInAlbum ?? true,
          groupCode: (r.groupCode ?? '').trim(),
          ...(idCard ? { idCard } : {}),
          matchedPhotoId: null,
          printReady: false,
          updatedAt: now,
        };
      });
      commitSnapshot({
        ...snapshotState,
        students: [...snapshotState.students, ...added],
        syncQueue: appendSyncLog('student', classId, 'INSERT', `${added.length} öğrenci listeye eklendi`, snapshotState.syncQueue),
      });
      return added.length;
    },

    deleteStudent(studentId: string) {
      const snapshotState = readSnapshot();
      deleteStudentSchema.parse(studentId);
      const target = snapshotState.students.find((s) => s.id === studentId);
      if (!target) return;
      commitSnapshot({
        ...snapshotState,
        students: snapshotState.students.filter((s) => s.id !== studentId),
        photos: snapshotState.photos.map((p) => (p.studentId === studentId ? { ...p, studentId: null, approvedForPrint: false } : p)),
        syncQueue: appendSyncLog('student', studentId, 'DELETE', `${target.studentNumber} ${target.firstName} ${target.lastName} kaydı silindi`, snapshotState.syncQueue),
      });
    },

    updateStudent(rawInput: {
      id: string; studentNumber: string; firstName: string; lastName: string;
      role?: string; isPrincipal?: boolean; showInAlbum?: boolean; groupCode?: string;
      idCard?: StudentIdCardDetails;
    }) {
      const snapshotState = readSnapshot();
      const input = updateStudentSchema.parse(rawInput);
      const current = snapshotState.students.find((s) => s.id === input.id);
      if (!current) throw new Error('Öğrenci bulunamadı.');
      const duplicate = snapshotState.students.some(
        (s) => s.classId === current.classId && s.id !== input.id && s.studentNumber === input.studentNumber,
      );
      if (duplicate) throw new Error(`Bu sınıfta yinelenen okul numarası: ${input.studentNumber}`);
      const now = new Date().toISOString();
      const nextIdCard = input.idCard !== undefined ? cleanStudentIdCard(input.idCard) : current.idCard;
      const nextIsPrincipal = input.isPrincipal !== undefined ? input.isPrincipal : current.isPrincipal;
      const nextRole = input.role !== undefined ? input.role : current.role;
      const identityChanged =
        current.studentNumber !== input.studentNumber ||
        current.firstName !== input.firstName ||
        current.lastName !== input.lastName ||
        JSON.stringify(current.idCard ?? {}) !== JSON.stringify(nextIdCard ?? {});
      const updatedStudents = snapshotState.students.map((s) => {
        if (s.id !== input.id) return s;
        const base = {
          ...s,
          studentNumber: input.studentNumber,
          firstName: input.firstName,
          lastName: input.lastName,
          role: nextRole || (nextIsPrincipal ? 'MDR.' : ''),
          ...(nextIsPrincipal !== undefined ? { isPrincipal: nextIsPrincipal } : {}),
          showInAlbum: input.showInAlbum !== undefined ? input.showInAlbum : s.showInAlbum,
          groupCode: input.groupCode !== undefined ? input.groupCode : s.groupCode,
          printReady: identityChanged ? false : s.printReady,
          updatedAt: now,
        };
        if (nextIdCard) base.idCard = nextIdCard;
        else delete base.idCard;
        return base;
      });
      const updatedPhotos = identityChanged
        ? snapshotState.photos.map((p) => (p.studentId === input.id ? { ...p, approvedForPrint: false } : p))
        : snapshotState.photos;
      commitSnapshot({
        ...snapshotState,
        students: updatedStudents,
        photos: updatedPhotos,
        syncQueue: appendSyncLog('student', input.id, 'UPDATE', `${input.studentNumber} ${input.firstName} ${input.lastName} güncellendi`, snapshotState.syncQueue),
      });
    },

    deleteStudentsBatch(rawIds: string[]) {
      const snapshotState = readSnapshot();
      const ids = new Set(deleteStudentsBatchSchema.parse(rawIds));
      const remaining = snapshotState.students.filter((s) => !ids.has(s.id));
      const removedCount = snapshotState.students.length - remaining.length;
      if (removedCount === 0) return 0;
      commitSnapshot({
        ...snapshotState,
        students: remaining,
        photos: snapshotState.photos.map((p) => (p.studentId && ids.has(p.studentId) ? { ...p, studentId: null, approvedForPrint: false } : p)),
        syncQueue: appendSyncLog('student', rawIds[0], 'DELETE', `${removedCount} öğrenci kaydı toplu silindi`, snapshotState.syncQueue),
      });
      return removedCount;
    },


    updateAlbumConfig(patch: Partial<AlbumTemplateConfig>) {
      const snapshotState = readSnapshot();
      patch = albumConfigPatchSchema.parse(patch);
      if (patch.selectedClassId && !snapshotState.classes.some((item) => item.id === patch.selectedClassId)) {
        throw new Error('Sınıf bulunamadı.');
      }
      commitSnapshot({ ...snapshotState, albumConfig: { ...snapshotState.albumConfig, ...patch } });
    },

    markAllQueueSynced() {
      throw new Error('Bulut bağlantısı henüz uygulanmadı. Sunucu onayı olmadan eşitlendi işaretlenemez.');
    },
  };
}

export type StudioActions = ReturnType<typeof createStudioActions>;
