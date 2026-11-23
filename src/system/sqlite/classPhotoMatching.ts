import type { PhotoBatchMatchInput, PhotoBatchMatchMode } from '../schemas/photoManagementSchemas';
import { comparePhotoNames } from '../storage/photoImport';
import { createPhotoNameMatcher } from './photoNameMatcher';
import type { PhotoRecord, StudentRecord, StudioDatabaseSnapshot } from './types';

export function photoClassId(photo: PhotoRecord, students: ReadonlyMap<string, StudentRecord>) {
  return photo.classId ?? (photo.studentId ? students.get(photo.studentId)?.classId : undefined);
}

type Pair = PhotoBatchMatchInput['pairs'][number];
const stem = (photo: PhotoRecord) => photo.fileName.replace(/\.[^.]+$/, '').trim();

function planBySequence(photos: PhotoRecord[], students: StudentRecord[]): { pairs: Pair[]; blocked?: string } {
  if (photos.length !== students.length) {
    return { pairs: [], blocked: `Çekim sırası için adetler aynı olmalı. Sınıfta ${students.length} kişi, arşivde ${photos.length} fotoğraf var.` };
  }
  const ordered = [...photos].sort((a, b) => comparePhotoNames(a.fileName, b.fileName));
  const numbers = new Set<string>();
  let prefix: string | undefined;
  for (const photo of ordered) {
    const numberedName = stem(photo).match(/^(.*?)(\d+)$/);
    if (!numberedName) return { pairs: [], blocked: 'Çekim sırası için fotoğraf adları sayıyla bitmeli.' };
    const currentPrefix = numberedName[1].toLowerCase();
    const number = numberedName[2].replace(/^0+(?=\d)/, '');
    prefix ??= currentPrefix;
    if (currentPrefix !== prefix || numbers.has(number)) {
      return { pairs: [], blocked: 'Fotoğraflar tek bir numaralı çekim dizisi oluşturmalı. Tekrarları ve farklı çekim dizilerini kontrol edin.' };
    }
    numbers.add(number);
  }

  const pairs: Pair[] = [];
  const matchName = createPhotoNameMatcher(students);
  for (const [index, photo] of ordered.entries()) {
    const student = students[index];
    const direct = matchName(stem(photo));
    if ((photo.studentId && photo.studentId !== student.id) ||
      (student.matchedPhotoId && student.matchedPhotoId !== photo.id) ||
      (direct && direct.id !== student.id)) {
      return { pairs: [], blocked: 'Çekim sırası mevcut bağlantıyla veya dosya adındaki öğrenci bilgisiyle çelişiyor. Sınıf sırasını ve bağlı kareleri kontrol edin.' };
    }
    if (!photo.studentId && !student.matchedPhotoId) pairs.push({ photoId: photo.id, studentId: student.id });
  }
  return { pairs };
}

function planByFileName(photos: PhotoRecord[], students: StudentRecord[]): Pair[] {
  const matches = new Map<string, string[]>();
  const matchName = createPhotoNameMatcher(students);
  for (const photo of photos) {
    if (photo.studentId) continue;
    const match = matchName(stem(photo));
    if (!match || match.matchedPhotoId) continue;
    const candidates = matches.get(match.id) ?? [];
    candidates.push(photo.id);
    matches.set(match.id, candidates);
  }
  return [...matches].flatMap(([studentId, candidates]) =>
    candidates.length === 1 ? [{ studentId, photoId: candidates[0] }] : [],
  );
}

export function planClassPhotoMatches(db: StudioDatabaseSnapshot, classId: string, mode: PhotoBatchMatchMode) {
  const students = db.students.filter((student) => student.classId === classId);
  const byId = new Map(students.map((student) => [student.id, student]));
  const photos = db.photos.filter((photo) => photoClassId(photo, byId) === classId);
  if (!students.length || !photos.length) {
    return { pairs: [], blocked: 'Önce seçili sınıfa öğrenci listesi ve fotoğraf aktarın.' };
  }
  if (mode === 'sequence') return planBySequence(photos, students);
  return { pairs: planByFileName(photos, students) };
}
