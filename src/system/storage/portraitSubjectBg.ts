/**
 * İZOLE SİSTEM KATMANI: Stüdyo Portre Arka Plan, Ten Maskesi & Silüet Yardımcıları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PortraitSubjectMetrics {
  faceCenterX: number;
  hairTopY: number;
  skullTopY: number;
  chinY: number;
  headMidY: number;
  skullHeight: number;
  faceWidth: number;
  headMetric: number;
  scaleX: number;
  scaleY: number;
  confidence: number;
  eyeY?: number;
  eyeSep?: number;
  hasUniformBg?: boolean;
  bgTopLeft?: readonly [number, number, number];
  bgTopRight?: readonly [number, number, number];
}

export interface CornerBackgroundModel {
  left: { r: number; g: number; b: number; spread: number };
  right: { r: number; g: number; b: number; spread: number };
  topLeft: readonly [number, number, number];
  topRight: readonly [number, number, number];
  spread: number;
  hasUniformBg: boolean;
}

export interface RawSubjectBox {
  faceCx: number;
  hairTopPx: number;
  skullTopPx: number;
  chinPx: number;
  faceW: number;
  eyePx?: number;
  eyeSepPx?: number;
  confidence: number;
}

export interface PortraitMasks {
  skinMask: Uint8Array;
  fgMask: Uint8Array;
  colSkin: Float32Array;
  skinCount: number;
}

function medianSorted(arr: number[]): number {
  if (!arr.length) return 0;
  arr.sort((a, b) => a - b);
  return arr[Math.floor(arr.length / 2)]!;
}

/**
 * Parlak kırmızı okul yakalarını dışlarken flaşlı çok açık çocuk teninden esmer tene kadar
 * tüm insan ten tonlarını kesintisiz biçimde yakalar.
 */
export function isHumanSkin(r: number, g: number, b: number): boolean {
  if (r <= g || r <= b) return false;
  const minCh = Math.min(g, b);
  if (r - minCh < 11 || r - g > 90 || g < b * 0.74) return false;
  if ((r - minCh) / Math.max(1, r) < 0.055) return false;
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y <= 42 || y >= 252) return false;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 76 && cb <= 127 && cr >= 132 && cr <= 174;
}

export function sampleCornerBackground(rgba: Uint8ClampedArray, w: number, h: number): CornerBackgroundModel {
  const sampleSide = (x0: number, x1: number, yStartFrac: number, yEndFrac: number) => {
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    const yStart = Math.max(0, Math.floor(h * yStartFrac));
    const yEnd = Math.max(yStart + 2, Math.floor(h * yEndFrac));
    for (let y = yStart; y < yEnd; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * w + x) * 4;
        if (rgba[i + 3]! < 200) continue;
        rs.push(rgba[i]!);
        gs.push(rgba[i + 1]!);
        bs.push(rgba[i + 2]!);
      }
    }
    const r = medianSorted(rs);
    const g = medianSorted(gs);
    const b = medianSorted(bs);
    const devs: number[] = [];
    for (let k = 0; k < rs.length; k += 1) {
      devs.push(Math.max(Math.abs(rs[k]! - r), Math.abs(gs[k]! - g), Math.abs(bs[k]! - b)));
    }
    return { r, g, b, spread: medianSorted(devs) };
  };
  const lx1 = Math.max(2, Math.floor(w * 0.14));
  const rx0 = Math.min(w - 2, Math.floor(w * 0.86));
  const left = sampleSide(0, lx1, 0.02, 0.22);
  const right = sampleSide(rx0, w, 0.02, 0.22);
  const topL = sampleSide(0, lx1, 0, 0.06);
  const topR = sampleSide(rx0, w, 0, 0.06);
  const crossDiff = Math.max(
    Math.abs(left.r - right.r),
    Math.abs(left.g - right.g),
    Math.abs(left.b - right.b),
  );
  const spread = Math.max(left.spread, right.spread);
  return {
    left,
    right,
    topLeft: [Math.round(topL.r), Math.round(topL.g), Math.round(topL.b)],
    topRight: [Math.round(topR.r), Math.round(topR.g), Math.round(topR.b)],
    spread,
    hasUniformBg: spread <= 24 && crossDiff <= 48,
  };
}

/** Arka plan fark maskesi (fgMask) ile insan teni maskesini (skinMask) tek geçişte üretir. */
export function buildPortraitMasks(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  bg: CornerBackgroundModel,
): PortraitMasks {
  const fgThr = Math.max(12, bg.spread * 2.2 + 8);
  const total = w * h;
  const skinMask = new Uint8Array(total);
  const fgMask = new Uint8Array(total);
  const colSkin = new Float32Array(w);
  let skinCount = 0;

  const ySkinStart = Math.floor(h * 0.04);
  const ySkinEnd = Math.floor(h * 0.86);
  const xSkinStart = Math.floor(w * 0.06);
  const xSkinEnd = Math.floor(w * 0.94);
  const colSkinLimitY = h * 0.68;

  for (let y = 0; y < h; y += 1) {
    const rowOff = y * w;
    const inSkinY = y >= ySkinStart && y < ySkinEnd;
    for (let x = 0; x < w; x += 1) {
      const idx = rowOff + x;
      const p = idx * 4;
      const r = rgba[p]!;
      const g = rgba[p + 1]!;
      const b = rgba[p + 2]!;
      if (rgba[p + 3]! < 128) continue;
      if (bg.hasUniformBg) {
        const t = x / Math.max(1, w - 1);
        const dr = Math.abs(r - (bg.left.r + (bg.right.r - bg.left.r) * t));
        const dg = Math.abs(g - (bg.left.g + (bg.right.g - bg.left.g) * t));
        const db = Math.abs(b - (bg.left.b + (bg.right.b - bg.left.b) * t));
        if (Math.hypot(0.55 * dr, 0.77 * dg, 0.33 * db) + 0.42 * Math.max(dr, dg, db) > fgThr) {
          fgMask[idx] = 1;
        }
      }
      if (inSkinY && x >= xSkinStart && x < xSkinEnd && (!bg.hasUniformBg || fgMask[idx] === 1) && isHumanSkin(r, g, b)) {
        skinMask[idx] = 1;
        if (y < colSkinLimitY) colSkin[x] += 1;
        skinCount += 1;
      }
    }
  }
  return { skinMask, fgMask, colSkin, skinCount };
}

/** Siyah-beyaz veya düşük doygunluklu stüdyo fotoğraflarında arka plan silüetinden baş konumu çıkarır. */
export function detectFromSilhouetteOnly(fgMask: Uint8Array, w: number, h: number): RawSubjectBox | null {
  const xMin = Math.floor(w * 0.1);
  const xMax = Math.ceil(w * 0.9);
  let hairTopPx = -1;
  let skullTopPx = -1;
  const widths: number[] = [];
  let sumX = 0;
  let countX = 0;
  for (let y = 0; y < Math.floor(h * 0.76); y += 1) {
    let first = -1;
    let last = -1;
    let cnt = 0;
    const rowOff = y * w;
    for (let x = xMin; x < xMax; x += 1) {
      if (!fgMask[rowOff + x]) continue;
      if (first < 0) first = x;
      last = x;
      cnt += 1;
    }
    const span = first >= 0 ? last - first + 1 : 0;
    if (hairTopPx < 0 && cnt >= Math.max(3, w * 0.04)) hairTopPx = y;
    if (hairTopPx >= 0 && skullTopPx < 0 && span >= w * 0.18) skullTopPx = y;
    if (hairTopPx >= 0 && y < hairTopPx + h * 0.38 && span >= w * 0.12 && span <= w * 0.74) {
      widths.push(span);
      sumX += (first + last) * 0.5;
      countX += 1;
    }
  }
  if (hairTopPx < 0 || !widths.length) return null;
  widths.sort((a, b) => a - b);
  const faceW = widths[Math.floor(widths.length * 0.5)]!;
  const skull = skullTopPx >= 0 ? skullTopPx : hairTopPx;
  return {
    faceCx: countX > 0 ? sumX / countX : w * 0.5,
    hairTopPx,
    skullTopPx: skull,
    chinPx: Math.min(h - 1, skull + faceW * 1.28),
    faceW,
    confidence: 0.52,
  };
}
