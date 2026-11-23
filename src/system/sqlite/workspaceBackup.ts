import { z } from 'zod';
import { SCHOOL_BACKUP_LIMITS, SCHOOL_LIMITS, schoolNameKey } from '../schemas/schoolSchemas';
import {
  backupAlbumConfigSchema,
  backupClassRecordSchema,
  backupPhotoRecordSchema,
  backupSchoolRecordSchema,
  backupStudentRecordSchema,
  hydrateBackupPhotosInBatches,
  hydrateSchoolRecordVisuals,
} from './backupShared';
import { validatePrototypeSnapshot } from './prototypePersistence';
import { computeBackupChecksum } from './schoolBackup';
import { appendSyncLog } from './syncLog';
import type {
  ClassRecord, PhotoRecord, SchoolRecord, StudentRecord, StudioDatabaseSnapshot,
} from './types';

const workspacePayloadSchema = z.object({
  schools: z.array(backupSchoolRecordSchema).min(1).max(SCHOOL_LIMITS.maxSchools),
  activeSchoolId: z.string().min(1).max(64).nullable(),
  classes: z.array(backupClassRecordSchema).max(2000),
  students: z.array(backupStudentRecordSchema).max(20_000),
  photos: z.array(backupPhotoRecordSchema).max(SCHOOL_BACKUP_LIMITS.maxPhotos),
  albumConfig: backupAlbumConfigSchema,
}).strict();

const workspaceEnvelopeSchema = z.object({
  format: z.literal('marbleos-workspace-backup-v1'),
  exportedAt: z.string().min(1).max(50),
  checksum: z.string().regex(/^[0-9a-f]{8}$/),
  payload: workspacePayloadSchema,
}).strict();

export async function prepareWorkspaceBackupPackage(
  state: StudioDatabaseSnapshot,
  readOriginal: (id: string, expectedHash?: string) => Promise<string>,
): Promise<{ fileName: string; json: string }> {
  if (state.schools.length === 0) {
    throw new Error('Çalışma alanı yedeği için en az 1 kayıtlı okul bulunmalıdır.');
  }
  if (state.photos.length > SCHOOL_BACKUP_LIMITS.maxPhotos) {
    throw new Error(
      `Tek paket kasa yedeği en fazla ${SCHOOL_BACKUP_LIMITS.maxPhotos} fotoğraf içerebilir; büyük koleksiyonlarda okulları tek tek yedekleyin.`,
    );
  }
  const hydratedSchools = await Promise.all(
    state.schools.map((s) => hydrateSchoolRecordVisuals(s, readOriginal)),
  );
  const hydratedPhotos = await hydrateBackupPhotosInBatches(
    state.photos,
    readOriginal,
    SCHOOL_BACKUP_LIMITS.maxPhotoBytes,
    'Kasa yedeği 64 MB fotoğraf sınırını aşıyor; okulları tek tek yedekleyin.',
  );

  const payload = workspacePayloadSchema.parse({
    schools: hydratedSchools,
    activeSchoolId: state.activeSchoolId,
    classes: state.classes,
    students: state.students,
    photos: hydratedPhotos,
    albumConfig: state.albumConfig,
  });
  validatePrototypeSnapshot({ ...payload, syncQueue: [], lastSyncedAt: null });

  const checksum = computeBackupChecksum(JSON.stringify(payload));
  const today = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify({
    format: 'marbleos-workspace-backup-v1',
    exportedAt: new Date().toISOString(),
    checksum,
    payload,
  }, null, 2);
  if (new Blob([json]).size > SCHOOL_BACKUP_LIMITS.maxJsonBytes) {
    throw new Error('Çalışma alanı yedeği boyut sınırını aşıyor.');
  }
  return { fileName: `marbleos_veri_kasasi_${today}.marbleos-kasa`, json };
}

export function restoreWorkspaceFromBackupJson(
  state: StudioDatabaseSnapshot,
  rawJson: string,
  nextCodeFor: (schools: SchoolRecord[]) => string,
): StudioDatabaseSnapshot {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    throw new Error('Yedek dosyası geçerli bir JSON paketi değil.');
  }
  const checked = workspaceEnvelopeSchema.safeParse(parsedJson);
  if (!checked.success) {
    throw new Error('Çalışma alanı yedeği biçimi geçersiz veya desteklenmeyen sürüm.');
  }
  const { checksum, payload } = checked.data;
  if (computeBackupChecksum(JSON.stringify(payload)) !== checksum) {
    throw new Error('Yedek dosyası bozuk veya bütünlük doğrulaması başarısız.');
  }
  validatePrototypeSnapshot({ ...payload, syncQueue: [], lastSyncedAt: null });

  if (state.schools.length + payload.schools.length > SCHOOL_LIMITS.maxSchools) {
    throw new Error('Okul sayısı sınırına ulaşıldı.');
  }
  const existingNames = new Set(state.schools.map((s) => schoolNameKey(s.name)));
  const existingInst = new Set(state.schools.map((s) => s.institutionCode).filter(Boolean));
  for (const s of payload.schools) {
    const key = schoolNameKey(s.name);
    if (existingNames.has(key)) {
      throw new Error(`"${s.name}" adıyla kayıtlı bir okul zaten var.`);
    }
    existingNames.add(key);
    if (s.institutionCode) {
      if (existingInst.has(s.institutionCode)) {
        throw new Error('Yedekteki kurum kodu başka bir okulda kayıtlı.');
      }
      existingInst.add(s.institutionCode);
    }
  }

  const now = new Date().toISOString();
  const schoolIdMap = new Map<string, string>();
  const classIdMap = new Map<string, string>();
  const studentIdMap = new Map<string, string>();
  const photoIdMap = new Map<string, string>();
  const workingSchools = [...state.schools];
  const restoredSchools: SchoolRecord[] = [];

  for (const s of payload.schools) {
    const newId = crypto.randomUUID();
    schoolIdMap.set(s.id, newId);
    const rec: SchoolRecord = { ...s, id: newId, code: nextCodeFor(workingSchools), updatedAt: now };
    workingSchools.push(rec);
    restoredSchools.push(rec);
  }
  const restoredClasses: ClassRecord[] = payload.classes.map((cls) => {
    const newId = crypto.randomUUID();
    classIdMap.set(cls.id, newId);
    return { ...cls, id: newId, schoolId: schoolIdMap.get(cls.schoolId)! };
  });
  for (const p of payload.photos) photoIdMap.set(p.id, crypto.randomUUID());

  const restoredStudents: StudentRecord[] = payload.students.map((stu) => {
    const newStuId = crypto.randomUUID();
    studentIdMap.set(stu.id, newStuId);
    return {
      ...stu, id: newStuId, classId: classIdMap.get(stu.classId)!,
      matchedPhotoId: stu.matchedPhotoId ? (photoIdMap.get(stu.matchedPhotoId) ?? null) : null,
      printReady: false, updatedAt: now,
    };
  });
  const restoredPhotos: PhotoRecord[] = payload.photos.map((photo) => ({
    ...photo, id: photoIdMap.get(photo.id)!,
    classId: photo.classId ? classIdMap.get(photo.classId) : undefined,
    studentId: photo.studentId ? (studentIdMap.get(photo.studentId) ?? null) : null,
    approvedForPrint: false,
  }));

  const wasEmpty = state.schools.length === 0;
  const mappedActiveSchool = payload.activeSchoolId ? (schoolIdMap.get(payload.activeSchoolId) ?? null) : null;
  const mappedAlbumClass = payload.albumConfig.selectedClassId
    ? (classIdMap.get(payload.albumConfig.selectedClassId) ?? '')
    : '';

  return validatePrototypeSnapshot({
    ...state,
    schools: workingSchools,
    activeSchoolId: mappedActiveSchool ?? restoredSchools[0]?.id ?? state.activeSchoolId,
    classes: [...state.classes, ...restoredClasses],
    students: [...state.students, ...restoredStudents],
    photos: [...state.photos, ...restoredPhotos],
    albumConfig: wasEmpty
      ? { ...payload.albumConfig, selectedClassId: mappedAlbumClass }
      : state.albumConfig,
    syncQueue: appendSyncLog(
      'school',
      restoredSchools[0].id,
      'INSERT',
      `${restoredSchools.length} okul içeren veri kasası yedeği yüklendi`,
      state.syncQueue,
    ),
  });
}
