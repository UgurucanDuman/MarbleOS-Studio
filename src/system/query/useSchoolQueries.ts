import { useMutation } from '@tanstack/react-query';
import {
  addSchoolsBatchSchema,
  deleteSchoolSchema,
  deleteSchoolsBatchSchema,
  importSchoolRosterSchema,
  mergeSchoolsSchema,
  promoteSchoolYearSchema,
  restoreSchoolBackupJsonSchema,
  schoolInputSchema,
  selectSchoolSchema,
  updateSchoolSchema,
} from '../schemas/schoolSchemas';
import type { StudioDatabaseSnapshot } from '../sqlite/types';
import { selectStudioSchool } from '../sqlite/studioDatabase';
import { useValidatedStudioMutation } from './useStudioQueries';

/** Modüllerin sınıf kaydından okul adını göstermesi için tek okuma yolu. */
export function schoolNameFor(db: StudioDatabaseSnapshot, schoolId: string | null | undefined): string | null {
  return db.schools.find((school) => school.id === schoolId)?.name ?? null;
}

// Okul kayıtları aynı tek snapshot sahibi üzerinden yazılır; ayrı cache tutulmaz.
export function useCreateSchoolMutation() {
  return useValidatedStudioMutation(schoolInputSchema, (v, actions) => actions.createSchool(v));
}

export function useUpdateSchoolMutation() {
  return useValidatedStudioMutation(updateSchoolSchema, (v, actions) => actions.updateSchool(v));
}

export function useSelectSchoolMutation() {
  return useMutation({
    mutationFn: async (rawId: string | null): Promise<void> => {
      await selectStudioSchool(selectSchoolSchema.parse(rawId));
    },
  });
}

export function useAddSchoolsBatchMutation() {
  return useValidatedStudioMutation(addSchoolsBatchSchema, (v, actions) => actions.addSchoolsBatch(v.rows));
}

export function useDeleteSchoolMutation() {
  return useValidatedStudioMutation(deleteSchoolSchema, (id, actions) => actions.deleteSchool(id));
}

export function useDeleteSchoolsBatchMutation() {
  return useValidatedStudioMutation(deleteSchoolsBatchSchema, (ids, actions) =>
    actions.deleteSchoolsBatch(ids),
  );
}

export function useMergeSchoolsMutation() {
  return useValidatedStudioMutation(mergeSchoolsSchema, (v, actions) => actions.mergeSchools(v));
}

export function useRestoreSchoolBackupMutation() {
  return useValidatedStudioMutation(restoreSchoolBackupJsonSchema, (json, actions) =>
    actions.restoreSchoolBackup(json),
  );
}

export function useRestoreWorkspaceBackupMutation() {
  return useValidatedStudioMutation(restoreSchoolBackupJsonSchema, (json, actions) =>
    actions.restoreWorkspaceBackup(json),
  );
}

export function usePromoteSchoolYearMutation() {
  return useValidatedStudioMutation(promoteSchoolYearSchema, (v, actions) =>
    actions.promoteSchoolYear(v),
  );
}

export function useImportSchoolRosterMutation() {
  return useValidatedStudioMutation(importSchoolRosterSchema, (v, actions) =>
    actions.importSchoolRoster(v),
  );
}
