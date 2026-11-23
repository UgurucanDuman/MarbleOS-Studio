import {
  detectShoulderTopY,
  measureContiguousRowSkin,
  refineBoxWithEyes,
  traceHairAndSkullTop,
} from './portraitGeometryHelpers';
import {
  buildPortraitMasks,
  detectFromSilhouetteOnly,
  sampleCornerBackground,
  type PortraitSubjectMetrics,
  type RawSubjectBox,
} from './portraitSubjectBg';

export type { PortraitSubjectMetrics } from './portraitSubjectBg';

/**
 * İZOLE SİSTEM KATMANI: Çevrimdışı Stüdyo Portre Yüz, Göz Çifti & Baş Konumu Algılayıcısı
 * Kesintisiz yüz genişliği + üst-yüz yaka/kazak koruması + ten-doğrulamalı göz çizgisi ile
 * gözlüklü, kâküllü, sarı saçlı veya krem/bej kazaklı tüm öğrencilerde tutarlı kadraj ölçeği sağlar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const CANONICAL_BOX_ASPECT = 3 / 4;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function detectFaceFromSkin(
  rgba: Uint8ClampedArray,
  skinMask: Uint8Array,
  fgMask: Uint8Array,
  colSkin: Float32Array,
  hasUniformBg: boolean,
  w: number,
  h: number,
): RawSubjectBox | null {
  const ySkinStart = Math.floor(h * 0.04);
  const ySkinEnd = Math.floor(h * 0.86);
  const xSkinStart = Math.floor(w * 0.06);
  const xSkinEnd = Math.floor(w * 0.94);

  const winR = Math.max(2, Math.round(w * 0.06));
  let bestX = Math.floor(w * 0.5);
  let bestScore = -1;
  for (let x = xSkinStart; x < xSkinEnd; x += 1) {
    let sum = 0;
    for (let k = Math.max(0, x - winR); k <= Math.min(w - 1, x + winR); k += 1) sum += colSkin[k]!;
    if (sum > bestScore) { bestScore = sum; bestX = x; }
  }

  const bandHalf0 = Math.round(w * 0.3);
  let cxNum = 0;
  let cxDen = 0;
  for (let x = Math.max(xSkinStart, bestX - bandHalf0); x <= Math.min(xSkinEnd - 1, bestX + bandHalf0); x += 1) {
    cxNum += x * colSkin[x]!;
    cxDen += colSkin[x]!;
  }
  let faceCx = cxDen > 0 ? cxNum / cxDen : bestX;

  const bandL = Math.max(0, Math.floor(faceCx - w * 0.42));
  const bandR = Math.min(w - 1, Math.ceil(faceCx + w * 0.42));
  const maxGap = Math.max(4, Math.round(w * 0.065));
  const rowCnt = new Int32Array(h);
  const rowW = new Float32Array(h);
  const rowMid = new Float32Array(h);
  let peakRow = 0;
  let peakY = Math.floor(h * 0.36);
  const peakLimitY = Math.floor(h * 0.62);
  for (let y = ySkinStart; y < ySkinEnd; y += 1) {
    const span = measureContiguousRowSkin(skinMask, y * w, faceCx, bandL, bandR, maxGap);
    if (!span) continue;
    rowCnt[y] = span.count;
    rowW[y] = span.hi - span.lo + 1;
    rowMid[y] = (span.lo + span.hi) * 0.5;
    if (y < peakLimitY && span.count > peakRow) {
      peakRow = span.count;
      peakY = y;
    }
  }

  const rowMinThr = Math.max(3, Math.floor(peakRow * 0.2));
  let skinTopY = peakY;
  for (let y = peakY; y >= ySkinStart; y -= 1) {
    if (rowCnt[y]! >= rowMinThr) skinTopY = y;
    else if (y <= skinTopY - 3) break;
  }
  let skinBotY = peakY;
  for (let y = peakY; y < ySkinEnd; y += 1) {
    if (rowCnt[y]! >= rowMinThr) skinBotY = y;
    else if (y >= skinBotY + 3) break;
  }

  // Üst yüz bandı (alın-elmacık): krem/bej ceket ve kazak omuzlarının yüz genişliğini şişirmesini keser
  const upperBandEnd = Math.min(skinBotY, skinTopY + Math.round(h * 0.28));
  const upperWs: number[] = [];
  for (let y = skinTopY + 1; y <= upperBandEnd; y += 1) {
    if (rowW[y]! > 0) upperWs.push(rowW[y]!);
  }
  if (upperWs.length < 3) return null;
  upperWs.sort((a, b) => a - b);
  const upperRefW = upperWs[Math.floor(upperWs.length * 0.72)]!;

  const faceWidths: number[] = [];
  const widthEndY = Math.min(skinBotY, skinTopY + Math.round(h * 0.48));
  let jacketCutY = skinBotY;
  let wideJumpRun = 0;
  let narrowStopRun = 0;
  for (let y = skinTopY; y <= widthEndY; y += 1) {
    const rw = rowW[y]!;
    if (rw <= 0) continue;
    if (y > skinTopY + Math.round(h * 0.16)) {
      if (rw > upperRefW * 1.3) {
        wideJumpRun += 1;
        if (wideJumpRun >= 2) { jacketCutY = Math.min(jacketCutY, y - 2); break; }
        continue;
      }
      wideJumpRun = 0;
      if (rw < upperRefW * 0.56) {
        narrowStopRun += 1;
        if (narrowStopRun >= 2) break;
      } else {
        narrowStopRun = 0;
      }
    }
    faceWidths.push(rw);
  }
  if (faceWidths.length < 4) return null;
  faceWidths.sort((a, b) => a - b);
  const faceW = faceWidths[Math.floor(faceWidths.length * 0.78)]!;

  const shoulderTopY = hasUniformBg ? detectShoulderTopY(fgMask, faceCx, skinTopY, faceW, w, h) : null;
  const maxChinByAnatomy = Math.min(skinBotY, jacketCutY, Math.round(skinTopY + faceW * 1.46));
  const chinCapY = shoulderTopY !== null ? Math.min(maxChinByAnatomy, shoulderTopY) : maxChinByAnatomy;

  const chinStart = skinTopY + Math.floor(Math.max(4, chinCapY - skinTopY) * 0.58);
  let narrowRun = 0;
  let chinPx = chinCapY;
  for (let y = chinStart; y <= chinCapY; y += 1) {
    if (rowW[y]! < faceW * 0.48) {
      narrowRun += 1;
      if (narrowRun >= 3) { chinPx = y - 2; break; }
    } else {
      narrowRun = 0;
    }
  }

  let midSum = 0;
  let midCnt = 0;
  for (let y = skinTopY; y <= chinPx; y += 1) {
    if (rowW[y]! >= faceW * 0.45 && rowW[y]! <= faceW * 1.25) { midSum += rowMid[y]!; midCnt += 1; }
  }
  if (midCnt > 0) faceCx = midSum / midCnt;

  const { hairTopPx, skullTopPx } = traceHairAndSkullTop(fgMask, hasUniformBg, faceCx, skinTopY, chinPx, faceW, w);
  return refineBoxWithEyes(
    { faceCx, hairTopPx, skullTopPx, chinPx, faceW, confidence: hasUniformBg ? 0.9 : 0.72 },
    rgba, skinMask, fgMask, hasUniformBg, w, h, skinTopY, shoulderTopY,
  );
}

export function detectPortraitSubjectFromRgba(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  boxAspect = CANONICAL_BOX_ASPECT,
): PortraitSubjectMetrics | null {
  if (w < 24 || h < 24 || rgba.length < w * h * 4) return null;
  const imgAspect = w / h;
  const scaleX = imgAspect > boxAspect ? imgAspect / boxAspect : 1;
  const scaleY = imgAspect > boxAspect ? 1 : boxAspect / imgAspect;

  const bg = sampleCornerBackground(rgba, w, h);
  const { skinMask, fgMask, colSkin, skinCount } = buildPortraitMasks(rgba, w, h, bg);

  let raw = skinCount >= Math.max(18, w * h * 0.008)
    ? detectFaceFromSkin(rgba, skinMask, fgMask, colSkin, bg.hasUniformBg, w, h)
    : null;
  if ((!raw || raw.confidence < 0.35) && bg.hasUniformBg) {
    raw = detectFromSilhouetteOnly(fgMask, w, h);
  }
  if (!raw || raw.confidence < 0.35) return null;

  const hairTopY = (raw.hairTopPx / h - 0.5) * scaleY;
  const skullTopY = (raw.skullTopPx / h - 0.5) * scaleY;
  const chinY = (raw.chinPx / h - 0.5) * scaleY;
  const faceCenterX = (raw.faceCx / w - 0.5) * scaleX;
  const skullHeight = clamp(chinY - skullTopY, 0.08, 1.2 * scaleY);
  const faceWidth = clamp((raw.faceW / w) * scaleX, 0.06, 1.0 * scaleX);
  const eyeY = raw.eyePx !== undefined ? (raw.eyePx / h - 0.5) * scaleY : undefined;
  const eyeSep = raw.eyeSepPx !== undefined ? clamp((raw.eyeSepPx / w) * scaleX, 0.03, 0.6 * scaleX) : undefined;
  const headMetric =
    eyeSep !== undefined
      ? 0.55 * skullHeight + 0.35 * (faceWidth * 1.3) + 0.1 * (eyeSep * 2.85)
      : 0.6 * skullHeight + 0.4 * (faceWidth * 1.3);

  return {
    faceCenterX, hairTopY, skullTopY, chinY,
    headMidY: (skullTopY + chinY) * 0.5,
    skullHeight, faceWidth, headMetric, scaleX, scaleY,
    confidence: raw.confidence,
    ...(eyeY !== undefined ? { eyeY } : {}),
    ...(eyeSep !== undefined ? { eyeSep } : {}),
    hasUniformBg: bg.hasUniformBg,
    bgTopLeft: bg.topLeft,
    bgTopRight: bg.topRight,
  };
}
