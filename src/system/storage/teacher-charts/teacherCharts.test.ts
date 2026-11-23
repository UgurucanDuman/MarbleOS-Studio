import { expect, test, vi } from 'vitest';
import { albumConfigPatchSchema } from '../../schemas/studioSchemas';
import { splitBalancedStudentLines } from './canvasPrimitives';
import {
  TEACHER_CATEGORY_META,
  TEACHER_DOC_TEMPLATES,
  TEACHER_INK_COLOR_LIST,
  TEACHER_PALETTE_LIST,
} from './catalog';
import { paintTeacherBookletSheet } from './drawBookletCanvas';
import { paintTeacherTabularSheet } from './drawTabularCanvas';
import {
  buildBookletA4Sheets,
  detectDefaultTemplateForBranch,
  paginateTabularRoster,
  resolveTeacherChartConfig,
} from './paginationMath';
import {
  estimateBoldTextEm,
  fitHeaderCellPoints,
  fitStudentLabelPoints,
  getIdentityDimensions,
  TABLE_SHEET,
} from './tabularPrintLayout';

function makeMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(), restore: vi.fn(), setTransform: vi.fn(),
    fillRect: vi.fn(), strokeRect: vi.fn(), translate: vi.fn(),
    rotate: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
    fillStyle: '#fff', strokeStyle: '#000', lineWidth: 1,
    font: '', textAlign: 'left', textBaseline: 'top', globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

test('catalog covers 5 categories, 8 school palettes, 12 zero-orange ink colors, and unclipped headers', () => {
  expect(TEACHER_CATEGORY_META).toHaveLength(5);
  expect(TEACHER_PALETTE_LIST).toHaveLength(8);
  expect(TEACHER_INK_COLOR_LIST).toHaveLength(12);
  expect(new Set(TEACHER_INK_COLOR_LIST.map((i) => i.id)).size).toBe(12);
  const ids = TEACHER_DOC_TEMPLATES.map((t) => t.id);
  expect(new Set(ids).size).toBe(ids.length);

  const forbiddenOrangeHex = /#(f97316|fb923c|ea580c|ff6b00|ff8800|f59e0b)/i;
  for (const pal of TEACHER_PALETTE_LIST) {
    for (const color of [
      pal.inkPrimary, pal.inkSecondary, pal.headingInk, pal.accent,
      pal.headerTint, pal.summaryTint, pal.finalTint, pal.gridBorder, pal.gridHairline,
    ]) {
      expect(color).not.toMatch(forbiddenOrangeHex);
    }
  }
  for (const ink of TEACHER_INK_COLOR_LIST) {
    for (const color of [ink.swatch, ink.inkPrimary, ink.inkSecondary, ink.headingInk]) {
      expect(color).not.toMatch(forbiddenOrangeHex);
    }
  }

  const resolvedCustomInk = resolveTeacherChartConfig(
    { chartPaletteId: 'emerald-ink', chartInkId: 'anatolian-burgundy' },
    '1-A',
  );
  expect(resolvedCustomInk.palette.headerTint).toBe('#ecfdf5');
  expect(resolvedCustomInk.palette.inkPrimary).toBe('#3b101d');
  expect(resolvedCustomInk.palette.headingInk).toBe('#881337');

  const pt8 = fitStudentLabelPoints('715 BÜLENT', 'DEMİR UÇAR', 8, 15.2);
  const pt9 = fitStudentLabelPoints('715 BÜLENT', 'DEMİR UÇAR', 9, 15.2);
  const pt10 = fitStudentLabelPoints('715 BÜLENT', 'DEMİR UÇAR', 10, 15.2);
  expect(pt8).toBeLessThan(pt9);
  expect(pt9).toBeLessThan(pt10);

  // 15 sütunlu detaylı lise şablonunda Dönem / Ağırlıklı / Performans başlıklarının taşmadığı doğrulanır
  const classic32 = TEACHER_DOC_TEMPLATES.find((t) => t.id === 'high-classic-32')!;
  const dims = getIdentityDimensions(classic32);
  const panelMm = (TABLE_SHEET.widthMm - 2 * TABLE_SHEET.marginMm - TABLE_SHEET.panelGapMm) / 2;
  const gridMm = panelMm - dims.sequenceMm - dims.identityMm - dims.periodMm;
  const totalW = classic32.columnGroups.reduce((s, g) => s + g.subHeaders.length * (g.widthWeight ?? 1), 0);
  for (const grp of classic32.columnGroups) {
    const spanMm = ((grp.subHeaders.length * (grp.widthWeight ?? 1)) / totalW) * gridMm;
    const pt = fitHeaderCellPoints(grp.title, 7.0, spanMm, false);
    const renderedMm = (estimateBoldTextEm(grp.title) * 0.96 * pt * 25.4) / 72;
    expect(renderedMm).toBeLessThanOrEqual(spanMm);
  }
});

test('detectDefaultTemplateForBranch maps Turkish preschool, primary, middle, and high school branches accurately', () => {
  expect(detectDefaultTemplateForBranch('Papatyalar Anaokulu').id).toBe('preschool-26');
  expect(detectDefaultTemplateForBranch('Anasınıfı-A').id).toBe('preschool-26');
  expect(detectDefaultTemplateForBranch('1-A').id).toBe('primary-123-26');
  expect(detectDefaultTemplateForBranch('3/B').id).toBe('primary-123-26');
  expect(detectDefaultTemplateForBranch('4-A').id).toBe('primary-4-26');
  expect(detectDefaultTemplateForBranch('5-C').id).toBe('middle-5678-26');
  expect(detectDefaultTemplateForBranch('8-D').id).toBe('middle-5678-26');
  expect(detectDefaultTemplateForBranch('9-A').id).toBe('high-28');
  expect(detectDefaultTemplateForBranch('12-FEN').id).toBe('high-28');
  expect(splitBalancedStudentLines('715', 'BÜLENT DEMİR', 'UÇAR', true)).toEqual(['715 BÜLENT', 'DEMİR UÇAR']);
  expect(splitBalancedStudentLines('753', 'HASAN TALHA', 'PALA', true)).toEqual(['753 HASAN', 'TALHA PALA']);
  expect(splitBalancedStudentLines('724', 'MUSTAFA URAS', 'ERGEN', true)).toEqual(['724 MUSTAFA', 'URAS ERGEN']);
});

test('paginateTabularRoster pads empty numbered rows up to template capacity and paginates larger classes', () => {
  const tpl26 = detectDefaultTemplateForBranch('6-A');
  const singlePage = paginateTabularRoster(['A', 'B', 'C', 'D'], tpl26);
  expect(singlePage).toHaveLength(1);
  expect(singlePage[0]!.leftColumn).toHaveLength(13);
  expect(singlePage[0]!.rightColumn).toHaveLength(13);
  expect(singlePage[0]!.leftColumn[0]).toEqual({ sequenceNumber: 1, student: 'A' });
  expect(singlePage[0]!.leftColumn[4]).toEqual({ sequenceNumber: 5, student: null });
  expect(singlePage[0]!.rightColumn[0]).toEqual({ sequenceNumber: 14, student: null });
  expect(singlePage[0]!.rightColumn[12]).toEqual({ sequenceNumber: 26, student: null });

  const thirtyStudents = Array.from({ length: 30 }, (_, i) => `S-${i + 1}`);
  const twoPages = paginateTabularRoster(thirtyStudents, tpl26);
  expect(twoPages).toHaveLength(2);
  expect(twoPages[1]!.leftColumn[0]).toEqual({ sequenceNumber: 27, student: 'S-27' });
  expect(twoPages[1]!.rightColumn[12]).toEqual({ sequenceNumber: 52, student: null });
});

test('buildBookletA4Sheets computes physical saddle-stitch duplex spreads for 6-up notebook and 4-up pocket album', () => {
  const items = Array.from({ length: 14 }, (_, i) => `Stu-${i + 1}`);
  const notebookSheets = buildBookletA4Sheets(items, 5, 3, true);
  expect(notebookSheets).toHaveLength(2);
  expect(notebookSheets[0]!.strips.map((s) => [s.leftPage.pageNumber, s.rightPage.pageNumber])).toEqual([
    [12, 1], [10, 3], [8, 5],
  ]);
  expect(notebookSheets[1]!.strips.map((s) => [s.leftPage.pageNumber, s.rightPage.pageNumber])).toEqual([
    [2, 11], [4, 9], [6, 7],
  ]);

  const albumSheets = buildBookletA4Sheets(items, 12, 2, false);
  expect(albumSheets).toHaveLength(2);
  expect(albumSheets[0]!.strips.map((s) => [s.leftPage.pageNumber, s.rightPage.pageNumber])).toEqual([
    [8, 1], [6, 3],
  ]);
  expect(albumSheets[1]!.strips.map((s) => [s.leftPage.pageNumber, s.rightPage.pageNumber])).toEqual([
    [2, 7], [4, 5],
  ]);
});

test('albumConfigPatchSchema strictly validates chartTemplateId, chartPaletteId, chartInkId, and formula-safe courseName', () => {
  const valid = albumConfigPatchSchema.parse({
    chartTemplateId: 'notebook-cover-front',
    chartPaletteId: 'anatolian-teal',
    chartInkId: 'obsidian-black',
    courseName: 'Matematik',
    coverTitle: 'Öğretmen Not Defteri',
    coverSubtitle: '2026-2027 Özel Baskı',
    customCoverDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    customCoverMode: 'full-bleed',
  });
  expect(valid.chartTemplateId).toBe('notebook-cover-front');
  expect(valid.chartInkId).toBe('obsidian-black');

  expect(() => albumConfigPatchSchema.parse({ chartTemplateId: 'non-existent' })).toThrow();
  expect(() => albumConfigPatchSchema.parse({ chartPaletteId: 'orange-glow' })).toThrow();
  expect(() => albumConfigPatchSchema.parse({ chartInkId: 'neon-orange' })).toThrow();
  expect(() => albumConfigPatchSchema.parse({ courseName: '=SUM(A1:A5)' })).toThrow();
  expect(() => albumConfigPatchSchema.parse({ customCoverDataUrl: 'javascript:alert(1)' })).toThrow();
});

test('300 DPI tabular and booklet canvas renderers execute cleanly across template modes', () => {
  const ctx = makeMockCtx();
  const { template, palette } = resolveTeacherChartConfig(
    { chartTemplateId: 'high-classic-32', chartPaletteId: 'classic-navy', chartInkId: 'meb-navy', courseName: 'Fizik' },
    '10-A',
  );
  const pages = paginateTabularRoster(
    [{ studentNumber: '417', firstName: 'Hafize', lastName: 'Güven', photoId: null }],
    template,
  );
  paintTeacherTabularSheet({
    ctx, widthPx: 2480, heightPx: 3508, template, palette,
    schoolName: 'Atatürk Anadolu Lisesi', academicYear: '2026-2027', className: '10-A',
    teacherName: 'Ayşe Yılmaz', courseName: 'Fizik', showStudentNumbers: true, showTeacherBadge: true,
    printFontPt: 10, pageNumber: 1, totalPages: 1,
    leftColumn: pages[0]!.leftColumn, rightColumn: pages[0]!.rightColumn, renderedPortraits: new Map(),
  });

  const bookletCfg = resolveTeacherChartConfig({ chartTemplateId: 'notebook-cover-back' }, '10-A');
  paintTeacherBookletSheet({
    ctx, widthPx: 2480, heightPx: 3508, template: bookletCfg.template, palette: bookletCfg.palette,
    schoolName: 'Atatürk Anadolu Lisesi', academicYear: '2026-2027', className: '10-A',
    teacherName: 'Ayşe Yılmaz', courseName: 'Fizik', showStudentNumbers: true, strips: [], renderedPortraits: new Map(),
  });
  const frontCfg = resolveTeacherChartConfig({ chartTemplateId: 'notebook-cover-front' }, '10-A');
  const fakeCover = { width: 600, height: 800 } as unknown as HTMLCanvasElement;
  paintTeacherBookletSheet({
    ctx, widthPx: 2480, heightPx: 3508, template: frontCfg.template, palette: frontCfg.palette,
    schoolName: 'Atatürk Anadolu Lisesi', academicYear: '2026-2027', className: '10-A',
    teacherName: 'Ayşe Yılmaz', courseName: 'Fizik', coverTitle: 'Özel Kapak', coverSubtitle: '2026-2027',
    customCoverBitmap: fakeCover, customCoverMode: 'full-bleed', showStudentNumbers: true,
    printFontPt: 9, strips: [], renderedPortraits: new Map(),
  });
  expect(ctx.drawImage).toHaveBeenCalled();
  expect(ctx.fillRect).toHaveBeenCalled();
  expect(ctx.fillText).toHaveBeenCalled();
});
