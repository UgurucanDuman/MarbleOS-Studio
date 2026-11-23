import {
  addSchoolsBatchSchema,
  deleteSchoolSchema,
  deleteSchoolsBatchSchema,
  type ImportSchoolRosterInput,
  mergeSchoolsSchema,
  promoteSchoolYearSchema,
  restoreSchoolBackupJsonSchema,
  SCHOOL_LIMITS,
  schoolInputSchema,
  schoolNameKey,
  selectSchoolSchema,
  updateSchoolSchema,
  type SchoolInput,
  type SchoolParsedInput,
} from '../schemas/schoolSchemas';
import { applySchoolRosterImport } from './schoolRosterImport';
import { restoreSchoolFromBackupJson } from './schoolBackup';
import { restoreWorkspaceFromBackupJson } from './workspaceBackup';
import {
  deleteSchoolFromSnapshot,
  mergeSchoolsIntoNewRecord,
  promoteSchoolClassesToNextYear,
} from './schoolMerge';
import { appendSyncLog } from './syncLog';
import type { SchoolRecord, StudioDatabaseSnapshot } from './types';

/** Sıradaki okul kodu: mevcut en büyük kodun bir fazlası, 5 haneli metin ("00001"). */
export function nextSchoolCode(schools: SchoolRecord[]): string {
  const highest = schools.reduce((max, school) => Math.max(max, Number(school.code) || 0), 0);
  if (highest >= 99_999) throw new Error('Okul kodu sınırına ulaşıldı.');
  return String(highest + 1).padStart(5, '0');
}

/** Ad ve kurum kodu tekrarını engeller. Düzenlenen okul kendisiyle karşılaştırılmaz. */
function assertUniqueSchool(schools: SchoolRecord[], input: SchoolParsedInput, ignoreId?: string) {
  const others = schools.filter((school) => school.id !== ignoreId);
  const key = schoolNameKey(input.name);
  if (others.some((school) => schoolNameKey(school.name) === key)) {
    throw new Error('Bu adla kayıtlı bir okul zaten var.');
  }
  if (input.institutionCode && others.some((school) => school.institutionCode === input.institutionCode)) {
    throw new Error('Bu kurum kodu başka bir okulda kayıtlı.');
  }
}

function cleanSchool(input: SchoolParsedInput): SchoolParsedInput {
  return { ...input, name: input.name.replace(/\s+/g, ' ') };
}

export function createSchoolActions(
  readSnapshot: () => StudioDatabaseSnapshot,
  commitSnapshot: (next: StudioDatabaseSnapshot) => void,
) {
  return {
    createSchool(rawInput: SchoolInput) {
      const state = readSnapshot();
      const input = cleanSchool(schoolInputSchema.parse(rawInput));
      if (state.schools.length >= SCHOOL_LIMITS.maxSchools) throw new Error('Okul sayısı sınırına ulaşıldı.');
      assertUniqueSchool(state.schools, input);
      const now = new Date().toISOString();
      const school: SchoolRecord = {
        id: crypto.randomUUID(),
        code: nextSchoolCode(state.schools),
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      commitSnapshot({
        ...state,
        schools: [...state.schools, school],
        activeSchoolId: school.id,
        syncQueue: appendSyncLog('school', school.id, 'INSERT', `${school.name} okulu eklendi`, state.syncQueue),
      });
      return school.id;
    },

    updateSchool(rawInput: SchoolInput & { id: string }) {
      const state = readSnapshot();
      const { id, ...parsed } = updateSchoolSchema.parse(rawInput);
      const current = state.schools.find((school) => school.id === id);
      if (!current) throw new Error('Okul bulunamadı.');
      const input = cleanSchool(parsed);
      assertUniqueSchool(state.schools, input, id);
      const updated: SchoolRecord = { ...current, ...input, updatedAt: new Date().toISOString() };
      commitSnapshot({
        ...state,
        schools: state.schools.map((school) => (school.id === id ? updated : school)),
        syncQueue: appendSyncLog('school', id, 'UPDATE', `${updated.name} okul bilgisi güncellendi`, state.syncQueue),
      });
    },

    selectSchool(rawId: string | null) {
      const state = readSnapshot();
      const id = selectSchoolSchema.parse(rawId);
      if (id && !state.schools.some((school) => school.id === id)) throw new Error('Okul bulunamadı.');
      if (state.activeSchoolId === id) return;
      commitSnapshot({ ...state, activeSchoolId: id });
    },

    addSchoolsBatch(rawRows: SchoolInput[]) {
      const state = readSnapshot();
      const { rows } = addSchoolsBatchSchema.parse({ rows: rawRows });
      if (state.schools.length + rows.length > SCHOOL_LIMITS.maxSchools) {
        throw new Error('Okul sayısı sınırına ulaşıldı.');
      }
      const working = [...state.schools];
      const now = new Date().toISOString();
      const added: SchoolRecord[] = [];
      for (const rawRow of rows) {
        const input = cleanSchool(rawRow);
        assertUniqueSchool(working, input);
        const school: SchoolRecord = {
          id: crypto.randomUUID(),
          code: nextSchoolCode(working),
          ...input,
          createdAt: now,
          updatedAt: now,
        };
        working.push(school);
        added.push(school);
      }
      commitSnapshot({
        ...state,
        schools: working,
        activeSchoolId: state.activeSchoolId ?? added[0].id,
        syncQueue: appendSyncLog(
          'school',
          added[0].id,
          'INSERT',
          `${added.length} okul toplu olarak eklendi`,
          state.syncQueue,
        ),
      });
      return added.length;
    },

    deleteSchool(rawId: string) {
      const state = readSnapshot();
      const schoolId = deleteSchoolSchema.parse(rawId);
      commitSnapshot(deleteSchoolFromSnapshot(state, schoolId));
    },

    deleteSchoolsBatch(rawIds: string[]) {
      let next = readSnapshot();
      const ids = Array.from(new Set(deleteSchoolsBatchSchema.parse(rawIds)));
      for (const id of ids) {
        if (next.schools.some((s) => s.id === id)) {
          next = deleteSchoolFromSnapshot(next, id);
        }
      }
      commitSnapshot(next);
    },

    mergeSchools(rawInput: { newSchoolName: string; schoolIds: string[] }) {
      const state = readSnapshot();
      const { newSchoolName, schoolIds } = mergeSchoolsSchema.parse(rawInput);
      const next = mergeSchoolsIntoNewRecord(
        state,
        newSchoolName,
        schoolIds,
        nextSchoolCode(state.schools),
      );
      commitSnapshot(next);
      return next.activeSchoolId!;
    },

    restoreSchoolBackup(rawJson: string) {
      const state = readSnapshot();
      const json = restoreSchoolBackupJsonSchema.parse(rawJson);
      const next = restoreSchoolFromBackupJson(state, json, nextSchoolCode(state.schools));
      commitSnapshot(next);
      return next.activeSchoolId!;
    },

    restoreWorkspaceBackup(rawJson: string) {
      const state = readSnapshot();
      const json = restoreSchoolBackupJsonSchema.parse(rawJson);
      const next = restoreWorkspaceFromBackupJson(state, json, nextSchoolCode);
      commitSnapshot(next);
      return next.activeSchoolId!;
    },

    promoteSchoolYear(rawInput: { schoolId: string; targetAcademicYear: string }) {
      const state = readSnapshot();
      const { schoolId, targetAcademicYear } = promoteSchoolYearSchema.parse(rawInput);
      commitSnapshot(promoteSchoolClassesToNextYear(state, schoolId, targetAcademicYear));
    },

    importSchoolRoster(rawInput: ImportSchoolRosterInput) {
      const state = readSnapshot();
      const { nextSnapshot, result } = applySchoolRosterImport(state, rawInput);
      if (result.createdClasses > 0 || result.addedStudents > 0) {
        commitSnapshot(nextSnapshot);
      }
      return result;
    },
  };
}

