/**
 * İZOLE SİSTEM KATMANI: ISO/IEC 15417 Code128 (Set B) Gerçek Barkod Kodlayıcı
 * Sahte çizgi üretmez; geçerli Start B (104), Modulo-103 sağlama toplamı, Stop (106)
 * ve sessiz kenar boşluklarıyla (quiet zone) kantin/kütüphane/turnike okuyucularına uyumludur.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const STOP_CODE = 106;
const QUIET_MODULES = 10;

const TR_ASCII_MAP: Readonly<Record<string, string>> = {
  Ç: 'C', ç: 'c', Ğ: 'G', ğ: 'g', İ: 'I', ı: 'i',
  Ö: 'O', ö: 'o', Ş: 'S', ş: 's', Ü: 'U', ü: 'u',
};

export interface EncodedCode128 {
  displayValue: string;
  bars: ReadonlyArray<{ x: number; w: number }>;
  totalModules: number;
  checksum: number;
}

export function sanitizeCode128Input(raw: string): string {
  const mapped = raw
    .trim()
    .split('')
    .map((ch) => TR_ASCII_MAP[ch] ?? ch)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join('')
    .slice(0, 32);
  return mapped || '0000';
}

export function encodeCode128B(rawValue: string): EncodedCode128 {
  const clean = sanitizeCode128Input(rawValue);
  const codes: number[] = [START_B];
  let weightedSum = START_B;

  for (let i = 0; i < clean.length; i += 1) {
    const val = clean.charCodeAt(i) - 32;
    codes.push(val);
    weightedSum += val * (i + 1);
  }

  const checksum = weightedSum % 103;
  codes.push(checksum, STOP_CODE);

  const bars: Array<{ x: number; w: number }> = [];
  let cursor = QUIET_MODULES;
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] ?? '';
    for (let j = 0; j < pattern.length; j += 1) {
      const width = Number(pattern[j]);
      if (j % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }
  const totalModules = cursor + QUIET_MODULES;

  return {
    displayValue: clean,
    bars,
    totalModules,
    checksum,
  };
}

export function drawCode128OnCanvas(options: {
  ctx: CanvasRenderingContext2D;
  value: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  showText: boolean;
}): void {
  const { ctx, value, x, y, w, h, color, showText } = options;
  const encoded = encodeCode128B(value);
  const textH = showText ? Math.max(8, Math.round(h * 0.28)) : 0;
  const barH = Math.max(4, h - textH - (showText ? 2 : 0));
  const unit = w / encoded.totalModules;

  ctx.save();
  ctx.fillStyle = color;
  for (const bar of encoded.bars) {
    const bx = Math.round(x + bar.x * unit);
    const nextX = Math.round(x + (bar.x + bar.w) * unit);
    ctx.fillRect(bx, Math.round(y), Math.max(1, nextX - bx), Math.round(barH));
  }

  if (showText) {
    const fontPx = Math.max(8, Math.round(textH * 0.88));
    ctx.font = `600 ${fontPx}px ui-monospace, Consolas, "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(encoded.displayValue, x + w / 2, y + h, w);
  }
  ctx.restore();
}
