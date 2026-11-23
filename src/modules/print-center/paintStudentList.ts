import { PRINT_DPI, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { canvasToJpegBytes } from '../../system/storage/portraitPrintRenderer';
import { DEFAULT_PRINT_FONT_PT, printFont, type PrintFontPoint } from '../../system/storage/printTypography';
import type { TeacherChartPalette } from '../../system/storage/teacher-charts/types';
import type { ImpositionPage } from './printSpecs';

export function paintStudentList(
  canvas: HTMLCanvasElement,
  page: ImpositionPage,
  schoolName: string,
  palette: TeacherChartPalette,
  printFontPt?: PrintFontPoint,
  dpi = PRINT_DPI,
): void {
  const px = (mm: number) => (mm * dpi) / 25.4;
  canvas.width = Math.round(px(page.widthMm));
  canvas.height = Math.round(px(page.heightMm));
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Öğrenci sırası sayfası oluşturulamadı.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const margin = px(8);
  const usable = canvas.width - 2 * margin;
  const isLandscape = page.widthMm > page.heightMm;
  const columns = isLandscape
    ? [8, 24, 56, 188, page.widthMm - 8].map(px)
    : [8, 22, 48, 149, page.widthMm - 8].map(px);
  const headerY = px(34);
  const headerH = px(9);
  const rowH = px(isLandscape ? 10.6 : 10.35);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = printFont(700, 15, dpi);
  ctx.fillText(schoolName, margin, px(8), usable);
  ctx.fillStyle = palette.headingInk;
  ctx.font = printFont(700, 13, dpi);
  ctx.fillText('Öğrenci Sıra Listesi', margin, px(16));
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = printFont(600, 10, dpi);
  ctx.fillText(`${page.titleLabel ?? ''} · ${page.academicYear ?? ''}`, margin, px(24), usable * 0.47);
  if (page.teacherLabel) {
    ctx.textAlign = 'right';
    ctx.fillText(page.teacherLabel, canvas.width - margin, px(24), usable * 0.5);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.headerTint;
  ctx.fillRect(margin, headerY, usable, headerH);
  ctx.fillStyle = palette.headingInk;
  ctx.font = printFont(700, 10, dpi);
  ['Sıra', 'Okul No', 'Adı Soyadı', 'Not'].forEach((label, index) => {
    ctx.fillText(label, columns[index]! + px(2), headerY + headerH / 2);
  });

  const textSize = (printFontPt ?? DEFAULT_PRINT_FONT_PT) + 4;
  const rows = page.studentListRows ?? [];
  ctx.lineWidth = Math.max(1, px(0.18));
  ctx.strokeStyle = palette.gridHairline;
  rows.forEach(({ sequence, student }, index) => {
    const rowY = headerY + headerH + index * rowH;
    if (index % 2 === 1) {
      ctx.fillStyle = palette.summaryTint;
      ctx.fillRect(margin, rowY, usable, rowH);
    }
    ctx.fillStyle = palette.inkPrimary;
    ctx.font = printFont(500, textSize, dpi);
    [String(sequence), student.studentNumber, `${student.firstName} ${student.lastName}`].forEach((label, col) => {
      ctx.fillText(label, columns[col]! + px(2), rowY + rowH / 2, columns[col + 1]! - columns[col]! - px(4));
    });
  });

  const tableBottom = headerY + headerH + rows.length * rowH;
  ctx.beginPath();
  for (const x of columns) {
    ctx.moveTo(x, headerY);
    ctx.lineTo(x, tableBottom);
  }
  const horizontalRules = [headerY, ...Array.from({ length: rows.length + 1 }, (_, i) => headerY + headerH + i * rowH)];
  for (const y of horizontalRules) {
    ctx.moveTo(margin, y);
    ctx.lineTo(canvas.width - margin, y);
  }
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.inkSecondary;
  ctx.font = printFont(500, 9, dpi);
  ctx.fillText(`Sayfa ${(page.subPageIndex ?? 0) + 1} / ${page.subTotalPages ?? 1}`, canvas.width - margin, px(page.heightMm - 11));
}

export async function renderStudentListPage(
  canvas: HTMLCanvasElement,
  page: ImpositionPage,
  schoolName: string,
  palette: TeacherChartPalette,
  printFontPt?: PrintFontPoint,
): Promise<PdfRasterPage> {
  paintStudentList(canvas, page, schoolName, palette, printFontPt);
  return {
    jpegBytes: await canvasToJpegBytes(canvas, 0.96, PRINT_DPI),
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
    widthMm: page.widthMm,
    heightMm: page.heightMm,
  };
}
