import { describe, expect, it } from 'vitest';
import {
  applyToneToNormalizedRgb,
  DEFAULT_PHOTO_ADJUSTMENTS,
  healPhotoAdjustments,
  isDefaultAdjustments,
  mergePhotoRecipe,
  resolveFullAdjustments,
} from './photoColorMath';

describe('photoColorMath', () => {
  it('heals out-of-bounds values and omits default optional fields', () => {
    const healed = healPhotoAdjustments({
      zoom: 9.5,
      brightness: 10,
      contrast: 200,
      warmth: -99,
      rotation: 45,
      panX: 0,
      shadows: 95,
      saturation: 100,
      sharpen: -10,
    });
    expect(healed).toEqual({
      zoom: 2.5,
      brightness: 70,
      contrast: 135,
      warmth: -30,
      shadows: 50,
    });
    expect('panX' in healed).toBe(false);
    expect('saturation' in healed).toBe(false);
    expect(isDefaultAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)).toBe(true);
  });

  it('copies lighting recipe while preserving individual framing unless copyFraming is true', () => {
    const target = {
      zoom: 1.28,
      panX: 11.5,
      panY: -6,
      rotation: 90,
      tilt: -2.5,
      brightness: 100,
      contrast: 100,
      warmth: 0,
    };
    const calibrated = {
      zoom: 1.05,
      panX: -4,
      brightness: 108,
      contrast: 106,
      warmth: 4,
      shadows: 16,
      highlights: -12,
      saturation: 108,
      sharpen: 12,
    };

    const keepFrame = mergePhotoRecipe(target, calibrated, false);
    expect(keepFrame.zoom).toBe(1.28);
    expect(keepFrame.panX).toBe(11.5);
    expect(keepFrame.panY).toBe(-6);
    expect(keepFrame.rotation).toBe(90);
    expect(keepFrame.tilt).toBe(-2.5);
    expect(keepFrame.brightness).toBe(108);
    expect(keepFrame.shadows).toBe(16);
    expect(keepFrame.sharpen).toBe(12);

    const withFrame = mergePhotoRecipe(target, calibrated, true);
    expect(withFrame.zoom).toBe(1.05);
    expect(withFrame.panX).toBe(-4);
    expect(withFrame.panY).toBeUndefined();
  });

  it('applies shadows, cool/warm balance, and monochrome saturation accurately', () => {
    const base = resolveFullAdjustments(DEFAULT_PHOTO_ADJUSTMENTS);
    expect(applyToneToNormalizedRgb(0.2, 0.2, 0.2, base)).toEqual([0.2, 0.2, 0.2]);

    const lifted = applyToneToNormalizedRgb(0.12, 0.12, 0.12, { ...base, shadows: 30 });
    expect(lifted[0]).toBeGreaterThan(0.2);

    const cooled = applyToneToNormalizedRgb(0.5, 0.5, 0.5, { ...base, warmth: -20 });
    expect(cooled[2]).toBeGreaterThan(cooled[0]);

    const mono = applyToneToNormalizedRgb(0.8, 0.3, 0.2, { ...base, saturation: 0 });
    expect(mono[0]).toBeCloseTo(mono[1], 5);
    expect(mono[1]).toBeCloseTo(mono[2], 5);
  });
});
