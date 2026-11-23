/**
 * İZOLE SİSTEM KATMANI: Kütük 300 DPI Kart Hücre Çizim, Akıllı İsim Sığdırma & Portre Kaplama Yardımcıları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

/**
 * Saf Minimal kutucukta uzun isimlerin kesilmeden ve tek harf kırılmadan eşit kutuya sığması için ölçek döner.
 */
export function kutukMinimalNameScale(text: string, cols: number): number {
  const clean = text.trim().replace(/\s+/g, ' ');
  const len = clean.length;
  const maxWordLen = clean.split(' ').reduce((m, w) => Math.max(m, w.length), 0);
  const colBias = cols >= 9 ? 0.78 : cols >= 7 ? 0.85 : cols === 6 ? 0.93 : 1.0;
  let scale = 0.96;
  if (len > 34) scale = Math.max(0.52, 0.7 * (34 / len));
  else if (len > 26) scale = 0.7;
  else if (len > 20) scale = 0.78;
  else if (len > 15) scale = 0.86;
  const wordCap = cols >= 8 ? 10 : cols >= 7 ? 11 : 13;
  if (maxWordLen > wordCap) {
    scale = Math.min(scale, (wordCap / maxWordLen) * 0.96);
  }
  return Number(Math.max(0.5, scale * colBias).toFixed(3));
}

/**
 * Apple Kutu / Renkli Bant / Klasik Kütük isim satırında uzun ad-soyad veya uzun tek kelimenin
 * kutu yüksekliğini bozmadan ve kelime ortasından harf koparmadan (örn. KABLANOĞL / U) sığmasını sağlar.
 */
export function kutukCardNameScale(
  fullName: string,
  cardWidthMm: number,
  baseFontMm: number,
): number {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (!clean || cardWidthMm <= 0 || baseFontMm <= 0) return 1;
  const usableWidthMm = Math.max(10, cardWidthMm - 1.6);
  // Kalın büyük harf (700 uppercase) ortalama glif genişliği ≈ 0.72 × fontSize
  const charsPerLineAtBase = usableWidthMm / (baseFontMm * 0.72);
  const words = clean.split(' ');
  const maxWordLen = words.reduce((m, w) => Math.max(m, w.length), 0);

  let scale = 1;
  // 1) En uzun tek kelime asla ortadan kırılmayacak şekilde tek satıra sığsın
  if (maxWordLen > charsPerLineAtBase * 0.92) {
    scale = Math.min(scale, (charsPerLineAtBase * 0.92) / maxWordLen);
  }
  // 2) 2 satıra taşan uzun ad-soyadlar sabit kilitli kutuda ferah dursun
  if (clean.length > charsPerLineAtBase * 0.94) {
    scale = Math.min(scale, 0.9);
  }
  const twoLineBudget = charsPerLineAtBase * 1.72;
  if (clean.length > twoLineBudget) {
    scale = Math.min(scale, twoLineBudget / clean.length);
  }
  return Number(Math.max(0.66, Math.min(1, scale)).toFixed(3));
}

export function splitKutukWrappedLines(
  full: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const clean = full.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  if (clean.length <= maxCharsPerLine || maxLines <= 1) return [clean];
  const rawWords = clean.split(' ');
  const words: string[] = [];
  for (const w of rawWords) {
    if (w.length > maxCharsPerLine) {
      for (let i = 0; i < w.length; i += maxCharsPerLine) words.push(w.slice(i, i + maxCharsPerLine));
    } else {
      words.push(w);
    }
  }
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w;
    if (cur && probe.length > maxCharsPerLine && lines.length < maxLines - 1) {
      lines.push(cur);
      cur = w;
    } else {
      cur = probe;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

/**
 * Portreyi en/boy oranını bozmadan (object-fit: cover, üstten %18 baş korumalı) hedef alana çizer.
 */
export function drawKutukCoverPortrait(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const sw = source.width || dw;
  const sh = source.height || dh;
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  const srcRatio = sw / sh;
  const dstRatio = dw / dh;
  let sx = 0;
  let sy = 0;
  let cropW = sw;
  let cropH = sh;
  if (srcRatio > dstRatio) {
    cropW = sh * dstRatio;
    sx = (sw - cropW) / 2;
  } else if (srcRatio < dstRatio) {
    cropH = sw / dstRatio;
    sy = (sh - cropH) * 0.18;
  }
  ctx.drawImage(source, sx, sy, cropW, cropH, dx, dy, dw, dh);
}

export function drawKutukRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | null,
  stroke: string | null,
  lineWidth = 1,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius > 0 && typeof ctx.quadraticCurveTo === 'function') {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath?.();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill?.();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    return;
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
  }
}
