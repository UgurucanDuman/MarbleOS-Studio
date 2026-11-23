import type { TeacherChartPalette } from '../teacher-charts/types';
import { hexToRgba } from './catalog';
import {
  drawKutukCoverPortrait,
  drawKutukRoundedBox,
  kutukCardNameScale,
  kutukMinimalNameScale,
  splitKutukWrappedLines,
} from './drawKutukPrimitives';
import { KUTUK_CANVAS_FONT } from './drawKutukSheetChrome';
import type { KutukStudentLike } from './staffDirectory';
import type { KutukNameBoxStyle, KutukPhotoFrame } from './types';

/**
 * İZOLE SİSTEM 300 DPI ÖĞRENCİ KARTI & ÇERÇEVE RESSAMI:
 * Canlı önizleme ile birebir eşleşen tek çerçeveli Apple Pro kartlar, eşit kilitli isim kutusu ve baş korumalı cover kırpma.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

function isStaffNum(studentNumber: string): boolean {
  const clean = studentNumber.trim();
  return clean === '0' || clean.startsWith('0-');
}

function drawMissingPlaceholder(
  ctx: CanvasRenderingContext2D,
  px: (mm: number) => number,
  x: number,
  y: number,
  w: number,
  h: number,
  numPx: number,
): void {
  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#71717a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.max(10, Math.round(numPx * 0.85))}px ${KUTUK_CANVAS_FONT}`;
  ctx.fillText('Fotoğraf Yok', Math.round(x + w / 2), Math.round(y + h / 2), Math.max(8, w - px(1.2)));
}

export function paintKutukStudentCell(options: {
  ctx: CanvasRenderingContext2D;
  px: (mm: number) => number;
  cx: number;
  cy: number;
  cw: number;
  ch: number;
  cardWMm: number;
  cols: number;
  nameFontMm: number;
  namePx: number;
  numPx: number;
  captionH: number;
  cardRadiusPx: number;
  student: KutukStudentLike;
  isStaffClass: boolean;
  showStudentNumbers: boolean;
  nameBoxStyle: KutukNameBoxStyle;
  photoFrame: KutukPhotoFrame;
  frameHex: string;
  palette: TeacherChartPalette;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
}): void {
  const {
    ctx, px, cx, cy, cw, ch, cardWMm, cols, nameFontMm, namePx, numPx, captionH, cardRadiusPx,
    student, isStaffClass, showStudentNumbers,
    nameBoxStyle, photoFrame, frameHex, palette, renderedPortraits,
  } = options;

  const thinPx = Math.max(1, px(0.18));
  const isMinimal = nameBoxStyle === 'minimal-clean';
  const isSharp = photoFrame === 'sharp' || nameBoxStyle === 'classic-grid';
  const isFrameless = photoFrame === 'frameless';
  const isMat = photoFrame === 'double-frame';
  const radius = isSharp ? 0 : cardRadiusPx;

  const portrait = student.matchedPhotoId ? renderedPortraits.get(student.matchedPhotoId) : undefined;
  const staffEntry = isStaffClass || isStaffNum(student.studentNumber);
  const numLine = staffEntry
    ? (student.isPrincipal ? 'Okul Müdürü' : (student.role || 'Öğretmen'))
    : showStudentNumbers
      ? student.studentNumber
      : '';
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const fullNameUpper = fullName.toLocaleUpperCase('tr-TR');

  if (isMinimal) {
    const gapPx = px(0.55);
    const photoH = Math.max(px(8), ch - captionH - gapPx);
    const matGap = isMat ? px(0.52) : 0;
    const imgX = cx + matGap;
    const imgY = cy + matGap;
    const imgW = Math.max(4, cw - matGap * 2);
    const imgH = Math.max(4, photoH - matGap * 2);
    const innerR = Math.max(0, radius - matGap * 0.7);

    if (isMat) {
      drawKutukRoundedBox(ctx, cx, cy, cw, photoH, radius, '#ffffff', null);
    }
    ctx.save();
    if (innerR > 0 && typeof ctx.quadraticCurveTo === 'function' && typeof ctx.clip === 'function') {
      drawKutukRoundedBox(ctx, imgX, imgY, imgW, imgH, innerR, null, null);
      ctx.clip();
    }
    if (portrait) drawKutukCoverPortrait(ctx, portrait, imgX, imgY, imgW, imgH);
    else drawMissingPlaceholder(ctx, px, imgX, imgY, imgW, imgH, numPx);
    ctx.restore();

    const photoStroke = isFrameless ? 'rgba(15, 23, 42, 0.09)' : hexToRgba(frameHex, 0.48);
    drawKutukRoundedBox(ctx, cx, cy, cw, photoH, radius, null, photoStroke, thinPx);

    const capY = cy + photoH + gapPx;
    const pillFill = hexToRgba(frameHex, 0.11);
    const pillStroke = isFrameless ? null : hexToRgba(frameHex, 0.5);
    drawKutukRoundedBox(ctx, cx, capY, cw, captionH, radius, pillFill, pillStroke, thinPx);

    const unified = `${numLine ? `${numLine} ` : ''}${fullNameUpper}`;
    const effPx = Math.max(10, Math.round(namePx * kutukMinimalNameScale(unified, cols)));
    const maxChars = Math.max(9, Math.round((cw - px(1.2)) / (effPx * 0.58)));
    const lines = splitKutukWrappedLines(unified, maxChars, 3);
    const step = Math.round(effPx * 1.08);
    const startY = capY + captionH / 2 - ((lines.length - 1) * step) / 2;
    ctx.fillStyle = palette.inkPrimary;
    ctx.font = `800 ${effPx}px ${KUTUK_CANVAS_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, idx) => ctx.fillText(line, cx + cw / 2, startY + idx * step, cw - px(1.0)));
    return;
  }

  // Tek çerçeveli Apple Kutu / Renkli Bant / Klasik Kütük: dış kart tek kez kırpılır, içte ikinci çerçeve yoktur
  const photoAreaH = Math.max(px(8), ch - captionH);
  const capY = cy + photoAreaH;
  ctx.save();
  if (radius > 0 && typeof ctx.quadraticCurveTo === 'function' && typeof ctx.clip === 'function') {
    drawKutukRoundedBox(ctx, cx, cy, cw, ch, radius, null, null);
    ctx.clip();
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx, cy, cw, ch);

  const matX = isMat ? px(0.68) : 0;
  const matTop = isMat ? px(0.68) : 0;
  const matBot = isMat ? px(0.5) : 0;
  const imgX = cx + matX;
  const imgY = cy + matTop;
  const imgW = Math.max(4, cw - matX * 2);
  const imgH = Math.max(4, photoAreaH - matTop - matBot);

  if (isMat && !isSharp && radius > 0 && typeof ctx.quadraticCurveTo === 'function' && typeof ctx.clip === 'function') {
    ctx.save();
    drawKutukRoundedBox(ctx, imgX, imgY, imgW, imgH, Math.max(0, radius - px(0.55)), null, null);
    ctx.clip();
    if (portrait) drawKutukCoverPortrait(ctx, portrait, imgX, imgY, imgW, imgH);
    else drawMissingPlaceholder(ctx, px, imgX, imgY, imgW, imgH, numPx);
    ctx.restore();
  } else if (portrait) {
    drawKutukCoverPortrait(ctx, portrait, imgX, imgY, imgW, imgH);
  } else {
    drawMissingPlaceholder(ctx, px, imgX, imgY, imgW, imgH, numPx);
  }

  const isFilledBand = nameBoxStyle === 'filled-band';
  if (isFilledBand) {
    ctx.fillStyle = frameHex;
    ctx.fillRect(cx, capY, cw, captionH);
  } else {
    ctx.fillStyle = nameBoxStyle === 'apple-soft' ? hexToRgba(frameHex, 0.085) : hexToRgba(frameHex, 0.08);
    ctx.fillRect(cx, capY, cw, captionH);
    ctx.strokeStyle = nameBoxStyle === 'apple-soft' ? hexToRgba(frameHex, 0.2) : hexToRgba(frameHex, 0.4);
    ctx.lineWidth = thinPx;
    ctx.beginPath();
    ctx.moveTo(cx, capY);
    ctx.lineTo(cx + cw, capY);
    ctx.stroke();
  }
  ctx.restore();

  const outerStroke = isFrameless
    ? 'rgba(15, 23, 42, 0.1)'
    : nameBoxStyle === 'apple-soft'
      ? hexToRgba(frameHex, 0.42)
      : frameHex;
  drawKutukRoundedBox(ctx, cx, cy, cw, ch, radius, null, outerStroke, thinPx);

  // Sabit kilitli kutuda dikey ortalanmış + akıllı ölçekli isim yazımı (asla harf koparmaz)
  const scale = kutukCardNameScale(fullNameUpper, cardWMm, nameFontMm);
  const effNamePx = Math.max(10, Math.round(namePx * scale));
  const maxChars = Math.max(8, Math.round((cw - px(1.1)) / (effNamePx * 0.58)));
  const lines = splitKutukWrappedLines(fullNameUpper, maxChars, 2);
  const lineStep = Math.round(effNamePx * 1.08);
  const numStep = numLine ? Math.round(numPx * 1.1) : 0;
  const totalTextH = numStep + lines.length * lineStep;
  let curY = capY + Math.max(px(0.25), (captionH - totalTextH) / 2);
  const centerX = Math.round(cx + cw / 2);
  const maxTextW = Math.max(10, cw - px(1.0));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (numLine) {
    ctx.fillStyle = isFilledBand ? 'rgba(255, 255, 255, 0.9)' : frameHex;
    ctx.font = `800 ${numPx}px ${KUTUK_CANVAS_FONT}`;
    ctx.fillText(numLine, centerX, curY, maxTextW);
    curY += numStep;
  }
  ctx.fillStyle = isFilledBand ? '#ffffff' : palette.inkPrimary;
  ctx.font = `700 ${effNamePx}px ${KUTUK_CANVAS_FONT}`;
  lines.forEach((line, idx) => ctx.fillText(line, centerX, curY + idx * lineStep, maxTextW));
}
