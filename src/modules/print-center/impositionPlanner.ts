import type { PrintDuplexMode, PrintOrientation } from '../../system/desktop/desktopPrinter';
import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { mmToPx, PRINT_DPI } from '../../system/storage/binaryPrintFormats';
import {
  buildBookletA4Sheets,
  resolveTeacherChartConfig,
} from '../../system/storage/teacher-charts/paginationMath';
import { planIdCardPages } from './idCardImpositionPlanner';
import {
  planKutukImpositionPages,
  type KutukPlanContext,
} from './kutukImpositionPlanner';
import {
  normalizeSheetModeForProduct,
  PRINT_PRODUCTS,
  type ImpositionPage,
  type PrintableStudentEntry,
  type PrintProductId,
  type PrintSheetMode,
} from './printSpecs';

/** İZOLE MODÜL 04 DİZGİ PLANLAYICISI (.ts <= 240 satır) */

function makeGridSlots(
  chunk: readonly PrintableStudentEntry[],
  paperW: number,
  cols: number,
  cellW: number,
  cellH: number,
  topMm: number,
  gapY: number,
) {
  const rawGapX = (paperW - 28 - cols * cellW) / Math.max(1, cols - 1);
  const gapX = Number(Math.min(14, Math.max(3.5, rawGapX)).toFixed(2));
  const leftMm = Number(((paperW - (cols * cellW + (cols - 1) * gapX)) / 2).toFixed(2));
  return chunk.map((entry, idx) => ({
    entry,
    xMm: Number((leftMm + (idx % cols) * (cellW + gapX)).toFixed(2)),
    yMm: Number((topMm + Math.floor(idx / cols) * (cellH + gapY)).toFixed(2)),
    widthMm: cellW,
    heightMm: cellH,
  }));
}

function planAlbumChartPages(
  entries: readonly PrintableStudentEntry[],
  albumColumns: number,
  albumConfig?: Pick<AlbumTemplateConfig, 'chartTemplateId' | 'chartPaletteId' | 'courseName'>,
): ImpositionPage[] {
  const paperW = 210;
  const paperH = 297;
  const cols = Math.min(6, Math.max(2, Math.round(albumColumns)));
  const rows = 5;
  const pages: ImpositionPage[] = [];

  const pushSheet = (
    titleLabel: string,
    teacherLabel: string,
    academicYear: string,
    subPageIndex: number,
    subTotalPages: number,
    rosterEntries: readonly PrintableStudentEntry[],
    slotItems: readonly PrintableStudentEntry[],
  ) => {
    pages.push({
      pageIndex: pages.length, kind: 'album-sheet', titleLabel, teacherLabel, academicYear,
      subPageIndex, subTotalPages, rosterEntries,
      widthMm: paperW, heightMm: paperH, widthPx: mmToPx(paperW, PRINT_DPI), heightPx: mmToPx(paperH, PRINT_DPI),
      cols, rows, rulerLengthMm: 50,
      slots: makeGridSlots(slotItems, paperW, cols, 24, 32, 38, 8),
    });
  };

  if (albumConfig?.chartTemplateId === 'notebook-inner-combined') {
    const sheets = buildBookletA4Sheets(entries, 5, 3, true);
    const firstCls = entries[0]?.classRecord;
    sheets.forEach((sh) => {
      const sheetEntries = sh.strips
        .flatMap((st) => [...st.leftPage.slots, ...st.rightPage.slots])
        .filter((e): e is PrintableStudentEntry => e !== null);
      pushSheet('Tüm Seçili Şubeler', firstCls?.teacherName ?? '', firstCls?.academicYear ?? '', sh.sheetIndex, sheets.length, entries, sheetEntries);
    });
    return pages;
  }

  const byClass = new Map<string, PrintableStudentEntry[]>();
  for (const item of entries) {
    const list = byClass.get(item.student.classId) ?? [];
    list.push(item);
    byClass.set(item.student.classId, list);
  }

  for (const group of byClass.values()) {
    const cls = group[0]?.classRecord;
    const branchName = cls?.name ?? group[0]?.className ?? 'Sınıf Panosu';
    const teacher = cls?.teacherName ?? '';
    const year = cls?.academicYear ?? '';
    const { template } = resolveTeacherChartConfig(albumConfig ?? {}, branchName);

    if (template.engine === 'booklet-gradebook-inner' || template.engine === 'booklet-album-inner') {
      const isAlbum = template.engine === 'booklet-album-inner';
      const sheets = buildBookletA4Sheets(group, isAlbum ? 12 : 5, isAlbum ? 2 : 3, !isAlbum);
      sheets.forEach((sh) => {
        const sheetEntries = sh.strips
          .flatMap((st) => [...st.leftPage.slots, ...st.rightPage.slots])
          .filter((e): e is PrintableStudentEntry => e !== null);
        pushSheet(branchName, teacher, year, sh.sheetIndex, sheets.length, group, sheetEntries);
      });
    } else if (template.studentsPerPage === 0) {
      pushSheet(branchName, teacher, year, 0, 1, group, []);
    } else {
      const perPage = Math.max(1, template.studentsPerPage);
      const branchPages = Math.max(1, Math.ceil(group.length / perPage));
      for (let bPage = 0; bPage < branchPages; bPage += 1) {
        const chunk = group.slice(bPage * perPage, (bPage + 1) * perPage);
        pushSheet(branchName, teacher, year, bPage, branchPages, group, chunk);
      }
    }
  }
  return pages;
}

export function planImpositionPages(
  entries: readonly PrintableStudentEntry[],
  productId: Exclude<PrintProductId, 'e-okul-zip'>,
  rawMode: Exclude<PrintSheetMode, 'single-zip'>,
  albumColumns = 4,
  albumConfig?: Partial<AlbumTemplateConfig>,
  kutukContext?: KutukPlanContext,
  orientation: PrintOrientation = 'portrait',
  duplex?: PrintDuplexMode,
): ImpositionPage[] {
  const sheetMode = normalizeSheetModeForProduct(productId, rawMode);
  if (sheetMode === 'a4-student-list') return [];
  if (productId === 'album-chart' && (sheetMode === 'a4-kutuk-portrait' || sheetMode === 'a4-album-landscape')) {
    return planKutukImpositionPages(
      entries,
      sheetMode === 'a4-album-landscape',
      albumConfig,
      kutukContext,
    );
  }
  if (entries.length === 0) {
    if (productId === 'album-chart' && sheetMode === 'a4-album-portrait') {
      const { template } = resolveTeacherChartConfig(albumConfig ?? {});
      if (template.studentsPerPage === 0) {
        return [{
          pageIndex: 0, kind: 'album-sheet', titleLabel: 'Şube', teacherLabel: '', academicYear: '2026-2027',
          subPageIndex: 0, subTotalPages: 1, rosterEntries: [], widthMm: 210, heightMm: 297,
          widthPx: mmToPx(210, PRINT_DPI), heightPx: mmToPx(297, PRINT_DPI), cols: 4, rows: 5, rulerLengthMm: 50, slots: [],
        }];
      }
    }
    return [];
  }

  if (productId === 'pvc-id-card') {
    return planIdCardPages(entries, sheetMode === 'cr80-single', albumConfig, orientation, duplex);
  }
  if (productId === 'album-chart') {
    return planAlbumChartPages(entries, albumColumns, albumConfig);
  }

  const product = PRINT_PRODUCTS[productId];
  const isBiometric = productId === 'biometric-50x60';
  const isA4 = sheetMode === 'a4-grid';
  const isLandscape = orientation === 'landscape';
  const isBio10x15Card = isBiometric && !isA4;
  const paperW = isA4 ? (isLandscape ? 297 : 210) : (isLandscape ? 150 : 100);
  const paperH = isA4 ? (isLandscape ? 210 : 297) : (isLandscape ? 100 : 150);
  const rotated90 = !isA4 && isLandscape;
  // 10×15 cm Biyometrik 4'lü kartta ortada 1.0 mm temiz beyaz kesim boşluğu + alt okul/şube şeridi (5:6 oranı sabit)
  const baseW = isBio10x15Card ? 49.5 : product.widthMm;
  const baseH = isBio10x15Card ? 59.4 : product.heightMm;
  const slotW = rotated90 ? baseH : baseW;
  const slotH = rotated90 ? baseW : baseH;
  const cols = isA4
    ? (isLandscape ? (isBiometric ? 5 : 6) : (isBiometric ? 3 : 4))
    : 2;
  const rows = isA4 ? (isLandscape ? 3 : 4) : 2;
  const gapX = isA4
    ? (isLandscape ? (isBiometric ? 5.5 : 3.2) : (isBiometric ? 6 : 4))
    : (rotated90 ? 8 : (isBiometric ? 1.0 : 3.2));
  const gapY = isA4
    ? (isLandscape ? 5.5 : 6.2)
    : (rotated90 ? (isBiometric ? 1.0 : 4) : (isBiometric ? 9.5 : 5.2));
  const topMm = isA4
    ? (isLandscape ? 10.5 : 13.5)
    : (rotated90 ? (isBiometric ? 0 : 3) : (isBiometric ? 2.0 : 8.5));
  const footerStudioStrip = isBio10x15Card && !rotated90;
  const rulerLengthMm = rotated90 || footerStudioStrip ? 0 : 50;
  const perPage = cols * rows;
  const leftMm = Number(Math.max(0, (paperW - (cols * slotW + (cols - 1) * gapX)) / 2).toFixed(2));
  const expanded =
    sheetMode === '10x15-4up-student'
      ? entries.flatMap((entry) => Array.from({ length: perPage }, () => entry))
      : [...entries];

  const pages: ImpositionPage[] = [];
  for (let offset = 0; offset < expanded.length; offset += perPage) {
    const chunk = expanded.slice(offset, offset + perPage);
    pages.push({
      pageIndex: pages.length,
      kind: 'portrait-sheet',
      widthMm: paperW,
      heightMm: paperH,
      widthPx: mmToPx(paperW, PRINT_DPI),
      heightPx: mmToPx(paperH, PRINT_DPI),
      cols,
      rows,
      rulerLengthMm,
      ...(footerStudioStrip ? { footerStudioStrip: true } : {}),
      slots: chunk.map((entry, idx) => ({
        entry,
        xMm: Number((leftMm + (idx % cols) * (slotW + gapX)).toFixed(2)),
        yMm: Number((topMm + Math.floor(idx / cols) * (slotH + gapY)).toFixed(2)),
        widthMm: slotW,
        heightMm: slotH,
        ...(rotated90 ? { rotated90: true } : {}),
      })),
    });
  }
  return pages;
}
