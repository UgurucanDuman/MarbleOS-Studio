import { mmToPx, PRINT_DPI } from '../binaryPrintFormats';
import { printFont, type PrintFontPoint } from '../printTypography';
import {
  drawCentered3x4Portrait,
  drawChartLine,
  drawRotatedLinesLabel,
  type TabularCanvasStudent,
} from './canvasPrimitives';
import {
  TABLE_SHEET,
  identityFontPoints,
  layoutStudentNameLines,
  teacherSheetHead,
} from './tabularPrintLayout';
import type { TeacherChartPalette, TeacherDocTemplateSpec } from './types';

interface TabularPageHead {
  ctx: CanvasRenderingContext2D;
  widthPx: number;
  heightPx: number;
  panelW: number;
  panelCount: number;
  palette: TeacherChartPalette;
  schoolName: string;
  academicYear: string;
  className: string;
  teacherName: string;
  courseName: string;
  title: string;
  pageNumber: number;
  totalPages: number;
  isSok: boolean;
}

export function drawTabularPageLabels({
  ctx, widthPx, heightPx, panelW, panelCount, palette, schoolName, academicYear, className,
  teacherName, courseName, title, pageNumber, totalPages, isSok,
}: TabularPageHead) {
  const margin = mmToPx(TABLE_SHEET.marginMm);
  const contentWidth = widthPx - 2 * margin;
  const midX = widthPx / 2;
  const { school, context } = teacherSheetHead(schoolName, academicYear, courseName, isSok);
  const availableMm = TABLE_SHEET.widthMm - 2 * TABLE_SHEET.marginMm;

  ctx.fillStyle = palette.accent;
  ctx.fillRect(margin, mmToPx(5.2), contentWidth, mmToPx(0.52));
  drawChartLine(ctx, margin, mmToPx(6.25), widthPx - margin, mmToPx(6.25), palette.gridHairline, mmToPx(0.14));

  ctx.fillStyle = palette.inkPrimary;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.font = printFont(700, identityFontPoints(school.length, 12.6, availableMm - 28));
  ctx.fillText(school, midX, mmToPx(7.4), contentWidth);

  ctx.fillStyle = palette.inkSecondary;
  ctx.font = printFont(600, 8.6);
  ctx.fillText(context, midX, mmToPx(12.6), contentWidth);

  ctx.fillStyle = palette.headingInk;
  ctx.font = printFont(700, 11.2);
  ctx.fillText(title, midX, mmToPx(16.7), contentWidth);

  drawChartLine(ctx, margin, mmToPx(21.4), widthPx - margin, mmToPx(21.4), palette.gridHairline, mmToPx(0.14));

  ctx.font = printFont(700, 9.6);
  ctx.textAlign = 'left';
  ctx.fillStyle = palette.headingInk;
  ctx.fillText(className || 'ŞUBE', margin, mmToPx(22.4), contentWidth * 0.65);

  ctx.textAlign = 'right';
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = printFont(700, 8.8);
  ctx.fillText(`Sayfa No: ${pageNumber} / ${totalPages}`, widthPx - margin, mmToPx(22.6));

  const signatureY = heightPx - mmToPx(13.8);
  ctx.textAlign = 'center';
  if (!isSok) {
    const leftCenter = margin + panelW * (panelCount === 2 ? 0.5 : 0.25);
    ctx.fillStyle = palette.inkPrimary;
    ctx.font = printFont(700, 8);
    ctx.fillText(
      teacherName ? `Rehber Öğrt.: ${teacherName}` : 'Öğretmenin Adı Soyadı',
      leftCenter,
      signatureY,
      contentWidth / 2 - margin,
    );
    ctx.fillStyle = palette.inkSecondary;
    ctx.font = printFont(500, 7.5);
    ctx.fillText('Ders / Sınıf Öğretmeni · İmza', leftCenter, signatureY + mmToPx(3.5));
  }
  const rightCenter = widthPx - margin - panelW * (panelCount === 2 ? 0.5 : 0.25);
  ctx.fillStyle = palette.inkSecondary;
  ctx.font = printFont(500, 7.5);
  ctx.fillText('....../....../20....', rightCenter, signatureY);
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = printFont(700, 8);
  ctx.fillText('Okul Müdürü', rightCenter, signatureY + mmToPx(3.5));
}

export function drawTabularIdentityCell(options: {
  ctx: CanvasRenderingContext2D;
  template: TeacherDocTemplateSpec;
  palette: TeacherChartPalette;
  stu: TabularCanvasStudent | null;
  idLeft: number;
  rTop: number;
  identityW: number;
  rowH: number;
  identityMm: number;
  nameMm: number;
  rowMm: number;
  showStudentNumbers: boolean;
  printFontPt: PrintFontPoint;
  borderThin: number;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  px: (mm: number) => number;
}): void {
  const {
    ctx, template, palette, stu, idLeft, rTop, identityW, rowH,
    identityMm, nameMm, rowMm, showStudentNumbers, printFontPt,
    borderThin, renderedPortraits, px,
  } = options;

  if (template.identityMode === 'stacked-horizontal') {
    const labelH = Math.min(px(9), rowH * 0.32);
    ctx.fillStyle = palette.summaryTint;
    ctx.fillRect(idLeft, rTop + rowH - labelH, identityW, labelH);
    drawChartLine(ctx, idLeft, rTop + rowH - labelH, idLeft + identityW, rTop + rowH - labelH, palette.gridHairline, borderThin);
    if (!stu) return;
    const portrait = stu.photoId ? renderedPortraits.get(stu.photoId) : undefined;
    const { pX, pY, pW, pH } = drawCentered3x4Portrait(ctx, portrait, idLeft + px(1), rTop + px(0.55), identityW - px(2), rowH - labelH - px(1.1));
    ctx.strokeStyle = palette.gridHairline;
    ctx.lineWidth = Math.max(1, borderThin * 0.85);
    ctx.strokeRect(pX, pY, pW, pH);
    const labelHMm = Math.min(9, rowMm * 0.32);
    const { lines, fontPt } = layoutStudentNameLines({
      studentNumber: stu.studentNumber,
      firstName: stu.firstName,
      lastName: stu.lastName,
      showStudentNumbers,
      targetPoints: printFontPt,
      availableLengthMm: identityMm - 1.1,
      availableThicknessMm: labelHMm - 0.55,
      maxLines: 3,
    });
    ctx.fillStyle = palette.inkPrimary;
    ctx.font = printFont(700, fontPt);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const stepPx = ((fontPt * PRINT_DPI) / 72) * 1.08;
    const baseCenterY = rTop + rowH - labelH / 2 - ((lines.length - 1) * stepPx) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, idLeft + identityW / 2, baseCenterY + i * stepPx, identityW - px(0.6));
    });
    return;
  }

  const nameStripW = px(nameMm);
  const stripX = idLeft + identityW - nameStripW;
  ctx.fillStyle = palette.summaryTint;
  ctx.fillRect(stripX, rTop, nameStripW, rowH);
  drawChartLine(ctx, stripX, rTop, stripX, rTop + rowH, palette.gridHairline, borderThin);
  if (!stu) return;
  const portrait = stu.photoId ? renderedPortraits.get(stu.photoId) : undefined;
  const { pX, pY, pW, pH } = drawCentered3x4Portrait(ctx, portrait, idLeft + px(0.55), rTop + px(0.5), identityW - nameStripW - px(1.1), rowH - px(1.0));
  ctx.strokeStyle = palette.gridHairline;
  ctx.lineWidth = Math.max(1, borderThin * 0.85);
  ctx.strokeRect(pX, pY, pW, pH);
  const { lines, fontPt } = layoutStudentNameLines({
    studentNumber: stu.studentNumber,
    firstName: stu.firstName,
    lastName: stu.lastName,
    showStudentNumbers,
    targetPoints: printFontPt,
    availableLengthMm: rowMm - 0.85,
    availableThicknessMm: nameMm - 0.5,
    maxLines: 4,
  });
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = printFont(700, fontPt);
  drawRotatedLinesLabel(ctx, lines, stripX + nameStripW / 2, rTop + rowH / 2, ((fontPt * PRINT_DPI) / 72) * 1.07, rowH - px(0.6));
}
