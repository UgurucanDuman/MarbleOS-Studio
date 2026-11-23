import {
  TEACHER_CATEGORY_META,
  TEACHER_DOC_TEMPLATES,
  TEACHER_INK_COLOR_LIST,
  TEACHER_PALETTE_LIST,
} from './catalog';
import {
  TEACHER_CHART_INKS,
  TEACHER_CHART_PALETTES,
  type BookletMiniPage,
  type BookletSpreadStrip,
  type TeacherChartInkId,
  type TeacherChartInkOption,
  type TeacherChartPalette,
  type TeacherChartPaletteId,
  type TeacherDocCategoryMeta,
  type TeacherDocTemplateSpec,
} from './types';

/**
 * İZOLE SİSTEM SAYFALAMA & FORMA MOTORU:
 * 1) Tablo çizelgelerinde tam şablon mevcuduna (16/24/26/28/30/32) boş satır tamamlama
 * 2) Kes-Katla Cep Defteri (6 cep/A4) ve Cep Albümü (4 cep/A4) gerçek kitapçık forma numarası (12-1, 10-3, 8-5)
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const TEMPLATE_BY_ID = new Map<string, TeacherDocTemplateSpec>(
  TEACHER_DOC_TEMPLATES.map((t) => [t.id, t]),
);
const PALETTE_BY_ID = new Map<TeacherChartPaletteId, TeacherChartPalette>(
  TEACHER_PALETTE_LIST.map((p) => [p.id, p]),
);
const INK_BY_ID = new Map<TeacherChartInkId, TeacherChartInkOption>(
  TEACHER_INK_COLOR_LIST.map((ink) => [ink.id, ink]),
);
const PALETTE_SET = new Set<string>(TEACHER_CHART_PALETTES);
const INK_SET = new Set<string>(TEACHER_CHART_INKS);

export function isValidTeacherChartTemplateId(val: unknown): boolean {
  return typeof val === 'string' && TEMPLATE_BY_ID.has(val);
}

export function isValidTeacherChartPaletteId(val: unknown): val is TeacherChartPaletteId {
  return typeof val === 'string' && PALETTE_SET.has(val);
}

export function isValidTeacherChartInkId(val: unknown): val is TeacherChartInkId {
  return typeof val === 'string' && INK_SET.has(val);
}

export function detectDefaultTemplateForBranch(className?: string | null): TeacherDocTemplateSpec {
  const raw = (className ?? '').trim().toLocaleLowerCase('tr-TR');
  if (
    raw.startsWith('0-') ||
    raw.includes('anaokul') ||
    raw.includes('anasınıf') ||
    raw.includes('anasinif') ||
    raw.includes('papatya') ||
    raw.includes('kelebek') ||
    raw.includes('minik')
  ) {
    return TEMPLATE_BY_ID.get('preschool-26')!;
  }
  const match = /^(\d{1,2})(?:\b|[-./\s]|[a-zçğıöşü])/i.exec(raw);
  const gradeNum = match ? Number(match[1]) : null;
  if (gradeNum !== null) {
    if (gradeNum >= 1 && gradeNum <= 3) return TEMPLATE_BY_ID.get('primary-123-26')!;
    if (gradeNum === 4) return TEMPLATE_BY_ID.get('primary-4-26')!;
    if (gradeNum >= 5 && gradeNum <= 8) return TEMPLATE_BY_ID.get('middle-5678-26')!;
    if (gradeNum >= 9 && gradeNum <= 12) return TEMPLATE_BY_ID.get('high-28')!;
  }
  return TEMPLATE_BY_ID.get('middle-5678-26')!;
}

export function resolveTeacherChartConfig(
  config: {
    chartTemplateId?: string;
    chartPaletteId?: TeacherChartPaletteId;
    chartInkId?: TeacherChartInkId;
    courseName?: string;
  },
  className?: string | null,
): {
  category: TeacherDocCategoryMeta;
  template: TeacherDocTemplateSpec;
  palette: TeacherChartPalette;
  activeInk: TeacherChartInkOption;
  courseName: string;
} {
  const template =
    (config.chartTemplateId ? TEMPLATE_BY_ID.get(config.chartTemplateId) : undefined) ??
    detectDefaultTemplateForBranch(className);
  const category =
    TEACHER_CATEGORY_META.find((c) => c.id === template.categoryId) ?? TEACHER_CATEGORY_META[0]!;
  const basePalette =
    (config.chartPaletteId ? PALETTE_BY_ID.get(config.chartPaletteId) : undefined) ??
    TEACHER_PALETTE_LIST[0]!;
  const activeInk =
    (config.chartInkId ? INK_BY_ID.get(config.chartInkId) : undefined) ??
    INK_BY_ID.get(basePalette.defaultInkId) ??
    TEACHER_INK_COLOR_LIST[0]!;
  const palette: TeacherChartPalette = config.chartInkId
    ? {
        ...basePalette,
        inkPrimary: activeInk.inkPrimary,
        inkSecondary: activeInk.inkSecondary,
        headingInk: activeInk.headingInk,
      }
    : basePalette;
  return {
    category,
    template,
    palette,
    activeInk,
    courseName: (config.courseName ?? '').trim(),
  };
}

export interface NumberedRosterRow<TStudent> {
  sequenceNumber: number;
  student: TStudent | null;
}

export function paginateTabularRoster<TStudent>(
  students: readonly TStudent[],
  template: TeacherDocTemplateSpec,
): Array<{
  pageIndex: number;
  leftColumn: NumberedRosterRow<TStudent>[];
  rightColumn: NumberedRosterRow<TStudent>[];
}> {
  const perPage = Math.max(1, template.studentsPerPage);
  const pageCount = Math.max(1, Math.ceil(students.length / perPage));
  const pages: Array<{
    pageIndex: number;
    leftColumn: NumberedRosterRow<TStudent>[];
    rightColumn: NumberedRosterRow<TStudent>[];
  }> = [];

  for (let p = 0; p < pageCount; p += 1) {
    const baseOffset = p * perPage;
    const leftColumn: NumberedRosterRow<TStudent>[] = [];
    const rightColumn: NumberedRosterRow<TStudent>[] = [];

    for (let r = 0; r < template.rowsPerCol; r += 1) {
      const leftIdx = baseOffset + r;
      leftColumn.push({
        sequenceNumber: leftIdx + 1,
        student: students[leftIdx] ?? null,
      });
      if (template.panelCols === 2) {
        const rightIdx = baseOffset + template.rowsPerCol + r;
        rightColumn.push({
          sequenceNumber: rightIdx + 1,
          student: students[rightIdx] ?? null,
        });
      }
    }
    pages.push({ pageIndex: p, leftColumn, rightColumn });
  }
  return pages;
}

export function buildBookletA4Sheets<TItem>(
  items: readonly TItem[],
  itemsPerMiniPage: number,
  stripsPerA4: 2 | 3,
  padMiniPageSlots: boolean,
): Array<{
  sheetIndex: number;
  totalBookletPages: number;
  strips: BookletSpreadStrip<TItem | null>[];
}> {
  const miniPagesPerDuplexPair = stripsPerA4 * 4;
  const rawMiniCount = Math.max(1, Math.ceil(items.length / Math.max(1, itemsPerMiniPage)));
  const totalBookletPages = Math.max(
    miniPagesPerDuplexPair,
    Math.ceil(rawMiniCount / miniPagesPerDuplexPair) * miniPagesPerDuplexPair,
  );

  const miniPages: BookletMiniPage<TItem | null>[] = [];
  for (let m = 0; m < totalBookletPages; m += 1) {
    const start = m * itemsPerMiniPage;
    const slice = items.slice(start, start + itemsPerMiniPage);
    const padded: Array<TItem | null> = [...slice];
    if (padMiniPageSlots) {
      while (padded.length < itemsPerMiniPage) padded.push(null);
    }
    miniPages.push({
      pageNumber: m + 1,
      isBlank: slice.length === 0,
      slots: padded,
    });
  }

  const sheets: Array<{
    sheetIndex: number;
    totalBookletPages: number;
    strips: BookletSpreadStrip<TItem | null>[];
  }> = [];
  const sheetPairs = totalBookletPages / miniPagesPerDuplexPair;
  for (let sp = 0; sp < sheetPairs; sp += 1) {
    const frontStrips: BookletSpreadStrip<TItem | null>[] = [];
    const backStrips: BookletSpreadStrip<TItem | null>[] = [];
    for (let s = 0; s < stripsPerA4; s += 1) {
      const pairIdx = sp * stripsPerA4 + s;
      const oddFront = miniPages[pairIdx * 2]!;
      const evenFrontPartner = miniPages[totalBookletPages - 1 - pairIdx * 2]!;
      const evenBack = miniPages[pairIdx * 2 + 1]!;
      const oddBackPartner = miniPages[totalBookletPages - 2 - pairIdx * 2]!;
      frontStrips.push({ stripIndex: s, leftPage: evenFrontPartner, rightPage: oddFront });
      backStrips.push({ stripIndex: s, leftPage: evenBack, rightPage: oddBackPartner });
    }
    sheets.push({ sheetIndex: sheets.length, totalBookletPages, strips: frontStrips });
    sheets.push({ sheetIndex: sheets.length, totalBookletPages, strips: backStrips });
  }
  return sheets;
}
