import { mmToPx, PRINT_DPI } from '../binaryPrintFormats';
import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';
import {
  drawCentered3x4Portrait,
  drawChartLine,
  drawRotatedLabel,
  drawRotatedTwoLineLabel,
  flattenColumnGroups,
  splitBalancedStudentLines,
  type TabularCanvasStudent,
} from './canvasPrimitives';
import { drawBookletFrontCoverStrip, drawBookletScheduleStrip } from './drawBookletCovers';
import type { BookletMiniPage, BookletSpreadStrip, TeacherChartPalette, TeacherDocTemplateSpec } from './types';

/**
 * İZOLE 300 DPI FOTOKOPİ-GÜVENLİ KES-KATLA FORMA RASTER MOTORU:
 * Cep Not Defteri (6’lı Forma + Kapaklar) ve Öğretmen Cep Albümü (4’lü Forma + Kapak).
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

function drawMiniGradePage(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  miniPage: BookletMiniPage<TabularCanvasStudent | null>,
  isLeftPage: boolean,
  className: string,
  schoolName: string,
  academicYear: string,
  showStudentNumbers: boolean,
  fontScale: number,
  palette: TeacherChartPalette,
  template: TeacherDocTemplateSpec,
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>,
  px: (mm: number) => number,
): void {
  const borderThin = Math.max(1.8, px(0.22));
  const borderStrong = Math.max(2.6, px(0.34));
  const footerH = px(5.0);
  const tableH = h - footerH;
  const headH = px(6.2);
  const rowH = (tableH - headH) / 5;
  const idW = px(15.5);
  const subW = px(3.4);
  const gridLeft = x + idW + subW;
  const gridW = w - idW - subW;

  ctx.fillStyle = palette.headerTint;
  ctx.fillRect(x, y, w, headH);
  ctx.fillStyle = palette.headingInk;
  ctx.font = `700 ${px(2.0)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(className || 'ŞUBE', x + (idW + subW) / 2, y + headH / 2);

  const subCols = flattenColumnGroups(template.columnGroups, palette);
  const cw = gridW / Math.max(1, subCols.length);
  subCols.forEach((col, i) => {
    const cx = gridLeft + i * cw;
    if (col.isGroupStart) {
      ctx.fillStyle = palette.headingInk;
      ctx.font = `700 ${px(1.35)}px Inter, Segoe UI, Arial, sans-serif`;
      ctx.fillText(col.groupTitle, cx + (col.groupSpan * cw) / 2, y + headH * 0.28);
      drawChartLine(ctx, cx, y, cx, y + headH, palette.gridBorder, borderThin);
    }
    ctx.fillStyle = palette.inkPrimary;
    ctx.font = `700 ${px(1.3)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.fillText(col.sub, cx + cw / 2, y + headH * 0.74);
  });
  drawChartLine(ctx, gridLeft, y + headH * 0.5, x + w, y + headH * 0.5, palette.gridBorder, borderThin);

  for (let r = 0; r < 5; r += 1) {
    const rTop = y + headH + r * rowH;
    const stu = miniPage.slots[r] ?? null;
    subCols.forEach((col, i) => {
      const cx = gridLeft + i * cw;
      const bg = col.tint !== '#ffffff' ? col.tint : col.sub === 'Ort' ? palette.summaryTint : '';
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(cx, rTop, cw, rowH);
      }
      drawChartLine(ctx, cx, rTop, cx, rTop + rowH, palette.gridHairline, borderThin);
    });
    for (let q = 0; q < 4; q += 1) {
      const qy = rTop + (q * rowH) / 4;
      if (q > 0) drawChartLine(ctx, x + idW, qy, x + w, qy, palette.gridHairline, borderThin);
      ctx.fillStyle = palette.inkPrimary;
      ctx.font = `700 ${px(1.35)}px Inter, Segoe UI, Arial, sans-serif`;
      ctx.fillText(String(q + 1), x + idW + subW / 2, qy + rowH / 8);
    }
    const stripW = px(5.4);
    ctx.fillStyle = palette.summaryTint;
    ctx.fillRect(x + idW - stripW, rTop, stripW, rowH);
    if (stu) {
      const portrait = stu.photoId ? renderedPortraits.get(stu.photoId) : undefined;
      drawCentered3x4Portrait(ctx, portrait, x + px(0.4), rTop + px(0.4), idW - stripW - px(0.8), rowH - px(0.8));
      const [l1, l2] = splitBalancedStudentLines(stu.studentNumber, stu.firstName, stu.lastName, showStudentNumbers);
      ctx.fillStyle = palette.inkPrimary;
      ctx.font = `700 ${px(1.18 * fontScale)}px Inter, Segoe UI, Arial, sans-serif`;
      drawRotatedTwoLineLabel(ctx, l1, l2, x + idW - stripW / 2, rTop + rowH / 2, px(1.8 * fontScale), rowH - px(0.6));
    }
    drawChartLine(ctx, x + idW, rTop, x + idW, rTop + rowH, palette.gridHairline, borderThin);
    drawChartLine(ctx, x, rTop + rowH, x + w, rTop + rowH, palette.gridBorder, borderStrong);
  }
  ctx.strokeStyle = palette.gridBorder;
  ctx.lineWidth = borderStrong;
  ctx.strokeRect(x, y, w, tableH);

  ctx.fillStyle = palette.inkSecondary;
  ctx.font = `600 ${px(1.4)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${schoolName} (${academicYear || '2026-2027'})`, x + w / 2, y + tableH + footerH * 0.55);
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = `700 ${px(1.75)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = isLeftPage ? 'left' : 'right';
  ctx.fillText(String(miniPage.pageNumber), isLeftPage ? x : x + w, y + tableH + footerH * 0.55);
}

export function paintTeacherBookletSheet(options: {
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
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverBitmap?: ImageBitmap | HTMLCanvasElement | null;
  customCoverMode?: 'full-bleed' | 'emblem';
  showStudentNumbers: boolean;
  printFontPt?: PrintFontPoint;
  strips: readonly BookletSpreadStrip<TabularCanvasStudent | null>[];
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
}): void {
  const {
    ctx, widthPx, heightPx, template, palette, schoolName, academicYear,
    className, teacherName, courseName, coverTitle, coverSubtitle,
    customCoverBitmap, customCoverMode, showStudentNumbers,
    printFontPt = DEFAULT_PRINT_FONT_PT, strips, renderedPortraits,
  } = options;
  const px = (mm: number) => mmToPx(mm, PRINT_DPI);
  const fontScale = printFontPt / DEFAULT_PRINT_FONT_PT;
  const borderThin = Math.max(1.8, px(0.22));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  const stripCount = template.engine === 'booklet-album-inner' || template.engine === 'booklet-album-cover' ? 2 : 3;
  const padY = px(8.5);
  const padX = px(9.5);
  const stripH = (heightPx - padY * 2) / stripCount;
  const halfW = (widthPx - padX * 2 - px(8)) / 2;

  for (let s = 0; s < stripCount; s += 1) {
    const sTop = padY + s * stripH;
    if (s > 0) {
      drawChartLine(ctx, px(4), sTop, px(11), sTop, palette.gridHairline, borderThin);
      drawChartLine(ctx, widthPx - px(11), sTop, widthPx - px(4), sTop, palette.gridHairline, borderThin);
    }
    const leftX = padX;
    const rightX = widthPx - padX - halfW;
    const innerH = stripH - px(4);
    const innerY = sTop + px(2);
    const spread = strips[s];

    if (template.engine === 'booklet-gradebook-inner' && spread) {
      drawMiniGradePage(ctx, leftX, innerY, halfW, innerH, spread.leftPage, true, className, schoolName, academicYear, showStudentNumbers, fontScale, palette, template, renderedPortraits, px);
      drawMiniGradePage(ctx, rightX, innerY, halfW, innerH, spread.rightPage, false, className, schoolName, academicYear, showStudentNumbers, fontScale, palette, template, renderedPortraits, px);
    } else if (template.engine === 'booklet-gradebook-front' || template.engine === 'booklet-album-cover') {
      drawBookletFrontCoverStrip({
        ctx, rightX, halfW, innerY, innerH, engine: template.engine, palette, schoolName, academicYear,
        className, teacherName, courseName, coverTitle, coverSubtitle, customCoverBitmap, customCoverMode, px,
      });
    } else if (template.engine === 'booklet-gradebook-back') {
      drawBookletScheduleStrip({ ctx, leftX, rightX, halfW, innerY, innerH, palette, px });
    } else if (template.engine === 'booklet-album-inner' && spread) {
      ctx.fillStyle = palette.inkSecondary;
      ctx.font = `600 ${px(1.6)}px Inter, Segoe UI, Arial, sans-serif`;
      drawRotatedLabel(ctx, `${schoolName} (${academicYear || '2026-2027'})`, widthPx / 2, innerY + innerH / 2, innerH - px(4));
      [
        { mp: spread.leftPage, x: leftX, isLeft: true },
        { mp: spread.rightPage, x: rightX, isLeft: false },
      ].forEach(({ mp, x, isLeft }) => {
        ctx.fillStyle = palette.headingInk;
        ctx.font = `700 ${px(2.1)}px Inter, Segoe UI, Arial, sans-serif`;
        ctx.textAlign = isLeft ? 'left' : 'right';
        ctx.fillText(String(mp.pageNumber), isLeft ? x : x + halfW, innerY + px(2.5));
        if (mp.slots.some(Boolean)) {
          ctx.textAlign = 'center';
          ctx.fillText(className || 'ALBÜM', x + halfW / 2, innerY + px(2.5));
        }
        const gTop = innerY + px(6.5);
        const cellW = halfW / 4;
        const cellH = (innerH - px(8)) / 3;
        mp.slots.slice(0, 12).forEach((stu, idx) => {
          if (!stu) return;
          const cx = x + (idx % 4) * cellW;
          const cy = gTop + Math.floor(idx / 4) * cellH;
          const portrait = stu.photoId ? renderedPortraits.get(stu.photoId) : undefined;
          const { pX, pY, pW, pH } = drawCentered3x4Portrait(ctx, portrait, cx + px(1.2), cy, cellW - px(2.4), cellH - px(6.5));
          ctx.strokeStyle = palette.gridHairline;
          ctx.lineWidth = borderThin;
          ctx.strokeRect(pX, pY, pW, pH);
          const [l1, l2] = splitBalancedStudentLines(stu.studentNumber, stu.firstName, stu.lastName, showStudentNumbers);
          ctx.fillStyle = palette.inkPrimary;
          ctx.font = `700 ${px(1.28 * fontScale)}px Inter, Segoe UI, Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(l1, cx + cellW / 2, pY + pH + px(1.8), cellW - px(0.8));
          if (l2) ctx.fillText(l2, cx + cellW / 2, pY + pH + px(3.8 * Math.max(0.95, fontScale)), cellW - px(0.8));
        });
      });
    }
  }
  ctx.restore();
}
