import type { ExportSubfolder } from '../../system/desktop/desktopStorage';
import type { ClassRecord, PhotoRecord, StudentRecord } from '../../system/sqlite/types';
import { mmToPx, PRINT_DPI } from '../../system/storage/binaryPrintFormats';
import type { PvcCardSide } from '../../system/storage/pvc-cards/types';
import type { KutukStudentLike } from '../../system/storage/yearbook-kutuk/staffDirectory';
import type { KutukResolvedPage } from '../../system/storage/yearbook-kutuk/types';

/**
 * İZOLE MODÜL 04 SPESİFİKASYONU: 300 DPI Fiziksel Portre, PVC Kimlik, Albüm & e-Okul Katalog Ölçüleri
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export type PrintProductId =
  | 'vesikalik-45x60'
  | 'biometric-50x60'
  | 'pvc-id-card'
  | 'album-chart'
  | 'e-okul-zip';

export type PrintSheetMode =
  | 'a4-grid'
  | '10x15-4up-student'
  | '10x15-grid'
  | 'cr80-single'
  | 'a4-id-8up'
  | 'a4-album-portrait'
  | 'a4-kutuk-portrait'
  | 'a4-album-landscape'
  | 'a4-student-list'
  | 'single-zip';

export type PrintApprovalFilter = 'approved-only' | 'all-matched';

export interface PrintProductSpec {
  id: PrintProductId;
  shortLabel: string;
  fullLabel: string;
  widthMm: number;
  heightMm: number;
  portraitWidthMm: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
  subfolder: ExportSubfolder;
  maxFileBytes?: number;
}

export const PRINT_PRODUCTS: Record<PrintProductId, PrintProductSpec> = {
  'vesikalik-45x60': {
    id: 'vesikalik-45x60',
    shortLabel: 'Vesikalık 45×60',
    fullLabel: 'Vesikalık (45×60 mm · 531×709 px · 300 DPI)',
    widthMm: 45,
    heightMm: 60,
    portraitWidthMm: 45,
    widthPx: mmToPx(45, PRINT_DPI),
    heightPx: mmToPx(60, PRINT_DPI),
    dpi: PRINT_DPI,
    subfolder: 'vesikalik',
  },
  'biometric-50x60': {
    id: 'biometric-50x60',
    shortLabel: 'Biyometrik 50×60',
    fullLabel: 'Biyometrik (50×60 mm · 591×709 px · 300 DPI)',
    widthMm: 50,
    heightMm: 60,
    portraitWidthMm: 50,
    widthPx: mmToPx(50, PRINT_DPI),
    heightPx: mmToPx(60, PRINT_DPI),
    dpi: PRINT_DPI,
    subfolder: 'biyometrik',
  },
  'pvc-id-card': {
    id: 'pvc-id-card',
    shortLabel: 'PVC Kimlik (CR80)',
    fullLabel: 'PVC Öğrenci & Kadro Kimlik Kartı (85.6×54 / 54×85.6 mm · CR80 · 300 DPI)',
    widthMm: 85.6,
    heightMm: 54,
    portraitWidthMm: 26,
    widthPx: mmToPx(26, PRINT_DPI),
    heightPx: mmToPx(34.7, PRINT_DPI),
    dpi: PRINT_DPI,
    subfolder: 'kimlik',
  },
  'album-chart': {
    id: 'album-chart',
    shortLabel: 'Albüm & Sınıf Panosu',
    fullLabel: 'Sınıf Çizelgesi & Yıllık Albüm Sayfası (A4 · 300 DPI)',
    widthMm: 210,
    heightMm: 297,
    portraitWidthMm: 32,
    widthPx: mmToPx(32, PRINT_DPI),
    heightPx: mmToPx(42.67, PRINT_DPI),
    dpi: PRINT_DPI,
    subfolder: 'album',
  },
  'e-okul-zip': {
    id: 'e-okul-zip',
    shortLabel: 'e-Okul (.zip)',
    fullLabel: 'MEB e-Okul Paketi (133×171 px · ≤120 KB JPEG .zip)',
    widthMm: 45,
    heightMm: 58,
    portraitWidthMm: 45,
    widthPx: 133,
    heightPx: 171,
    dpi: 96,
    subfolder: 'e-okul',
    maxFileBytes: 120_000,
  },
};

export interface PrintableStudentEntry {
  student: StudentRecord;
  photo: PhotoRecord;
  classRecord: ClassRecord | undefined;
  className: string;
}

export interface ImpositionSlot {
  entry: PrintableStudentEntry;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated90?: boolean;
}

export interface ImpositionPage {
  pageIndex: number;
  kind: 'portrait-sheet' | 'id-card-sheet' | 'album-sheet' | 'kutuk-sheet' | 'student-list';
  cardSide?: PvcCardSide;
  titleLabel?: string;
  teacherLabel?: string;
  academicYear?: string;
  subPageIndex?: number;
  subTotalPages?: number;
  rosterEntries?: readonly PrintableStudentEntry[];
  kutukPage?: KutukResolvedPage<KutukStudentLike, string | null>;
  studentListRows?: readonly { sequence: number; student: StudentRecord }[];
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  cols: number;
  rows: number;
  rulerLengthMm: number;
  footerStudioStrip?: boolean;
  slots: ImpositionSlot[];
}

export function defaultSheetModeForProduct(productId: PrintProductId): PrintSheetMode {
  if (productId === 'pvc-id-card') return 'a4-id-8up';
  if (productId === 'album-chart') return 'a4-album-portrait';
  if (productId === 'e-okul-zip') return 'single-zip';
  return 'a4-grid';
}

export function normalizeSheetModeForProduct(productId: PrintProductId, mode: PrintSheetMode): PrintSheetMode {
  if (productId === 'e-okul-zip') return 'single-zip';
  if (productId === 'pvc-id-card') {
    return mode === 'cr80-single' || mode === 'a4-id-8up' ? mode : 'a4-id-8up';
  }
  if (productId === 'album-chart') {
    return mode === 'a4-album-portrait' ||
      mode === 'a4-kutuk-portrait' ||
      mode === 'a4-album-landscape' ||
      mode === 'a4-student-list'
      ? mode
      : 'a4-album-portrait';
  }
  return mode === 'a4-grid' || mode === '10x15-4up-student' || mode === '10x15-grid' || mode === 'single-zip'
    ? mode
    : 'a4-grid';
}

export { planImpositionPages } from './impositionPlanner';
