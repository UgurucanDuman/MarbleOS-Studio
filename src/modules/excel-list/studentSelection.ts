import type { StudentRecord } from '../../system/sqlite/types';

export function getVisibleCheckedStudentIds(checkedIds: string[], students: readonly StudentRecord[]) {
  if (checkedIds.length === 0) return checkedIds;
  const visibleIds = new Set(students.map((student) => student.id));
  return checkedIds.filter((id) => visibleIds.has(id));
}

export function toggleVisibleStudentIds(checkedIds: string[], students: readonly StudentRecord[]) {
  const visibleIds = students.map((student) => student.id);
  const checked = new Set(checkedIds);
  if (visibleIds.length > 0 && visibleIds.every((id) => checked.has(id))) return [];
  for (const id of visibleIds) checked.add(id);
  return [...checked];
}
