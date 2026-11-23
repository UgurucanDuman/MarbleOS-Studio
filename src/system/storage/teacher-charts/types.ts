/**
 * İZOLE SİSTEM KATMANI: Öğretmen Not Çizelgesi, Cep Not Defteri, ŞÖK ve Öğretmen Cep Albümü Tipleri
 * Modül 03 (Canlı Tasarım Masası) ve Modül 04 (300 DPI Baskı & PDF Motoru) bu sözleşmeyi paylaşır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const TEACHER_DOC_CATEGORIES = [
  'ilkogretim-cizelge',
  'lise-cizelge',
  'not-defteri',
  'kurul-rapor',
  'cep-albumu',
] as const;

export type TeacherDocCategoryId = (typeof TEACHER_DOC_CATEGORIES)[number];

export const TEACHER_CHART_PALETTES = [
  'classic-navy',
  'emerald-ink',
  'crimson-slate',
  'anatolian-teal',
  'royal-azure',
  'imperial-plum',
  'nordic-slate',
  'pure-mono',
] as const;

export type TeacherChartPaletteId = (typeof TEACHER_CHART_PALETTES)[number];

export const TEACHER_CHART_INKS = [
  'obsidian-black',
  'graphite-charcoal',
  'meb-navy',
  'oxford-blue',
  'cobalt-sky',
  'seljuk-teal',
  'emerald-forest',
  'pine-olive',
  'midnight-indigo',
  'royal-plum',
  'berry-magenta',
  'anatolian-burgundy',
] as const;

export type TeacherChartInkId = (typeof TEACHER_CHART_INKS)[number];

export interface TeacherChartInkOption {
  id: TeacherChartInkId;
  name: string;
  swatch: string;
  inkPrimary: string;
  inkSecondary: string;
  headingInk: string;
}

export interface TeacherChartPalette {
  id: TeacherChartPaletteId;
  name: string;
  subtitle: string;
  defaultInkId: TeacherChartInkId;
  inkPrimary: string;
  inkSecondary: string;
  headingInk: string;
  accent: string;
  headerTint: string;
  summaryTint: string;
  finalTint: string;
  gridBorder: string;
  gridHairline: string;
}

export type TeacherDocEngineKind =
  | 'tabular-gradebook'
  | 'tabular-sok'
  | 'booklet-gradebook-inner'
  | 'booklet-gradebook-front'
  | 'booklet-gradebook-back'
  | 'booklet-album-inner'
  | 'booklet-album-cover';

export type StudentIdentityCellMode = 'side-vertical' | 'stacked-horizontal';

export type SubRowScheme =
  | 'two-terms'       // 1. Dönem / 2. Dönem dikey etiketli 2 alt satır
  | 'quad-numbered'   // 1, 2, 3, 4 numaralı 4 alt satır (Lise 16/24/28/30)
  | 'single-open';    // Tek yüksek görüş alanı (ŞÖK)

export interface GradeColumnGroup {
  title: string;
  subHeaders: readonly string[];
  tintKind?: 'none' | 'summary' | 'final';
  widthWeight?: number;
}

export interface TeacherDocTemplateSpec {
  id: string;
  categoryId: TeacherDocCategoryId;
  engine: TeacherDocEngineKind;
  name: string;
  shortBadge: string;
  subtitle: string;
  officialDocTitle: string;
  panelCols: 1 | 2;
  rowsPerCol: number;
  studentsPerPage: number;
  identityMode: StudentIdentityCellMode;
  subRowScheme: SubRowScheme;
  showRowSequenceNumber: boolean;
  columnGroups: readonly GradeColumnGroup[];
}

export interface TeacherDocCategoryMeta {
  id: TeacherDocCategoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface BookletMiniPage<TSlot> {
  pageNumber: number;
  isBlank: boolean;
  slots: readonly TSlot[];
}

export interface BookletSpreadStrip<TSlot> {
  stripIndex: number;
  leftPage: BookletMiniPage<TSlot>;
  rightPage: BookletMiniPage<TSlot>;
}
