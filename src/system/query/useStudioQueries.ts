import { useMutation } from '@tanstack/react-query';
import type { z } from 'zod';
import {
  runStudioMutation,
  useStudioDatabase,
} from '../sqlite/studioDatabase';
import type { StudioActions } from '../sqlite/studioActions';
import { useWindowWorkEnabled } from '../motion/windowWork';
import {
  addStudentsBatchSchema,
  albumConfigPatchSchema,
  approveBranchForPrintSchema,
  assignPhotoSchema,
  batchPatchClassStudentsSchema,
  createClassSchema,
  deleteClassSchema,
  deleteStudentsBatchSchema,
  deleteStudentSchema,
  duplicateClassSchema,
  moveStudentOrderSchema,
  shiftStudentPhotoSchema,
  sortClassStudentsSchema,
  transferStudentSchema,
  updateClassSchema,
  updatePhotoStudioSchema,
  updateStudentSchema,
  uploadPhotosSchema,
} from '../schemas/studioSchemas';

export function useStudioSnapshotQuery(enabled = true) {
  const windowWorkEnabled = useWindowWorkEnabled();
  return { data: useStudioDatabase(enabled && windowWorkEnabled) };
}

export function useValidatedStudioMutation<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  executor: (validated: z.infer<TSchema>, actions: StudioActions) => TResult,
) {
  return useMutation({
    mutationFn: async (rawInput: z.input<TSchema>): Promise<TResult> => {
      const validated = schema.parse(rawInput);
      return await runStudioMutation((actions) => executor(validated, actions));
    },
  });
}

export function useCreateClassMutation() {
  return useValidatedStudioMutation(createClassSchema, (v, actions) =>
    actions.addClass(v.name, v.teacherName || '', v.schoolId, v.academicYear, v.deputyPrincipalName || ''),
  );
}

export function useImportClassRosterMutation() {
  return useValidatedStudioMutation(addStudentsBatchSchema, (input, actions) => actions.importClassRoster(input));
}

export function useUpdateClassMutation() {
  return useValidatedStudioMutation(updateClassSchema, (v, actions) =>
    actions.updateClass(v),
  );
}

export function useDeleteClassMutation() {
  return useValidatedStudioMutation(deleteClassSchema, (classId, actions) =>
    actions.deleteClass(classId),
  );
}

export function useDuplicateClassMutation() {
  return useValidatedStudioMutation(duplicateClassSchema, (classId, actions) =>
    actions.duplicateClass(classId),
  );
}

export function useAddStudentsBatchMutation() {
  return useValidatedStudioMutation(addStudentsBatchSchema, (v, actions) =>
    actions.addStudentsBatch(v.classId, v.rows),
  );
}

export function useDeleteStudentMutation() {
  return useValidatedStudioMutation(deleteStudentSchema, (studentId, actions) =>
    actions.deleteStudent(studentId),
  );
}

export function useUpdateStudentMutation() {
  return useValidatedStudioMutation(updateStudentSchema, (v, actions) =>
    actions.updateStudent(v),
  );
}

export function useDeleteStudentsBatchMutation() {
  return useValidatedStudioMutation(deleteStudentsBatchSchema, (ids, actions) =>
    actions.deleteStudentsBatch(ids),
  );
}

export function useSortClassStudentsMutation() {
  return useValidatedStudioMutation(sortClassStudentsSchema, (v, actions) =>
    actions.sortClassStudents(v.classId, v.by),
  );
}

export function useMoveStudentOrderMutation() {
  return useValidatedStudioMutation(moveStudentOrderSchema, (v, actions) =>
    actions.moveStudentOrder(v.studentId, v.direction),
  );
}

export function useTransferStudentMutation() {
  return useValidatedStudioMutation(transferStudentSchema, (input, actions) => actions.transferStudent(input));
}

export function useBatchPatchClassStudentsMutation() {
  return useValidatedStudioMutation(batchPatchClassStudentsSchema, (v, actions) =>
    actions.batchPatchClassStudents(v),
  );
}

export function useUploadPhotosMutation() {
  return useValidatedStudioMutation(uploadPhotosSchema, (v, actions) =>
    actions.uploadPhotos(v.files, v.classId, v.matchMode, v.targetStudentId),
  );
}

export function useAssignPhotoMutation() {
  return useValidatedStudioMutation(assignPhotoSchema, (v, actions) =>
    actions.assignPhotoToStudent(v.photoId, v.studentId),
  );
}

export function useShiftStudentPhotoMutation() {
  return useValidatedStudioMutation(shiftStudentPhotoSchema, (v, actions) =>
    actions.shiftStudentPhoto(v.studentId, v.direction),
  );
}

export function useUpdatePhotoStudioMutation() {
  return useValidatedStudioMutation(updatePhotoStudioSchema, (v, actions) =>
    actions.updatePhotoStudioSettings(v.photoId, v.adjustments, v.approvedForPrint),
  );
}

export function useUpdateAlbumConfigMutation() {
  return useValidatedStudioMutation(albumConfigPatchSchema, (v, actions) =>
    actions.updateAlbumConfig(v),
  );
}

export function useApproveBranchForPrintMutation() {
  return useValidatedStudioMutation(approveBranchForPrintSchema, (v, actions) =>
    actions.approveBranchPhotosForPrint(v.schoolId, v.classId),
  );
}
