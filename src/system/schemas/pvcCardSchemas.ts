import { z } from 'zod';
import {
  PVC_ARTWORK_STYLES,
  PVC_CODE_SOURCES,
  PVC_CODE_TYPES,
  PVC_CUSTOM_DESIGN_LIMITS,
  PVC_ELEMENT_KINDS,
  PVC_FIELD_KEYS,
  PVC_FONT_FAMILIES,
  PVC_ORIENTATIONS,
  PVC_PHOTO_SHAPES,
  PVC_PRINT_SIDES_MODES,
  PVC_SEMANTIC_COLORS,
  PVC_SHAPE_VARIANTS,
} from '../storage/pvc-cards/types';
import { noUnsafeSingleLineChars, safeOptionalSingleLine } from './textSecurity';

/**
 * İZOLE SİSTEM KATMANI: PVC Kimlik Kartı Katı Zod Doğrulama Şemaları
 * Uygulama mutasyonları, tarayıcı prototipi ve şifreli yedek (.marbleos-kasa) bu şemaları paylaşır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const COLOR_OR_TOKEN_RE = new RegExp(
  `^(?:|#[0-9a-fA-F]{6}|${PVC_SEMANTIC_COLORS.join('|')})$`,
);

const PVC_IMAGE_DATA_URL_RE =
  /^(?:|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/;

const colorTokenSchema = z
  .string()
  .max(24)
  .regex(COLOR_OR_TOKEN_RE, 'Geçersiz kart renk kodu veya tema jetonu');

const safeElementText = z
  .string()
  .transform((val) => val.normalize('NFC'))
  .pipe(
    z
      .string()
      .max(200, 'Kart metni en fazla 200 karakter olabilir')
      .refine(noUnsafeSingleLineChars, 'Kart metni geçersiz karakter içeriyor')
      .refine(
        (val) => !val.trim() || !/^[=+\-@]/.test(val.trim()),
        'Kart metni formül karakteriyle (=, +, -, @) başlayamaz',
      ),
  );

export const pvcCardElementSchema = z
  .object({
    id: z.string().min(1).max(48).regex(/^[A-Za-z0-9_-]+$/, 'Geçersiz katman kimliği'),
    kind: z.enum(PVC_ELEMENT_KINDS),
    xMm: z.number().min(-25).max(140),
    yMm: z.number().min(-25).max(140),
    wMm: z.number().min(0.2).max(140),
    hMm: z.number().min(0.2).max(140),
    rotationDeg: z.number().min(-180).max(180).optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    opacity: z.number().min(0.05).max(1).optional(),
    radiusMm: z.number().min(0).max(40).optional(),
    fillColor: colorTokenSchema.optional(),
    fillColor2: colorTokenSchema.optional(),
    gradientAngle: z.number().min(0).max(360).optional(),
    borderColor: colorTokenSchema.optional(),
    borderWidthMm: z.number().min(0).max(3).optional(),
    shadow: z.boolean().optional(),
    shapeVariant: z.enum(PVC_SHAPE_VARIANTS).optional(),
    photoShape: z.enum(PVC_PHOTO_SHAPES).optional(),
    imageDataUrl: z
      .string()
      .max(PVC_CUSTOM_DESIGN_LIMITS.maxElementImageLength, 'Görsel öğesi en fazla 2 MB olabilir')
      .regex(PVC_IMAGE_DATA_URL_RE, 'Yalnızca JPEG, PNG veya WebP görsel eklenebilir')
      .optional(),
    imageFit: z.enum(['cover', 'contain']).optional(),
    photoZoom: z.number().min(0.7).max(2.5).optional(),
    photoPosX: z.number().min(0).max(100).optional(),
    photoPosY: z.number().min(0).max(100).optional(),
    fieldKey: z.enum(PVC_FIELD_KEYS).optional(),
    prefix: safeOptionalSingleLine(32, 'Alan öneki'),
    text: safeElementText.optional(),
    fontFamily: z.enum(PVC_FONT_FAMILIES).optional(),
    fontSizePt: z.number().min(4).max(24).optional(),
    fontWeight: z.union([
      z.literal(400),
      z.literal(500),
      z.literal(600),
      z.literal(700),
      z.literal(800),
    ]).optional(),
    textColor: colorTokenSchema.optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    uppercase: z.boolean().optional(),
    maxLines: z.number().int().min(1).max(4).optional(),
    codeSource: z.enum(PVC_CODE_SOURCES).optional(),
    showCodeText: z.boolean().optional(),
    sigRole: z.enum(['principal', 'deputy']).optional(),
  })
  .strict();

export const pvcCardSideSchema = z
  .object({
    backgroundColor: colorTokenSchema.refine((v) => v.length > 0, 'Zemin rengi gerekli'),
    backgroundColor2: colorTokenSchema.optional(),
    backgroundGradientAngle: z.number().min(0).max(360).optional(),
    artworkStyle: z.enum(PVC_ARTWORK_STYLES).optional(),
    backgroundDataUrl: z
      .string()
      .max(PVC_CUSTOM_DESIGN_LIMITS.maxBgDataUrlLength, 'Kart arka plan görseli en fazla 3 MB olabilir')
      .regex(PVC_IMAGE_DATA_URL_RE, 'Yalnızca JPEG, PNG veya WebP arka plan görseli kabul edilir')
      .optional(),
    backgroundFit: z.enum(['cover', 'contain']).optional(),
    backgroundOpacity: z.number().min(0.1).max(1).optional(),
    elements: z
      .array(pvcCardElementSchema)
      .max(PVC_CUSTOM_DESIGN_LIMITS.maxElementsPerSide, 'Bir kart yüzünde en fazla 45 katman bulunabilir')
      .refine(
        (list) => new Set(list.map((el) => el.id)).size === list.length,
        'Aynı kart yüzünde yinelenen katman kimliği bulunamaz',
      ),
  })
  .strict();

export const pvcDesignNameSchema = z
  .string()
  .transform((val) => val.normalize('NFC').trim())
  .pipe(
    z
      .string()
      .min(2, 'Tasarım adı en az 2 karakter olmalıdır')
      .max(60, 'Tasarım adı en fazla 60 karakter olabilir')
      .refine(noUnsafeSingleLineChars, 'Tasarım adı geçersiz karakter içeriyor')
      .refine((val) => !/^[=+\-@]/.test(val), 'Tasarım adı formül karakteriyle (=, +, -, @) başlayamaz'),
  );

export const pvcCustomDesignSchema = z
  .object({
    id: z.string().min(2).max(64).regex(/^[A-Za-z0-9-]+$/, 'Geçersiz özel kart tasarımı kimliği'),
    name: pvcDesignNameSchema,
    orientation: z.enum(PVC_ORIENTATIONS),
    widthMm: z.number().min(40).max(130).optional(),
    heightMm: z.number().min(40).max(130).optional(),
    cardRadiusMm: z.number().min(0).max(10).optional(),
    front: pvcCardSideSchema,
    back: pvcCardSideSchema,
    updatedAt: z.string().min(1).max(50).refine(noUnsafeSingleLineChars, 'Geçersiz tarih biçimi'),
  })
  .strict();

export const pvcBackNoteSchema = z
  .string()
  .transform((val) => val.normalize('NFC'))
  .pipe(
    z
      .string()
      .max(180, 'Arka yüz notu en fazla 180 karakter olabilir')
      .refine(noUnsafeSingleLineChars, 'Arka yüz notu geçersiz karakter içeriyor')
      .refine(
        (val) => !val.trim() || !/^[=+\-@]/.test(val.trim()),
        'Arka yüz notu formül karakteriyle başlayamaz',
      ),
  );

export const pvcAlbumConfigFieldsShape = {
  pvcTemplateId: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/, 'Geçersiz PVC şablon kimliği').optional(),
  pvcPrintSides: z.enum(PVC_PRINT_SIDES_MODES).optional(),
  pvcCardsPerPage: z.number().int().min(1).max(10).optional(),
  pvcCodeType: z.enum(PVC_CODE_TYPES).optional(),
  pvcCodeSource: z.enum(PVC_CODE_SOURCES).optional(),
  pvcShowWatermark: z.boolean().optional(),
  pvcShowSignature: z.boolean().optional(),
  pvcShowStudioInfo: z.boolean().optional(),
  pvcCardRadiusMm: z.number().min(0).max(10).optional(),
  pvcCardWidthMm: z.number().min(40).max(130).optional(),
  pvcCardHeightMm: z.number().min(40).max(130).optional(),
  pvcPhotoFit: z.enum(['cover', 'contain']).optional(),
  pvcPhotoZoom: z.number().min(0.7).max(2.5).optional(),
  pvcPhotoPosX: z.number().min(0).max(100).optional(),
  pvcPhotoPosY: z.number().min(0).max(100).optional(),
  pvcPhotoShape: z.enum(PVC_PHOTO_SHAPES).optional(),
  pvcHeaderTopText: safeOptionalSingleLine(80, 'Kart üst başlık metni'),
  pvcBackNote: pvcBackNoteSchema.optional(),
  pvcHiddenFields: z.array(z.enum(PVC_FIELD_KEYS)).max(24).optional(),
  pvcCustomDesigns: z
    .array(pvcCustomDesignSchema)
    .max(PVC_CUSTOM_DESIGN_LIMITS.maxDesigns, 'En fazla 15 özel PVC kart tasarımı saklanabilir')
    .refine(
      (list) => new Set(list.map((d) => d.id)).size === list.length,
      'Yinelenen özel kart tasarımı kimliği',
    )
    .optional(),
};
