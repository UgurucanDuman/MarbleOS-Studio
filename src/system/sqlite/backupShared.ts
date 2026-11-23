import { z } from 'zod';
import { PHOTO_DATA_URL_LIMIT } from '../storage/photoImport';
import { PRINT_FONT_POINTS } from '../storage/printTypography';
import { isValidTeacherChartTemplateId } from '../storage/teacher-charts/paginationMath';
import { TEACHER_CHART_INKS, TEACHER_CHART_PALETTES } from '../storage/teacher-charts/types';
import {
  KUTUK_NAME_BOX_STYLES,
  KUTUK_PHOTO_FRAMES,
  KUTUK_SCOPE_MODES,
  KUTUK_TEMPLATE_IDS,
} from '../storage/yearbook-kutuk/types';
import { pvcAlbumConfigFieldsShape } from '../schemas/pvcCardSchemas';
import { parseSchoolAssetId, SCHOOL_ASSET_PREFIX, schoolInputSchema } from '../schemas/schoolSchemas';
import { photoAdjustmentsSchema, studentIdCardSchema } from '../schemas/studioSchemas';
import { noUnsafeSingleLineChars } from '../schemas/textSecurity';
import type { PhotoRecord, SchoolRecord } from './types';

/**
 * İZOLE SİSTEM KATMANI: Ortak Yedek Şemaları ve Görsel Yardımcıları
 * Tekil okul yedeği (.marbleos-yedek) ve tüm kasa yedeği (.marbleos-kasa) aynı
 * sıkı Zod şemalarını, SVG/Bidi engellerini ve bayt hesabı yardımcısını paylaşır.
 */

const safeText = (min: number, max: number) =>
  z.string().min(min).max(max).refine(noUnsafeSingleLineChars, 'Geçersiz karakter içeriyor');

export const BACKUP_PHOTO_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const backupSchoolRecordSchema = schoolInputSchema
  .extend({
    id: safeText(1, 64),
    code: z.string().regex(/^\d{5}$/),
    createdAt: safeText(1, 50),
    updatedAt: safeText(1, 50),
  })
  .strict()
  .refine(
    (s) =>
      ![s.logoDataUrl, s.principalSignatureDataUrl, s.deputySignatureDataUrl, s.schoolPhotoDataUrl].some((v) =>
        v.startsWith(SCHOOL_ASSET_PREFIX),
      ),
    'Yedek içinde çözümlenmemiş yerel görsel referansı bulunamaz.',
  );

export const backupClassRecordSchema = z
  .object({
    id: safeText(1, 64),
    schoolId: safeText(1, 64),
    academicYear: safeText(4, 20),
    name: safeText(1, 20),
    teacherName: safeText(0, 60),
    deputyPrincipalName: safeText(0, 60).optional(),
    createdAt: safeText(1, 50),
  })
  .strict();

export const backupStudentRecordSchema = z
  .object({
    id: safeText(1, 64),
    classId: safeText(1, 64),
    studentNumber: z
      .string()
      .min(1)
      .max(15)
      .regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, 'Geçersiz okul numarası biçimi'),
    firstName: safeText(2, 60),
    lastName: safeText(1, 60),
    role: safeText(0, 60).optional(),
    isPrincipal: z.boolean().optional(),
    showInAlbum: z.boolean().optional(),
    groupCode: safeText(0, 24).optional(),
    idCard: studentIdCardSchema.optional(),
    matchedPhotoId: safeText(1, 64).nullable(),
    printReady: z.boolean(),
    updatedAt: safeText(1, 50),
  })
  .strict();

export const backupPhotoRecordSchema = z
  .object({
    id: safeText(1, 64),
    fileName: safeText(1, 255),
    dataUrl: z
      .string()
      .min(1)
      .max(PHOTO_DATA_URL_LIMIT)
      .regex(BACKUP_PHOTO_DATA_URL_RE, 'Yalnızca JPEG, PNG veya WebP base64 görseller kabul edilir'),
    classId: safeText(1, 64).optional(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    studentId: safeText(1, 64).nullable(),
    adjustments: photoAdjustmentsSchema,
    approvedForPrint: z.boolean(),
    createdAt: safeText(1, 50),
  })
  .strict();

export const backupAlbumConfigSchema = z
  .object({
    selectedClassId: safeText(0, 64),
    layoutKind: z.enum(['class-chart', 'yearbook-spread', 'id-card']),
    headerTitle: safeText(0, 120),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    columns: z.number().int().min(2).max(10),
    showStudentNumbers: z.boolean(),
    showTeacherBadge: z.boolean(),
    chartTemplateId: safeText(1, 40).refine(isValidTeacherChartTemplateId).optional(),
    chartPaletteId: z.enum(TEACHER_CHART_PALETTES).optional(),
    chartInkId: z.enum(TEACHER_CHART_INKS).optional(),
    printFontPt: z.literal(PRINT_FONT_POINTS).optional(),
    courseName: safeText(0, 60).optional(),
    coverTitle: safeText(0, 80).optional(),
    coverSubtitle: safeText(0, 80).optional(),
    customCoverDataUrl: z
      .string()
      .max(4_500_000)
      .regex(/^(?:|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/)
      .optional(),
    customCoverMode: z.enum(['full-bleed', 'emblem']).optional(),
    kutukTemplateId: z.enum(KUTUK_TEMPLATE_IDS).optional(),
    kutukCols: z.number().int().min(3).max(10).optional(),
    kutukRows: z.number().int().min(3).max(7).optional(),
    kutukScopeMode: z.enum(KUTUK_SCOPE_MODES).optional(),
    kutukDeputyName: safeText(0, 60).optional(),
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
    kutukFrameColor: z.string().regex(/^(?:|#[0-9a-fA-F]{6})$/).optional(),
    ...pvcAlbumConfigFieldsShape,
  })
  .strict();

export function decodedDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1 || !dataUrl.slice(0, comma).endsWith(';base64')) return new Blob([dataUrl]).size;
  const encoded = dataUrl.slice(comma + 1);
  const pad = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - pad);
}

export async function hydrateSchoolRecordVisuals(
  school: SchoolRecord,
  readOriginal: (id: string, expectedHash?: string) => Promise<string>,
): Promise<SchoolRecord> {
  const resolveSlot = async (val: string) => {
    const assetId = parseSchoolAssetId(val);
    return assetId ? readOriginal(assetId) : val;
  };
  const [logoDataUrl, principalSignatureDataUrl, deputySignatureDataUrl, schoolPhotoDataUrl] =
    await Promise.all([
      resolveSlot(school.logoDataUrl),
      resolveSlot(school.principalSignatureDataUrl),
      resolveSlot(school.deputySignatureDataUrl),
      resolveSlot(school.schoolPhotoDataUrl),
    ]);
  return {
    ...school,
    logoDataUrl,
    principalSignatureDataUrl,
    deputySignatureDataUrl,
    schoolPhotoDataUrl,
  };
}

const BACKUP_HYDRATE_BATCH_SIZE = 6;

export async function hydrateBackupPhotosInBatches(
  photos: readonly PhotoRecord[],
  readOriginal: (id: string, expectedHash?: string) => Promise<string>,
  maxPhotoBytes: number,
  limitErrorMessage: string,
): Promise<PhotoRecord[]> {
  let photoBytes = 0;
  const hydrated: PhotoRecord[] = [];
  for (let i = 0; i < photos.length; i += BACKUP_HYDRATE_BATCH_SIZE) {
    const batch = photos.slice(i, i + BACKUP_HYDRATE_BATCH_SIZE);
    const resolvedUrls = await Promise.all(
      batch.map((photo) => (photo.dataUrl ? Promise.resolve(photo.dataUrl) : readOriginal(photo.id, photo.contentHash))),
    );
    for (let j = 0; j < batch.length; j += 1) {
      const dataUrl = resolvedUrls[j]!;
      photoBytes += decodedDataUrlBytes(dataUrl);
      if (photoBytes > maxPhotoBytes) {
        throw new Error(limitErrorMessage);
      }
      hydrated.push({ ...batch[j]!, dataUrl });
    }
  }
  return hydrated;
}

