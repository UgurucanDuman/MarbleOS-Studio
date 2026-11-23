import type { PhotoMatchMode } from '../schemas/studioSchemas';
import { comparePhotoNames } from '../storage/photoImport';
import { createPhotoNameMatcher } from './photoNameMatcher';
import type { StudioDatabaseSnapshot } from './types';

export function assignPrototypePhoto(
  state: StudioDatabaseSnapshot,
  photoId: string,
  studentId: string | null,
): StudioDatabaseSnapshot {
  const current = state.photos.find((photo) => photo.id === photoId);
  if (!current) throw new Error('Fotoğraf bulunamadı.');
  const student = state.students.find((item) => item.id === studentId);
  if (studentId && !student) throw new Error('Öğrenci bulunamadı.');
  const scope = current.classId ?? state.students.find((item) => item.id === current.studentId)?.classId;
  if (scope && student && scope !== student.classId) {
    throw new Error('Fotoğraf yalnızca kendi sınıfındaki bir kişiye bağlanabilir.');
  }
  if (current.studentId === studentId) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    photos: state.photos.map((photo) => {
      if (photo.id === photoId) return { ...photo, studentId, classId: scope ?? student?.classId, approvedForPrint: false };
      if (studentId && photo.studentId === studentId) {
        return { ...photo, studentId: null, classId: student?.classId, approvedForPrint: false };
      }
      return photo;
    }),
    students: state.students.map((student) => {
      if (student.id === studentId) {
        return { ...student, matchedPhotoId: photoId, printReady: false, updatedAt: now };
      }
      if (student.matchedPhotoId === photoId) {
        return { ...student, matchedPhotoId: null, printReady: false, updatedAt: now };
      }
      return student;
    }),
  };
}

/**
 * Sınıftaki seçili öğrencinin fotoğrafını kaydırır:
 * - 'up' / 'down': üstteki veya alttaki öğrenciyle yer değiştirir
 * - 'insert-gap-down': seçili öğrencinin fotoğrafını boş bırakıp altındakileri 1 satır aşağı kaydırır
 * - 'delete-shift-up': seçili öğrencinin fotoğrafını silip altındakileri 1 satır yukarı kaydırır
 */
export function shiftStudentPhotoInClass(
  state: StudioDatabaseSnapshot,
  studentId: string,
  direction: 'up' | 'down' | 'insert-gap-down' | 'delete-shift-up',
): StudioDatabaseSnapshot {
  const target = state.students.find((s) => s.id === studentId);
  if (!target) throw new Error('Öğrenci bulunamadı.');
  const classStudents = state.students.filter((s) => s.classId === target.classId);
  const idx = classStudents.findIndex((s) => s.id === studentId);
  if (idx < 0) return state;

  const nextPhotos = classStudents.map((s) => s.matchedPhotoId);
  if (direction === 'up' || direction === 'down') {
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= classStudents.length) return state;
    [nextPhotos[idx], nextPhotos[swapIdx]] = [nextPhotos[swapIdx], nextPhotos[idx]];
  } else if (direction === 'insert-gap-down') {
    for (let k = nextPhotos.length - 1; k > idx; k--) nextPhotos[k] = nextPhotos[k - 1];
    nextPhotos[idx] = null;
  } else {
    for (let k = idx; k < nextPhotos.length - 1; k++) nextPhotos[k] = nextPhotos[k + 1];
    nextPhotos[nextPhotos.length - 1] = null;
  }

  const now = new Date().toISOString();
  const studentToPhoto = new Map<string, string | null>();
  const photoToStudent = new Map<string, string>();
  const classStudentIds = new Set(classStudents.map((s) => s.id));
  classStudents.forEach((stu, i) => {
    const pid = nextPhotos[i] ?? null;
    studentToPhoto.set(stu.id, pid);
    if (pid) photoToStudent.set(pid, stu.id);
  });

  return {
    ...state,
    students: state.students.map((s) =>
      studentToPhoto.has(s.id) && studentToPhoto.get(s.id) !== s.matchedPhotoId
        ? { ...s, matchedPhotoId: studentToPhoto.get(s.id) ?? null, printReady: false, updatedAt: now }
        : s,
    ),
    photos: state.photos.map((p) => {
      const destination = photoToStudent.get(p.id) ??
        (p.studentId && classStudentIds.has(p.studentId) ? null : p.studentId);
      return destination === p.studentId ? p : { ...p, studentId: destination, classId: target.classId, approvedForPrint: false };
    }),
  };
}

export function addPrototypePhotos(
  state: StudioDatabaseSnapshot,
  files: Array<{ fileName: string; dataUrl: string; contentHash?: string }>,
  classId?: string,
  options?: { matchMode?: PhotoMatchMode; targetStudentId?: string },
): StudioDatabaseSnapshot {
  const targetClass = classId ? state.classes.find((item) => item.id === classId) : undefined;
  if (classId && !targetClass) {
    throw new Error('Sınıf bulunamadı.');
  }
  const classStudents = state.students.filter((student) => student.classId === classId);
  const target = options?.targetStudentId;
  if (target && (files.length !== 1 || !classStudents.some((student) => student.id === target))) {
    throw new Error('Tek bir fotoğraf ve bu sınıftan bir öğrenci seçin.');
  }

  const mode = options?.matchMode ?? 'smart';
  const classStudentIds = new Set(classStudents.map((student) => student.id));
  const scopedPhotos = state.photos.filter((p) =>
    classId ? p.classId === classId || (p.studentId && classStudentIds.has(p.studentId)) : !p.classId && !p.studentId,
  );
  const existingNames = new Map(scopedPhotos.map((p) => [p.fileName.trim().toLocaleLowerCase('tr-TR'), p.contentHash]));
  const existingHashes = new Set(scopedPhotos.flatMap((p) => p.contentHash ? [p.contentHash] : []));
  if (target && files[0].contentHash) {
    const existing = scopedPhotos.find((photo) => photo.contentHash === files[0].contentHash);
    if (existing) {
      if (existing.studentId && existing.studentId !== target) throw new Error('Bu fotoğraf başka bir kişiye bağlı. Eşleştirmeyi kontrol edin.');
      return assignPrototypePhoto(state, existing.id, target);
    }
  }
  const namedFiles = files
    .map((file) => ({
      ...file, fileName: file.fileName.split(/[\\/]/).pop() || file.fileName,
    }))
    .filter((file) => {
      if (target) return true;
      const name = file.fileName.trim().toLocaleLowerCase('tr-TR');
      if (existingNames.has(name)) {
        const oldHash = existingNames.get(name);
        if (oldHash && file.contentHash && oldHash !== file.contentHash) {
          throw new Error(`${file.fileName} farklı içerikle zaten kayıtlı. Resim Ekle / Değiştir seçeneğini kullanın.`);
        }
        return false;
      }
      if (file.contentHash) {
        if (existingHashes.has(file.contentHash)) return false;
        existingNames.set(name, file.contentHash);
        existingHashes.add(file.contentHash);
      }
      return true;
    });
  if (namedFiles.length === 0) return state;
  if (mode === 'sequence') {
    namedFiles.sort((a, b) => comparePhotoNames(a.fileName, b.fileName));
  }
  const emptyRows = classStudents.filter((student) => !student.matchedPhotoId);
  const matchName = createPhotoNameMatcher(classStudents, targetClass?.name);
  const assigned = new Map<string, string>();
  const now = new Date().toISOString();
  const added = namedFiles.map((file, index) => {
    const stem = file.fileName.replace(/\.[^.]+$/, '').trim();
    const matched = mode === 'sequence' ? emptyRows[index] : matchName(stem, mode);
    const id = crypto.randomUUID();
    const studentId = target ?? (matched && !matched.matchedPhotoId && !assigned.has(matched.id) ? matched.id : null);
    if (studentId) assigned.set(studentId, id);
    return {
      ...file, id, studentId, classId, approvedForPrint: false, createdAt: now,
      adjustments: { zoom: 1, brightness: 100, contrast: 100, warmth: 0 },
    };
  });

  return {
    ...state,
    photos: [
      ...state.photos.map((photo) => target && photo.studentId === target
        ? { ...photo, studentId: null, classId, approvedForPrint: false } : photo),
      ...added,
    ],
    students: state.students.map((student) => {
      const photoId = assigned.get(student.id);
      return photoId ? { ...student, matchedPhotoId: photoId, printReady: false, updatedAt: now } : student;
    }),
  };
}

