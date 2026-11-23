import { describe, expect, test } from 'vitest';
import { createEmptyStudioSnapshot } from './emptySnapshot';
import { sameJsonValue, shareUnchangedSnapshot } from './snapshotSharing';
import type { StudioDatabaseSnapshot } from './types';

function snapshot(): StudioDatabaseSnapshot {
  const base = createEmptyStudioSnapshot();
  return {
    ...base,
    classes: [
      { id: 'c1', schoolId: 's1', academicYear: '2026-2027', name: '1-A', teacherName: '', createdAt: '2026' },
      { id: 'c2', schoolId: 's1', academicYear: '2026-2027', name: '1-B', teacherName: '', createdAt: '2026' },
    ],
    students: [
      { id: 'st1', classId: 'c1', studentNumber: '1', firstName: 'Ali', lastName: 'Kaya', matchedPhotoId: null, printReady: false, updatedAt: '2026' },
      { id: 'st2', classId: 'c2', studentNumber: '2', firstName: 'Ece', lastName: 'Demir', matchedPhotoId: null, printReady: false, updatedAt: '2026' },
    ],
  };
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('shareUnchangedSnapshot', () => {
  test('keeps record and array references when only the active school changes', () => {
    const previous = snapshot();
    const next = { ...clone(previous), activeSchoolId: 's2' };
    const shared = shareUnchangedSnapshot(previous, next);
    expect(shared).not.toBe(previous);
    expect(shared.activeSchoolId).toBe('s2');
    expect(shared.classes).toBe(previous.classes);
    expect(shared.students).toBe(previous.students);
    expect(shared.albumConfig).toBe(previous.albumConfig);
  });

  test('returns the previous snapshot when the committed data is identical', () => {
    const previous = snapshot();
    expect(shareUnchangedSnapshot(previous, clone(previous))).toBe(previous);
  });

  test('uses the committed values for changed records and keeps the rest', () => {
    const previous = snapshot();
    const next = clone(previous);
    next.students[1] = { ...next.students[1], firstName: 'Elif' };
    const shared = shareUnchangedSnapshot(previous, next);
    expect(shared.students).not.toBe(previous.students);
    expect(shared.students[0]).toBe(previous.students[0]);
    expect(shared.students[1]).toBe(next.students[1]);
    expect(shared.students[1].firstName).toBe('Elif');
  });

  test('follows committed order, additions and removals', () => {
    const previous = snapshot();
    const next = clone(previous);
    next.classes = [next.classes[1]];
    const shared = shareUnchangedSnapshot(previous, next);
    expect(shared.classes).toHaveLength(1);
    expect(shared.classes[0]).toBe(previous.classes[1]);
  });

  test('treats undefined optional keys as absent but detects real differences', () => {
    expect(sameJsonValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameJsonValue({ a: 1, nested: { x: [1, 2] } }, { a: 1, nested: { x: [1, 3] } })).toBe(false);
    expect(sameJsonValue([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});
