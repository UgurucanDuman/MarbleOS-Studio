import {
  batchApprovePhotosSchema,
  batchPhotoAdjustmentsSchema,
  deleteStudioPhotosSchema,
  photoBatchMatchSchema,
  type BatchApprovePhotosInput,
  type BatchPhotoAdjustmentsInput,
  type DeleteStudioPhotosInput,
  type PhotoBatchMatchInput,
} from '../schemas/photoManagementSchemas';
import { arePhotoAdjustmentsEqual, mergePhotoRecipe, normalizePhotoAdjustments } from '../storage/photoColorMath';
import { photoClassId, planClassPhotoMatches } from './classPhotoMatching';
import { appendSyncLog } from './syncLog';
import type { PhotoRecord, StudioDatabaseSnapshot } from './types';

export type CommitWorkspace = (next: StudioDatabaseSnapshot, deletedPhotoIds?: string[]) => void;

function assertPhotosInScope(state: StudioDatabaseSnapshot, photoIds: string[], classId?: string): PhotoRecord[] {
  const students = new Map(state.students.map((student) => [student.id, student]));
  const classes = new Map(state.classes.map((item) => [item.id, item]));
  const ids = new Set(photoIds);
  const selected = state.photos.filter((photo) => ids.has(photo.id));
  if (
    selected.length !== ids.size ||
    selected.some((photo) => {
      const scope = photoClassId(photo, students);
      return classId ? scope !== classId : Boolean(scope && classes.get(scope)?.schoolId !== state.activeSchoolId);
    })
  ) {
    throw new Error('Seçili fotoğraflar değişti veya geçerli sınıfın dışında. Seçimi yenileyin.');
  }
  return selected;
}

export function createPhotoManagementActions(read: () => StudioDatabaseSnapshot, commit: CommitWorkspace) {
  return {
    applyClassPhotoMatches(rawInput: PhotoBatchMatchInput) {
      const { classId, mode, pairs } = photoBatchMatchSchema.parse(rawInput);
      const state = read();
      const plan = planClassPhotoMatches(state, classId, mode);
      if (plan.pairs.length !== pairs.length || plan.pairs.some((pair, index) =>
        pair.photoId !== pairs[index].photoId || pair.studentId !== pairs[index].studentId,
      )) {
        throw new Error('Eşleştirme önizlemesi değişti. Güncel önerileri kontrol edip yeniden onaylayın.');
      }
      const byStudent = new Map(pairs.map(({ studentId, photoId }) => [studentId, photoId]));
      const byPhoto = new Map(pairs.map(({ studentId, photoId }) => [photoId, studentId]));
      const now = new Date().toISOString();
      commit({
        ...state,
        photos: state.photos.map((photo) => {
          const studentId = byPhoto.get(photo.id);
          return studentId ? { ...photo, studentId, classId, approvedForPrint: false } : photo;
        }),
        students: state.students.map((student) => {
          const photoId = byStudent.get(student.id);
          return photoId ? { ...student, matchedPhotoId: photoId, printReady: false, updatedAt: now } : student;
        }),
        syncQueue: appendSyncLog('class', classId, 'UPDATE', `${pairs.length} fotoğraf eşleştirildi`, state.syncQueue),
      });
      return pairs.length;
    },

    deleteStudioPhotos(rawInput: DeleteStudioPhotosInput) {
      const { classId, photoIds } = deleteStudioPhotosSchema.parse(rawInput);
      const state = read();
      assertPhotosInScope(state, photoIds, classId);
      const ids = new Set(photoIds);
      const now = new Date().toISOString();
      commit({
        ...state,
        photos: state.photos.filter((photo) => !ids.has(photo.id)),
        students: state.students.map((student) =>
          student.matchedPhotoId && ids.has(student.matchedPhotoId)
            ? { ...student, matchedPhotoId: null, printReady: false, updatedAt: now } : student,
        ),
        syncQueue: appendSyncLog('photo', photoIds[0], 'DELETE', `${ids.size} fotoğraf silindi`, state.syncQueue),
      }, photoIds);
      return ids.size;
    },

    applyBatchPhotoAdjustments(rawInput: BatchPhotoAdjustmentsInput) {
      const { classId, photoIds, sourceAdjustments, copyFraming = false, perPhotoAdjustments } =
        batchPhotoAdjustmentsSchema.parse(rawInput);
      const state = read();
      assertPhotosInScope(state, photoIds, classId);
      const ids = new Set(photoIds);
      const invalidatedStudentIds = new Set<string>();
      let updatedCount = 0;
      const nextPhotos = state.photos.map((photo) => {
        if (!ids.has(photo.id)) return photo;
        const custom = perPhotoAdjustments?.[photo.id];
        const merged = custom
          ? normalizePhotoAdjustments(custom)
          : mergePhotoRecipe(photo.adjustments, sourceAdjustments, copyFraming);
        if (arePhotoAdjustmentsEqual(merged, photo.adjustments)) return photo;
        updatedCount += 1;
        if (photo.studentId) invalidatedStudentIds.add(photo.studentId);
        return { ...photo, adjustments: merged, approvedForPrint: false };
      });
      if (updatedCount === 0) return 0;
      const now = new Date().toISOString();
      commit({
        ...state,
        photos: nextPhotos,
        students: invalidatedStudentIds.size
          ? state.students.map((s) => (invalidatedStudentIds.has(s.id) ? { ...s, printReady: false, updatedAt: now } : s))
          : state.students,
        syncQueue: appendSyncLog('photo', photoIds[0], 'UPDATE', `${updatedCount} fotoğrafa stüdyo ışık tarifi uygulandı`, state.syncQueue),
      });
      return updatedCount;
    },

    approveStudioPhotosBatch(rawInput: BatchApprovePhotosInput) {
      const { classId, photoIds, approved } = batchApprovePhotosSchema.parse(rawInput);
      const state = read();
      const selected = assertPhotosInScope(state, photoIds, classId);
      const eligible = selected.filter((p) => (approved ? Boolean(p.studentId) && !p.approvedForPrint : p.approvedForPrint));
      if (eligible.length === 0) {
        if (approved && selected.every((p) => !p.studentId)) {
          throw new Error('Eşleşmeyen fotoğraflar baskıya onaylanamaz. Önce öğrenci eşleştirmesini yapın.');
        }
        return 0;
      }
      const eligibleIds = new Set(eligible.map((p) => p.id));
      const eligibleStuIds = new Set(eligible.map((p) => p.studentId).filter((v): v is string => Boolean(v)));
      const now = new Date().toISOString();
      commit({
        ...state,
        photos: state.photos.map((p) => (eligibleIds.has(p.id) ? { ...p, approvedForPrint: approved } : p)),
        students: state.students.map((s) => (eligibleStuIds.has(s.id) ? { ...s, printReady: approved, updatedAt: now } : s)),
        syncQueue: appendSyncLog(
          'photo',
          eligible[0]!.id,
          'UPDATE',
          `${eligible.length} fotoğraf baskı onayı ${approved ? 'verildi' : 'kaldırıldı'}`,
          state.syncQueue,
        ),
      });
      return eligible.length;
    },
  };
}
