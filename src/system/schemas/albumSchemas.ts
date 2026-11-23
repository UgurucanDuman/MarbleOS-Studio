import { z } from 'zod';
import { PRINT_FONT_POINTS } from '../storage/printTypography';
import { isValidTeacherChartTemplateId } from '../storage/teacher-charts/paginationMath';
import { TEACHER_CHART_INKS, TEACHER_CHART_PALETTES } from '../storage/teacher-charts/types';
import {
  KUTUK_NAME_BOX_STYLES,
  KUTUK_PHOTO_FRAMES,
  KUTUK_SCOPE_MODES,
  KUTUK_TEMPLATE_IDS,
} from '../storage/yearbook-kutuk/types';
import { pvcAlbumConfigFieldsShape } from './pvcCardSchemas';
import { noUnsafeSingleLineChars, safeOptionalSingleLine } from './textSecurity';

/**
 * İZOLE SİSTEM KATMANI: Albüm, Öğretmen Çizelgesi ve İdareci Kütük Dosyası Zod Şemaları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const albumConfigPatchSchema = z.object({
  selectedClassId: z.string().max(64).refine(noUnsafeSingleLineChars, 'Geçersiz şube kimliği').optional(),
  layoutKind: z.enum(['class-chart', 'yearbook-spread', 'id-card']).optional(),
  headerTitle: z
    .string()
    .transform((val) => val.normalize('NFC'))
    .pipe(
      z
        .string()
        .max(120, 'Başlık en fazla 120 karakter olabilir')
        .refine(noUnsafeSingleLineChars, 'Başlık geçersiz karakter içeriyor')
        .refine(
          (val) => !val.trim() || !/^[=+\-@]/.test(val.trim()),
          'Başlık formül karakteriyle (=, +, -, @) başlayamaz',
        ),
    )
    .optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Geçersiz vurgu rengi').optional(),
  columns: z.number().int().min(2).max(10).optional(),
  showStudentNumbers: z.boolean().optional(),
  showTeacherBadge: z.boolean().optional(),
  chartTemplateId: z.string().max(40).refine(isValidTeacherChartTemplateId, 'Geçersiz çizelge şablonu').optional(),
  chartPaletteId: z.enum(TEACHER_CHART_PALETTES).optional(),
  chartInkId: z.enum(TEACHER_CHART_INKS).optional(),
  printFontPt: z.literal(PRINT_FONT_POINTS).optional(),
  courseName: safeOptionalSingleLine(60, 'Ders adı'),
  coverTitle: safeOptionalSingleLine(80, 'Kapak başlığı'),
  coverSubtitle: safeOptionalSingleLine(80, 'Kapak alt başlığı'),
  customCoverDataUrl: z
    .string()
    .max(4_500_000, 'Kapak görseli en fazla 3 MB olabilir')
    .regex(/^(?:|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/, 'Geçersiz kapak görseli biçimi')
    .optional(),
  customCoverMode: z.enum(['full-bleed', 'emblem']).optional(),
  kutukTemplateId: z.enum(KUTUK_TEMPLATE_IDS).optional(),
  kutukCols: z.number().int().min(3).max(10).optional(),
  kutukRows: z.number().int().min(3).max(7).optional(),
  kutukScopeMode: z.enum(KUTUK_SCOPE_MODES).optional(),
  kutukDeputyName: safeOptionalSingleLine(60, 'Müdür yardımcısı adı'),
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
  kutukFrameColor: z.string().regex(/^(?:|#[0-9a-fA-F]{6})$/, 'Geçersiz çerçeve rengi').optional(),
  ...pvcAlbumConfigFieldsShape,
}).strict();

export const approveBranchForPrintSchema = z.object({
  schoolId: z.string().min(1, 'Okul seçilmelidir'),
  classId: z
    .string()
    .min(1, 'Şube seçilmelidir')
    .max(80)
    .refine(noUnsafeSingleLineChars, 'Geçersiz kapsam bilgisi'),
}).strict();
