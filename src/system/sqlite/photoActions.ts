import { addPrototypePhotos, assignPrototypePhoto, shiftStudentPhotoInClass } from './photoAssignments';
import { appendSyncLog } from './syncLog';
import { approveBranchForPrintSchema, assignPhotoSchema, shiftStudentPhotoSchema, updatePhotoStudioSchema, uploadPhotosSchema, type PhotoMatchMode } from '../schemas/studioSchemas';
import { arePhotoAdjustmentsEqual, normalizePhotoAdjustments } from '../storage/photoColorMath';
import type { PhotoAdjustments, StudioDatabaseSnapshot } from './types';
import type { CommitWorkspace } from './photoManagementActions';

export function createPhotoActions(readSnapshot: () => StudioDatabaseSnapshot, commitSnapshot: CommitWorkspace) {
  return {
    uploadPhotos(files: Array<{ fileName: string; dataUrl: string; contentHash?: string }>, classId?: string, matchMode?: PhotoMatchMode, targetStudentId?: string) {
      const snapshotState = readSnapshot();
      ({ files, classId, matchMode, targetStudentId } = uploadPhotosSchema.parse({ files, classId, matchMode, targetStudentId }));
      const next = addPrototypePhotos(snapshotState, files, classId, { matchMode, targetStudentId });
      const addedPhotos = next.photos.slice(snapshotState.photos.length);
      const matched = addedPhotos.filter((photo) => photo.studentId).length;
      const entityId = addedPhotos[0]?.id ?? next.students.find((student) => student.id === targetStudentId)?.matchedPhotoId;
      if (next !== snapshotState && entityId) commitSnapshot({
        ...next,
        syncQueue: appendSyncLog('photo', entityId, 'INSERT', `${addedPhotos.length} yeni fotoğraf eklendi`, snapshotState.syncQueue),
      });
      return {
        imported: addedPhotos.length, matched, unmatched: addedPhotos.length - matched,
        ...(files.length > addedPhotos.length ? { skipped: files.length - addedPhotos.length } : {}),
      };
    },

    assignPhotoToStudent(photoId: string, studentId: string | null) {
      const snapshotState = readSnapshot();
      assignPhotoSchema.parse({ photoId, studentId });
      commitSnapshot({
        ...assignPrototypePhoto(snapshotState, photoId, studentId),
        syncQueue: appendSyncLog('photo', photoId, 'UPDATE', 'Fotoğraf-öğrenci eşleştirmesi güncellendi', snapshotState.syncQueue),
      });
    },

    shiftStudentPhoto(studentId: string, direction: 'up' | 'down' | 'insert-gap-down' | 'delete-shift-up') {
      const snapshotState = readSnapshot();
      shiftStudentPhotoSchema.parse({ studentId, direction });
      commitSnapshot(shiftStudentPhotoInClass(snapshotState, studentId, direction));
    },

    updatePhotoStudioSettings(photoId: string, adjustments: PhotoAdjustments, approvedForPrint: boolean) {
      const snapshotState = readSnapshot();
      updatePhotoStudioSchema.parse({ photoId, adjustments, approvedForPrint });
      const targetPhoto = snapshotState.photos.find((p) => p.id === photoId);
      if (!targetPhoto) throw new Error('Fotoğraf bulunamadı.');
      if (approvedForPrint && !targetPhoto.studentId) throw new Error('Önce öğrenci eşleştirmesini yapın.');
      const normalized = normalizePhotoAdjustments(adjustments);
      if (approvedForPrint && !arePhotoAdjustmentsEqual(normalized, targetPhoto.adjustments)) {
        throw new Error('Önce fotoğraf değişikliklerini kaydedin, ardından baskı onayı verin.');
      }
      commitSnapshot({
        ...snapshotState,
        photos: snapshotState.photos.map((p) => (p.id === photoId ? { ...p, adjustments: normalized, approvedForPrint } : p)),
        students: snapshotState.students.map((s) => (s.id === targetPhoto.studentId ? { ...s, printReady: approvedForPrint } : s)),
        syncQueue: appendSyncLog('photo', photoId, 'UPDATE', `${targetPhoto.fileName} kadraj ve baskı onayı kaydedildi`, snapshotState.syncQueue),
      });
    },

    approveBranchPhotosForPrint(schoolId: string, classId: string) {
      const snapshotState = readSnapshot();
      approveBranchForPrintSchema.parse({ schoolId, classId });
      const isDeputyScope = classId.startsWith('DEPUTY:');
      const deputyTarget = isDeputyScope
        ? classId.slice('DEPUTY:'.length).trim().toLocaleLowerCase('tr-TR')
        : '';
      const targetClassIds = new Set(
        snapshotState.classes
          .filter((c) => {
            if (c.schoolId !== schoolId) return false;
            if (classId === 'ALL') return true;
            if (isDeputyScope) {
              const lowerName = c.name.trim().toLocaleLowerCase('tr-TR');
              const isStaff =
                lowerName.startsWith('öğretmen') ||
                lowerName.startsWith('ogretmen') ||
                lowerName.startsWith('idare') ||
                lowerName.startsWith('kadro');
              if (isStaff) return true;
              return Boolean(deputyTarget) && (c.deputyPrincipalName ?? '').trim().toLocaleLowerCase('tr-TR') === deputyTarget;
            }
            return c.id === classId;
          })
          .map((c) => c.id),
      );
      if (targetClassIds.size === 0) return 0;

      const eligibleStudentIds = new Set(
        snapshotState.students
          .filter((s) => targetClassIds.has(s.classId) && Boolean(s.matchedPhotoId) && s.showInAlbum !== false)
          .map((s) => s.id),
      );
      if (eligibleStudentIds.size === 0) return 0;

      let newlyApproved = 0;
      const nextPhotos = snapshotState.photos.map((p) => {
        if (p.studentId && eligibleStudentIds.has(p.studentId)) {
          if (!p.approvedForPrint) newlyApproved += 1;
          return { ...p, approvedForPrint: true };
        }
        return p;
      });
      const nextStudents = snapshotState.students.map((s) =>
        eligibleStudentIds.has(s.id) ? { ...s, printReady: true } : s,
      );
      const firstPhoto = nextPhotos.find((p) => p.studentId && eligibleStudentIds.has(p.studentId));
      if (!firstPhoto) return 0;

      commitSnapshot({
        ...snapshotState,
        photos: nextPhotos,
        students: nextStudents,
        syncQueue: appendSyncLog(
          'photo',
          firstPhoto.id,
          'UPDATE',
          `${eligibleStudentIds.size} eşleşen öğrenci baskı için onaylandı`,
          snapshotState.syncQueue,
        ),
      });
      return newlyApproved > 0 ? newlyApproved : eligibleStudentIds.size;
    },
  };
}
