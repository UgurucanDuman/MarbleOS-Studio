import { expect, test, vi } from 'vitest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';
import { createStudioActions } from './studioActions';
import type { StudioDatabaseSnapshot } from './types';

const request = { studentId: 'stu-104', sourceClassId: 'cls-9a', targetClassId: 'cls-10b' };

test.each([undefined, request.sourceClassId])('transfers a student and their photo in one commit (original photo scope %s)', (classId) => {
  let state = structuredClone(INITIAL_STUDIO_SEED);
  const student = state.students.find((item) => item.id === request.studentId)!;
  const photo = state.photos.find((item) => item.id === student.matchedPhotoId)!;
  photo.classId = classId;
  const commit = vi.fn((next: StudioDatabaseSnapshot) => { state = next; });
  const actions = createStudioActions(() => state, commit);

  expect(actions.transferStudent(request)).toBe('10-B');
  expect(commit).toHaveBeenCalledTimes(1);
  expect(state.students[state.students.length - 1])
    .toMatchObject({ ...student, classId: request.targetClassId, printReady: false, updatedAt: expect.any(String) });
  expect(state.students.filter((item) => item.id === student.id)).toHaveLength(1);
  expect(state.photos.find((item) => item.id === photo.id))
    .toEqual({ ...photo, classId: request.targetClassId, approvedForPrint: false });
  expect(() => actions.transferStudent(request)).toThrow(/sınıfı değişmiş/);
  expect(commit).toHaveBeenCalledTimes(1);
});

test('rejects the same class, other schools and years, staff classes, and duplicate numbers before committing', () => {
  const state = structuredClone(INITIAL_STUDIO_SEED);
  const source = state.classes[0];
  state.classes.push(
    { ...source, id: 'other-school', schoolId: 'sch-2' },
    { ...source, id: 'other-year', academicYear: '2027–2028' },
    { ...source, id: 'staff-class', name: 'ÖĞRETMENLER' },
  );
  state.schools.push({ ...state.schools[0], id: 'sch-2', code: '00002', institutionCode: '' });
  const commit = vi.fn();
  const actions = createStudioActions(() => state, commit);
  for (const targetClassId of [source.id, 'other-school', 'other-year', 'staff-class', 'missing']) {
    expect(() => actions.transferStudent({ ...request, targetClassId })).toThrow(/farklı bir öğrenci sınıfı/);
  }

  state.students.find((item) => item.classId === request.targetClassId)!.studentNumber = '104';
  expect(() => actions.transferStudent(request)).toThrow(/104 okul numarası zaten kullanılıyor/);
  expect(commit).not.toHaveBeenCalled();
});
