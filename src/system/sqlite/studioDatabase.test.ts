import { beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

const STORAGE_KEY = 'marbleos_studio_local_prototype_v4';
const schoolInput = {
  name: 'Kendi Okulum', institutionCode: '', address: '', notes: '',
  makeBiometric: false, makeVesikalik: false,
};
const row = { studentNumber: '001', firstName: 'Kullanıcı', lastName: 'Kaydı' };

async function openWithSchool() {
  const db = await import('./studioDatabase');
  const schoolId = db.studioDbActions.createSchool(schoolInput);
  const classArgs = ['1-A', 'Öğretmen', schoolId, '2026-2027'] as const;
  return { db, schoolId, classArgs };
}

test('starts empty without sample people, schools or portraits', async () => {
  const { getStudioDatabaseSnapshot } = await import('./studioDatabase');
  const value = getStudioDatabaseSnapshot();
  expect([value.schools, value.classes, value.students, value.photos, value.syncQueue]).toEqual([[], [], [], [], []]);
  expect(value.activeSchoolId).toBeNull();
});

test('commits user data to local browser storage, not a claimed SQLite engine', async () => {
  const { db, schoolId, classArgs } = await openWithSchool();
  const id = db.studioDbActions.addClass(...classArgs);
  db.studioDbActions.addStudentsBatch(id, [row]);
  const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(persisted.students[0].studentNumber).toBe('001');
  expect(persisted.classes[0].schoolId).toBe(schoolId);
  expect(persisted.schools[0].name).toBe('Kendi Okulum');
});

test('rejects storage failure before publishing a successful mutation', async () => {
  const { db, classArgs } = await openWithSchool();
  const original = db.getStudioDatabaseSnapshot();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
  expect(() => db.studioDbActions.addClass(...classArgs)).toThrow('kaydedilmedi');
  expect(db.getStudioDatabaseSnapshot()).toBe(original);
});

test('preserves malformed data and blocks replacement with an empty snapshot', async () => {
  localStorage.setItem(STORAGE_KEY, '{broken');
  const db = await import('./studioDatabase');
  expect(() => db.studioDbActions.createSchool(schoolInput)).toThrow('yazma durduruldu');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
});

test('old prototype data is retained without loading mock records into the new session', async () => {
  localStorage.setItem('marbleos_studio_sqlite_v2', 'old-data-do-not-delete');
  localStorage.setItem('marbleos_studio_local_prototype_v3', '{"classes":[{"schoolName":"Eski"}]}');
  const db = await import('./studioDatabase');
  expect(db.getStudioDatabaseSnapshot().classes).toEqual([]);
  db.studioDbActions.createSchool(schoolInput);
  expect(localStorage.getItem('marbleos_studio_sqlite_v2')).toBe('old-data-do-not-delete');
  expect(localStorage.getItem('marbleos_studio_local_prototype_v3')).toContain('Eski');
});

test('rejects unknown classes and duplicate student numbers atomically', async () => {
  const { db, classArgs } = await openWithSchool();
  expect(() => db.studioDbActions.addStudentsBatch('missing', [row])).toThrow();
  const id = db.studioDbActions.addClass(...classArgs);
  expect(() => db.studioDbActions.addStudentsBatch(id, [row, row])).toThrow('yinelenen');
  expect(db.getStudioDatabaseSnapshot().students).toHaveLength(0);
});

test('skips existing student numbers when an updated Excel list adds new students, and blocks identical re-upload', async () => {
  const { db, classArgs } = await openWithSchool();
  const classId = db.studioDbActions.addClass(...classArgs);
  const firstBatch = [
    { studentNumber: '101', firstName: 'Ali', lastName: 'Yılmaz' },
    { studentNumber: '102', firstName: 'Ayşe', lastName: 'Kaya' },
  ];
  expect(db.studioDbActions.addStudentsBatch(classId, firstBatch)).toBe(2);
  expect(() => db.studioDbActions.addStudentsBatch(classId, firstBatch)).toThrow('yinelenen');

  const updatedExcelBatch = [
    ...firstBatch,
    { studentNumber: '103', firstName: 'Mehmet', lastName: 'Demir' },
  ];
  expect(db.studioDbActions.addStudentsBatch(classId, updatedExcelBatch)).toBe(1);
  expect(db.getStudioDatabaseSnapshot().students.map((s) => s.studentNumber)).toEqual(['101', '102', '103']);
});

test('normalizes class and term before checking duplicate classes', async () => {
  const { db, schoolId } = await openWithSchool();
  db.studioDbActions.addClass(' 1-a ', '', schoolId, ' 2026-2027 ');
  expect(() => db.studioDbActions.addClass('1-A', '', schoolId, '2026-2027')).toThrow('zaten var');
  expect(db.getStudioDatabaseSnapshot().classes).toHaveLength(1);
});

test('a class cannot be created for a school that does not exist', async () => {
  const db = await import('./studioDatabase');
  expect(() => db.studioDbActions.addClass('1-A', '', 'missing-school', '2026-2027')).toThrow('Okul bulunamadı');
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

test('requires a separate approval after saving changed photo adjustments', async () => {
  const { db, classArgs } = await openWithSchool();
  const classId = db.studioDbActions.addClass(...classArgs);
  db.studioDbActions.addStudentsBatch(classId, [row]);
  db.studioDbActions.uploadPhotos([{ fileName: '001.png', dataUrl: 'data:image/png;base64,YQ==' }]);
  const { photos: [photo], students: [student] } = db.getStudioDatabaseSnapshot();
  db.studioDbActions.assignPhotoToStudent(photo.id, student.id);
  expect(() => db.studioDbActions.updatePhotoStudioSettings(photo.id, {
    ...photo.adjustments, zoom: 1.2,
  }, true)).toThrow('ardından baskı onayı');
  expect(db.getStudioDatabaseSnapshot().photos[0].adjustments.zoom).toBe(photo.adjustments.zoom);
});

test('never acknowledges cloud synchronization without a server', async () => {
  const { db, classArgs } = await openWithSchool();
  db.studioDbActions.addClass(...classArgs);
  expect(() => db.studioDbActions.markAllQueueSynced()).toThrow('Sunucu onayı');
  expect(db.getStudioDatabaseSnapshot().syncQueue.every((item) => item.status === 'PENDING')).toBe(true);
  expect(db.getStudioDatabaseSnapshot().lastSyncedAt).toBeNull();
});

test('keeps more than 100 unsent operations instead of silently dropping old rows', async () => {
  const { db, schoolId } = await openWithSchool();
  for (let index = 0; index < 105; index++) {
    db.studioDbActions.addClass(`A-${index}`, '', schoolId, '2026');
  }
  expect(db.getStudioDatabaseSnapshot().syncQueue).toHaveLength(106);
  expect(new Set(db.getStudioDatabaseSnapshot().classes.map((item) => item.id)).size).toBe(105);
});

test('heals legacy v4 extra keys and duplicate teacher numbers on startup', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schools: [{ id: 'sch-1', code: '00001', institutionCode: '', name: 'okull', address: '', notes: '', makeBiometric: false, makeVesikalik: true, createdAt: '2026-11-06', updatedAt: '2026-11-06', extraField: true }],
    activeSchoolId: 'sch-1',
    classes: [{ id: 'cls-1', code: '00001', schoolId: 'sch-1', academicYear: '2026-2027', name: '4-A', teacherName: 'MEHMET', createdAt: '2026-11-06' }],
    students: [
      { id: 'stu-1', classId: 'cls-1', studentNumber: '0', firstName: 'ALİ', lastName: 'MEHMET', matchedPhotoId: 'missing-photo', printReady: true, updatedAt: '2026-11-06', extraProp: 1 },
      { id: 'stu-2', classId: 'cls-1', studentNumber: '0', firstName: 'AYŞE', lastName: 'YILMAZ', matchedPhotoId: null, printReady: false, updatedAt: '2026-11-06' },
    ],
    photos: [],
    albumConfig: { selectedClassId: 'cls-1', layoutKind: 'class-chart', headerTitle: '', accentColor: '#3b82f6', columns: 4, showStudentNumbers: true, showTeacherBadge: true },
    syncQueue: [],
    lastSyncedAt: null,
  }));
  const db = await import('./studioDatabase');
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(1);
  expect(db.getStudioDatabaseSnapshot().classes).toHaveLength(1);
  expect(db.getStudioDatabaseSnapshot().students).toHaveLength(2);
  expect(() => db.studioDbActions.addClass('5-A', '', 'sch-1', '2026-2027')).not.toThrow();
});

test('duplicates classes sequentially without 20-char infinite loop freeze and heals chained -2-2 names', async () => {
  const { db, schoolId, classArgs } = await openWithSchool();
  let currentId: string = db.studioDbActions.addClass(...classArgs);
  for (let index = 0; index < 12; index++) {
    currentId = db.studioDbActions.duplicateClass(currentId);
  }
  const names = db.getStudioDatabaseSnapshot().classes.map((c) => c.name);
  expect(names).toEqual([
    '1-A', '1-A-2', '1-A-3', '1-A-4', '1-A-5', '1-A-6', '1-A-7',
    '1-A-8', '1-A-9', '1-A-10', '1-A-11', '1-A-12', '1-A-13',
  ]);

  const { healPrototypeSnapshotObject } = await import('./healPrototypeSnapshot');
  const healed = healPrototypeSnapshotObject({
    ...db.getStudioDatabaseSnapshot(),
    classes: [
      { id: 'c0', code: '00000', schoolId, academicYear: '2026-2027', name: '1-A', teacherName: '', createdAt: '2026' },
      { id: 'c1', code: '00001', schoolId, academicYear: '2026-2027', name: '1-A-2-2-2-2-2-2-2-2-', teacherName: '', createdAt: '2026' },
      { id: 'c2', code: '00002', schoolId, academicYear: '2026-2027', name: '1-A-2-2-2', teacherName: '', createdAt: '2026' },
    ],
  }) as { classes: Array<{ name: string }> };
  expect(healed.classes.map((c) => c.name)).toEqual(['1-A', '1-A-2', '1-A-3']);
});
