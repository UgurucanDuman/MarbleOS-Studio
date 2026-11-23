import { z } from 'zod';
import { PHOTO_DATA_URL_LIMIT, PHOTO_IMPORT_LIMITS } from '../storage/photoImport';
import {
  noUnsafeSingleLineChars,
  safeOptionalSingleLine,
  safeSingleLine,
} from './textSecurity';

export { albumConfigPatchSchema, approveBranchForPrintSchema } from './albumSchemas';

/**
 * İZOLE SİSTEM KATMANI: Kesin Zod Doğrulama Şemaları (src/system/schemas/studioSchemas.ts)
 * Uygulamadaki tüm veri girişleri ve mutasyonlar istisnasız bu şemalarla doğrulanır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const createClassSchema = z.object({
  name: safeSingleLine(
    1,
    20,
    'Sınıf/Şube adı boş olamaz (Örn: A veya 9-A)',
    'Sınıf/Şube adı en fazla 20 karakter olabilir',
  ),
  teacherName: safeOptionalSingleLine(60, 'Öğretmen adı', 2, 'Öğretmen adı en az 2 karakter olmalıdır'),
  deputyPrincipalName: safeOptionalSingleLine(60, 'Müdür yardımcısı adı'),
  schoolId: z.string().min(1, 'Önce bir okul seçin'),
  academicYear: safeSingleLine(4, 20, 'Eğitim dönemi gerekli'),
}).strict();

export const updateClassSchema = z.object({
  id: z.string().min(1, 'Şube kimliği gerekli'),
  name: safeSingleLine(
    1,
    20,
    'Sınıf/Şube adı boş olamaz',
    'Sınıf/Şube adı en fazla 20 karakter olabilir',
  ),
  teacherName: safeOptionalSingleLine(60, 'Öğretmen adı'),
  deputyPrincipalName: safeOptionalSingleLine(60, 'Müdür yardımcısı adı'),
}).strict();

export const deleteClassSchema = z.string().min(1, 'Silinecek şube kimliği geçersiz');
export const duplicateClassSchema = z.string().min(1, 'Çoğaltılacak şube kimliği geçersiz');

export const studentIdCardSchema = z.object({
  nationalId: z
    .string()
    .trim()
    .max(11, 'T.C. Kimlik No en fazla 11 rakam olabilir')
    .regex(/^\d*$/, 'T.C. Kimlik No yalnızca rakam içerebilir')
    .optional()
    .or(z.literal('')),
  department: safeOptionalSingleLine(60, 'Bölümü / Alanı'),
  bloodType: safeOptionalSingleLine(16, 'Kan Grubu'),
  fatherName: safeOptionalSingleLine(50, 'Baba Adı'),
  motherName: safeOptionalSingleLine(50, 'Anne Adı'),
  birthPlace: safeOptionalSingleLine(50, 'Doğum Yeri'),
  birthDate: safeOptionalSingleLine(24, 'Doğum Tarihi'),
  province: safeOptionalSingleLine(40, 'İli'),
  district: safeOptionalSingleLine(40, 'İlçesi'),
  neighborhood: safeOptionalSingleLine(60, 'Mahalle/Köy'),
  volumeNo: safeOptionalSingleLine(20, 'Cilt No'),
  familySerialNo: safeOptionalSingleLine(20, 'Aile Sıra No'),
  serialNo: safeOptionalSingleLine(20, 'Sıra No'),
  documentNo: safeOptionalSingleLine(30, 'İl/Belge No'),
  registryNo: safeOptionalSingleLine(30, 'Sicil No'),
}).strict();

export const studentInputSchema = z.object({
  studentNumber: z
    .string()
    .trim()
    .min(1, 'Okul numarası boş olamaz')
    .max(15, 'Okul numarası en fazla 15 karakter olabilir')
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Okul numarası harf veya rakamla başlamalı, yalnızca harf/rakam/tire içermelidir'),
  firstName: safeSingleLine(2, 60, 'Ad en az 2 harf olmalıdır', 'Ad çok uzun'),
  lastName: safeSingleLine(1, 60, 'Soyad boş olamaz', 'Soyad çok uzun'),
  role: safeOptionalSingleLine(60, 'Görevi / Unvan'),
  isPrincipal: z.boolean().optional(),
  showInAlbum: z.boolean().optional(),
  groupCode: safeOptionalSingleLine(24, 'Grup kodu'),
  idCard: studentIdCardSchema.optional(),
}).strict();

export const bulkStudentRowSchema = studentInputSchema;
export type StudentInput = z.input<typeof studentInputSchema>;

export const addStudentsBatchSchema = z.object({
  classId: z.string().min(1, 'Geçerli bir sınıf seçilmelidir'),
  rows: z.array(studentInputSchema).min(1, 'En az 1 geçerli öğrenci kaydı bulunmalıdır').max(5000),
}).strict();
export type AddStudentsBatchInput = z.input<typeof addStudentsBatchSchema>;

export const deleteStudentSchema = z.string().min(1, 'Silinecek öğrenci kimliği geçersiz');

export const updateStudentSchema = studentInputSchema.extend({
  id: z.string().min(1, 'Öğrenci kimliği gerekli'),
}).strict();
export type UpdateStudentInput = z.input<typeof updateStudentSchema>;

export const deleteStudentsBatchSchema = z
  .array(z.string().min(1))
  .min(1, 'Silinecek en az 1 öğrenci seçilmelidir')
  .max(5000);

export const sortClassStudentsSchema = z.object({
  classId: z.string().min(1, 'Şube kimliği gerekli'),
  by: z.enum(['number', 'name']),
}).strict();

export const moveStudentOrderSchema = z.object({
  studentId: z.string().min(1, 'Öğrenci kimliği gerekli'),
  direction: z.enum(['up', 'down']),
}).strict();

export const transferStudentSchema = z.object({
  studentId: safeSingleLine(1, 64, 'Öğrenci kimliği gerekli'),
  sourceClassId: safeSingleLine(1, 64, 'Mevcut sınıf gerekli'),
  targetClassId: safeSingleLine(1, 64, 'Hedef sınıfı seçin'),
}).strict();
export type TransferStudentInput = z.input<typeof transferStudentSchema>;

export const batchPatchClassStudentsSchema = z.object({
  classId: z.string().min(1, 'Şube kimliği gerekli'),
  studentIds: z.array(z.string().min(1)).optional(),
  showInAlbum: z.boolean().optional(),
  groupCode: safeOptionalSingleLine(24, 'Grup kodu'),
}).strict();

export const photoMatchModeSchema = z.enum(['smart', 'number', 'name', 'sequence']);
export type PhotoMatchMode = z.infer<typeof photoMatchModeSchema>;

export const uploadPhotosSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z
          .string()
          .min(1)
          .max(255)
          .refine(noUnsafeSingleLineChars, 'Dosya adı geçersiz karakter içeriyor'),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
        dataUrl: z
          .string()
          .max(PHOTO_DATA_URL_LIMIT)
          .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
      }).strict(),
    )
    .min(1, 'En az 1 fotoğraf seçilmelidir')
    .max(PHOTO_IMPORT_LIMITS.count),
  classId: z.string().optional(),
  matchMode: photoMatchModeSchema.optional(),
  targetStudentId: z.string().min(1).optional(),
}).strict().refine(({ files, targetStudentId, classId }) => !targetStudentId || (files.length === 1 && Boolean(classId)), {
  message: 'Tek bir fotoğraf ve bu sınıftan bir öğrenci seçin.',
}).refine(({ files }) => files.reduce((total, { dataUrl }) => {
  const encodedLength = dataUrl.length - dataUrl.indexOf(',') - 1;
  const padding = dataUrl.endsWith('==') ? 2 : Number(dataUrl.endsWith('='));
  return total + Math.floor(encodedLength * 3 / 4) - padding;
}, 0) <= PHOTO_IMPORT_LIMITS.batchBytes, {
  message: 'Bir kayıt grubu 16 MB sınırını aşıyor.',
});

export const assignPhotoSchema = z.object({
  photoId: z.string().min(1, 'Fotoğraf kimliği gerekli'),
  studentId: z.string().min(1).nullable(),
}).strict();

export const shiftStudentPhotoSchema = z.object({
  studentId: z.string().min(1, 'Öğrenci kimliği gerekli'),
  direction: z.enum(['up', 'down', 'insert-gap-down', 'delete-shift-up']),
}).strict();

export const photoAdjustmentsSchema = z.object({
  zoom: z.number().min(1).max(2.5),
  brightness: z.number().min(70).max(135),
  contrast: z.number().min(70).max(135),
  warmth: z.number().min(-30).max(30),
  rotation: z.number().int().refine((v) => v === 0 || v === 90 || v === 180 || v === 270).optional(),
  panX: z.number().min(-45).max(45).optional(),
  panY: z.number().min(-45).max(45).optional(),
  tilt: z.number().min(-10).max(10).optional(),
  shadows: z.number().min(-30).max(50).optional(),
  highlights: z.number().min(-50).max(30).optional(),
  saturation: z.number().min(0).max(140).optional(),
  sharpen: z.number().min(0).max(40).optional(),
}).strict();

export const updatePhotoStudioSchema = z.object({
  photoId: z.string().min(1),
  adjustments: photoAdjustmentsSchema,
  approvedForPrint: z.boolean(),
}).strict();
