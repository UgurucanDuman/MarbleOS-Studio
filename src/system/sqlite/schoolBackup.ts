import { z } from 'zod';
import { SCHOOL_BACKUP_LIMITS, SCHOOL_LIMITS, schoolNameKey } from '../schemas/schoolSchemas';
import {
  backupClassRecordSchema,
  backupPhotoRecordSchema,
  backupSchoolRecordSchema,
  backupStudentRecordSchema,
  hydrateBackupPhotosInBatches,
  hydrateSchoolRecordVisuals,
} from './backupShared';
import { validatePrototypeSnapshot } from './prototypePersistence';
import { appendSyncLog } from './syncLog';
import type {
  ClassRecord, PhotoRecord, SchoolRecord, StudentRecord, StudioDatabaseSnapshot,
} from './types';

const backupPayloadSchema = z.object({
  school: backupSchoolRecordSchema,
  classes: z.array(backupClassRecordSchema).max(500),
  students: z.array(backupStudentRecordSchema).max(10_000),
  photos: z.array(backupPhotoRecordSchema).max(SCHOOL_BACKUP_LIMITS.maxPhotos),
}).strict();

const backupEnvelopeSchema = z.object({
  format: z.literal('marbleos-school-backup-v1'),
  exportedAt: z.string().min(1).max(50),
  checksum: z.string().regex(/^[0-9a-f]{8}$/),
  payload: backupPayloadSchema,
}).strict();

/** Deterministik FNV-1a 32-bit özet (tarayıcı ve test ortamında senkron çalışır). */
export function computeBackupChecksum(payloadJson: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payloadJson.length; i++) {
    hash ^= payloadJson.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function schoolBackupScope(state: StudioDatabaseSnapshot, schoolId: string) {
  const school = state.schools.find((item) => item.id === schoolId);
  if (!school) throw new Error('Yedeklenecek okul bulunamadı.');
  const classes = state.classes.filter((item) => item.schoolId === school.id);
  const classIds = new Set(classes.map((item) => item.id));
  const students = state.students.filter((item) => classIds.has(item.classId));
  const studentIds = new Set(students.map((item) => item.id));
  const photos = state.photos.filter((item) =>
    (item.classId && classIds.has(item.classId)) || (item.studentId && studentIds.has(item.studentId)),
  );
  return { school, classes, students, photos };
}

export async function prepareSchoolBackupPackage(
  state: StudioDatabaseSnapshot,
  schoolId: string,
  readOriginal: (id: string, expectedHash?: string) => Promise<string>,
) {
  const { school, photos } = schoolBackupScope(state, schoolId);
  if (photos.length > SCHOOL_BACKUP_LIMITS.maxPhotos) {
    throw new Error(`Okul yedeği en fazla ${SCHOOL_BACKUP_LIMITS.maxPhotos} fotoğraf içerebilir.`);
  }
  const hydratedSchool = await hydrateSchoolRecordVisuals(school, readOriginal);
  const hydratedPhotos = await hydrateBackupPhotosInBatches(
    photos,
    readOriginal,
    SCHOOL_BACKUP_LIMITS.maxPhotoBytes,
    'Okul yedeği 64 MB fotoğraf sınırını aşıyor.',
  );
  const originals = new Map(hydratedPhotos.map((p) => [p.id, p.dataUrl]));
  const result = buildSchoolBackupPackage({
    ...state,
    schools: state.schools.map((item) => (item.id === school.id ? hydratedSchool : item)),
    photos: state.photos.map((photo) => ({ ...photo, dataUrl: originals.get(photo.id) ?? photo.dataUrl })),
  }, schoolId);
  if (new Blob([result.json]).size > SCHOOL_BACKUP_LIMITS.maxJsonBytes) {
    throw new Error('Okul yedeği boyut sınırını aşıyor.');
  }
  return result;
}

export function buildSchoolBackupPackage(
  state: StudioDatabaseSnapshot,
  schoolId: string,
): { fileName: string; json: string } {
  const payload = backupPayloadSchema.parse(schoolBackupScope(state, schoolId));
  const { school } = payload;
  const checksum = computeBackupChecksum(JSON.stringify(payload));
  const safeSlug = school.name
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöç]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'okul';

  return {
    fileName: `${school.code}_${safeSlug}.marbleos-school.json`,
    json: JSON.stringify({
      format: 'marbleos-school-backup-v1', exportedAt: new Date().toISOString(), checksum, payload,
    }, null, 2),
  };
}

export function restoreSchoolFromBackupJson(
  state: StudioDatabaseSnapshot,
  rawJson: string,
  nextCode: string,
): StudioDatabaseSnapshot {
  if (state.schools.length >= SCHOOL_LIMITS.maxSchools) {
    throw new Error('Okul sayısı sınırına ulaşıldı.');
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    throw new Error('Yedek dosyası geçerli bir JSON paketi değil.');
  }
  const envelopeResult = backupEnvelopeSchema.safeParse(parsedJson);
  if (!envelopeResult.success) {
    throw new Error('Yedek dosyası biçimi geçersiz veya desteklenmeyen sürüm.');
  }
  const { checksum, payload } = envelopeResult.data;
  if (computeBackupChecksum(JSON.stringify(payload)) !== checksum) {
    throw new Error('Yedek dosyası bozuk veya bütünlük doğrulaması başarısız.');
  }

  const nameKey = schoolNameKey(payload.school.name);
  if (state.schools.some((item) => schoolNameKey(item.name) === nameKey)) {
    throw new Error(`"${payload.school.name}" adıyla kayıtlı bir okul zaten var.`);
  }
  if (
    payload.school.institutionCode &&
    state.schools.some((item) => item.institutionCode === payload.school.institutionCode)
  ) {
    throw new Error('Yedekteki kurum kodu başka bir okulda kayıtlı.');
  }

  const now = new Date().toISOString();
  const newSchoolId = crypto.randomUUID();
  const classIdMap = new Map<string, string>();
  const studentIdMap = new Map<string, string>();
  const photoIdMap = new Map<string, string>();

  const restoredClasses: ClassRecord[] = payload.classes.map((cls) => {
    const newId = crypto.randomUUID();
    classIdMap.set(cls.id, newId);
    return { ...cls, id: newId, schoolId: newSchoolId };
  });

  for (const photo of payload.photos) {
    photoIdMap.set(photo.id, crypto.randomUUID());
  }

  const restoredStudents: StudentRecord[] = payload.students.map((stu) => {
    const mappedClassId = classIdMap.get(stu.classId);
    if (!mappedClassId) throw new Error('Yedekteki öğrencinin sınıf bağlantısı bozuk.');
    const newStuId = crypto.randomUUID();
    studentIdMap.set(stu.id, newStuId);
    const mappedPhotoId = stu.matchedPhotoId ? (photoIdMap.get(stu.matchedPhotoId) ?? null) : null;
    return {
      ...stu, id: newStuId, classId: mappedClassId,
      matchedPhotoId: mappedPhotoId, printReady: false, updatedAt: now,
    };
  });

  const restoredPhotos: PhotoRecord[] = payload.photos.map((photo) => {
    const newPhotoId = photoIdMap.get(photo.id)!;
    const mappedStuId = photo.studentId ? (studentIdMap.get(photo.studentId) ?? null) : null;
    const classId = photo.classId ? classIdMap.get(photo.classId) : undefined;
    if (photo.classId && !classId) throw new Error('Yedekteki fotoğrafın sınıf bağlantısı bozuk.');
    return { ...photo, id: newPhotoId, classId, studentId: mappedStuId, approvedForPrint: false };
  });

  const restoredSchool: SchoolRecord = {
    ...payload.school, id: newSchoolId, code: nextCode, updatedAt: now,
  };

  return validatePrototypeSnapshot({
    ...state,
    schools: [...state.schools, restoredSchool],
    activeSchoolId: newSchoolId,
    classes: [...state.classes, ...restoredClasses],
    students: [...state.students, ...restoredStudents],
    photos: [...state.photos, ...restoredPhotos],
    syncQueue: appendSyncLog('school', newSchoolId, 'INSERT',
      `${restoredSchool.name} okulu yedekten yüklendi`, state.syncQueue),
  });
}
