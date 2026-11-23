import { mmToPx, PRINT_DPI } from '../binaryPrintFormats';
import { DEFAULT_PRINT_FONT_PT, printFont, type PrintFontPoint } from '../printTypography';
import {
  drawChartLine,
  drawRotatedLabel,
  flattenColumnGroups,
  type TabularCanvasStudent,
} from './canvasPrimitives';
import { drawTabularIdentityCell, drawTabularPageLabels } from './drawTabularHead';
import type { NumberedRosterRow } from './paginationMath';
import { TABLE_SHEET, fitHeaderCellPoints, getIdentityDimensions } from './tabularPrintLayout';
import type { TeacherChartPalette, TeacherDocTemplateSpec } from './types';

export type { TabularCanvasStudent } from './canvasPrimitives';

/** İZOLE 300 DPI FOTOKOPİ-GÜVENLİ TABLO ÇİZELGE RASTER MOTORU (.ts <= 240 satır) */

export function paintTeacherTabularSheet(options: {
  ctx: CanvasRenderingContext2D;
  widthPx: number;
  heightPx: number;
  template: TeacherDocTemplateSpec;
  palette: TeacherChartPalette;
  schoolName: string;
  academicYear: string;
  className: string;
  teacherName: string;
  courseName: string;
  showStudentNumbers: boolean;
  showTeacherBadge: boolean;
  printFontPt?: PrintFontPoint;
  pageNumber: number;
  totalPages: number;
  leftColumn: readonly NumberedRosterRow<TabularCanvasStudent>[];
  rightColumn: readonly NumberedRosterRow<TabularCanvasStudent>[];
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
}): void {
  const {
    ctx, widthPx, heightPx, template, palette, schoolName, academicYear, className,
    teacherName, courseName, showStudentNumbers, showTeacherBadge,
    printFontPt = DEFAULT_PRINT_FONT_PT, pageNumber, totalPages,
    leftColumn, rightColumn, renderedPortraits,
  } = options;
  const px = (mm: number) => mmToPx(mm, PRINT_DPI);
  const borderThin = px(0.16);
  const borderMid = px(0.24);
  const borderStrong = px(0.32);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const marginX = px(TABLE_SHEET.marginMm);
  const isSok = template.engine === 'tabular-sok';
  const tableTop = px(TABLE_SHEET.topMm);
  const tableBottom = heightPx - px(TABLE_SHEET.footerMm);
  const tableH = tableBottom - tableTop;
  const headerH = px(TABLE_SHEET.headerMm);
  const rowH = (tableH - headerH) / Math.max(1, template.rowsPerCol);
  const colGap = template.panelCols === 2 ? px(TABLE_SHEET.panelGapMm) : 0;
  const panelW = (widthPx - marginX * 2 - colGap) / template.panelCols;
  const dimensions = getIdentityDimensions(template);
  const seqW = dimensions.sequenceMm ? px(dimensions.sequenceMm) : 0;
  const identityW = px(dimensions.identityMm);
  const subTagW = dimensions.periodMm ? px(dimensions.periodMm) : 0;
  const rowMm = (297 - TABLE_SHEET.topMm - TABLE_SHEET.footerMm - TABLE_SHEET.headerMm) / template.rowsPerCol;

  drawTabularPageLabels({
    ctx, widthPx, heightPx, panelW, panelCount: template.panelCols, palette, schoolName,
    academicYear, className, courseName, title: template.officialDocTitle, pageNumber, totalPages, isSok,
    teacherName: showTeacherBadge ? teacherName.trim() : '',
  });

  const flatCols = flattenColumnGroups(template.columnGroups, palette);
  const totalColWeight = Math.max(1, flatCols.reduce((acc, c) => acc + c.weight, 0));

  const panels = template.panelCols === 2 ? [leftColumn, rightColumn] : [leftColumn];
  panels.forEach((rows, pIdx) => {
    const pLeft = marginX + pIdx * (panelW + colGap);
    const gridLeft = pLeft + seqW + identityW + subTagW;
    const gridW = Math.max(px(20), panelW - (seqW + identityW + subTagW));
    const groupTopH = isSok ? headerH : headerH * 0.54;

    ctx.fillStyle = palette.headerTint;
    ctx.fillRect(pLeft, tableTop, panelW, headerH);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const idCenter = pLeft + seqW + (identityW + subTagW) / 2;
    const idHeaderW = identityW + subTagW - px(1);
    ctx.fillStyle = palette.headingInk;
    ctx.font = printFont(700, 7.4);
    ctx.fillText(showStudentNumbers ? 'Okul No · Adı Soyadı' : 'Adı Soyadı', idCenter, tableTop + headerH * 0.35, idHeaderW);
    ctx.fillStyle = palette.inkSecondary;
    ctx.font = printFont(700, 6.9);
    ctx.fillText('Fotoğraf', idCenter, tableTop + headerH * 0.72, idHeaderW);
    if (seqW > 0) {
      ctx.fillStyle = palette.headingInk;
      ctx.font = printFont(700, 7.5);
      ctx.fillText('Sıra', pLeft + seqW / 2, tableTop + headerH / 2, seqW - px(0.4));
      drawChartLine(ctx, pLeft + seqW, tableTop, pLeft + seqW, tableTop + headerH, palette.gridBorder, borderMid);
    }
    drawChartLine(ctx, gridLeft, tableTop, gridLeft, tableTop + headerH, palette.gridBorder, borderMid);

    let cursorX = gridLeft;
    for (let c = 0; c < flatCols.length; c += 1) {
      const col = flatCols[c]!;
      const colW = (col.weight / totalColWeight) * gridW;
      if (col.tint !== '#ffffff') {
        ctx.fillStyle = col.tint;
        ctx.fillRect(cursorX, tableTop, colW, headerH);
      } else if (!isSok) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.56;
        ctx.fillRect(cursorX, tableTop + groupTopH, colW, headerH - groupTopH);
        ctx.globalAlpha = 1;
      }
      if (col.isGroupStart) {
        let spanW = 0;
        for (let k = 0; k < col.groupSpan; k += 1) spanW += (flatCols[c + k]!.weight / totalColWeight) * gridW;
        const spanMm = (spanW * 25.4) / PRINT_DPI;
        ctx.fillStyle = palette.headingInk;
        ctx.font = printFont(700, fitHeaderCellPoints(col.groupTitle, isSok ? 9.2 : 7.0, spanMm, false));
        ctx.fillText(col.groupTitle, cursorX + spanW / 2, tableTop + groupTopH / 2, spanW - px(1.0));
      }
      if (!isSok) {
        const colMm = (colW * 25.4) / PRINT_DPI;
        ctx.fillStyle = palette.inkPrimary;
        ctx.font = printFont(700, fitHeaderCellPoints(col.sub, 6.4, colMm, false));
        ctx.fillText(col.sub, cursorX + colW / 2, tableTop + groupTopH + (headerH - groupTopH) / 2, colW - px(0.7));
      }
      cursorX += colW;
      if (c < flatCols.length - 1) {
        const yFrom = col.isGroupEnd ? tableTop : tableTop + groupTopH;
        drawChartLine(ctx, cursorX, yFrom, cursorX, tableTop + headerH, col.isGroupEnd ? palette.gridBorder : palette.gridHairline, col.isGroupEnd ? borderMid : borderThin);
      }
    }
    if (!isSok) drawChartLine(ctx, gridLeft, tableTop + groupTopH, pLeft + panelW, tableTop + groupTopH, palette.gridBorder, borderThin);

    rows.forEach((row, rIdx) => {
      const rTop = tableTop + headerH + rIdx * rowH;
      const stu = row.student;

      let gx = gridLeft;
      for (const col of flatCols) {
        const cw = (col.weight / totalColWeight) * gridW;
        if (col.tint !== '#ffffff') {
          ctx.fillStyle = col.tint;
          ctx.fillRect(gx, rTop, cw, rowH);
        } else if (template.subRowScheme === 'two-terms') {
          ctx.fillStyle = palette.headerTint;
          ctx.fillRect(gx, rTop, cw, rowH / 2);
        }
        gx += cw;
      }

      if (template.subRowScheme === 'two-terms') {
        const midY = rTop + rowH / 2;
        ctx.fillStyle = palette.headerTint;
        ctx.fillRect(pLeft + seqW + identityW, rTop, subTagW, rowH / 2);
        ctx.fillStyle = palette.inkPrimary;
        ctx.font = printFont(700, 6.3);
        drawRotatedLabel(ctx, '1.D', pLeft + seqW + identityW + subTagW / 2, rTop + rowH * 0.25, rowH * 0.44);
        drawRotatedLabel(ctx, '2.D', pLeft + seqW + identityW + subTagW / 2, rTop + rowH * 0.75, rowH * 0.44);
        drawChartLine(ctx, pLeft + seqW + identityW, midY, pLeft + panelW, midY, palette.gridHairline, borderThin);
      } else if (template.subRowScheme === 'quad-numbered') {
        ctx.fillStyle = palette.summaryTint;
        ctx.fillRect(pLeft + seqW + identityW, rTop, subTagW, rowH);
        for (let q = 0; q < 4; q += 1) {
          const qTop = rTop + (q * rowH) / 4;
          if (q > 0) drawChartLine(ctx, pLeft + seqW + identityW, qTop, pLeft + panelW, qTop, palette.gridHairline, borderThin);
          ctx.fillStyle = palette.inkPrimary;
          ctx.font = printFont(700, 6.3);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(q + 1), pLeft + seqW + identityW + subTagW / 2, qTop + rowH / 8);
        }
      }

      gx = gridLeft;
      drawChartLine(ctx, gridLeft, rTop, gridLeft, rTop + rowH, palette.gridBorder, borderMid);
      flatCols.forEach((col, cIdx) => {
        gx += (col.weight / totalColWeight) * gridW;
        if (cIdx < flatCols.length - 1) {
          drawChartLine(ctx, gx, rTop, gx, rTop + rowH, col.isGroupEnd ? palette.gridBorder : palette.gridHairline, col.isGroupEnd ? borderMid : borderThin);
        }
      });

      if (seqW > 0) {
        ctx.fillStyle = palette.headerTint;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(pLeft, rTop, seqW, rowH);
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.inkPrimary;
        ctx.font = printFont(700, 7.5);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (stu) ctx.fillText(String(row.sequenceNumber), pLeft + seqW / 2, rTop + rowH / 2, seqW - px(0.6));
        drawChartLine(ctx, pLeft + seqW, rTop, pLeft + seqW, rTop + rowH, palette.gridBorder, borderMid);
      }

      const idLeft = pLeft + seqW;
      drawTabularIdentityCell({
        ctx, template, palette, stu, idLeft, rTop, identityW, rowH,
        identityMm: dimensions.identityMm, nameMm: dimensions.nameMm, rowMm,
        showStudentNumbers, printFontPt, borderThin, renderedPortraits, px,
      });
      if (subTagW > 0) drawChartLine(ctx, idLeft + identityW, rTop, idLeft + identityW, rTop + rowH, palette.gridHairline, borderThin);
      if (rIdx < rows.length - 1) drawChartLine(ctx, pLeft, rTop + rowH, pLeft + panelW, rTop + rowH, palette.gridBorder, borderMid);
    });

    ctx.strokeStyle = palette.gridBorder;
    ctx.lineWidth = borderStrong;
    ctx.strokeRect(pLeft, tableTop, panelW, tableH);
    drawChartLine(ctx, pLeft, tableTop + headerH, pLeft + panelW, tableTop + headerH, palette.gridBorder, borderStrong);
  });

  ctx.restore();
}
