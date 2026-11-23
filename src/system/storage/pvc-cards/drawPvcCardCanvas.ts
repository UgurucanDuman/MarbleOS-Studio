import { mmToPx, PRINT_DPI } from '../binaryPrintFormats';
import { DEFAULT_PRINT_FONT_PT } from '../printTypography';
import type { TeacherChartPalette } from '../teacher-charts/types';
import { paintPvcArtworkOnCanvas } from './cardArtworkCanvas';
import { drawCode128OnCanvas } from './code128Encoder';
import {
  pvcFontFamilyCss,
  resolvePvcCodePayload,
  resolvePvcColorToken,
  resolvePvcFieldValue,
} from './fieldResolver';
import { resolveElementsForMedia } from './mediaLayoutAdjust';
import {
  createLinearGradientOnCanvas,
  drawBitmapFitted,
  drawWrappedPvcText,
  paintPvcShapeElement,
  tracePhotoClipPath,
  traceRoundedRect,
} from './pvcCanvasPrimitives';
import { drawQrCodeOnCanvas } from './qrCodeEncoder';
import type {
  PvcCardDataContext,
  PvcCardElement,
  PvcCardSide,
  PvcResolvedDesign,
} from './types';

/**
 * İZOLE SİSTEM 300 DPI PVC KİMLİK KARTI TUVAL RESSAMI:
 * Vektör grafik desenler, gradyanlar, döndürme, daire/kemer/altıgen portreler,
 * stüdyo logosu, özel görseller, gerçek Code128 barkod ve QR kodları 300 DPI işler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PvcCardCanvasBitmaps {
  portrait?: HTMLCanvasElement | null;
  logo?: HTMLCanvasElement | null;
  studioLogo?: HTMLCanvasElement | null;
  principalSig?: HTMLCanvasElement | null;
  deputySig?: HTMLCanvasElement | null;
  frontBg?: HTMLCanvasElement | null;
  backBg?: HTMLCanvasElement | null;
  elementImages?: ReadonlyMap<string, HTMLCanvasElement>;
}

function paintElement(options: {
  ctx: CanvasRenderingContext2D;
  el: PvcCardElement;
  cardX: number;
  cardY: number;
  pxPerMm: number;
  fontScale: number;
  palette: TeacherChartPalette;
  data: PvcCardDataContext;
  bitmaps: PvcCardCanvasBitmaps;
}): void {
  const { ctx, el, cardX, cardY, pxPerMm, fontScale, palette, data, bitmaps } = options;
  if (el.visible === false) return;

  const x = cardX + el.xMm * pxPerMm;
  const y = cardY + el.yMm * pxPerMm;
  const w = Math.max(1, el.wMm * pxPerMm);
  const h = Math.max(1, el.hMm * pxPerMm);
  const r = (el.radiusMm ?? 0) * pxPerMm;

  ctx.save();
  if (el.opacity !== undefined && el.opacity < 1) ctx.globalAlpha = el.opacity;
  if (el.rotationDeg) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((el.rotationDeg * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  if (el.kind === 'shape') {
    paintPvcShapeElement(ctx, el, x, y, w, h, r, pxPerMm, palette);
    ctx.restore();
    return;
  }

  if (el.kind === 'photo') {
    const shape = el.photoShape ?? 'rounded';
    const fit = el.imageFit ?? 'cover';
    tracePhotoClipPath(ctx, x, y, w, h, shape, r);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = fit === 'contain' ? '#ffffff' : '#e4e4e7';
    ctx.fillRect(x, y, w, h);
    if (bitmaps.portrait) {
      const defaultPosY = el.wMm / Math.max(0.1, el.hMm) > 0.78 ? 16 : 24;
      drawBitmapFitted(
        ctx,
        bitmaps.portrait,
        x,
        y,
        w,
        h,
        fit,
        el.photoZoom ?? 1,
        el.photoPosX ?? 50,
        el.photoPosY ?? defaultPosY,
      );
    }
    ctx.restore();
    if (el.borderColor && (el.borderWidthMm ?? 0) > 0 && shape !== 'hexagon') {
      tracePhotoClipPath(ctx, x, y, w, h, shape, r);
      ctx.strokeStyle = resolvePvcColorToken(el.borderColor, palette, palette.accent);
      ctx.lineWidth = Math.max(1, (el.borderWidthMm ?? 0.35) * pxPerMm);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (el.kind === 'school-logo' || el.kind === 'studio-logo' || el.kind === 'signature' || el.kind === 'image') {
    const bmp =
      el.kind === 'school-logo' ? bitmaps.logo
        : el.kind === 'studio-logo' ? bitmaps.studioLogo
          : el.kind === 'image' ? (bitmaps.elementImages?.get(el.id) ?? null)
            : el.sigRole === 'deputy' ? bitmaps.deputySig : bitmaps.principalSig;
    if (bmp) {
      const drawH = el.kind === 'signature' ? h * 0.74 : h;
      traceRoundedRect(ctx, x, y, w, drawH, r);
      ctx.save();
      ctx.clip();
      drawBitmapFitted(ctx, bmp, x, y, w, drawH, el.kind === 'image' ? (el.imageFit ?? 'contain') : 'contain');
      ctx.restore();
      if (el.kind === 'signature') {
        const capPx = Math.max(7, 4.6 * 0.352778 * pxPerMm);
        ctx.fillStyle = palette.inkSecondary;
        ctx.font = `600 ${capPx.toFixed(1)}px Inter, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(el.sigRole === 'deputy' ? 'Müdür Yrd.' : 'Okul Müdürü', x + w / 2, y + h, w);
      }
    }
    ctx.restore();
    return;
  }

  if (el.kind === 'barcode') {
    drawCode128OnCanvas({
      ctx, value: resolvePvcCodePayload(el.codeSource, data), x, y, w, h,
      color: resolvePvcColorToken(el.textColor, palette, '#09090b'), showText: el.showCodeText ?? true,
    });
    ctx.restore();
    return;
  }

  if (el.kind === 'qrcode') {
    drawQrCodeOnCanvas({
      ctx, value: resolvePvcCodePayload(el.codeSource, data), x, y, w, h,
      color: resolvePvcColorToken(el.textColor, palette, '#09090b'),
    });
    ctx.restore();
    return;
  }

  const rawText = el.kind === 'field' && el.fieldKey
    ? resolvePvcFieldValue(el.fieldKey, data, el.prefix ?? '')
    : (el.text ?? '');
  const content = el.uppercase ? rawText.toLocaleUpperCase('tr-TR') : rawText;
  if (content) {
    const pt = (el.fontSizePt ?? 6.5) * fontScale;
    const fontPx = Math.max(6, pt * 0.352778 * pxPerMm);
    ctx.fillStyle = resolvePvcColorToken(el.textColor, palette, palette.inkPrimary);
    ctx.font = `${el.fontWeight ?? 600} ${fontPx.toFixed(1)}px ${pvcFontFamilyCss(el.fontFamily)}`;
    drawWrappedPvcText({ ctx, text: content, x, y, w, h, fontPx, maxLines: el.maxLines ?? 1, align: el.align ?? 'left' });
  }
  ctx.restore();
}

export function paintPvcCardToCanvas(options: {
  ctx: CanvasRenderingContext2D;
  design: PvcResolvedDesign;
  side: PvcCardSide;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  palette: TeacherChartPalette;
  data: PvcCardDataContext;
  bitmaps: PvcCardCanvasBitmaps;
  printFontPt?: number;
  drawOuterBorder?: boolean;
}): void {
  const {
    ctx, design, side, xPx, yPx, widthPx, heightPx,
    palette, data, bitmaps, printFontPt = DEFAULT_PRINT_FONT_PT, drawOuterBorder = true,
  } = options;
  const spec = side === 'back' ? design.back : design.front;
  const pxPerMm = widthPx / design.widthMm;
  const cardRadiusPx = Math.max(0, (design.cardRadiusMm ?? 0) * pxPerMm);
  const fontScale = 1 + (printFontPt - DEFAULT_PRINT_FONT_PT) * 0.14;

  ctx.save();
  traceRoundedRect(ctx, xPx, yPx, widthPx, heightPx, cardRadiusPx);
  ctx.clip();

  const bg1 = resolvePvcColorToken(spec.backgroundColor, palette, '#ffffff');
  const bg2 = spec.backgroundColor2 ? resolvePvcColorToken(spec.backgroundColor2, palette, bg1) : '';
  ctx.fillStyle = bg2
    ? createLinearGradientOnCanvas(ctx, xPx, yPx, widthPx, heightPx, spec.backgroundGradientAngle ?? 135, bg1, bg2)
    : bg1;
  ctx.fillRect(xPx, yPx, widthPx, heightPx);

  if (spec.artworkStyle && spec.artworkStyle !== 'none') {
    paintPvcArtworkOnCanvas({ ctx, styleId: spec.artworkStyle, side, cardX: xPx, cardY: yPx, widthMm: design.widthMm, heightMm: design.heightMm, pxPerMm, palette });
  }

  const bgBmp = side === 'back' ? bitmaps.backBg : bitmaps.frontBg;
  if (bgBmp) {
    ctx.save();
    ctx.globalAlpha = spec.backgroundOpacity ?? 1;
    drawBitmapFitted(ctx, bgBmp, xPx, yPx, widthPx, heightPx, spec.backgroundFit ?? 'cover');
    ctx.restore();
  }

  const adjustedElements = resolveElementsForMedia(spec.elements, {
    hasSchoolLogo: Boolean(bitmaps.logo),
    hasStudioLogo: Boolean(bitmaps.studioLogo),
    cardWidthMm: design.widthMm,
  });
  for (const el of adjustedElements) {
    paintElement({ ctx, el, cardX: xPx, cardY: yPx, pxPerMm, fontScale, palette, data, bitmaps });
  }
  ctx.restore();

  if (drawOuterBorder) {
    ctx.save();
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = Math.max(1, mmToPx(0.18, PRINT_DPI));
    traceRoundedRect(ctx, xPx, yPx, widthPx, heightPx, cardRadiusPx);
    ctx.stroke();
    ctx.restore();
  }
}
