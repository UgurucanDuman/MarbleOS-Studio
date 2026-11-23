import { z } from 'zod';
import { createEmptyStudioSnapshot } from './emptySnapshot';
import { healPrototypeSnapshotObject } from './healPrototypeSnapshot';
import { pvcAlbumConfigFieldsShape } from '../schemas/pvcCardSchemas';
import { photoAdjustmentsSchema, studentIdCardSchema } from '../schemas/studioSchemas';
import { SCHOOL_LIMITS, schoolInputSchema } from '../schemas/schoolSchemas';
import { PRINT_FONT_POINTS } from '../storage/printTypography';
import { isValidTeacherChartTemplateId } from '../storage/teacher-charts/paginationMath';
import { TEACHER_CHART_INKS, TEACHER_CHART_PALETTES } from '../storage/teacher-charts/types';
import {
  KUTUK_NAME_BOX_STYLES,
  KUTUK_PHOTO_FRAMES,
  KUTUK_SCOPE_MODES,
  KUTUK_TEMPLATE_IDS,
} from '../storage/yearbook-kutuk/types';
import type { StudioDatabaseSnapshot } from './types';

// Compatibility key only. This adapter is localStorage, not SQLite.
// v4 okulları ayrı kayıt yaptı. Eski v3 anahtarı silinmez ve otomatik içeri alınmaz.
const STORAGE_KEY = 'marbleos_studio_local_prototype_v4';
const text = z.string();
const snapshotSchema = z.object({
  schools: z.array(schoolInputSchema.extend({
    id: text.min(1), code: text.regex(/^\d{5}$/), createdAt: text, updatedAt: text,
  }).strict()).max(SCHOOL_LIMITS.maxSchools),
  activeSchoolId: text.min(1).nullable(),
  classes: z.array(z.object({
    id: text.min(1), schoolId: text.min(1), academicYear: text, name: text,
    teacherName: text, deputyPrincipalName: text.optional(), createdAt: text,
  }).strict()).max(2000),
  students: z.array(z.object({
    id: text.min(1), classId: text.min(1), studentNumber: text.min(1),
    firstName: text.min(1), lastName: text.min(1),
    role: text.optional(), isPrincipal: z.boolean().optional(),
    showInAlbum: z.boolean().optional(), groupCode: text.optional(),
    idCard: studentIdCardSchema.optional(),
    matchedPhotoId: text.nullable(),
    printReady: z.boolean(), updatedAt: text,
  }).strict()).max(20000),
  photos: z.array(z.object({
    id: text.min(1), fileName: text, dataUrl: text, studentId: text.nullable(), classId: text.min(1).optional(),
    contentHash: text.regex(/^[a-f0-9]{64}$/).optional(),
    adjustments: photoAdjustmentsSchema, approvedForPrint: z.boolean(), createdAt: text,
  }).strict()).max(20000),
  albumConfig: z.object({
    selectedClassId: text, layoutKind: z.enum(['class-chart', 'yearbook-spread', 'id-card']),
    headerTitle: text, accentColor: text, columns: z.number().int().min(2).max(10),
    showStudentNumbers: z.boolean(), showTeacherBadge: z.boolean(),
    chartTemplateId: text.max(40).refine(isValidTeacherChartTemplateId).optional(),
    chartPaletteId: z.enum(TEACHER_CHART_PALETTES).optional(),
    chartInkId: z.enum(TEACHER_CHART_INKS).optional(),
    printFontPt: z.literal(PRINT_FONT_POINTS).optional(),
    courseName: text.max(60).optional(),
    coverTitle: text.max(80).optional(),
    coverSubtitle: text.max(80).optional(),
    customCoverDataUrl: text
      .max(4_500_000)
      .regex(/^(?:|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/)
      .optional(),
    customCoverMode: z.enum(['full-bleed', 'emblem']).optional(),
    kutukTemplateId: z.enum(KUTUK_TEMPLATE_IDS).optional(),
    kutukCols: z.number().int().min(3).max(10).optional(),
    kutukRows: z.number().int().min(3).max(7).optional(),
    kutukScopeMode: z.enum(KUTUK_SCOPE_MODES).optional(),
    kutukDeputyName: text.max(60).optional(),
    kutukIncludeCover: z.boolean().optional(),
    kutukShowHeader: z.boolean().optional(),
    kutukShowSubtitle: z.boolean().optional(),
    kutukShowStaffPortraits: z.boolean().optional(),
    kutukShowTeacherSig: z.boolean().optional(),
    kutukShowDeputySig: z.boolean().optional(),
    kutukShowPrincipalSig: z.boolean().optional(),
    kutukShowPageNumber: z.boolean().optional(),
    kutukNameBoxStyle: z.enum(KUTUK_NAME_BOX_STYLES).optional(),
    kutukPhotoFrame: z.enum(KUTUK_PHOTO_FRAMES).optional(),
    kutukFrameColor: text.regex(/^(?:|#[0-9a-fA-F]{6})$/).optional(),
    ...pvcAlbumConfigFieldsShape,
  }).strict(),
  syncQueue: z.array(z.object({
    id: text.min(1), entityType: z.enum(['school', 'class', 'student', 'photo', 'album']),
    entityId: text, operation: z.enum(['INSERT', 'UPDATE', 'DELETE']), summary: text,
    status: z.enum(['PENDING', 'SYNCED']), createdAt: text,
  }).strict()).max(10000),
  lastSyncedAt: text.nullable(),
}).strict();

export function validatePrototypeSnapshot(raw: unknown): StudioDatabaseSnapshot {
  const value = snapshotSchema.parse(raw);
  const schools = new Set(value.schools.map((item) => item.id));
  const schoolCodes = new Set(value.schools.map((item) => item.code));
  const institutionCodes = value.schools.map((item) => item.institutionCode).filter(Boolean);
  // Ad tekrarı iş kuralı olarak action katmanında; burada kimlik ve kod bütünlüğü (Rust ile aynı).
  if (schools.size !== value.schools.length || schoolCodes.size !== value.schools.length ||
      new Set(institutionCodes).size !== institutionCodes.length) {
    throw new Error('Yinelenen okul kimliği, kodu veya kurum kodu.');
  }
  if (value.activeSchoolId && !schools.has(value.activeSchoolId)) throw new Error('Seçili okul bulunamadı.');
  if (value.classes.some((item) => !schools.has(item.schoolId))) throw new Error('Sınıfın okulu bulunamadı.');
  const classKeys = new Set(value.classes.map((item) => JSON.stringify([item.schoolId, item.academicYear, item.name])));
  if (classKeys.size !== value.classes.length) throw new Error('Aynı okul ve dönemde yinelenen sınıf.');
  const classes = new Set(value.classes.map((item) => item.id));
  const students = new Map(value.students.map((item) => [item.id, item]));
  const photos = new Map(value.photos.map((item) => [item.id, item]));
  const numbers = new Set(value.students.map((item) => JSON.stringify([item.classId, item.studentNumber])));
  if (classes.size !== value.classes.length || students.size !== value.students.length ||
      photos.size !== value.photos.length || numbers.size !== value.students.length) {
    throw new Error('Yinelenen kayıt kimliği veya sınıf içi okul numarası.');
  }
  for (const student of value.students) {
    if (!classes.has(student.classId)) throw new Error('Öğrencinin sınıfı bulunamadı.');
    const photo = student.matchedPhotoId ? photos.get(student.matchedPhotoId) : null;
    if (student.matchedPhotoId && (!photo || photo.studentId !== student.id)) {
      throw new Error('Fotoğraf ve öğrenci bağlantısı tutarsız.');
    }
    if (student.printReady && (!photo || !photo.approvedForPrint)) {
      throw new Error('Fotoğraf onayı olmadan öğrenci onaylanamaz.');
    }
  }
  for (const photo of value.photos) {
    if (photo.classId && (!classes.has(photo.classId) ||
      (photo.studentId && students.get(photo.studentId)?.classId !== photo.classId))) {
      throw new Error('Fotoğrafın sınıf bağlantısı tutarsız.');
    }
    if (photo.studentId && students.get(photo.studentId)?.matchedPhotoId !== photo.id) {
      throw new Error('Fotoğraf birden fazla veya bulunamayan öğrenciye bağlı.');
    }
    if (photo.approvedForPrint && !photo.studentId) throw new Error('Eşleşmeyen fotoğraf onaylanamaz.');
  }
  return value;
}

export function loadPrototypeSnapshot({ rewrite = true } = {}): {
  snapshot: StudioDatabaseSnapshot; error: string | null; hasLegacyData: boolean;
} {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
    if (raw && raw.length > 16_000_000) throw new Error('Yerel kayıt boyut sınırı aşıldı.');
    const parsed = raw ? healPrototypeSnapshotObject(JSON.parse(raw)) : null;
    const snapshot = parsed ? validatePrototypeSnapshot(parsed) : createEmptyStudioSnapshot();
    // Previous builds could mark rows synced without contacting a server.
    const cleanSnapshot: StudioDatabaseSnapshot = {
      ...snapshot,
      lastSyncedAt: null,
      syncQueue: snapshot.syncQueue.map((item) => ({ ...item, status: 'PENDING' })),
    };
    if (rewrite && parsed && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanSnapshot));
      } catch {
        // Ignore quota error during startup migration
      }
    }
    return { snapshot: cleanSnapshot, error: null, hasLegacyData: raw !== null };
  } catch {
    return { snapshot: createEmptyStudioSnapshot(), hasLegacyData: false,
      error: 'Yerel kayıt okunamadı veya tutarsız. Eski veri korunuyor; yazma durduruldu. Geliştirici desteği gerekiyor.' };
  }
}

export function persistPrototypeSnapshot(snapshot: StudioDatabaseSnapshot): void {
  if (typeof window === 'undefined') return;
  const raw = JSON.stringify(snapshot);
  if (raw.length > 16_000_000) throw new Error('Prototip kayıt sınırı aşıldı. Gerçek SQLite ve dosya deposu gerekiyor.');
  window.localStorage.setItem(STORAGE_KEY, raw);
}
