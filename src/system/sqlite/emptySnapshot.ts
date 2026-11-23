import type { StudioDatabaseSnapshot } from './types';

export function createEmptyStudioSnapshot(): StudioDatabaseSnapshot {
  return {
    schools: [], activeSchoolId: null, classes: [], students: [], photos: [], syncQueue: [], lastSyncedAt: null,
    albumConfig: {
      selectedClassId: '', layoutKind: 'class-chart', headerTitle: '',
      accentColor: '#a1a1aa', columns: 4, showStudentNumbers: true, showTeacherBadge: true,
    },
  };
}
