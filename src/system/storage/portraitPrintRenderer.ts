import { loadDesktopPhotoOriginal, usesDesktopStorage } from '../desktop/desktopStorage';
import type { PhotoRecord } from '../sqlite/types';
import { injectJfif300Dpi, PRINT_DPI } from './binaryPrintFormats';
import {
  analyzeDrawableForBiometric,
  computeBiometricIcaoPlan,
  rgbTupleCss,
} from './biometricFraming';
import { loadBrowserPhoto } from './browserWorkspace';
import { isDefaultAdjustments, resolveFullAdjustments } from './photoColorMath';
import { effectivePhotoZoom } from './portraitSmartAlignMath';
import { applyPixelToneAndSharpen } from './portraitPixelPass';
import { decodeFullResImage } from './printImageDecode';

/**
 * İZOLE SİSTEM KATMANI: Tam Çözünürlüklü 300 DPI Portre İşleyici
 * Orijinal fotoğrafı yükler, WebGL Karanlık Oda ile birebir aynı 12 parametreyi uygular
 * ve JFIF 300 DPI yoğunluk başlıklı JPEG ile etkin DPI değerini üretir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface RenderedPortraitResult {
  canvas: HTMLCanvasElement;
  jpegBytes: Uint8Array;
  sourceWidth: number;
  sourceHeight: number;
  effectiveDpi: number;
}

export async function loadOriginalPhotoDataUrl(photo: PhotoRecord): Promise<string> {
  if (usesDesktopStorage) {
    return loadDesktopPhotoOriginal(photo.id, photo.contentHash);
  }
  if (photo.dataUrl) {
    return photo.dataUrl;
  }
  return loadBrowserPhoto(photo.id);
}

export async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality = 0.93,
  dpi = PRINT_DPI,
): Promise<Uint8Array> {
  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (blob) {
      return injectJfif300Dpi(new Uint8Array(await blob.arrayBuffer()), dpi);
    }
  }
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const comma = dataUrl.indexOf(',');
  const bin = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return injectJfif300Dpi(bytes, dpi);
}

export async function renderPortraitAtPhysicalSpec(options: {
  photo: PhotoRecord;
  targetWidthPx: number;
  targetHeightPx: number;
  physicalWidthMm: number;
  dpi?: number;
  maxFileBytes?: number;
  workCanvas?: HTMLCanvasElement;
  biometricIcao?: boolean;
}): Promise<RenderedPortraitResult> {
  const {
    photo,
    targetWidthPx,
    targetHeightPx,
    physicalWidthMm,
    dpi = PRINT_DPI,
    maxFileBytes,
    workCanvas,
    biometricIcao = false,
  } = options;

  const dataUrl = await loadOriginalPhotoDataUrl(photo);
  const decoded = await decodeFullResImage(dataUrl);
  try {
    const full = resolveFullAdjustments(photo.adjustments);
    const bioSubject = biometricIcao
      ? analyzeDrawableForBiometric(decoded.drawable, decoded.width, decoded.height, full.rotation)
      : null;
    const bioPlan = bioSubject && bioSubject.confidence >= 0.35
      ? computeBiometricIcaoPlan(bioSubject, photo.adjustments)
      : null;

    const canvas = workCanvas ?? document.createElement('canvas');
    if (canvas.width !== targetWidthPx || canvas.height !== targetHeightPx) {
      canvas.width = targetWidthPx;
      canvas.height = targetHeightPx;
    }
    const ctx = canvas.getContext('2d', {
      colorSpace: 'srgb',
      willReadFrequently: !isDefaultAdjustments(photo.adjustments),
    });
    if (!ctx) throw new Error('2D baskı tuvali başlatılamadı.');

    const effW = full.rotation === 90 || full.rotation === 270 ? decoded.height : decoded.width;
    const effH = full.rotation === 90 || full.rotation === 270 ? decoded.width : decoded.height;
    const baseScale = Math.max(targetWidthPx / effW, targetHeightPx / effH);
    const orientedDrawW = effW * baseScale;
    const rawDrawW = decoded.width * baseScale;
    const rawDrawH = decoded.height * baseScale;

    const activeTilt = bioPlan ? bioPlan.tilt : full.tilt;
    const activePanX = bioPlan ? bioPlan.panX : full.panX;
    const activePanY = bioPlan ? bioPlan.panY : full.panY;
    const tiltRad = (activeTilt * Math.PI) / 180;
    const effZoom = bioPlan ? bioPlan.zoom : effectivePhotoZoom(full.zoom, full.tilt);

    const scaleX = orientedDrawW / targetWidthPx;
    const visibleSrcW = effW / (scaleX * effZoom);
    const effectiveDpi = Math.round(visibleSrcW / Math.max(0.1, physicalWidthMm / 25.4));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bioPlan) {
      const grad = ctx.createLinearGradient(0, 0, targetWidthPx, 0);
      grad.addColorStop(0, rgbTupleCss(bioPlan.bgLeft));
      grad.addColorStop(1, rgbTupleCss(bioPlan.bgRight));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#f8fafc';
    }
    ctx.fillRect(0, 0, targetWidthPx, targetHeightPx);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.translate(targetWidthPx / 2, targetHeightPx / 2);
    ctx.scale(effZoom, effZoom);
    if (tiltRad !== 0) ctx.rotate(tiltRad);
    if (activePanX !== 0 || activePanY !== 0) {
      ctx.translate((activePanX / 100) * targetWidthPx, (activePanY / 100) * targetHeightPx);
    }
    if (full.rotation !== 0) ctx.rotate((full.rotation * Math.PI) / 180);
    ctx.drawImage(decoded.drawable, -rawDrawW / 2, -rawDrawH / 2, rawDrawW, rawDrawH);
    ctx.restore();

    applyPixelToneAndSharpen(ctx, targetWidthPx, targetHeightPx, full);

    let quality = maxFileBytes ? 0.9 : 0.95;
    let jpegBytes = await canvasToJpegBytes(canvas, quality, dpi);
    while (maxFileBytes && jpegBytes.byteLength > maxFileBytes && quality > 0.46) {
      quality = Number((quality - 0.1).toFixed(2));
      jpegBytes = await canvasToJpegBytes(canvas, quality, dpi);
    }

    return {
      canvas,
      jpegBytes,
      sourceWidth: decoded.width,
      sourceHeight: decoded.height,
      effectiveDpi,
    };
  } finally {
    decoded.dispose();
  }
}
