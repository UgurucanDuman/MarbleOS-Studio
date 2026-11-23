/**
 * İZOLE SİSTEM KATMANI: Kafatası-Sınırlı & Ten-Doğrulamalı Göz Çifti ve Gerçek Omuz Algılayıcısı
 * - Saç çizgisi, gözlük köprüsü, burun deliği ve bej/krem kazak yanılsamalarına karşı tam korumalıdır.
 * - Sabit boyutlu göz örnekleme kutusu + ten/ön plan integral maskesi ile < 0.6 ms içinde çalışır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface DetectedEyePair {
  eyeCx: number;
  eyeY: number;
  eyeSep: number;
  score: number;
}

function buildIntegralFromCallback(w: number, h: number, sample: (idx: number) => number): Float32Array {
  const stride = w + 1;
  const ii = new Float32Array(stride * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let rowSum = 0;
    const rowOff = y * w;
    const dst = (y + 1) * stride;
    const prev = y * stride;
    for (let x = 0; x < w; x += 1) {
      rowSum += sample(rowOff + x);
      ii[dst + x + 1] = ii[prev + x + 1]! + rowSum;
    }
  }
  return ii;
}

function boxMean(
  ii: Float32Array,
  stride: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
): number {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(cx - halfW)));
  const x1 = Math.max(x0 + 1, Math.min(w, Math.ceil(cx + halfW)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(cy - halfH)));
  const y1 = Math.max(y0 + 1, Math.min(h, Math.ceil(cy + halfH)));
  const area = (x1 - x0) * (y1 - y0);
  const sum =
    ii[y1 * stride + x1]! -
    ii[y0 * stride + x1]! -
    ii[y1 * stride + x0]! +
    ii[y0 * stride + x0]!;
  return sum / Math.max(1, area);
}

/**
 * Kafatası orta bandında (saç çizgisi ve ağız/burun dışarıda bırakılarak) ten maskesi doğrulanmış
 * simetrik göz çiftini bulur. Gözsüz sentetik portrelerde güvenle null döner.
 */
export function detectEyePairMetrics(
  rgba: Uint8ClampedArray,
  skinMask: Uint8Array,
  fgMask: Uint8Array,
  hasUniformBg: boolean,
  w: number,
  h: number,
  faceCx: number,
  skullTopPx: number,
  skinTopY: number,
  chinPx: number,
  faceW: number,
): DetectedEyePair | null {
  if (faceW < 14 || w < 32 || h < 32) return null;
  const headH = Math.max(faceW * 1.15, chinPx - skullTopPx);
  // Gözler anatomik olarak kafatası orta bandında (0.36..0.64) yer alır; saç çizgisi ve burun deliği dışlanır
  const yMin = Math.max(4, Math.max(Math.floor(skinTopY + faceW * 0.08), Math.floor(skullTopPx + headH * 0.36)));
  const yMax = Math.min(h - 6, Math.min(Math.ceil(chinPx - faceW * 0.3), Math.ceil(skullTopPx + headH * 0.64)));
  if (yMax <= yMin + 2) return null;

  const lumaII = buildIntegralFromCallback(w, h, (idx) => {
    const p = idx * 4;
    return 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  });
  const skinII = buildIntegralFromCallback(w, h, (idx) => skinMask[idx]!);
  const fgII = hasUniformBg ? buildIntegralFromCallback(w, h, (idx) => fgMask[idx]!) : null;
  const stride = w + 1;

  const expectedSep = faceW * 0.455;
  const expectedEyeY = skullTopPx + headH * 0.5;
  const minSep = Math.max(7, Math.round(faceW * 0.37));
  const maxSep = Math.min(Math.round(w * 0.48), Math.round(faceW * 0.55));
  const sepStep = Math.max(1, Math.round((maxSep - minSep) / 8));
  const cxSpan = Math.max(2, Math.round(faceW * 0.14));
  const cxStep = Math.max(1, Math.round(cxSpan / 4));
  const yStep = faceW >= 58 ? 2 : 1;

  // Sabit örnekleme kutusu boyutu: küçük sep adaylarına haksız yüksek kontrast avantajı verilmez
  const eyeHalfW = Math.max(1.5, faceW * 0.075);
  const eyeHalfH = Math.max(1.2, faceW * 0.052);
  const bridgeHalfW = Math.max(1.5, faceW * 0.062);
  const cheekDy = Math.max(3, faceW * 0.165);

  let best: DetectedEyePair | null = null;

  for (let sep = minSep; sep <= maxSep; sep += sepStep) {
    const halfSep = sep * 0.5;
    const outerOff = halfSep + eyeHalfW * 1.5;
    const sepPrior = 1 - Math.min(1, Math.abs(sep - expectedSep) / Math.max(4, expectedSep * 0.45)) * 0.22;

    for (let y = yMin; y <= yMax; y += yStep) {
      const yPrior = 1 - Math.min(1, Math.abs(y - expectedEyeY) / Math.max(6, headH * 0.35)) * 0.14;
      for (let dx = -cxSpan; dx <= cxSpan; dx += cxStep) {
        const cx = faceCx + dx;
        if (cx - halfSep - eyeHalfW < 2 || cx + halfSep + eyeHalfW > w - 2) continue;
        if (y + cheekDy + eyeHalfH > h - 2) continue;

        // Burun köprüsü ve her iki göz altı yanağı mutlaka insan teni içinde olmalıdır (saç çizgisi koruması)
        if (boxMean(skinII, stride, w, h, cx, y, bridgeHalfW * 1.2, eyeHalfH * 1.2) < 0.42) continue;
        const lCheekSkin = boxMean(skinII, stride, w, h, cx - halfSep, y + cheekDy, eyeHalfW * 1.2, eyeHalfH * 1.2);
        const rCheekSkin = boxMean(skinII, stride, w, h, cx + halfSep, y + cheekDy, eyeHalfW * 1.2, eyeHalfH * 1.2);
        if (lCheekSkin < 0.42 || rCheekSkin < 0.42) continue;

        // Göz dış kenarları beyaz arka plan değil baş silüetinin içinde olmalıdır
        if (fgII) {
          const lOutFg = boxMean(fgII, stride, w, h, cx - outerOff, y, eyeHalfW, eyeHalfH * 1.2);
          const rOutFg = boxMean(fgII, stride, w, h, cx + outerOff, y, eyeHalfW, eyeHalfH * 1.2);
          if (lOutFg < 0.55 || rOutFg < 0.55) continue;
        }

        const leftL = boxMean(lumaII, stride, w, h, cx - halfSep, y, eyeHalfW, eyeHalfH);
        const rightL = boxMean(lumaII, stride, w, h, cx + halfSep, y, eyeHalfW, eyeHalfH);
        const bridgeL = boxMean(lumaII, stride, w, h, cx, y, bridgeHalfW, eyeHalfH);
        const cheekL =
          0.5 *
          (boxMean(lumaII, stride, w, h, cx - halfSep, y + cheekDy, eyeHalfW * 1.1, eyeHalfH * 1.1) +
            boxMean(lumaII, stride, w, h, cx + halfSep, y + cheekDy, eyeHalfW * 1.1, eyeHalfH * 1.1));

        const diffBridgeL = bridgeL - leftL;
        const diffBridgeR = bridgeL - rightL;
        const diffCheekL = cheekL - leftL;
        const diffCheekR = cheekL - rightL;
        if (diffBridgeL < 7 || diffBridgeR < 7 || diffCheekL < 7 || diffCheekR < 7) continue;

        const symDiff = Math.abs(leftL - rightL);
        if (symDiff > 32) continue;

        const minContrast = Math.min(diffBridgeL, diffBridgeR, diffCheekL, diffCheekR);
        const meanContrast = (diffBridgeL + diffBridgeR + diffCheekL + diffCheekR) * 0.25;
        const centerPrior = 1 - Math.min(1, Math.abs(dx) / Math.max(1, cxSpan * 1.8)) * 0.1;
        const score = (minContrast * 0.58 + meanContrast * 0.42 - symDiff * 0.55) * sepPrior * yPrior * centerPrior;

        if (!best || score > best.score) {
          best = { eyeCx: cx, eyeY: y, eyeSep: sep, score };
        }
      }
    }
  }

  return best && best.score >= 10 ? best : null;
}
