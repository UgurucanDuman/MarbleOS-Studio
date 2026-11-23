import { describe, expect, it } from 'vitest';
import type { PhotoAdjustments } from '../sqlite/types';
import { computeSmartAlignedFraming, safeCoverPanLimit } from './portraitSmartAlign';
import { detectPortraitSubjectFromRgba } from './portraitSubjectDetect';

interface SyntheticPortraitSpec {
  width: number;
  height: number;
  cx: number;
  headMidY: number;
  faceRx: number;
  faceRy: number;
  hairColor?: [number, number, number];
  skinColor?: [number, number, number];
  bgColor?: [number, number, number];
  topBunHeight?: number;
  withBangs?: boolean;
}

/** Stüdyo arka planı, saç, yüz (ten), kırmızı okul yakası ve isteğe bağlı topuz çizen deterministik test portresi. */
function makeSyntheticPortraitRgba(spec: SyntheticPortraitSpec): Uint8ClampedArray {
  const {
    width,
    height,
    cx,
    headMidY,
    faceRx,
    faceRy,
    hairColor = [42, 32, 26],
    skinColor = [228, 184, 156],
    bgColor = [244, 245, 247],
    topBunHeight = 0,
    withBangs = false,
  } = spec;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const skullTop = headMidY - faceRy * 1.18;
  const chinY = headMidY + faceRy;
  const hairLineY = withBangs ? headMidY - faceRy * 0.35 : headMidY - faceRy * 0.82;
  const collarTopY = chinY + faceRy * 0.22;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = bgColor[0];
      let g = bgColor[1];
      let b = bgColor[2];

      const dx = (x - cx) / faceRx;
      const dyFace = (y - headMidY) / faceRy;
      const inFace = dx * dx + dyFace * dyFace <= 1;
      const dySkull = (y - (headMidY - faceRy * 0.14)) / (faceRy * 1.06);
      const inSkull = (dx / 1.08) ** 2 + dySkull ** 2 <= 1;
      const inBun =
        topBunHeight > 0 &&
        ((x - cx) / (faceRx * 0.32)) ** 2 + ((y - (skullTop - topBunHeight * 0.45)) / (topBunHeight * 0.58)) ** 2 <= 1;
      const inNeck = y >= chinY - 2 && y <= collarTopY + 4 && Math.abs(x - cx) <= faceRx * 0.34;
      const inRedPolo = y >= collarTopY && Math.abs(x - cx) <= faceRx * 1.85;

      if (inRedPolo) {
        r = 198;
        g = 28;
        b = 42;
      }
      if (inNeck) {
        [r, g, b] = skinColor;
      }
      if (inBun || (inSkull && y < headMidY + faceRy * 0.1)) {
        [r, g, b] = hairColor;
      }
      if (inFace && y >= hairLineY) {
        [r, g, b] = skinColor;
      }

      const i = (y * width + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const BASE_ADJ: PhotoAdjustments = { zoom: 1, brightness: 100, contrast: 100, warmth: 0 };

describe('portraitSmartAlign', () => {
  it('aligns short, tall, off-center, bangs, and blonde students to the reference framing with zero dark edges', () => {
    const W = 180;
    const H = 240;
    const refRgba = makeSyntheticPortraitRgba({ width: W, height: H, cx: 90, headMidY: 112, faceRx: 34, faceRy: 44 });
    const shortRgba = makeSyntheticPortraitRgba({ width: W, height: H, cx: 82, headMidY: 144, faceRx: 30, faceRy: 39 });
    const tallRgba = makeSyntheticPortraitRgba({ width: W, height: H, cx: 98, headMidY: 74, faceRx: 36, faceRy: 46 });
    const blondeRgba = makeSyntheticPortraitRgba({
      width: W,
      height: H,
      cx: 94,
      headMidY: 122,
      faceRx: 33,
      faceRy: 43,
      hairColor: [214, 192, 148],
      skinColor: [236, 206, 188],
    });
    const bangsRgba = makeSyntheticPortraitRgba({
      width: W,
      height: H,
      cx: 88,
      headMidY: 110,
      faceRx: 34,
      faceRy: 44,
      withBangs: true,
    });

    const refSub = detectPortraitSubjectFromRgba(refRgba, W, H)!;
    const shortSub = detectPortraitSubjectFromRgba(shortRgba, W, H)!;
    const tallSub = detectPortraitSubjectFromRgba(tallRgba, W, H)!;
    const blondeSub = detectPortraitSubjectFromRgba(blondeRgba, W, H)!;
    const bangsSub = detectPortraitSubjectFromRgba(bangsRgba, W, H)!;

    expect(refSub.confidence).toBeGreaterThan(0.8);
    expect(blondeSub.confidence).toBeGreaterThan(0.8);
    expect(Math.abs(bangsSub.skullHeight - refSub.skullHeight)).toBeLessThan(0.05);

    const refAdj: PhotoAdjustments = {
      zoom: 1.38,
      panX: 0,
      panY: 2,
      brightness: 106,
      contrast: 104,
      warmth: 2,
      shadows: 12,
    };

    const shortAligned = computeSmartAlignedFraming(refSub, refAdj, shortSub, BASE_ADJ);
    const tallAligned = computeSmartAlignedFraming(refSub, refAdj, tallSub, BASE_ADJ);
    const blondeAligned = computeSmartAlignedFraming(refSub, refAdj, blondeSub, BASE_ADJ);

    // Kısa çocuk yukarı çekilir (panY < 0) ve daha yakınlaştırılır; uzun çocuk aşağı indirilir (panY > 0)
    expect(shortAligned.panY ?? 0).toBeLessThan(-4);
    expect(shortAligned.zoom).toBeGreaterThan(refAdj.zoom);
    expect(tallAligned.panY ?? 0).toBeGreaterThan(4);

    // Sağa kaymış çocuk sola çekilir (panX < 0), sola kaymış çocuk sağa çekilir (panX > 0)
    expect(shortAligned.panX ?? 0).toBeGreaterThan(1.5);
    expect(tallAligned.panX ?? 0).toBeLessThan(-1.5);

    // Uzun çocuğun saç tepesi asla üst kenarın dışına (-0.5) kesilmez
    const tallHairPlaced = tallAligned.zoom * (tallSub.hairTopY + (tallAligned.panY ?? 0) / 100);
    expect(tallHairPlaced).toBeGreaterThan(-0.47);

    // Tüm sonuçlar sıfır siyah kenar sınırında kalır ve ışık reçetesini taşır
    for (const aligned of [shortAligned, tallAligned, blondeAligned]) {
      const limitPct = safeCoverPanLimit(aligned.zoom) * 100 + 0.05;
      expect(Math.abs(aligned.panX ?? 0)).toBeLessThanOrEqual(limitPct);
      expect(Math.abs(aligned.panY ?? 0)).toBeLessThanOrEqual(limitPct);
      expect(aligned.brightness).toBe(106);
      expect(aligned.shadows).toBe(12);
    }
  });

  it('protects tall top buns from cropping without shrinking face scale', () => {
    const W = 180;
    const H = 240;
    const refRgba = makeSyntheticPortraitRgba({ width: W, height: H, cx: 90, headMidY: 112, faceRx: 34, faceRy: 44 });
    const bunRgba = makeSyntheticPortraitRgba({
      width: W,
      height: H,
      cx: 90,
      headMidY: 94,
      faceRx: 34,
      faceRy: 44,
      topBunHeight: 28,
    });

    const refSub = detectPortraitSubjectFromRgba(refRgba, W, H)!;
    const bunSub = detectPortraitSubjectFromRgba(bunRgba, W, H)!;
    expect(bunSub.hairTopY).toBeLessThan(bunSub.skullTopY - 0.05);

    const refAdj: PhotoAdjustments = { zoom: 1.4, panX: 0, panY: 0, brightness: 100, contrast: 100, warmth: 0 };
    const bunAligned = computeSmartAlignedFraming(refSub, refAdj, bunSub, BASE_ADJ);
    const bunTopPlaced = bunAligned.zoom * (bunSub.hairTopY + (bunAligned.panY ?? 0) / 100);
    expect(bunTopPlaced).toBeGreaterThan(-0.47);
    expect(bunAligned.zoom).toBeGreaterThan(1.18);
  });
});
