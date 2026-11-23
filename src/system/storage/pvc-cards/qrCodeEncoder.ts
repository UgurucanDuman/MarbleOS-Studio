import { computeQrMaskPenalty, qrMaskBit } from './qrMasking';
import {
  buildQrCodewords,
  computeQrFormatBitsM,
  selectQrVersionM,
  type QrVersionSpec,
} from './qrReedSolomon';

/**
 * İZOLE SİSTEM KATMANI: ISO/IEC 18004 Gerçek QR Kod Matris Üreticisi & SVG/Canvas Çizicisi
 * Telefon kameraları ve el tipi barkod/QR okuyucular tarafından %100 taranabilir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface QrMatrix {
  version: number;
  size: number;
  modules: Uint8Array;
}

const QUIET_ZONE = 2;

function setFunc(modules: Uint8Array, isFunc: Uint8Array, size: number, r: number, c: number, dark: boolean) {
  if (r < 0 || c < 0 || r >= size || c >= size) return;
  const idx = r * size + c;
  modules[idx] = dark ? 1 : 0;
  isFunc[idx] = 1;
}

function drawFinder(modules: Uint8Array, isFunc: Uint8Array, size: number, top: number, left: number) {
  for (let dr = -1; dr <= 7; dr += 1) {
    for (let dc = -1; dc <= 7; dc += 1) {
      const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const dark =
        inBox &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      setFunc(modules, isFunc, size, top + dr, left + dc, dark);
    }
  }
}

function drawAlignment(modules: Uint8Array, isFunc: Uint8Array, size: number, centerR: number, centerC: number) {
  for (let dr = -2; dr <= 2; dr += 1) {
    for (let dc = -2; dc <= 2; dc += 1) {
      setFunc(modules, isFunc, size, centerR + dr, centerC + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }
}

function drawFormatBits(modules: Uint8Array, isFunc: Uint8Array, size: number, mask: number) {
  const bits = computeQrFormatBitsM(mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i += 1) setFunc(modules, isFunc, size, 8, i, bit(14 - i));
  setFunc(modules, isFunc, size, 8, 7, bit(8));
  setFunc(modules, isFunc, size, 8, 8, bit(7));
  setFunc(modules, isFunc, size, 7, 8, bit(6));
  for (let i = 9; i < 15; i += 1) setFunc(modules, isFunc, size, 14 - i, 8, bit(14 - i));
  for (let i = 0; i < 8; i += 1) setFunc(modules, isFunc, size, 8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i += 1) setFunc(modules, isFunc, size, size - 15 + i, 8, bit(i));
  setFunc(modules, isFunc, size, size - 8, 8, true);
}

function setupFunctionPatterns(spec: QrVersionSpec): { modules: Uint8Array; isFunc: Uint8Array } {
  const { size } = spec;
  const modules = new Uint8Array(size * size);
  const isFunc = new Uint8Array(size * size);

  drawFinder(modules, isFunc, size, 0, 0);
  drawFinder(modules, isFunc, size, 0, size - 7);
  drawFinder(modules, isFunc, size, size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    setFunc(modules, isFunc, size, 6, i, i % 2 === 0);
    setFunc(modules, isFunc, size, i, 6, i % 2 === 0);
  }

  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i += 1) {
    for (let j = 0; j < centers.length; j += 1) {
      const isCorner =
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0);
      if (!isCorner) drawAlignment(modules, isFunc, size, centers[i]!, centers[j]!);
    }
  }
  drawFormatBits(modules, isFunc, size, 0);
  return { modules, isFunc };
}

function placeDataCodewords(
  modules: Uint8Array,
  isFunc: Uint8Array,
  size: number,
  codewords: Uint8Array,
) {
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc += 1) {
        const c = right - dc;
        const idx = r * size + c;
        if (isFunc[idx]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          dark = ((codewords[bitIndex >>> 3]! >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
        modules[idx] = dark ? 1 : 0;
      }
    }
    upward = !upward;
  }
}

export function encodeQrMatrix(rawValue: string): QrMatrix {
  const clean = rawValue.trim() || '0000';
  const bytes = new TextEncoder().encode(clean);
  const spec = selectQrVersionM(bytes.length);
  const codewords = buildQrCodewords(bytes, spec);
  const { modules: baseModules, isFunc } = setupFunctionPatterns(spec);
  placeDataCodewords(baseModules, isFunc, spec.size, codewords);

  let bestScore = Infinity;
  let bestModules = baseModules;

  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = new Uint8Array(baseModules);
    for (let r = 0; r < spec.size; r += 1) {
      for (let c = 0; c < spec.size; c += 1) {
        const idx = r * spec.size + c;
        if (!isFunc[idx] && qrMaskBit(mask, r, c)) candidate[idx] ^= 1;
      }
    }
    drawFormatBits(candidate, isFunc, spec.size, mask);
    const score = computeQrMaskPenalty(candidate, spec.size);
    if (score < bestScore) {
      bestScore = score;
      bestModules = candidate;
    }
  }
  return { version: spec.version, size: spec.size, modules: bestModules };
}

export function qrMatrixToSvgPath(matrix: QrMatrix): { viewBoxSize: number; d: string } {
  const total = matrix.size + QUIET_ZONE * 2;
  const parts: string[] = [];
  for (let r = 0; r < matrix.size; r += 1) {
    for (let c = 0; c < matrix.size; c += 1) {
      if (matrix.modules[r * matrix.size + c]) {
        parts.push(`M${c + QUIET_ZONE},${r + QUIET_ZONE}h1v1h-1z`);
      }
    }
  }
  return { viewBoxSize: total, d: parts.join('') };
}

export function drawQrCodeOnCanvas(options: {
  ctx: CanvasRenderingContext2D;
  value: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}): void {
  const { ctx, value, x, y, w, h, color } = options;
  const matrix = encodeQrMatrix(value);
  const side = Math.min(w, h);
  const ox = x + (w - side) / 2;
  const oy = y + (h - side) / 2;
  const total = matrix.size + QUIET_ZONE * 2;
  const cell = side / total;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.floor(ox), Math.floor(oy), Math.ceil(side), Math.ceil(side));
  ctx.fillStyle = color;
  for (let r = 0; r < matrix.size; r += 1) {
    for (let c = 0; c < matrix.size; c += 1) {
      if (!matrix.modules[r * matrix.size + c]) continue;
      const rx = Math.round(ox + (c + QUIET_ZONE) * cell);
      const ry = Math.round(oy + (r + QUIET_ZONE) * cell);
      const nx = Math.round(ox + (c + QUIET_ZONE + 1) * cell);
      const ny = Math.round(oy + (r + QUIET_ZONE + 1) * cell);
      ctx.fillRect(rx, ry, Math.max(1, nx - rx), Math.max(1, ny - ry));
    }
  }
  ctx.restore();
}
