import type { GradeColumnGroup, TeacherChartPalette } from './types';

/**
 * İZOLE 300 DPI ÇİZELGE & KİTAPÇIK ORTAK TUVAL PRİMİTİFLERİ:
 * Piksel-hizalı jilet keskinliğinde çizgi, döndürülmüş etiket, 3:4 portre oturtma ve sütun yardımcıları.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface TabularCanvasStudent {
  photoId?: string | null;
  studentNumber: string;
  firstName: string;
  lastName: string;
}

export interface FlatChartColumn {
  groupTitle: string;
  groupSpan: number;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  sub: string;
  weight: number;
  tint: string;
}

export function drawChartLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  widthPx: number,
): void {
  const lw = Math.max(1, widthPx);
  const half = Math.round(lw) % 2 === 1 ? 0.5 : 0;
  const sx1 = Math.abs(x1 - x2) < 0.01 ? Math.floor(x1) + half : x1;
  const sx2 = Math.abs(x1 - x2) < 0.01 ? sx1 : x2;
  const sy1 = Math.abs(y1 - y2) < 0.01 ? Math.floor(y1) + half : y1;
  const sy2 = Math.abs(y1 - y2) < 0.01 ? sy1 : y2;

  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();
}

export function drawRotatedLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxW: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0, maxW);
  ctx.restore();
}

export function drawRotatedLinesLabel(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  cx: number,
  cy: number,
  lineStepPx: number,
  maxW: number,
): void {
  const nonEmpty = lines.filter(Boolean);
  if (nonEmpty.length === 0) return;
  if (nonEmpty.length === 1) {
    drawRotatedLabel(ctx, nonEmpty[0]!, cx, cy, maxW);
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = -((nonEmpty.length - 1) * lineStepPx) / 2;
  nonEmpty.forEach((line, idx) => {
    ctx.fillText(line, 0, startY + idx * lineStepPx, maxW);
  });
  ctx.restore();
}

export function drawRotatedTwoLineLabel(
  ctx: CanvasRenderingContext2D,
  line1: string,
  line2: string,
  cx: number,
  cy: number,
  lineGapPx: number,
  maxW: number,
): void {
  drawRotatedLinesLabel(ctx, line2 ? [line1, line2] : [line1], cx, cy, lineGapPx, maxW);
}

export function splitBalancedStudentLines(
  studentNumber: string,
  firstName: string,
  lastName: string,
  showStudentNumbers: boolean,
): [string, string] {
  const prefix = showStudentNumbers ? studentNumber.trim() : '';
  const tokens = [prefix, ...firstName.trim().split(/\s+/), ...lastName.trim().split(/\s+/)].filter(Boolean);
  if (tokens.length === 0) return ['', ''];
  if (tokens.length === 1) return [tokens[0]!, ''];
  let bestIdx = 1;
  let bestScore = Infinity;
  for (let i = 1; i < tokens.length; i += 1) {
    const l1 = tokens.slice(0, i).join(' ');
    const l2 = tokens.slice(i).join(' ');
    const score = Math.max(l1.length, l2.length) + Math.abs(l1.length - l2.length) * 0.15;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return [tokens.slice(0, bestIdx).join(' '), tokens.slice(bestIdx).join(' ')];
}

export function drawCentered3x4Portrait(
  ctx: CanvasRenderingContext2D,
  portrait: HTMLCanvasElement | undefined,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): { pX: number; pY: number; pW: number; pH: number } {
  const pW = Math.max(2, Math.min(boxW, boxH * 0.75));
  const pH = pW / 0.75;
  const pX = boxX + (boxW - pW) / 2;
  const pY = boxY + (boxH - pH) / 2;
  if (portrait) {
    ctx.drawImage(portrait, pX, pY, pW, pH);
  }
  return { pX, pY, pW, pH };
}

export function flattenColumnGroups(
  groups: readonly GradeColumnGroup[],
  palette: TeacherChartPalette,
): FlatChartColumn[] {
  const flat: FlatChartColumn[] = [];
  groups.forEach((grp, gIdx) => {
    const tint =
      grp.tintKind === 'final'
        ? palette.finalTint
        : grp.tintKind === 'summary'
          ? palette.summaryTint
          : '#ffffff';
    const w = grp.widthWeight ?? 1;
    const isLastGroup = gIdx === groups.length - 1;
    grp.subHeaders.forEach((sub, idx) => {
      flat.push({
        groupTitle: grp.title,
        groupSpan: grp.subHeaders.length,
        isGroupStart: idx === 0,
        isGroupEnd: !isLastGroup && idx === grp.subHeaders.length - 1,
        sub,
        weight: w,
        tint,
      });
    });
  });
  return flat;
}
