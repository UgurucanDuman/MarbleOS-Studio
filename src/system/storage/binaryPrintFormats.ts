/**
 * İZOLE SİSTEM KATMANI: 300 DPI Fiziksel Ölçü Birimleri, JFIF Yoğunluk Başlığı ve Saf PDF 1.4 Üreticisi
 * Üçüncü parti ağır PDF kütüphaneleri olmadan milimetrik `/MediaBox` ve `/DCTDecode` JPEG akışıyla
 * gerçek 300 DPI minilab / matbaa çıktısı üretir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;
const PDF_PT_PER_INCH = 72;

export function mmToPx(mm: number, dpi = PRINT_DPI): number {
  return Math.max(1, Math.round((mm / MM_PER_INCH) * dpi));
}

export function mmToPt(mm: number): number {
  return Number(((mm * PDF_PT_PER_INCH) / MM_PER_INCH).toFixed(2));
}

/**
 * JPEG bayt akışına 300 DPI (`units = 1`, `Xdensity = dpi`, `Ydensity = dpi`) JFIF APP0
 * başlığını yazar veya günceller; Photoshop, Corel ve Frontier/Noritsu minilab cihazları
 * fotoğrafı 72 DPI yerine tam fiziksel milimetre ölçüsünde açar.
 */
export function injectJfif300Dpi(jpegBytes: Uint8Array, dpi = PRINT_DPI): Uint8Array {
  if (jpegBytes.length < 4 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    throw new Error('Geçerli bir JPEG akışı oluşturulmadı.');
  }
  const safeDpi = Math.min(2400, Math.max(72, Math.round(dpi)));
  const hi = (safeDpi >> 8) & 0xff;
  const lo = safeDpi & 0xff;

  if (
    jpegBytes.length >= 20 &&
    jpegBytes[2] === 0xff &&
    jpegBytes[3] === 0xe0 &&
    ((jpegBytes[4]! << 8) | jpegBytes[5]!) >= 16 &&
    jpegBytes[6] === 0x4a &&
    jpegBytes[7] === 0x46 &&
    jpegBytes[8] === 0x49 &&
    jpegBytes[9] === 0x46 &&
    jpegBytes[10] === 0x00
  ) {
    const out = new Uint8Array(jpegBytes.length);
    out.set(jpegBytes);
    out[13] = 1;
    out[14] = hi;
    out[15] = lo;
    out[16] = hi;
    out[17] = lo;
    return out;
  }

  const app0 = new Uint8Array([
    0xff, 0xe0,
    0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01,
    0x01,
    hi, lo,
    hi, lo,
    0x00, 0x00,
  ]);
  const out = new Uint8Array(jpegBytes.length + app0.length);
  out[0] = 0xff;
  out[1] = 0xd8;
  out.set(app0, 2);
  out.set(jpegBytes.subarray(2), 2 + app0.length);
  return out;
}

export interface PdfRasterPage {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  widthMm: number;
  heightMm: number;
}

export { buildPhysicalPdfFromJpegs, type PdfBuildOptions } from './pdfDocumentBuilder';

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', copy));
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    h1 ^= bytes[i]!;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0').repeat(8);
}
