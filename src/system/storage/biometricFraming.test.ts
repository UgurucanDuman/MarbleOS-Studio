import { describe, expect, test } from 'vitest';
import { BIOMETRIC_ASPECT, computeBiometricIcaoPlan } from './biometricFraming';
import type { PortraitSubjectMetrics } from './portraitSubjectBg';
import { detectPortraitSubjectFromRgba } from './portraitSubjectDetect';

function makeSyntheticPortraitRgba(options: {
  w: number;
  h: number;
  hairTopFrac: number;
  chinFrac: number;
  faceCxFrac: number;
  bgLeft?: [number, number, number];
  bgRight?: [number, number, number];
  noisyBg?: boolean;
}): Uint8ClampedArray {
  const {
    w,
    h,
    hairTopFrac,
    chinFrac,
    faceCxFrac,
    bgLeft = [242, 245, 249],
    bgRight = [238, 242, 247],
    noisyBg = false,
  } = options;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const cx = faceCxFrac * w;
  const hairTop = hairTopFrac * h;
  const chin = chinFrac * h;
  const headH = chin - hairTop;
  const skinTop = hairTop + headH * 0.24;
  const faceRx = headH * 0.36;
  const faceCy = (skinTop + chin) * 0.5;
  const faceRy = (chin - skinTop) * 0.5;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      const t = x / Math.max(1, w - 1);
      let r = Math.round(bgLeft[0] + (bgRight[0] - bgLeft[0]) * t);
      let g = Math.round(bgLeft[1] + (bgRight[1] - bgLeft[1]) * t);
      let b = Math.round(bgLeft[2] + (bgRight[2] - bgLeft[2]) * t);

      if (noisyBg) {
        const stripe = ((x * 13 + y * 7) % 120) - 60;
        r = Math.max(0, Math.min(255, r + stripe));
        g = Math.max(0, Math.min(255, g - stripe));
      }

      // Saç tepesi / kafatası silüeti
      const hairCy = hairTop + headH * 0.38;
      const hairRx = faceRx * 1.15;
      const hairRy = headH * 0.38;
      const inHair = ((x - cx) / hairRx) ** 2 + ((y - hairCy) / hairRy) ** 2 <= 1 && y >= hairTop;
      if (inHair) {
        r = 58;
        g = 42;
        b = 34;
      }

      // Yüz ten bölgesi
      const inFace = ((x - cx) / faceRx) ** 2 + ((y - faceCy) / faceRy) ** 2 <= 1;
      if (inFace) {
        r = 212;
        g = 166;
        b = 140;
      }

      // Kırmızı okul yakası / omuz
      if (y > chin + headH * 0.08 && Math.abs(x - cx) < w * 0.48) {
        r = 185;
        g = 34;
        b = 46;
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

describe('biometricFraming (NVİ / ICAO 50×60 mm saç tepesi koruması)', () => {
  test('üst kenara dayalı çekilmiş stüdyo portresinde saçı kesmeden ~5-6 mm temiz üst boşluk üretir', () => {
    const w = 150;
    const h = 200; // 3:4 stüdyo çekimi
    const rgba = makeSyntheticPortraitRgba({
      w,
      h,
      hairTopFrac: 0.02, // saç neredeyse en üstte!
      chinFrac: 0.62,
      faceCxFrac: 0.52,
    });
    const subject = detectPortraitSubjectFromRgba(rgba, w, h);
    expect(subject).not.toBeNull();
    expect(subject!.hasUniformBg).toBe(true);
    expect(subject!.bgTopLeft?.[0]).toBeGreaterThan(235);

    const plan = computeBiometricIcaoPlan(subject!, { zoom: 1, brightness: 100, contrast: 100, warmth: 0 });
    expect(plan.isTopExtended).toBe(true);
    expect(plan.panY).toBeGreaterThan(4);

    // 5:6 çerçevede yerleştirilmiş saç tepesi en az ~%7.5 (~4.5 mm) üst boşluk bırakmalı
    const bioScaleY = BIOMETRIC_ASPECT / (3 / 4);
    const hairTopBio = subject!.hairTopY * bioScaleY;
    const placedHairTop = plan.zoom * (hairTopBio + plan.panY / 100);
    expect(placedHairTop).toBeGreaterThanOrEqual(-0.425);
    expect(placedHairTop).toBeLessThanOrEqual(-0.35);

    // Sol/sağ/alt omuz kenarları çerçeveden içeri çekilip boşluk bırakmamalı
    const bioScaleX = 1;
    expect(plan.zoom * (-0.5 * bioScaleX + plan.panX / 100)).toBeLessThanOrEqual(-0.499);
    expect(plan.zoom * (0.5 * bioScaleX + plan.panX / 100)).toBeGreaterThanOrEqual(0.499);
    expect(plan.zoom * (0.5 * bioScaleY + plan.panY / 100)).toBeGreaterThanOrEqual(0.499);
  });

  test('uzaktan çekilmiş portreyi ICAO baş yüksekliğine (~33 mm) yakınlaştırıp saç payını korur', () => {
    const subject: PortraitSubjectMetrics = {
      faceCenterX: 0.04,
      hairTopY: -0.24,
      skullTopY: -0.22,
      chinY: 0.14,
      headMidY: -0.04,
      skullHeight: 0.36,
      faceWidth: 0.24,
      headMetric: 0.34,
      scaleX: 1,
      scaleY: 1,
      confidence: 0.92,
      hasUniformBg: true,
      bgTopLeft: [244, 246, 250],
      bgTopRight: [242, 245, 249],
    };
    const plan = computeBiometricIcaoPlan(subject, { zoom: 1, brightness: 100, contrast: 100, warmth: 0 });
    expect(plan.zoom).toBeGreaterThan(1.2);
    expect(plan.isTopExtended).toBe(false);
    expect(plan.panX).toBeLessThan(0); // sağa kayık yüzü sola merkeze alır
  });

  test('düz fon olmayan (karmaşık arka planlı) fotoğrafta üst kenarın ötesine yapay fon uzatması yapmaz', () => {
    const subject: PortraitSubjectMetrics = {
      faceCenterX: 0,
      hairTopY: -0.47,
      skullTopY: -0.45,
      chinY: 0.15,
      headMidY: -0.15,
      skullHeight: 0.6,
      faceWidth: 0.36,
      headMetric: 0.56,
      scaleX: 1,
      scaleY: 1,
      confidence: 0.72,
      hasUniformBg: false,
    };
    const plan = computeBiometricIcaoPlan(subject, { zoom: 1, brightness: 100, contrast: 100, warmth: 0 });
    expect(plan.isTopExtended).toBe(false);
    const bioScaleY = BIOMETRIC_ASPECT / (3 / 4);
    const placedImgTop = plan.zoom * (-0.5 * bioScaleY + plan.panY / 100);
    expect(placedImgTop).toBeLessThanOrEqual(-0.495);
  });
});

