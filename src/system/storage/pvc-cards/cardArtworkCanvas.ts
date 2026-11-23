import type { TeacherChartPalette } from '../teacher-charts/types';
import { createLinearGradientOnCanvas } from './pvcCanvasPrimitives';
import type { PvcArtworkStyle, PvcCardSide } from './types';

/**
 * İZOLE SİSTEM KATMANI: 300 DPI Canvas 2D PVC Kart Vektör Grafik Arka Plan Ressamı
 * PvcCardArtworkSvg ile birebir aynı katmanlı matbaa desenlerini 300 DPI baskıya işler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function paintPvcArtworkOnCanvas(options: {
  ctx: CanvasRenderingContext2D;
  styleId: PvcArtworkStyle;
  side: PvcCardSide;
  cardX: number;
  cardY: number;
  widthMm: number;
  heightMm: number;
  pxPerMm: number;
  palette: TeacherChartPalette;
}): void {
  const { ctx, styleId, side, cardX, cardY, widthMm: w, heightMm: h, pxPerMm, palette } = options;
  if (styleId === 'none') return;

  const isBack = side === 'back';
  const accent = palette.accent;
  const deep = palette.gridBorder;
  const soft = palette.headerTint;
  const mid = palette.finalTint;
  const px = (mm: number) => cardX + mm * pxPerMm;
  const py = (mm: number) => cardY + mm * pxPerMm;
  const s = (mm: number) => mm * pxPerMm;
  const grad = createLinearGradientOnCanvas(ctx, cardX, cardY, s(w), s(h), 135, deep, accent);

  ctx.save();
  if (styleId === 'corporate-wave') {
    if (!isBack) {
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      ctx.lineTo(px(w), py(0));
      ctx.lineTo(px(w), py(15.2));
      ctx.quadraticCurveTo(px(w * 0.66), py(19.6), px(w * 0.34), py(15.4));
      ctx.lineTo(px(0), py(16.8));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      ctx.lineTo(px(w), py(0));
      ctx.lineTo(px(w), py(13.6));
      ctx.quadraticCurveTo(px(w * 0.66), py(17.8), px(w * 0.34), py(13.8));
      ctx.lineTo(px(0), py(15.2));
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(px(0), py(h));
      ctx.lineTo(px(w), py(h));
      ctx.lineTo(px(w), py(h - 4.2));
      ctx.quadraticCurveTo(px(w * 0.72), py(h - 1.2), px(w * 0.36), py(h - 3.4));
      ctx.lineTo(px(0), py(h - 2.0));
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      ctx.lineTo(px(w), py(0));
      ctx.lineTo(px(w), py(8.4));
      ctx.quadraticCurveTo(px(w * 0.55), py(11.2), px(0), py(8.8));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = soft;
      ctx.fillRect(px(0), py(h - 15.6), s(w), s(15.6));
      ctx.fillStyle = grad;
      ctx.fillRect(px(0), py(h - 1.8), s(w), s(1.8));
    }
  } else if (styleId === 'modern-diagonal') {
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    ctx.lineTo(px(isBack ? 13 : 32), py(0));
    ctx.lineTo(px(isBack ? 9 : 22), py(h));
    ctx.lineTo(px(0), py(h));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    ctx.lineTo(px(isBack ? 11 : 24), py(0));
    ctx.lineTo(px(isBack ? 7 : 14), py(h));
    ctx.lineTo(px(0), py(h));
    ctx.closePath();
    ctx.fill();

    if (!isBack) {
      ctx.beginPath();
      ctx.moveTo(px(w - 13), py(0));
      ctx.lineTo(px(w), py(0));
      ctx.lineTo(px(w), py(8.4));
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = soft;
      ctx.fillRect(px(8.5), py(h - 15.4), s(w - 8.5), s(15.4));
    }
  } else if (styleId === 'academic-crest') {
    ctx.fillStyle = deep;
    ctx.fillRect(px(0), py(0), s(w), s(h));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px(1.8), py(1.8), s(w - 3.6), s(h - 3.6));
    ctx.fillStyle = grad;
    ctx.fillRect(px(1.8), py(1.8), s(w - 3.6), s(isBack ? 8.0 : 12.8));
    if (!isBack) {
      ctx.fillStyle = mid;
      ctx.fillRect(px(1.8), py(14.6), s(w - 3.6), s(1.0));
      ctx.fillStyle = soft;
      ctx.fillRect(px(w - 29.5), py(15.6), s(27.7), s(h - 17.4));
    } else {
      ctx.fillStyle = soft;
      ctx.fillRect(px(1.8), py(h - 16.4), s(w - 3.6), s(14.6));
    }
  } else if (styleId === 'lanyard-arch') {
    if (!isBack) {
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      ctx.lineTo(px(w), py(0));
      ctx.lineTo(px(w), py(31.2));
      ctx.quadraticCurveTo(px(w / 2), py(42.5), px(0), py(31.2));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    ctx.lineTo(px(w), py(0));
    ctx.lineTo(px(w), py(isBack ? 14.5 : 28.8));
    ctx.quadraticCurveTo(px(w / 2), py(isBack ? 19.6 : 40.0), px(0), py(isBack ? 14.5 : 28.8));
    ctx.closePath();
    ctx.fill();
    if (!isBack) {
      ctx.beginPath();
      ctx.moveTo(px(0), py(h));
      ctx.lineTo(px(w), py(h));
      ctx.lineTo(px(w), py(h - 4.4));
      ctx.quadraticCurveTo(px(w / 2), py(h - 7.6), px(0), py(h - 4.4));
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = soft;
      ctx.fillRect(px(0), py(h - 19.8), s(w), s(19.8));
      ctx.fillStyle = grad;
      ctx.fillRect(px(0), py(h - 2.2), s(w), s(2.2));
    }
  } else if (styleId === 'swiss-minimal') {
    ctx.fillStyle = grad;
    ctx.fillRect(px(0), py(0), s(3.6), s(h));
    ctx.fillStyle = mid;
    ctx.fillRect(px(3.6), py(0), s(1.0), s(h));
    ctx.fillStyle = soft;
    if (!isBack) ctx.fillRect(px(w - 26), py(0), s(26), s(h));
    else ctx.fillRect(px(4.6), py(h - 15.6), s(w - 4.6), s(15.6));
    ctx.fillStyle = grad;
    ctx.fillRect(px(3.6), py(h - 1.6), s(w - 3.6), s(1.6));
  } else if (styleId === 'guilloche-net') {
    ctx.fillStyle = soft;
    ctx.fillRect(px(0), py(0), s(w), s(h));
    ctx.fillStyle = grad;
    ctx.fillRect(px(0), py(0), s(w), s(2.4));
    ctx.fillRect(px(0), py(h - 2.4), s(w), s(2.4));
  }
  ctx.restore();
}
