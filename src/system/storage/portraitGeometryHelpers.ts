import { detectEyePairMetrics } from './portraitEyeDetect';
import type { RawSubjectBox } from './portraitSubjectBg';

/**
 * İZOLE SİSTEM KATMANI: Portre Silüet, Omuz Sınırı, Saç Tepesi & Göz-Çerçeve İyileştirme Yardımcıları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Verilen yatay satırda faceCx merkezli kesintisiz ten kümesinin sol/sağ sınırını ölçer (yan örgü/kolu dışlar). */
export function measureContiguousRowSkin(
  skinMask: Uint8Array,
  rowOff: number,
  faceCx: number,
  bandL: number,
  bandR: number,
  maxGap: number,
): { lo: number; hi: number; count: number } | null {
  const cx = clamp(Math.round(faceCx), bandL, bandR);
  let seed = -1;
  for (let d = 0; d <= maxGap * 3; d += 1) {
    if (cx + d <= bandR && skinMask[rowOff + cx + d]) { seed = cx + d; break; }
    if (cx - d >= bandL && skinMask[rowOff + cx - d]) { seed = cx - d; break; }
  }
  if (seed < 0) return null;
  let lo = seed;
  let gap = 0;
  let count = 1;
  for (let x = seed - 1; x >= bandL; x -= 1) {
    if (skinMask[rowOff + x]) { lo = x; count += 1; gap = 0; }
    else { gap += 1; if (gap > maxGap) break; }
  }
  let hi = seed;
  gap = 0;
  for (let x = seed + 1; x <= bandR; x += 1) {
    if (skinMask[rowOff + x]) { hi = x; count += 1; gap = 0; }
    else { gap += 1; if (gap > maxGap) break; }
  }
  return count >= 3 ? { lo, hi, count } : null;
}

/** Alın üstünden yukarı doğru ön plan silüetini tarayarak saç tepesi (hairTopPx) ve kafatası üstünü bulur. */
export function traceHairAndSkullTop(
  fgMask: Uint8Array,
  hasUniformBg: boolean,
  faceCx: number,
  skinTopY: number,
  chinPx: number,
  faceW: number,
  w: number,
): { hairTopPx: number; skullTopPx: number } {
  if (!hasUniformBg) {
    const skinH = Math.max(8, chinPx - skinTopY);
    const skullTopPx = Math.max(0, skinTopY - skinH * 0.34);
    return { hairTopPx: Math.max(0, skullTopPx - skinH * 0.06), skullTopPx };
  }
  const hHalf = Math.max(faceW * 0.78, w * 0.14);
  const hl = Math.max(0, Math.floor(faceCx - hHalf));
  const hr = Math.min(w - 1, Math.ceil(faceCx + hHalf));
  let hairTopPx = skinTopY;
  let skullTopPx = skinTopY;
  let emptyRun = 0;
  for (let y = skinTopY; y >= 0; y -= 1) {
    const rowOff = y * w;
    let fgCnt = 0;
    for (let x = hl; x <= hr; x += 1) fgCnt += fgMask[rowOff + x]!;
    if (fgCnt >= Math.max(2, faceW * 0.05)) {
      hairTopPx = y;
      emptyRun = 0;
      if (fgCnt >= faceW * 0.46) skullTopPx = y;
    } else {
      emptyRun += 1;
      if (emptyRun >= 3) break;
    }
  }
  return { hairTopPx, skullTopPx };
}

/**
 * Çene ve boyun altı seviyesinde (kulak/örgülere takılmadan) omuzlara ani genişleme satırını bulur.
 * Bej/krem kazak veya açık renkli yakaların çene algısını göğse indirmesini kesin olarak engeller.
 */
export function detectShoulderTopY(
  fgMask: Uint8Array,
  faceCx: number,
  skinTopY: number,
  faceW: number,
  w: number,
  h: number,
): number | null {
  const yStart = Math.max(0, Math.floor(skinTopY + faceW * 0.92));
  const yEnd = Math.min(h - 1, Math.ceil(skinTopY + faceW * 2.15));
  if (yEnd <= yStart + 4) return null;

  let minSpan = faceW * 1.18;
  let wideRun = 0;

  for (let y = yStart; y <= yEnd; y += 1) {
    const rowOff = y * w;
    let first = -1;
    let last = -1;
    for (let x = 0; x < w; x += 1) {
      if (!fgMask[rowOff + x]) continue;
      if (first < 0) first = x;
      last = x;
    }
    if (first < 0 || last < faceCx - faceW * 0.4 || first > faceCx + faceW * 0.4) continue;
    const span = last - first + 1;
    if (span < minSpan && span >= faceW * 0.25) {
      minSpan = span;
      wideRun = 0;
      continue;
    }
    const shoulderThreshold = Math.max(faceW * 1.38, minSpan * 1.34);
    if (span >= shoulderThreshold) {
      wideRun += 1;
      if (wideRun >= 2) return Math.max(yStart, y - 2);
    } else {
      wideRun = 0;
    }
  }
  return null;
}

/** Ten ve silüetle bulunan baş kutusunu göz çizgisi ve anatomik kafa oranlarıyla doğrular. */
export function refineBoxWithEyes(
  raw: RawSubjectBox,
  rgba: Uint8ClampedArray,
  skinMask: Uint8Array,
  fgMask: Uint8Array,
  hasUniformBg: boolean,
  w: number,
  h: number,
  skinTopY: number,
  shoulderTopY: number | null,
): RawSubjectBox {
  const eyePair = detectEyePairMetrics(
    rgba, skinMask, fgMask, hasUniformBg, w, h,
    raw.faceCx, raw.skullTopPx, skinTopY, raw.chinPx, raw.faceW,
  );
  if (!eyePair) {
    const rawH = raw.chinPx - raw.skullTopPx;
    const chinPx = clamp(raw.chinPx, raw.skullTopPx + raw.faceW * 1.12, Math.min(h - 1, raw.skullTopPx + raw.faceW * 1.65));
    return rawH > raw.faceW * 1.65 || rawH < raw.faceW * 1.12 ? { ...raw, chinPx } : raw;
  }
  const faceCx = 0.55 * eyePair.eyeCx + 0.45 * raw.faceCx;
  const minChin = eyePair.eyeY + raw.faceW * 0.5;
  const maxChin = Math.min(shoulderTopY ?? h - 1, eyePair.eyeY + raw.faceW * 0.88);
  const chinPx = clamp(raw.chinPx, minChin, Math.max(minChin, maxChin));
  const minSkull = Math.max(raw.hairTopPx, eyePair.eyeY - raw.faceW * 0.86);
  const maxSkull = Math.max(0, eyePair.eyeY - raw.faceW * 0.48);
  const skullTopPx = clamp(raw.skullTopPx, Math.min(minSkull, maxSkull), maxSkull);
  return {
    faceCx,
    hairTopPx: Math.min(raw.hairTopPx, skullTopPx),
    skullTopPx,
    chinPx,
    faceW: raw.faceW,
    eyePx: eyePair.eyeY,
    eyeSepPx: eyePair.eyeSep,
    confidence: 0.96,
  };
}
