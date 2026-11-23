import type { TeacherChartPalette } from '../teacher-charts/types';
import { resolvePvcColorToken } from './fieldResolver';
import type { PvcCardElement, PvcPhotoShape } from './types';

/**
 * İZOLE SİSTEM KATMANI: PVC Kimlik Kartı 300 DPI Canvas Çizim Primitifleri
 * Yuvarlatılmış yol, daire/kemer/altıgen portre klipi, gradyan, şekil ve çok satırlı metin yardımcıları.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (rad <= 0.1) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

export function tracePhotoClipPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  shape: PvcPhotoShape,
  radiusPx: number,
): void {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  if (shape === 'hexagon') {
    const cx = x + w / 2;
    const topOff = h * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + w, y + topOff);
    ctx.lineTo(x + w, y + h - topOff);
    ctx.lineTo(cx, y + h);
    ctx.lineTo(x, y + h - topOff);
    ctx.lineTo(x, y + topOff);
    ctx.closePath();
    return;
  }
  if (shape === 'arch') {
    const rx = w / 2;
    const archH = Math.min(rx, h * 0.45);
    const botR = Math.min(radiusPx, w * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, y + archH);
    ctx.quadraticCurveTo(x, y, x + rx, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + archH);
    ctx.lineTo(x + w, y + h - botR);
    ctx.arcTo(x + w, y + h, x + w - botR, y + h, botR);
    ctx.lineTo(x + botR, y + h);
    ctx.arcTo(x, y + h, x, y + h - botR, botR);
    ctx.closePath();
    return;
  }
  traceRoundedRect(ctx, x, y, w, h, shape === 'rect' ? 0 : radiusPx);
}

export function createLinearGradientOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angleDeg: number,
  c1: string,
  c2: string,
): CanvasGradient | string {
  if (typeof ctx.createLinearGradient !== 'function') return c1;
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = (Math.cos(rad) * w) / 2;
  const dy = (Math.sin(rad) * h) / 2;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  return grad;
}

export function paintPvcShapeElement(
  ctx: CanvasRenderingContext2D,
  el: PvcCardElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  pxPerMm: number,
  palette: TeacherChartPalette,
): void {
  const c1 = el.fillColor ? resolvePvcColorToken(el.fillColor, palette, palette.accent) : '';
  const c2 = el.fillColor2 ? resolvePvcColorToken(el.fillColor2, palette, c1) : '';
  const fillStyle = c1 && c2
    ? createLinearGradientOnCanvas(ctx, x, y, w, h, el.gradientAngle ?? 135, c1, c2)
    : c1;

  if (el.shapeVariant === 'circle') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if (el.shapeVariant === 'wave') {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h * 0.72);
    ctx.quadraticCurveTo(x + w * 0.66, y + h * 1.04, x + w * 0.34, y + h * 0.78);
    ctx.lineTo(x, y + h * 0.88);
    ctx.closePath();
  } else if (el.shapeVariant === 'diagonal') {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.68, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  } else {
    traceRoundedRect(ctx, x, y, w, h, r);
  }

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (el.borderColor && (el.borderWidthMm ?? 0) > 0) {
    ctx.strokeStyle = resolvePvcColorToken(el.borderColor, palette, palette.gridHairline);
    ctx.lineWidth = Math.max(1, (el.borderWidthMm ?? 0.3) * pxPerMm);
    ctx.stroke();
  }
}

export function drawBitmapFitted(
  ctx: CanvasRenderingContext2D,
  bmp: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: 'cover' | 'contain',
  zoom = 1,
  posX = 50,
  posY = 50,
): void {
  const srcRatio = bmp.width / Math.max(1, bmp.height);
  const dstRatio = w / Math.max(1, h);
  let dw = w;
  let dh = h;
  if ((fit === 'cover' && srcRatio > dstRatio) || (fit === 'contain' && srcRatio < dstRatio)) {
    dw = h * srcRatio;
  } else {
    dh = w / srcRatio;
  }
  const safeZoom = Math.min(2.5, Math.max(0.7, zoom));
  dw *= safeZoom;
  dh *= safeZoom;
  const fx = Math.min(1, Math.max(0, posX / 100));
  const fy = Math.min(1, Math.max(0, posY / 100));
  const dx = x + (w - dw) * fx;
  const dy = y + (h - dh) * fy;
  ctx.drawImage(bmp, dx, dy, dw, dh);
}

export function drawWrappedPvcText(options: {
  ctx: CanvasRenderingContext2D;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontPx: number;
  maxLines: number;
  align: 'left' | 'center' | 'right';
}): void {
  const { ctx, text, x, y, w, h, fontPx, maxLines, align } = options;
  const lineH = fontPx * 1.24;
  const anchorX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (maxLines <= 1) {
    ctx.fillText(text, anchorX, y + (h - fontPx) / 2, w);
    return;
  }
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const probe = current ? `${current} ${word}` : word;
    const width = ctx.measureText ? ctx.measureText(probe).width : probe.length * fontPx * 0.55;
    if (current && width > w && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = probe;
    }
  }
  if (current) lines.push(current);
  const clipped = lines.slice(0, maxLines);
  const startY = y + Math.max(0, (h - clipped.length * lineH) / 2);
  clipped.forEach((line, idx) => ctx.fillText(line, anchorX, startY + idx * lineH, w));
}
