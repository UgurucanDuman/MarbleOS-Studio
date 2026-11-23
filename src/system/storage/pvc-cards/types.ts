import type {
  PVC_ARTWORK_STYLES,
  PVC_BUILT_IN_TEMPLATE_IDS,
  PVC_CODE_SOURCES,
  PVC_CODE_TYPES,
  PVC_ELEMENT_KINDS,
  PVC_FIELD_KEYS,
  PVC_FONT_FAMILIES,
  PVC_ORIENTATIONS,
  PVC_PHOTO_SHAPES,
  PVC_PRINT_SIDES_MODES,
  PVC_SHAPE_VARIANTS,
  PVC_SIDES,
} from './constants';

export * from './constants';

/**
 * İZOLE SİSTEM KATMANI: CR80 PVC Öğrenci & Kadro Kimlik Kartı Arayüz Tipleri
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export type PvcBuiltInTemplateId = (typeof PVC_BUILT_IN_TEMPLATE_IDS)[number];
export type PvcCardOrientation = (typeof PVC_ORIENTATIONS)[number];
export type PvcCardSide = (typeof PVC_SIDES)[number];
export type PvcPrintSidesMode = (typeof PVC_PRINT_SIDES_MODES)[number];
export type PvcCodeType = (typeof PVC_CODE_TYPES)[number];
export type PvcCodeSource = (typeof PVC_CODE_SOURCES)[number];
export type PvcArtworkStyle = (typeof PVC_ARTWORK_STYLES)[number];
export type PvcShapeVariant = (typeof PVC_SHAPE_VARIANTS)[number];
export type PvcPhotoShape = (typeof PVC_PHOTO_SHAPES)[number];
export type PvcFontFamily = (typeof PVC_FONT_FAMILIES)[number];
export type PvcElementKind = (typeof PVC_ELEMENT_KINDS)[number];
export type PvcFieldKey = (typeof PVC_FIELD_KEYS)[number];
export type PvcFontWeight = 400 | 500 | 600 | 700 | 800;
export type PvcTextAlign = 'left' | 'center' | 'right';

export interface PvcCardElement {
  id: string;
  kind: PvcElementKind;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotationDeg?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  radiusMm?: number;
  fillColor?: string;
  fillColor2?: string;
  gradientAngle?: number;
  borderColor?: string;
  borderWidthMm?: number;
  shadow?: boolean;
  shapeVariant?: PvcShapeVariant;
  photoShape?: PvcPhotoShape;
  imageDataUrl?: string;
  imageFit?: 'cover' | 'contain';
  photoZoom?: number;
  photoPosX?: number;
  photoPosY?: number;
  fieldKey?: PvcFieldKey;
  prefix?: string;
  text?: string;
  fontFamily?: PvcFontFamily;
  fontSizePt?: number;
  fontWeight?: PvcFontWeight;
  textColor?: string;
  align?: PvcTextAlign;
  uppercase?: boolean;
  maxLines?: number;
  codeSource?: PvcCodeSource;
  showCodeText?: boolean;
  sigRole?: 'principal' | 'deputy';
}

export interface PvcCardSideSpec {
  backgroundColor: string;
  backgroundColor2?: string;
  backgroundGradientAngle?: number;
  artworkStyle?: PvcArtworkStyle;
  backgroundDataUrl?: string;
  backgroundFit?: 'cover' | 'contain';
  backgroundOpacity?: number;
  elements: PvcCardElement[];
}

export interface PvcCustomDesign {
  id: string;
  name: string;
  orientation: PvcCardOrientation;
  widthMm?: number;
  heightMm?: number;
  cardRadiusMm?: number;
  front: PvcCardSideSpec;
  back: PvcCardSideSpec;
  updatedAt: string;
}

export interface PvcBuiltInTemplateSpec {
  id: PvcBuiltInTemplateId;
  name: string;
  shortBadge: string;
  subtitle: string;
  orientation: PvcCardOrientation;
  cardRadiusMm: number;
  front: PvcCardSideSpec;
  back: PvcCardSideSpec;
}

export interface PvcResolvedDesign {
  id: string;
  name: string;
  shortBadge: string;
  subtitle: string;
  isCustom: boolean;
  orientation: PvcCardOrientation;
  widthMm: number;
  heightMm: number;
  cardRadiusMm: number;
  front: PvcCardSideSpec;
  back: PvcCardSideSpec;
}

export interface PvcCardStudentLike {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  role?: string;
  isPrincipal?: boolean;
  idCard?: {
    nationalId?: string;
    department?: string;
    bloodType?: string;
    fatherName?: string;
    motherName?: string;
    birthPlace?: string;
    birthDate?: string;
    registryNo?: string;
  };
}

export interface PvcStudioBrandInfo {
  companyName?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
}

export interface PvcCardDataContext {
  schoolName: string;
  schoolAddress?: string;
  institutionCode?: string;
  academicYear?: string;
  className?: string;
  isStaffCard: boolean;
  student: PvcCardStudentLike | null;
  studio?: PvcStudioBrandInfo;
  backNote?: string;
}
