import type { PhotoAdjustments } from '../sqlite/types';
import { mergePhotoRecipe, normalizePhotoAdjustments, resolveFullAdjustments } from './photoColorMath';
import type { PortraitSubjectMetrics } from './portraitSubjectBg';

/**
 * İZOLE SİSTEM KATMANI: Referans Tabanlı Akıllı Portre Kadraj Matematiği
 * Referans öğrencideki göz çizgisi, yüz boyutu, saç tepesi koruması ve omuz dengesini
 * her hedef öğrenciye aşırı yakınlaştırma ve siyah kenar olmadan birebir uyarlar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function effectivePhotoZoom(zoom: number, tilt: number): number {
  const tiltGuard = tilt !== 0 ? 1 + Math.abs(Math.sin((tilt * Math.PI) / 180)) * 1.18 : 1;
  return Math.max(zoom, tiltGuard);
}

/** Fare tekerleği hareketini 1.00..2.50x aralığında pürüzsüz yakınlaştırmaya çevirir. */
export function stepPhotoWheelZoom(currentZoom: number, deltaY: number, deltaMode: number): number {
  const rawDelta = deltaMode === 1 ? deltaY * 18 : deltaY;
  const factor = Math.exp(-clamp(rawDelta, -90, 90) * 0.0012);
  return clamp(round3(currentZoom * factor), 1, 2.5);
}

/** Sürükleme piksel farkını yakınlaştırmaya göre 1:1 kadraj kaydırma yüzdesine (-45..+45) çevirir. */
export function computePhotoDragPan(
  basePanX: number,
  basePanY: number,
  dxPx: number,
  dyPx: number,
  boxW: number,
  boxH: number,
  zoom: number,
): { panX: number; panY: number } {
  const z = Math.max(1, zoom);
  return {
    panX: clamp(round2(basePanX + (dxPx / Math.max(1, boxW)) * (100 / z)), -45, 45),
    panY: clamp(round2(basePanY + (dyPx / Math.max(1, boxH)) * (100 / z)), -45, 45),
  };
}

/**
 * CSS önizleme (object-fit: cover + transform), WebGL ve 300 DPI baskıda
 * 4 kenarda siyah/gri boşluk bırakmayan güvenli kaydırma sınırı.
 */
export function safeCoverPanLimit(zoom: number): number {
  return Math.max(0, 0.5 - 1 / (2 * Math.max(1, zoom)));
}

/**
 * Referans öğrencinin ekrandaki konumunu hedef öğrenciye uyarlayarak
 * hedef öğrencinin bireysel zoom, panX ve panY değerlerini hesaplar.
 */
export function computeSmartAlignedFraming(
  refSubject: PortraitSubjectMetrics,
  refAdj: PhotoAdjustments,
  targetSubject: PortraitSubjectMetrics,
  targetCurrentAdj: PhotoAdjustments,
): PhotoAdjustments {
  const refFull = resolveFullAdjustments(refAdj);
  const curFull = resolveFullAdjustments(targetCurrentAdj);
  const refZoom = effectivePhotoZoom(refFull.zoom, refFull.tilt);
  const refPanX = refFull.panX / 100;
  const refPanY = refFull.panY / 100;

  // Her iki karede de göz çizgisi varsa göz hizasını birincil dikey eksen olarak kilitle
  const useEyes = refSubject.eyeY !== undefined && targetSubject.eyeY !== undefined;
  const refAnchorY = useEyes
    ? 0.72 * refSubject.eyeY! + 0.28 * refSubject.headMidY
    : refSubject.headMidY;
  const targetAnchorY = useEyes
    ? 0.72 * targetSubject.eyeY! + 0.28 * targetSubject.headMidY
    : targetSubject.headMidY;

  // 1. Referans fotoğrafta kullanıcının yerleştirdiği hedef yüz geometrisi (3:4 çerçevede [-0.5..+0.5])
  const desiredCx = refZoom * (refSubject.faceCenterX + refPanX);
  const desiredAnchorY = refZoom * (refAnchorY + refPanY);
  const desiredHairTopY = refZoom * (refSubject.hairTopY + refPanY);
  const desiredHeadMetric = refZoom * refSubject.headMetric;

  // 2. Hedef öğrencinin yüz/göz ölçeğini referansa eşitle + aşırı yakınlaşma tavanı (kulak/örgü/omuz koruma)
  const rawZoom = desiredHeadMetric / Math.max(0.1, targetSubject.headMetric);
  const maxByFaceWidth = 0.72 / Math.max(0.12, targetSubject.faceWidth);
  const maxBySkullH = 0.68 / Math.max(0.14, targetSubject.skullHeight);
  const refMaxFaceW = Math.max(0.72, refZoom * refSubject.faceWidth * 1.08);
  const refMaxSkullH = Math.max(0.68, refZoom * refSubject.skullHeight * 1.08);
  const framingCeiling = Math.min(
    2.35,
    Math.max(maxByFaceWidth, refMaxFaceW / Math.max(0.12, targetSubject.faceWidth)),
    Math.max(maxBySkullH, refMaxSkullH / Math.max(0.14, targetSubject.skullHeight)),
  );
  const highConf = refSubject.confidence >= 0.8 && targetSubject.confidence >= 0.8;
  // Yakın çekilmiş öğrencileri zorla aşırı büyütme; uzaktaki öğrencileri ise referans boyutuna güvenle çıkar
  const minBound = highConf ? 1 : Math.max(1, refZoom * 0.72);
  const maxBound = Math.max(
    minBound,
    Math.min(framingCeiling, highConf ? 2.35 : Math.max(refZoom * 1.42, 1.85)),
  );
  let zoom = clamp(rawZoom, minBound, maxBound);

  let panX = desiredCx / zoom - targetSubject.faceCenterX;
  let panY = desiredAnchorY / zoom - targetAnchorY;

  // 3. Saç tepesi / topuz / kurdele koruması: baş tepesi üst kenardan kesilmez, çene aşağı taşmaz
  const minAllowedHairTop = Math.min(desiredHairTopY, -0.455);
  const maxAllowedChin = Math.max(0.41, refZoom * (refSubject.chinY + refPanY) + 0.04);
  let placedHairTop = zoom * (targetSubject.hairTopY + panY);
  if (placedHairTop < minAllowedHairTop) {
    const downShift = (minAllowedHairTop - placedHairTop) / zoom;
    const projectedChin = zoom * (targetSubject.chinY + panY + downShift);
    if (projectedChin <= maxAllowedChin) {
      panY += downShift;
    } else {
      const targetSpan = Math.max(0.3, maxAllowedChin - minAllowedHairTop);
      const actualSpan = Math.max(0.1, targetSubject.chinY - targetSubject.hairTopY);
      zoom = clamp(Math.min(zoom, targetSpan / actualSpan), 1, 2.35);
      panX = desiredCx / zoom - targetSubject.faceCenterX;
      panY = desiredAnchorY / zoom - targetAnchorY;
      placedHairTop = zoom * (targetSubject.hairTopY + panY);
      if (placedHairTop < minAllowedHairTop) {
        panY += (minAllowedHairTop - placedHairTop) / zoom;
      }
    }
  }

  // Çene alt kenara çok yaklaştıysa (omuzlar kayboluyorsa) hafifçe yukarı/geriye dengele
  const placedChinNow = zoom * (targetSubject.chinY + panY);
  if (placedChinNow > maxAllowedChin) {
    const upShift = (placedChinNow - maxAllowedChin) / zoom;
    if (zoom * (targetSubject.hairTopY + panY - upShift) >= minAllowedHairTop) {
      panY -= upShift;
    } else {
      const targetSpan = Math.max(0.3, maxAllowedChin - minAllowedHairTop);
      const actualSpan = Math.max(0.1, targetSubject.chinY - targetSubject.hairTopY);
      zoom = clamp(Math.min(zoom, targetSpan / actualSpan), 1, 2.35);
      panX = desiredCx / zoom - targetSubject.faceCenterX;
      panY = desiredAnchorY / zoom - targetAnchorY;
    }
  }

  // 4. Kısa boylu / kenarda duran öğrenciler için 4 kenarda boşluksuz kaydırma payı (aşırı şişirmeden)
  const maxAbsNeeded = Math.max(Math.abs(panX), Math.abs(panY));
  if (maxAbsNeeded > safeCoverPanLimit(zoom)) {
    const zoomCap = Math.min(maxBound, Math.max(zoom * 1.14, 1.26));
    const maxReachablePan = safeCoverPanLimit(zoomCap);
    const goalPan = Math.min(maxAbsNeeded, maxReachablePan);
    const neededZoom = goalPan < 0.49 ? 1 / (1 - 2 * goalPan) : zoomCap;
    const candidateZoom = clamp(neededZoom, zoom, zoomCap);
    const candPanX = desiredCx / candidateZoom - targetSubject.faceCenterX;
    let candPanY = desiredAnchorY / candidateZoom - targetAnchorY;
    const candHairTop = candidateZoom * (targetSubject.hairTopY + candPanY);
    if (candHairTop < minAllowedHairTop) {
      candPanY += (minAllowedHairTop - candHairTop) / candidateZoom;
    }
    const candChin = candidateZoom * (targetSubject.chinY + candPanY);
    if (
      candidateZoom * (targetSubject.hairTopY + candPanY) >= minAllowedHairTop - 0.02 &&
      candChin <= maxAllowedChin + 0.03
    ) {
      zoom = candidateZoom;
      panX = candPanX;
      panY = candPanY;
    }
  }

  const panLimit = Math.min(0.45, safeCoverPanLimit(zoom));
  panX = clamp(panX, -panLimit, panLimit);
  panY = clamp(panY, -panLimit, panLimit);

  const mergedLight = mergePhotoRecipe(targetCurrentAdj, refAdj, false);
  return normalizePhotoAdjustments({
    ...mergedLight,
    zoom: round3(clamp(zoom, 1, 2.5)),
    panX: round2(panX * 100),
    panY: round2(panY * 100),
    rotation: refFull.rotation !== 0 ? refFull.rotation : curFull.rotation,
    tilt: curFull.tilt,
  });
}
