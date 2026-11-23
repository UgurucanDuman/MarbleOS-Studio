import { mmToPx, PRINT_DPI, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { canvasToJpegBytes } from '../../system/storage/portraitPrintRenderer';
import type { ImpositionPage } from './printSpecs';

/** İZOLE MODÜL 04 SAYFA BESTECİSİ: 300 DPI Fiziksel Kâğıt Dizgisi, Kesim Çizgisi ve 50 mm Ölçek Cetveli (.ts <= 240 satır) */

export function isStaffStudentNumber(studentNumber: string): boolean {
  return studentNumber === '0' || studentNumber.startsWith('0-');
}

export function formatStudentCaption(
  studentNumber: string,
  firstName: string,
  lastName: string,
  className: string,
): string {
  const numPart = isStaffStudentNumber(studentNumber) ? '' : `${studentNumber} `;
  const full = `${numPart}${firstName} ${lastName}`.trim();
  const clipped = full.length > 24 ? `${full.slice(0, 23)}…` : full;
  return className ? `${className} · ${clipped}` : clipped;
}

export interface CropMarkEdgeMask {
  skipLeft?: boolean;
  skipRight?: boolean;
  skipTop?: boolean;
  skipBottom?: boolean;
}

export function drawCornerCropMarks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  edges?: CropMarkEdgeMask,
  maxLenMm = 2.4,
): void {
  const len = mmToPx(Math.max(0.7, maxLenMm), PRINT_DPI);
  const gap = mmToPx(Math.min(0.9, Math.max(0.35, maxLenMm * 0.38)), PRINT_DPI);
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = Math.max(1, Math.round(mmToPx(0.16, PRINT_DPI)));
  ctx.beginPath();

  if (!edges?.skipLeft) {
    ctx.moveTo(x - gap - len, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x - gap - len, y + h);
    ctx.lineTo(x - gap, y + h);
  }
  if (!edges?.skipRight) {
    ctx.moveTo(x + w + gap, y);
    ctx.lineTo(x + w + gap + len, y);
    ctx.moveTo(x + w + gap, y + h);
    ctx.lineTo(x + w + gap + len, y + h);
  }
  if (!edges?.skipTop) {
    ctx.moveTo(x, y - gap - len);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x + w, y - gap - len);
    ctx.lineTo(x + w, y - gap);
  }
  if (!edges?.skipBottom) {
    ctx.moveTo(x, y + h + gap);
    ctx.lineTo(x, y + h + gap + len);
    ctx.moveTo(x + w, y + h + gap);
    ctx.lineTo(x + w, y + h + gap + len);
  }

  ctx.stroke();
}

export function drawCalibrationRuler(
  ctx: CanvasRenderingContext2D,
  pageWidthPx: number,
  pageHeightPx: number,
  rulerMm: number,
  compact: boolean,
): void {
  if (rulerMm <= 0) return;
  const rulerW = mmToPx(rulerMm, PRINT_DPI);
  const startX = Math.round((pageWidthPx - rulerW) / 2);
  const baseY = pageHeightPx - mmToPx(compact ? 4.2 : 6.5, PRINT_DPI);
  const majorTick = mmToPx(compact ? 1.8 : 2.3, PRINT_DPI);
  const midTick = mmToPx(compact ? 1.2 : 1.5, PRINT_DPI);
  const minorTick = mmToPx(0.7, PRINT_DPI);

  ctx.save();
  ctx.strokeStyle = '#27272a';
  ctx.fillStyle = '#27272a';
  ctx.lineWidth = Math.max(1, Math.round(mmToPx(0.18, PRINT_DPI)));

  ctx.beginPath();
  ctx.moveTo(startX, baseY);
  ctx.lineTo(startX + rulerW, baseY);

  for (let mm = 0; mm <= rulerMm; mm += 1) {
    const tickX = startX + mmToPx(mm, PRINT_DPI);
    const tickH = mm % 10 === 0 ? majorTick : mm % 5 === 0 ? midTick : minorTick;
    ctx.moveTo(tickX, baseY);
    ctx.lineTo(tickX, baseY - tickH);
  }
  ctx.stroke();

  const fontPx = mmToPx(compact ? 1.7 : 2.0, PRINT_DPI);
  ctx.font = `600 ${fontPx}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(
    `%100 GERÇEK ÖLÇEK KONTROLÜ — BU ÇİZGİ TAM ${rulerMm} mm OLMALIDIR`,
    Math.round(pageWidthPx / 2),
    baseY + mmToPx(0.6, PRINT_DPI),
  );
  ctx.restore();
}

export async function renderImpositionPageToPdfRaster(options: {
  page: ImpositionPage;
  totalPages: number;
  schoolName: string;
  specLabel: string;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  showCropMarks?: boolean;
  sheetCanvas?: HTMLCanvasElement;
}): Promise<PdfRasterPage> {
  const {
    page,
    totalPages,
    schoolName,
    specLabel,
    renderedPortraits,
    showCropMarks = true,
    sheetCanvas,
  } = options;
  const canvas = sheetCanvas ?? document.createElement('canvas');
  if (canvas.width !== page.widthPx || canvas.height !== page.heightPx) {
    canvas.width = page.widthPx;
    canvas.height = page.heightPx;
  }
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Sayfa dizgi tuvali başlatılamadı.');

  const compact = Math.min(page.widthMm, page.heightMm) <= 105;
  const minSlotY = page.slots.reduce((m, s) => Math.min(m, s.yMm), 99);
  const studioBioCard = page.footerStudioStrip === true;
  const tightVertical = minSlotY < 7 || studioBioCard;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!tightVertical) {
    const headerFontPx = mmToPx(compact ? 1.85 : 2.4, PRINT_DPI);
    const headerY = mmToPx(compact ? 3.2 : 5.6, PRINT_DPI);
    const sidePad = mmToPx(compact ? 4 : 9, PRINT_DPI);
    ctx.fillStyle = '#18181b';
    ctx.font = `600 ${headerFontPx}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const leftTitle = compact ? schoolName.slice(0, 28) : `${schoolName} · ${specLabel}`;
    ctx.fillText(leftTitle, sidePad, headerY);

    ctx.fillStyle = '#52525b';
    ctx.textAlign = 'right';
    ctx.fillText(`Sayfa ${page.pageIndex + 1} / ${totalPages}`, canvas.width - sidePad, headerY);
  }

  const captionFontPx = mmToPx(compact ? 1.65 : 1.85, PRINT_DPI);
  ctx.font = `500 ${captionFontPx}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (const slot of page.slots) {
    const x = mmToPx(slot.xMm, PRINT_DPI);
    const y = mmToPx(slot.yMm, PRINT_DPI);
    const w = mmToPx(slot.widthMm, PRINT_DPI);
    const h = mmToPx(slot.heightMm, PRINT_DPI);
    const portrait = renderedPortraits.get(slot.entry.photo.id);
    if (portrait) {
      if (slot.rotated90) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(portrait, -h / 2, -w / 2, h, w);
        ctx.restore();
      } else {
        ctx.drawImage(portrait, x, y, w, h);
      }
    }
    if (showCropMarks && !studioBioCard) {
      const m = 3.5;
      const hit = (fn: (o: (typeof page.slots)[number]) => boolean) => page.slots.some((o) => o !== slot && fn(o));
      const vOv = (o: (typeof page.slots)[number]) => o.yMm < slot.yMm + slot.heightMm - 0.5 && o.yMm + o.heightMm > slot.yMm + 0.5;
      const hOv = (o: (typeof page.slots)[number]) => o.xMm < slot.xMm + slot.widthMm - 0.5 && o.xMm + o.widthMm > slot.xMm + 0.5;
      drawCornerCropMarks(ctx, x, y, w, h, {
        skipLeft: slot.xMm < 1.2 || hit((o) => vOv(o) && o.xMm + o.widthMm > slot.xMm - m && o.xMm < slot.xMm),
        skipRight: slot.xMm + slot.widthMm > page.widthMm - 1.2 || hit((o) => vOv(o) && o.xMm < slot.xMm + slot.widthMm + m && o.xMm >= slot.xMm + slot.widthMm - 0.5),
        skipTop: slot.yMm < 1.2 || hit((o) => hOv(o) && o.yMm + o.heightMm > slot.yMm - m && o.yMm < slot.yMm),
        skipBottom: slot.yMm + slot.heightMm > page.heightMm - 1.2 || hit((o) => hOv(o) && o.yMm < slot.yMm + slot.heightMm + m && o.yMm >= slot.yMm + slot.heightMm - 0.5),
      });
    }
    if (!tightVertical) {
      ctx.fillStyle = '#27272a';
      const cap = formatStudentCaption(slot.entry.student.studentNumber, slot.entry.student.firstName, slot.entry.student.lastName, slot.entry.className);
      ctx.fillText(cap, Math.round(x + w / 2), y + h + mmToPx(0.85, PRINT_DPI), w);
    }
  }

  if (studioBioCard) {
    const first = page.slots[0]?.entry;
    const padX = mmToPx(3.0, PRINT_DPI);
    const footY = canvas.height - mmToPx(10.0, PRINT_DPI);
    ctx.fillStyle = '#18181b';
    ctx.font = `700 ${mmToPx(2.45, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(schoolName.toLocaleUpperCase('tr-TR'), padX, footY, canvas.width * 0.68);
    ctx.textAlign = 'right';
    const rightTxt = first?.className || (first ? `${first.student.studentNumber} ${first.student.firstName}` : '');
    if (rightTxt) ctx.fillText(rightTxt.toLocaleUpperCase('tr-TR'), canvas.width - padX, footY, canvas.width * 0.28);
  } else if (showCropMarks) {
    drawCalibrationRuler(ctx, canvas.width, canvas.height, page.rulerLengthMm, compact);
  }
  ctx.restore();

  const jpegBytes = await canvasToJpegBytes(canvas, 0.95, PRINT_DPI);
  return {
    jpegBytes,
    pixelWidth: page.widthPx,
    pixelHeight: page.heightPx,
    widthMm: page.widthMm,
    heightMm: page.heightMm,
  };
}
