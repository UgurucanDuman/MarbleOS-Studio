import type { PhotoAdjustments } from '../sqlite/types';
import { applyToneToNormalizedRgb } from './photoColorMath';

/**
 * İZOLE SİSTEM KATMANI: 300 DPI 2D Tuval Ton Eğrisi ve 5-Noktalı Keskinleştirme (Unsharp Mask) Geçişi
 * WebGL Karanlık Oda parçacık gölgelendiricisi (`glDarkroomPipeline.ts`) ile birebir aynı matematikle çalışır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function applyPixelToneAndSharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  full: Required<PhotoAdjustments>,
): void {
  const hasTone =
    full.brightness !== 100 ||
    full.contrast !== 100 ||
    full.shadows !== 0 ||
    full.highlights !== 0 ||
    full.warmth !== 0 ||
    full.saturation !== 100;
  const sharpenStrength = full.sharpen > 0 ? (full.sharpen / 40) * 1.35 : 0;
  if (!hasTone && sharpenStrength <= 0) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const srcCopy = sharpenStrength > 0 ? new Uint8ClampedArray(data) : null;
  const rowStride = width * 4;

  for (let y = 0; y < height; y += 1) {
    const yOff = y * rowStride;
    const northOff = Math.max(0, y - 1) * rowStride;
    const southOff = Math.min(height - 1, y + 1) * rowStride;

    for (let x = 0; x < width; x += 1) {
      const idx = yOff + x * 4;
      let r = data[idx]! / 255;
      let g = data[idx + 1]! / 255;
      let b = data[idx + 2]! / 255;

      if (srcCopy && sharpenStrength > 0) {
        const westX = Math.max(0, x - 1) * 4;
        const eastX = Math.min(width - 1, x + 1) * 4;
        const nIdx = northOff + x * 4;
        const sIdx = southOff + x * 4;
        const wIdx = yOff + westX;
        const eIdx = yOff + eastX;

        const blurR = (srcCopy[nIdx]! + srcCopy[sIdx]! + srcCopy[wIdx]! + srcCopy[eIdx]!) / (4 * 255);
        const blurG = (srcCopy[nIdx + 1]! + srcCopy[sIdx + 1]! + srcCopy[wIdx + 1]! + srcCopy[eIdx + 1]!) / (4 * 255);
        const blurB = (srcCopy[nIdx + 2]! + srcCopy[sIdx + 2]! + srcCopy[wIdx + 2]! + srcCopy[eIdx + 2]!) / (4 * 255);

        r = Math.min(1, Math.max(0, r + (r - blurR) * sharpenStrength));
        g = Math.min(1, Math.max(0, g + (g - blurG) * sharpenStrength));
        b = Math.min(1, Math.max(0, b + (b - blurB) * sharpenStrength));
      }

      if (hasTone) {
        [r, g, b] = applyToneToNormalizedRgb(r, g, b, full);
      }

      data[idx] = Math.round(r * 255);
      data[idx + 1] = Math.round(g * 255);
      data[idx + 2] = Math.round(b * 255);
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

