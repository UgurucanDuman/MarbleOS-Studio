/**
 * İZOLE SİSTEM KATMANI: ISO/IEC 18004 QR Kod GF(256) Reed-Solomon & Sürüm 1–6 (ECC-M) Tabloları
 * Sıfır harici bağımlılık; 106 UTF-8 bayta kadar okul no, T.C. ve kimlik özetini kodlar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface QrVersionSpec {
  version: number;
  size: number;
  totalDataCodewords: number;
  ecPerBlock: number;
  blocks: number;
  alignmentCenters: readonly number[];
}

/** ISO/IEC 18004 Table 9 — ECC Level M, Versions 1..6 */
export const QR_VERSIONS_M: readonly QrVersionSpec[] = [
  { version: 1, size: 21, totalDataCodewords: 16, ecPerBlock: 10, blocks: 1, alignmentCenters: [] },
  { version: 2, size: 25, totalDataCodewords: 28, ecPerBlock: 16, blocks: 1, alignmentCenters: [6, 18] },
  { version: 3, size: 29, totalDataCodewords: 44, ecPerBlock: 26, blocks: 1, alignmentCenters: [6, 22] },
  { version: 4, size: 33, totalDataCodewords: 64, ecPerBlock: 18, blocks: 2, alignmentCenters: [6, 26] },
  { version: 5, size: 37, totalDataCodewords: 86, ecPerBlock: 24, blocks: 2, alignmentCenters: [6, 30] },
  { version: 6, size: 41, totalDataCodewords: 108, ecPerBlock: 16, blocks: 4, alignmentCenters: [6, 34] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) {
    GF_EXP[i] = GF_EXP[i - 255]!;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

function buildRsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i]!;
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j]!;
      next[j + 1] ^= gfMul(poly[j]!, root);
    }
    poly = next;
  }
  return poly;
}

export function computeReedSolomonEcc(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = buildRsGenerator(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i]! ^ rem[0]!;
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j += 1) {
        rem[j] ^= gfMul(gen[j + 1]!, factor);
      }
    }
  }
  return rem;
}

export function selectQrVersionM(byteLen: number): QrVersionSpec {
  // Byte mode overhead: 4-bit mode + 8-bit length + 4-bit terminator = 16 bits = 2 bytes
  const neededBytes = byteLen + 2;
  for (const spec of QR_VERSIONS_M) {
    if (neededBytes <= spec.totalDataCodewords) return spec;
  }
  return QR_VERSIONS_M[QR_VERSIONS_M.length - 1]!;
}

export function buildQrCodewords(utf8Bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const maxPayload = Math.max(0, spec.totalDataCodewords - 2);
  const payload = utf8Bytes.subarray(0, maxPayload);
  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  pushBits(payload.length, 8); // Versions 1..9 use 8-bit char count
  for (let i = 0; i < payload.length; i += 1) pushBits(payload[i]!, 8);

  const capacityBits = spec.totalDataCodewords * 8;
  const term = Math.min(4, capacityBits - bits.length);
  pushBits(0, term);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(spec.totalDataCodewords);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k += 1) b = (b << 1) | (bits[i + k] ?? 0);
    data[byteIdx++] = b;
  }
  const padBytes = [0xec, 0x11];
  let padToggle = 0;
  while (byteIdx < spec.totalDataCodewords) {
    data[byteIdx++] = padBytes[padToggle]! ;
    padToggle ^= 1;
  }

  const blockSize = Math.floor(spec.totalDataCodewords / spec.blocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b += 1) {
    const slice = data.subarray(b * blockSize, (b + 1) * blockSize);
    dataBlocks.push(slice);
    ecBlocks.push(computeReedSolomonEcc(slice, spec.ecPerBlock));
  }

  const out = new Uint8Array(spec.totalDataCodewords + spec.blocks * spec.ecPerBlock);
  let pos = 0;
  for (let i = 0; i < blockSize; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) out[pos++] = dataBlocks[b]![i]!;
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (let b = 0; b < spec.blocks; b += 1) out[pos++] = ecBlocks[b]![i]!;
  }
  return out;
}

/** ISO/IEC 18004 Format Information (15 bits): ECC-M (00) + mask (0..7), BCH(15,5) + mask 0x5412 */
export function computeQrFormatBitsM(maskPattern: number): number {
  const data = (0b00 << 3) | (maskPattern & 0b111);
  let rem = data << 10;
  const poly = 0b10100110111;
  for (let i = 14; i >= 10; i -= 1) {
    if ((rem >>> i) & 1) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}
