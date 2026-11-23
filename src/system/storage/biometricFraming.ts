import type { PhotoAdjustments } from '../sqlite/types';
import { resolveFullAdjustments } from './photoColorMath';
import { effectivePhotoZoom, safeCoverPanLimit } from './portraitSmartAlignMath';
import type { PortraitSubjectMetrics } from './portraitSubjectBg';
import { detectPortraitSubjectFromRgba } from './portraitSubjectDetect';

/**
 * İZOLE SİSTEM KATMANI: NVİ / ICAO 50×60 mm Otomatik Biyometrik Kadraj & Saç Payı Motoru
 * Saç tepesini (topuz/toka dahil) üst kenardan asla kesmeden ~5.5 mm (~%9.5) temiz üst boşluk,
 * ~33 mm (%55) standart baş oranı ve yatay merkezleme üretir.
 * Canlı önizleme ile 300 DPI PDF / Doğrudan Baskı birebir aynı matematiği kullanır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const BIOMETRIC_ASPECT = 50 / 60;
const CANONICAL_ASPECT = 3 / 4;
const TARGET_HAIR_TOP = -0.405; // 60 mm'nin %9.5'i = ~5.7 mm üst boşluk (ICAO / NVİ standardı)
const MIN_HAIR_TOP = -0.422; // En az ~4.7 mm üst boşluk koruması
const TARGET_HEAD_SPAN = 0.56; // Saç-çene toplamı ~33.6 mm (ICAO 32–36 mm)
const MAX_CHIN_Y = 0.345; // Alt kenarda en az ~9.3 mm boyun/omuz payı
const MAX_TOP_BACKDROP_EXT = -0.34; // Düz stüdyo fonda üstten en fazla %16 (~9.6 mm) kusursuz fon uzatması

export interface BiometricIcaoPlan {
  zoom: number;
  panX: number; // % of box width
  panY: number; // % of box height
  tilt: number;
  rotation: number;
  /** 5:6 kutusuna göre döndürülmemiş kaynak görüntünün genişlik oranı (rawDrawW / W) */
  rawWidthFrac: number;
  /** 5:6 kutusuna göre döndürülmemiş kaynak görüntünün yükseklik oranı (rawDrawH / H) */
  rawHeightFrac: number;
  /** Üst kenar düz stüdyo fon rengiyle uzatıldıysa true */
  isTopExtended: boolean;
  bgLeft: readonly [number, number, number];
  bgRight: readonly [number, number, number];
  backdropCss: string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function rgbTupleCss(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * 3:4 kanonik algılama metriklerini 50×60 mm (5:6) biyometrik çerçeveye dönüştürüp
 * NVİ / ICAO saç tepesi payı, baş ölçeği ve omuz kenar korumalı kadraj planını hesaplar.
 */
export function computeBiometricIcaoPlan(
  subject: PortraitSubjectMetrics,
  currentAdj: PhotoAdjustments,
): BiometricIcaoPlan {
  const full = resolveFullAdjustments(currentAdj);
  const rot = full.rotation;
  const swap = rot === 90 || rot === 270;

  // 3:4 kanonik cover ölçeklerinden döndürülmüş görüntünün gerçek en/boy oranını kesin çıkar
  const effAspect = CANONICAL_ASPECT * (subject.scaleX / Math.max(0.01, subject.scaleY));
  const bioScaleX = effAspect > BIOMETRIC_ASPECT ? effAspect / BIOMETRIC_ASPECT : 1;
  const bioScaleY = effAspect > BIOMETRIC_ASPECT ? 1 : BIOMETRIC_ASPECT / effAspect;

  const kx = bioScaleX / Math.max(0.01, subject.scaleX);
  const ky = bioScaleY / Math.max(0.01, subject.scaleY);

  const faceCx = subject.faceCenterX * kx;
  const hairTop = subject.hairTopY * ky;
  const skullTop = subject.skullTopY * ky;
  const chin = subject.chinY * ky;
  const headSpan = Math.max(0.16, chin - hairTop);
  const skullSpan = Math.max(0.12, chin - skullTop);
  const metricSpan = 0.65 * headSpan + 0.35 * skullSpan;

  const minTiltZoom = effectivePhotoZoom(1, full.tilt);
  const minCoverZoom = Math.max(minTiltZoom, 1 / Math.max(1, bioScaleX));

  // 1. İdeal ICAO baş yüksekliği (~%56 = 33.6 mm) için yakınlaştırma
  const idealZoom = TARGET_HEAD_SPAN / Math.max(0.18, metricSpan);
  let zoom = clamp(idealZoom, minCoverZoom, 1.85);

  // 2. Yatay merkezleme (sol/sağ omuz kenarı asla açılmadan)
  let panX = -faceCx;
  const maxSafePanX = Math.max(0, 0.5 * bioScaleX - 0.5 / zoom);
  if (Math.abs(panX) > maxSafePanX) {
    // Hafif merkezleme için makul düzeyde zoom artır, fakat başı boğma
    const neededForX = Math.abs(panX) < 0.45 * bioScaleX
      ? 0.5 / (0.5 * bioScaleX - Math.abs(panX))
      : zoom;
    const maxZoomForX = Math.min(1.85, zoom * 1.18);
    if (neededForX <= maxZoomForX) {
      zoom = Math.max(zoom, neededForX);
    }
    const finalSafePanX = Math.max(0, 0.5 * bioScaleX - 0.5 / zoom);
    panX = clamp(panX, -finalSafePanX, finalSafePanX);
  }

  // 3. Dikey saç tepesi payı (~5.7 mm temiz boşluk) & alt omuz/çene dengesi
  let panY = TARGET_HAIR_TOP / zoom - hairTop;
  let placedChin = zoom * (chin + panY);

  // Çene çok aşağı indiyse mümkünse yakınlaştırmayı gevşet
  if (placedChin > MAX_CHIN_Y && zoom > minCoverZoom) {
    const allowedSpan = Math.max(0.32, MAX_CHIN_Y - TARGET_HAIR_TOP);
    zoom = clamp(Math.min(zoom, allowedSpan / headSpan), minCoverZoom, 1.85);
    const safeX = Math.max(0, 0.5 * bioScaleX - 0.5 / zoom);
    panX = clamp(-faceCx, -safeX, safeX);
    panY = TARGET_HAIR_TOP / zoom - hairTop;
    placedChin = zoom * (chin + panY);
  }

  // Alt kenar (kıyafet/omuz) asla kutunun üstüne çıkmasın (placedBot >= +0.5)
  const minPanYForBottom = 0.5 / zoom - 0.5 * bioScaleY;

  // Üst kenar: düz stüdyo fonda saç payı için kusursuz fon uzatmasına izin ver;
  // desenli/karmaşık fonda kaynağın kendi üst kenarıyla sınırla
  const uniformBg = subject.hasUniformBg === true;
  const maxAllowedImgTop = uniformBg ? MAX_TOP_BACKDROP_EXT : -0.5;
  const maxPanYForTop = maxAllowedImgTop / zoom + 0.5 * bioScaleY;

  // Eğer çene yine de MAX_CHIN_Y sınırını aşıyorsa saç tepesini MIN_HAIR_TOP'a kadar koruyarak dengele
  if (placedChin > MAX_CHIN_Y) {
    const chinFriendlyPanY = MAX_CHIN_Y / zoom - chin;
    const minHairSafePanY = MIN_HAIR_TOP / zoom - hairTop;
    panY = Math.max(minHairSafePanY, Math.min(panY, chinFriendlyPanY));
  }

  panY = clamp(panY, minPanYForBottom, Math.max(minPanYForBottom, maxPanYForTop));

  // Düz fon yoksa genel cover pan sınırını da uygula
  if (!uniformBg) {
    const coverLim = Math.min(0.45, safeCoverPanLimit(zoom));
    panX = clamp(panX, -coverLim, coverLim);
    panY = clamp(panY, -coverLim, Math.max(coverLim, 0.5 * bioScaleY - 0.5 / zoom));
  }

  const placedImgTop = zoom * (-0.5 * bioScaleY + panY);
  const bgLeft: readonly [number, number, number] = subject.bgTopLeft ?? [245, 247, 250];
  const bgRight: readonly [number, number, number] = subject.bgTopRight ?? bgLeft;

  const rawWidthFrac = swap ? bioScaleY / BIOMETRIC_ASPECT : bioScaleX;
  const rawHeightFrac = swap ? bioScaleX * BIOMETRIC_ASPECT : bioScaleY;

  return {
    zoom: round3(zoom),
    panX: round2(panX * 100),
    panY: round2(panY * 100),
    tilt: full.tilt,
    rotation: rot,
    rawWidthFrac: round3(rawWidthFrac),
    rawHeightFrac: round3(rawHeightFrac),
    isTopExtended: uniformBg && placedImgTop > -0.496,
    bgLeft,
    bgRight,
    backdropCss: `linear-gradient(90deg, ${rgbTupleCss(bgLeft)} 0%, ${rgbTupleCss(bgRight)} 100%)`,
  };
}

/** 300 DPI işleyicide decode edilmiş tam çözünürlüklü görseli hızlıca (<= 224 px) analiz eder. */
export function analyzeDrawableForBiometric(
  drawable: CanvasImageSource,
  naturalW: number,
  naturalH: number,
  rotation: number,
): PortraitSubjectMetrics | null {
  if (typeof document === 'undefined' || naturalW < 24 || naturalH < 24) return null;
  const swap = rotation === 90 || rotation === 270;
  const srcW = swap ? naturalH : naturalW;
  const srcH = swap ? naturalW : naturalH;
  const scale = Math.min(1, 224 / Math.max(srcW, srcH));
  const aw = Math.max(1, Math.round(srcW * scale));
  const ah = Math.max(1, Math.round(srcH * scale));
  if (aw < 24 || ah < 24) return null;

  const tmp = document.createElement('canvas');
  tmp.width = aw;
  tmp.height = ah;
  const ctx = tmp.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.save();
  ctx.translate(aw / 2, ah / 2);
  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(drawable, (-naturalW * scale) / 2, (-naturalH * scale) / 2, naturalW * scale, naturalH * scale);
  ctx.restore();
  try {
    const imgData = ctx.getImageData(0, 0, aw, ah);
    return detectPortraitSubjectFromRgba(imgData.data, aw, ah);
  } catch {
    return null;
  }
}

