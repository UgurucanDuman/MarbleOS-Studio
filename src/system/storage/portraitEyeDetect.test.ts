import { describe, expect, it } from 'vitest';
import type { PhotoAdjustments } from '../sqlite/types';
import { computeSmartAlignedFraming, safeCoverPanLimit } from './portraitSmartAlign';
import { detectPortraitSubjectFromRgba } from './portraitSubjectDetect';

interface DetailedPortraitSpec {
  width: number;
  height: number;
  cx: number;
  headMidY: number;
  faceRx: number;
  faceRy: number;
  hairColor?: [number, number, number];
  skinColor?: [number, number, number];
  shirtColor?: [number, number, number];
  bgColor?: [number, number, number];
  withBangs?: boolean;
  rightPonytail?: boolean;
  pigtailBows?: boolean;
}

/** Gerçekçi simetrik gözler, kaşlar, saç, kâkül, örgü/toka ve kazak çizen stüdyo portresi. */
function makeDetailedPortraitRgba(spec: DetailedPortraitSpec): Uint8ClampedArray {
  const {
    width,
    height,
    cx,
    headMidY,
    faceRx,
    faceRy,
    hairColor = [46, 36, 28],
    skinColor = [228, 186, 158],
    shirtColor = [196, 34, 48],
    bgColor = [244, 245, 247],
    withBangs = false,
    rightPonytail = false,
    pigtailBows = false,
  } = spec;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const chinY = headMidY + faceRy;
  const eyeY = headMidY - faceRy * 0.14;
  const eyeHalfSep = faceRx * 0.45;
  const hairLineY = withBangs ? eyeY - faceRy * 0.22 : headMidY - faceRy * 0.82;
  const collarTopY = chinY + faceRy * 0.24;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let [r, g, b] = bgColor;
      const dx = (x - cx) / faceRx;
      const dyFace = (y - headMidY) / faceRy;
      const inFace = dx * dx + dyFace * dyFace <= 1;
      const dySkull = (y - (headMidY - faceRy * 0.14)) / (faceRy * 1.06);
      const inSkull = (dx / 1.08) ** 2 + dySkull ** 2 <= 1;
      const inNeck = y >= chinY - 2 && y <= collarTopY + 4 && Math.abs(x - cx) <= faceRx * 0.34;
      const inShirt = y >= collarTopY && Math.abs(x - cx) <= faceRx * 1.9;
      const inRightTail =
        rightPonytail &&
        y >= headMidY - faceRy * 0.9 &&
        y <= collarTopY + faceRy * 0.8 &&
        x >= cx + faceRx * 0.88 &&
        x <= cx + faceRx * 1.52;
      const inLeftBow =
        pigtailBows &&
        ((x - (cx - faceRx * 0.88)) / (faceRx * 0.32)) ** 2 +
          ((y - (headMidY - faceRy * 1.15)) / (faceRy * 0.24)) ** 2 <=
          1;
      const inRightBow =
        pigtailBows &&
        ((x - (cx + faceRx * 0.88)) / (faceRx * 0.32)) ** 2 +
          ((y - (headMidY - faceRy * 1.15)) / (faceRy * 0.24)) ** 2 <=
          1;

      if (inShirt) [r, g, b] = shirtColor;
      if (inNeck) [r, g, b] = skinColor;
      if (inRightTail || (inSkull && y < headMidY + faceRy * 0.14)) [r, g, b] = hairColor;
      if (inLeftBow || inRightBow) [r, g, b] = [232, 148, 166];
      if (inFace && y >= hairLineY) [r, g, b] = skinColor;

      // Simetrik koyu göz bebekleri ve ince kaş çizgisi
      const eyeRx = Math.max(2.2, faceRx * 0.14);
      const eyeRy = Math.max(1.8, faceRy * 0.085);
      const inLeftEye = ((x - (cx - eyeHalfSep)) / eyeRx) ** 2 + ((y - eyeY) / eyeRy) ** 2 <= 1;
      const inRightEye = ((x - (cx + eyeHalfSep)) / eyeRx) ** 2 + ((y - eyeY) / eyeRy) ** 2 <= 1;
      if (inLeftEye || inRightEye) [r, g, b] = [44, 34, 30];

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

describe('portraitEyeDetect & real studio edge cases', () => {
  it('aligns beige sweater, cream jacket, heavy bangs, and blonde pigtail portraits to the same eye line and scale', () => {
    const W = 180;
    const H = 240;

    // 61 DEFNE benzeri referans öğrenci
    const refRgba = makeDetailedPortraitRgba({ width: W, height: H, cx: 90, headMidY: 112, faceRx: 34, faceRy: 44 });
    // 72 KIVANÇ benzeri bej/krem kazaklı öğrenci (daha uzakta çekilmiş)
    const beigeSweaterRgba = makeDetailedPortraitRgba({
      width: W,
      height: H,
      cx: 88,
      headMidY: 118,
      faceRx: 29,
      faceRy: 38,
      shirtColor: [198, 180, 162],
      withBangs: true,
    });
    // 63 EGE benzeri krem/beyaz fermuarlı ceketli öğrenci (uzakta çekilmiş)
    const creamJacketRgba = makeDetailedPortraitRgba({
      width: W,
      height: H,
      cx: 93,
      headMidY: 106,
      faceRx: 28,
      faceRy: 36,
      shirtColor: [232, 224, 214],
    });
    // 62 DOĞA benzeri sarı saç + uzun sağ at kuyruğu + çift fiyonk + açık ten
    const blondePigtailRgba = makeDetailedPortraitRgba({
      width: W,
      height: H,
      cx: 88,
      headMidY: 114,
      faceRx: 35,
      faceRy: 45,
      hairColor: [192, 158, 108],
      skinColor: [238, 206, 186],
      shirtColor: [242, 240, 238],
      rightPonytail: true,
      pigtailBows: true,
    });
    // 76 PIRIL benzeri çok açık tenli sarı saçlı uzakta duran öğrenci
    const fairBlondeFarRgba = makeDetailedPortraitRgba({
      width: W,
      height: H,
      cx: 92,
      headMidY: 132,
      faceRx: 26,
      faceRy: 34,
      hairColor: [212, 188, 138],
      skinColor: [246, 218, 200],
      shirtColor: [196, 38, 52],
    });

    const refSub = detectPortraitSubjectFromRgba(refRgba, W, H)!;
    const beigeSub = detectPortraitSubjectFromRgba(beigeSweaterRgba, W, H)!;
    const creamSub = detectPortraitSubjectFromRgba(creamJacketRgba, W, H)!;
    const pigtailSub = detectPortraitSubjectFromRgba(blondePigtailRgba, W, H)!;
    const fairFarSub = detectPortraitSubjectFromRgba(fairBlondeFarRgba, W, H)!;

    // Tüm öğrencilerde göz çizgisi ve gözler arası mesafe yüksek güvenle algılanır
    for (const sub of [refSub, beigeSub, creamSub, pigtailSub, fairFarSub]) {
      expect(sub.eyeY).toBeDefined();
      expect(sub.eyeSep).toBeDefined();
      expect(sub.confidence).toBeGreaterThanOrEqual(0.9);
    }

    // Bej kazak çeneyi göğse çekmemeli
    expect(beigeSub.chinY).toBeLessThan(0.24);
    // Sağ at kuyruğu yüz merkezini sağa kaydırmamalı
    expect(Math.abs(pigtailSub.faceCenterX - (88 / W - 0.5))).toBeLessThan(0.05);

    const refAdj: PhotoAdjustments = { zoom: 1.24, panX: 0, panY: 0, brightness: 102, contrast: 102, warmth: 0 };
    const refPlacedEyeY = refAdj.zoom * refSub.eyeY!;
    const refPlacedFaceW = refAdj.zoom * refSub.faceWidth;

    const results = [
      { sub: beigeSub, aligned: computeSmartAlignedFraming(refSub, refAdj, beigeSub, BASE_ADJ) },
      { sub: creamSub, aligned: computeSmartAlignedFraming(refSub, refAdj, creamSub, BASE_ADJ) },
      { sub: pigtailSub, aligned: computeSmartAlignedFraming(refSub, refAdj, pigtailSub, BASE_ADJ) },
      { sub: fairFarSub, aligned: computeSmartAlignedFraming(refSub, refAdj, fairFarSub, BASE_ADJ) },
    ];

    for (const { sub, aligned } of results) {
      const placedEyeY = aligned.zoom * (sub.eyeY! + (aligned.panY ?? 0) / 100);
      const placedFaceW = aligned.zoom * sub.faceWidth;
      const placedHairTop = aligned.zoom * (sub.hairTopY + (aligned.panY ?? 0) / 100);
      const limitPct = safeCoverPanLimit(aligned.zoom) * 100 + 0.05;

      // Göz çizgisi ve yüz genişliği tüm öğrencilerde tutarlı; hiçbiri aşırı yakınlaşmaz veya küçülmez
      expect(Math.abs(placedEyeY - refPlacedEyeY)).toBeLessThan(0.06);
      expect(Math.abs(placedFaceW - refPlacedFaceW)).toBeLessThan(0.08);
      expect(placedHairTop).toBeGreaterThan(-0.475);
      expect(Math.abs(aligned.panX ?? 0)).toBeLessThanOrEqual(limitPct);
      expect(Math.abs(aligned.panY ?? 0)).toBeLessThanOrEqual(limitPct);
    }
  });

  it('never forces over-zoom on an already close-up portrait even when reference zoom is high', () => {
    const W = 180;
    const H = 240;
    // Uzak çekilmiş referans (%185 yakınlaştırılmış) vs zaten yakın çekilmiş hedef öğrenci
    const farRefRgba = makeDetailedPortraitRgba({ width: W, height: H, cx: 90, headMidY: 120, faceRx: 25, faceRy: 33 });
    const closeTargetRgba = makeDetailedPortraitRgba({
      width: W,
      height: H,
      cx: 90,
      headMidY: 112,
      faceRx: 44,
      faceRy: 56,
      pigtailBows: true,
    });

    const farRefSub = detectPortraitSubjectFromRgba(farRefRgba, W, H)!;
    const closeSub = detectPortraitSubjectFromRgba(closeTargetRgba, W, H)!;
    const refAdj: PhotoAdjustments = { zoom: 1.85, panX: 0, panY: 0, brightness: 100, contrast: 100, warmth: 0 };

    const aligned = computeSmartAlignedFraming(farRefSub, refAdj, closeSub, BASE_ADJ);
    // Yakın çekilmiş öğrenci zorla %130'a büyütülmez; ~1.0x civarında kalır ve kurdeleleri kesilmez
    expect(aligned.zoom).toBeLessThanOrEqual(1.16);
    const placedHairTop = aligned.zoom * (closeSub.hairTopY + (aligned.panY ?? 0) / 100);
    expect(placedHairTop).toBeGreaterThan(-0.475);
  });
});
