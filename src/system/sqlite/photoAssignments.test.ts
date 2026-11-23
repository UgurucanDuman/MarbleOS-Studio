import { expect, test } from 'vitest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';
import { addPrototypePhotos, assignPrototypePhoto, shiftStudentPhotoInClass } from './photoAssignments';
import { validatePrototypeSnapshot } from './prototypePersistence';

test('reassignment detaches both former links and resets print approvals', () => {
  const value = assignPrototypePhoto(INITIAL_STUDIO_SEED, 'ph-104', 'stu-108');
  expect(value.photos.find((item) => item.id === 'ph-108')?.studentId).toBeNull();
  expect(value.students.find((item) => item.id === 'stu-104')?.matchedPhotoId).toBeNull();
  expect(value.students.find((item) => item.id === 'stu-108')).toMatchObject({ matchedPhotoId: 'ph-104', printReady: false });
  expect(value.photos.find((item) => item.id === 'ph-104')?.approvedForPrint).toBe(false);
  expect(() => validatePrototypeSnapshot(value)).not.toThrow();
});

test('rejects unknown photo or student without modifying the input', () => {
  expect(() => assignPrototypePhoto(INITIAL_STUDIO_SEED, 'missing', 'stu-104')).toThrow();
  expect(() => assignPrototypePhoto(INITIAL_STUDIO_SEED, 'ph-104', 'missing')).toThrow();
  expect(INITIAL_STUDIO_SEED.students[0].matchedPhotoId).toBe('ph-104');
});

test('requires explicit class; does not infer a person from arbitrary filename digits', () => {
  const photo = { fileName: '119_person.jpg', dataUrl: 'data:image/jpeg;base64,YQ==' };
  expect(addPrototypePhotos(INITIAL_STUDIO_SEED, [photo]).photos.slice(-1)[0]?.studentId).toBeNull();
  expect(addPrototypePhotos(INITIAL_STUDIO_SEED, [{ ...photo, fileName: 'IMG_119_person.jpg' }], 'cls-9a').photos.slice(-1)[0]?.studentId).toBeNull();
});

test('exact class match never auto-approves and never overwrites an existing assignment', () => {
  const photo = { fileName: '119_person.jpg', dataUrl: 'data:image/jpeg;base64,YQ==' };
  const value = addPrototypePhotos(INITIAL_STUDIO_SEED, [photo, photo], 'cls-9a');
  expect(value.photos.slice(-2).map((item) => item.studentId)).toEqual(['stu-119', null]);
  expect(value.photos.slice(-2).every((item) => !item.approvedForPrint)).toBe(true);
  expect(() => validatePrototypeSnapshot(value)).not.toThrow();
});

test('matches folder photos smartly by Turkish-folded student full name when number is absent', () => {
  const unbound = INITIAL_STUDIO_SEED.students.find((s) => s.id === 'stu-119')!;
  const namedPhoto = {
    fileName: `9A-Klasor/${unbound.firstName} ${unbound.lastName}.jpg`,
    dataUrl: 'data:image/jpeg;base64,YQ==',
  };
  const value = addPrototypePhotos(INITIAL_STUDIO_SEED, [namedPhoto], 'cls-9a');
  const addedPhoto = value.photos.slice(-1)[0];
  expect(addedPhoto?.fileName).toBe(`${unbound.firstName} ${unbound.lastName}.jpg`);
  expect(addedPhoto?.studentId).toBe('stu-119');
});

test('sequence is explicit and supports gap/delete shifts', () => {
  const cleared = {
    ...INITIAL_STUDIO_SEED,
    students: INITIAL_STUDIO_SEED.students.map((s) => ({ ...s, matchedPhotoId: null, printReady: false })),
    photos: [],
  };
  const files = [
    { fileName: '81.jpg', dataUrl: 'data:image/jpeg;base64,YQ==' },
    { fileName: '80.jpg', dataUrl: 'data:image/jpeg;base64,Yg==' },
  ];
  const smart = addPrototypePhotos(cleared, files, 'cls-9a', { matchMode: 'smart' });
  expect(smart.photos.map((item) => item.studentId)).toEqual([null, null]);
  const matched = addPrototypePhotos(cleared, files, 'cls-9a', { matchMode: 'sequence' });
  const clsStudents = matched.students.filter((s) => s.classId === 'cls-9a');
  const firstPhoto = matched.photos.find((p) => p.id === clsStudents[0].matchedPhotoId);
  const secondPhoto = matched.photos.find((p) => p.id === clsStudents[1].matchedPhotoId);
  expect(firstPhoto?.fileName).toBe('80.jpg');
  expect(secondPhoto?.fileName).toBe('81.jpg');

  // İlk öğrenci gelmediyse "Yeni Boş Satır Bırak" (insert-gap-down) fotoğrafları 1 satır aşağı kaydırır
  const shiftedDown = shiftStudentPhotoInClass(matched, clsStudents[0].id, 'insert-gap-down');
  const afterDown = shiftedDown.students.filter((s) => s.classId === 'cls-9a');
  expect(afterDown[0].matchedPhotoId).toBeNull();
  expect(shiftedDown.photos.find((p) => p.id === afterDown[1].matchedPhotoId)?.fileName).toBe('80.jpg');
  expect(() => validatePrototypeSnapshot(shiftedDown)).not.toThrow();

  // "Resim Satırını Sil" (delete-shift-up) tekrar yukarı çeker
  const shiftedUp = shiftStudentPhotoInClass(shiftedDown, clsStudents[0].id, 'delete-shift-up');
  const afterUp = shiftedUp.students.filter((s) => s.classId === 'cls-9a');
  expect(shiftedUp.photos.find((p) => p.id === afterUp[0].matchedPhotoId)?.fileName).toBe('80.jpg');
  expect(() => validatePrototypeSnapshot(shiftedUp)).not.toThrow();
});

test('sequence uses empty rows only, and unmatched photos retain their class', () => {
  const files = ['10.jpg', '2.jpg'].map((fileName) => ({ fileName, dataUrl: 'data:image/jpeg;base64,YQ==' }));
  const result = addPrototypePhotos(INITIAL_STUDIO_SEED, files, 'cls-9a', { matchMode: 'sequence' });
  expect(result.photos.slice(-2)).toMatchObject([
    { fileName: '2.jpg', studentId: 'stu-119', classId: 'cls-9a' },
    { fileName: '10.jpg', studentId: null, classId: 'cls-9a' },
  ]);
  expect(result.photos.find((photo) => photo.id === 'ph-104')).toEqual(INITIAL_STUDIO_SEED.photos[0]);
  expect(() => addPrototypePhotos(INITIAL_STUDIO_SEED, files.slice(0, 1), 'cls-9b', {
    targetStudentId: 'stu-119',
  })).toThrow();
});

test('skips already-uploaded class photos on folder re-import and matches class-prefixed filenames like 9A_119.jpg', () => {
  const withPrefixed = addPrototypePhotos(
    INITIAL_STUDIO_SEED,
    [
      { fileName: '104_Elif_Aksoy.jpg', dataUrl: 'data:image/jpeg;base64,YQ==' },
      { fileName: '9A_119.jpg', dataUrl: 'data:image/jpeg;base64,Yg==' },
    ],
    'cls-9a',
  );
  // 104_Elif_Aksoy.jpg was already in cls-9a, so only 9A_119.jpg is added and matched to stu-119
  expect(withPrefixed.photos).toHaveLength(INITIAL_STUDIO_SEED.photos.length + 1);
  expect(withPrefixed.photos.slice(-1)[0]).toMatchObject({
    fileName: '9A_119.jpg',
    studentId: 'stu-119',
    classId: 'cls-9a',
  });
});
