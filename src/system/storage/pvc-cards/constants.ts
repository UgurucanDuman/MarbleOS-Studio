/**
 * İZOLE SİSTEM KATMANI: CR80 PVC Kimlik Kartı Sabitleri ve Enum Dizileri
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const PVC_CR80_LANDSCAPE_MM = { widthMm: 85.6, heightMm: 54 } as const;
export const PVC_CR80_PORTRAIT_MM = { widthMm: 54, heightMm: 85.6 } as const;
export const PVC_DEFAULT_CORNER_RADIUS_MM = 3.18;
export const PVC_SAFE_MARGIN_MM = 3;
export const PVC_LANYARD_TOP_MM = 8.5;

export const PVC_BUILT_IN_TEMPLATE_IDS = [
  'official-classic',
  'modern-stripe',
  'prestige-academic',
  'vertical-lanyard',
  'minimal-pro',
] as const;

export const PVC_ORIENTATIONS = ['landscape', 'portrait'] as const;
export const PVC_SIDES = ['front', 'back'] as const;
export const PVC_PRINT_SIDES_MODES = ['front-only', 'back-only', 'front-and-back'] as const;
export const PVC_CODE_TYPES = ['barcode', 'qrcode', 'none'] as const;
export const PVC_CODE_SOURCES = [
  'studentNumber',
  'nationalId',
  'institutionAndNumber',
  'studentSummary',
] as const;

export const PVC_ARTWORK_STYLES = [
  'none',
  'corporate-wave',
  'modern-diagonal',
  'academic-crest',
  'lanyard-arch',
  'swiss-minimal',
  'guilloche-net',
] as const;

export const PVC_SHAPE_VARIANTS = ['rect', 'circle', 'wave', 'diagonal', 'line'] as const;
export const PVC_PHOTO_SHAPES = ['rect', 'rounded', 'circle', 'arch', 'hexagon'] as const;
export const PVC_FONT_FAMILIES = ['sans', 'serif', 'display', 'mono'] as const;

export const PVC_ELEMENT_KINDS = [
  'shape',
  'photo',
  'school-logo',
  'studio-logo',
  'signature',
  'image',
  'field',
  'text',
  'barcode',
  'qrcode',
] as const;

export const PVC_FIELD_KEYS = [
  'fullName',
  'firstName',
  'lastName',
  'studentNumber',
  'className',
  'classAndNumber',
  'role',
  'department',
  'nationalId',
  'bloodType',
  'birthDate',
  'birthPlace',
  'birthInfo',
  'fatherName',
  'motherName',
  'registryNo',
  'schoolName',
  'schoolAddress',
  'academicYear',
  'cardTitle',
  'studioName',
  'studioOwner',
  'studioPhone',
  'studioAddress',
] as const;

export const PVC_SEMANTIC_COLORS = [
  'accent',
  'accentSoft',
  'accentDeep',
  'surface',
  'ink',
  'inkMuted',
  'onAccent',
  'border',
] as const;

export const PVC_CUSTOM_DESIGN_LIMITS = {
  maxDesigns: 15,
  maxElementsPerSide: 45,
  maxBgDataUrlLength: 4_500_000,
  maxElementImageLength: 2_800_000,
} as const;

export function pvcCardDimensions(orientation: (typeof PVC_ORIENTATIONS)[number]): {
  widthMm: number;
  heightMm: number;
} {
  return orientation === 'portrait' ? PVC_CR80_PORTRAIT_MM : PVC_CR80_LANDSCAPE_MM;
}
