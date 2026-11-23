/**
 * İZOLE SİSTEM KATMANI: ISO/IEC 18004 QR Kod Maskeleme Desenleri (0–7) ve Ceza Puanlama
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function qrMaskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

export function computeQrMaskPenalty(modules: Uint8Array, size: number): number {
  let penalty = 0;
  let darkCount = 0;
  for (let r = 0; r < size; r += 1) {
    let runColor = -1;
    let runLen = 0;
    for (let c = 0; c < size; c += 1) {
      const v = modules[r * size + c]!;
      darkCount += v;
      if (v === runColor) {
        runLen += 1;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = v;
        runLen = 1;
      }
      if (r < size - 1 && c < size - 1) {
        if (
          v === modules[r * size + c + 1] &&
          v === modules[(r + 1) * size + c] &&
          v === modules[(r + 1) * size + c + 1]
        ) {
          penalty += 3;
        }
      }
    }
  }
  for (let c = 0; c < size; c += 1) {
    let runColor = -1;
    let runLen = 0;
    for (let r = 0; r < size; r += 1) {
      const v = modules[r * size + c]!;
      if (v === runColor) {
        runLen += 1;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = v;
        runLen = 1;
      }
    }
  }
  const balance = Math.abs(darkCount * 20 - size * size * 10);
  penalty += Math.floor(balance / (size * size)) * 10;
  return penalty;
}
