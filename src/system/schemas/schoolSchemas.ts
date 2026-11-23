import { z } from 'zod';
import { studentInputSchema } from './studioSchemas';
import { safeMultiLine, safeSingleLine } from './textSecurity';

/**
 * İZOLE SİSTEM KATMANI: Okul kayıt şemaları (src/system/schemas/schoolSchemas.ts)
 * Tek satırlık alanlar kontrol/Bidi karakteri veya formül öneki içeremez; adres ve not yalnız satır sonuna izin verir.
 * Aynı sınırlar yerel Rust doğrulamasında (src-tauri/src/snapshot.rs) tekrar uygulanır.
 */

const singleLine = safeSingleLine;
const multiLine = safeMultiLine;

export const SCHOOL_LIMITS = {
  nameMax: 100,
  institutionCodeMax: 12,
  addressMax: 300,
  notesMax: 2000,
  logoAndSignatureBytesMax: 3 * 1024 * 1024, // 3 MB
  schoolPhotoBytesMax: 8 * 1024 * 1024,      // 8 MB
  logoAndSignatureDataUrlMax: 4_500_000,     // ~3 MB base64 üst sınırı
  schoolPhotoDataUrlMax: 11_500_000,         // ~8 MB base64 üst sınırı
  maxSchools: 500,
} as const;

export const SCHOOL_ASSET_PREFIX = 'marbleos-school-asset:';
export const DESKTOP_PHOTO_COPY_PREFIX = 'marbleos-photo-copy:';
const SCHOOL_ASSET_RE = /^marbleos-school-asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const DATA_URL_PATTERN = /^(?:|marbleos-school-asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/;

export function parseSchoolAssetId(value?: string | null): string | null {
  if (!value) return null;
  return SCHOOL_ASSET_RE.exec(value)?.[1] ?? null;
}

const logoOrSignatureDataUrl = z.string()
  .max(SCHOOL_LIMITS.logoAndSignatureDataUrlMax, 'Logo ve imza görselleri en fazla 3 MB olabilir')
  .regex(DATA_URL_PATTERN, 'Geçersiz görsel biçimi');

const schoolPhotoDataUrl = z.string()
  .max(SCHOOL_LIMITS.schoolPhotoDataUrlMax, 'Okul resmi en fazla 8 MB olabilir')
  .regex(DATA_URL_PATTERN, 'Geçersiz görsel biçimi');

export const schoolInputSchema = z.object({
  name: singleLine(2, SCHOOL_LIMITS.nameMax, 'Okul adı en az 2 karakter olmalıdır'),
  institutionCode: z.string().trim()
    .max(SCHOOL_LIMITS.institutionCodeMax, 'Kurum kodu en fazla 12 hane olabilir')
    .regex(/^\d*$/, 'Kurum kodu yalnızca rakam içerebilir'),
  address: multiLine(SCHOOL_LIMITS.addressMax),
  notes: multiLine(SCHOOL_LIMITS.notesMax),
  makeBiometric: z.boolean(),
  makeVesikalik: z.boolean(),
  logoDataUrl: logoOrSignatureDataUrl.default(''),
  transparentLogoOpacity: z.number().int().min(10).max(100).default(35),
  principalSignatureDataUrl: logoOrSignatureDataUrl.default(''),
  deputySignatureDataUrl: logoOrSignatureDataUrl.default(''),
  schoolPhotoDataUrl: schoolPhotoDataUrl.default(''),
  schoolPhotoZoom: z.number().min(1).max(2).default(1),
}).strict();

export const updateSchoolSchema = schoolInputSchema.extend({
  id: z.string().min(1, 'Okul kimliği gerekli'),
}).strict();

export const addSchoolsBatchSchema = z.object({
  rows: z.array(schoolInputSchema)
    .min(1, 'En az 1 geçerli okul satırı bulunmalıdır')
    .max(SCHOOL_LIMITS.maxSchools, `Tek seferde en fazla ${SCHOOL_LIMITS.maxSchools} okul aktarılabilir`),
}).strict();

export const selectSchoolSchema = z.string().min(1, 'Okul kimliği gerekli').nullable();

export const deleteSchoolSchema = z.string().min(1, 'Silinecek okul kimliği gerekli');

export const deleteSchoolsBatchSchema = z
  .array(z.string().min(1))
  .min(1, 'Silinecek en az 1 okul seçilmelidir')
  .max(SCHOOL_LIMITS.maxSchools);

export const mergeSchoolsSchema = z.object({
  newSchoolName: singleLine(2, SCHOOL_LIMITS.nameMax, 'Yeni okul adı en az 2 karakter olmalıdır'),
  schoolIds: z.array(z.string().min(1))
    .min(2, 'Birleştirmek için en az 2 okul seçmelisiniz')
    .max(50, 'Tek seferde en fazla 50 okul birleştirilebilir'),
}).strict();

export const SCHOOL_BACKUP_LIMITS = {
  maxPhotos: 600,
  maxPhotoBytes: 64_000_000,
  maxJsonBytes: 115_000_000,
} as const;

export const restoreSchoolBackupJsonSchema = z.string()
  .min(2, 'Yedek dosyası boş olamaz')
  .max(SCHOOL_BACKUP_LIMITS.maxJsonBytes, 'Okul yedeği boyut sınırını aşıyor');

export const promoteSchoolYearSchema = z.object({
  schoolId: z.string().min(1, 'Okul kimliği gerekli'),
  targetAcademicYear: singleLine(4, 20, 'Yeni eğitim dönemi gerekli (Örn: 2027-2028)'),
}).strict();

export const importSchoolRosterSchema = z.object({
  schoolId: z.string().min(1, 'Önce bir okul seçin'),
  academicYear: singleLine(4, 20, 'Eğitim dönemi gerekli (Örn: 2026-2027)'),
  classes: z
    .array(
      z.object({
        className: singleLine(2, 20, 'Şube adı en az 2 karakter olmalıdır'),
        rows: z.array(studentInputSchema).min(1, 'Şubede en az 1 öğrenci olmalıdır').max(5000),
      }).strict(),
    )
    .min(1, 'Aktarılacak en az 1 şube bulunmalıdır')
    .max(200, 'Tek seferde en fazla 200 şube aktarılabilir'),
}).strict().refine(
  (val) => val.classes.reduce((sum, item) => sum + item.rows.length, 0) <= 20_000,
  { message: 'Tek aktarımda en fazla 20.000 öğrenci bulunabilir' },
);

export type ImportSchoolRosterInput = z.input<typeof importSchoolRosterSchema>;
export type SchoolInput = z.input<typeof schoolInputSchema>;
export type SchoolParsedInput = z.output<typeof schoolInputSchema>;

/** Türkçe büyük/küçük harf ve fazla boşluk farkını yok sayan karşılaştırma anahtarı. */
export function schoolNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}
