import { loadCachedDesktopPhotoPreview } from '../desktop/desktopPhotoPreview';
import { usesDesktopStorage } from '../desktop/desktopStorage';
import type { PhotoAdjustments, PhotoRecord } from '../sqlite/types';
import { loadBrowserPhotoPreview } from './browserPhotoPreview';
import { mergePhotoRecipe, normalizePhotoAdjustments, resolveFullAdjustments } from './photoColorMath';
import { computeSmartAlignedFraming } from './portraitSmartAlignMath';
import { detectPortraitSubjectFromRgba, type PortraitSubjectMetrics } from './portraitSubjectDetect';

export { computeSmartAlignedFraming, safeCoverPanLimit } from './portraitSmartAlignMath';

/**
 * İZOLE SİSTEM KATMANI: Önizleme Decode, Önbellek & Toplu Akıllı Hizalama Yürütücüsü
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const ANALYSIS_MAX_DIM = 224;
const SUBJECT_CACHE_LIMIT = 600;
const subjectCache = new Map<string, PortraitSubjectMetrics | null>();

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function resolvePreviewDataUrl(photo: PhotoRecord): Promise<string | null> {
  if (!usesDesktopStorage && photo.dataUrl) return photo.dataUrl;
  try {
    return usesDesktopStorage
      ? await loadCachedDesktopPhotoPreview(photo.id)
      : await loadBrowserPhotoPreview(photo.id);
  } catch {
    return null;
  }
}

export async function analyzePhotoRecordSubject(
  photo: PhotoRecord,
  rotation: number,
): Promise<PortraitSubjectMetrics | null> {
  const normRot = ((rotation % 360) + 360) % 360;
  const rot = normRot === 90 || normRot === 180 || normRot === 270 ? normRot : 0;
  const cacheKey = `${photo.id}:${rot}`;
  if (subjectCache.has(cacheKey)) return subjectCache.get(cacheKey) ?? null;

  if (typeof document === 'undefined') return null;
  const src = await resolvePreviewDataUrl(photo);
  if (!src) return null;
  const img = await loadImageElement(src);
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;

  const swap = rot === 90 || rot === 270;
  const srcW = swap ? img.naturalHeight : img.naturalWidth;
  const srcH = swap ? img.naturalWidth : img.naturalHeight;
  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(srcW, srcH));
  const aw = Math.max(1, Math.round(srcW * scale));
  const ah = Math.max(1, Math.round(srcH * scale));
  if (aw < 24 || ah < 24) return null;

  const canvas = document.createElement('canvas');
  canvas.width = aw;
  canvas.height = ah;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.save();
  ctx.translate(aw / 2, ah / 2);
  if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, aw, ah);
  } catch {
    return null;
  }
  const metrics = detectPortraitSubjectFromRgba(imageData.data, aw, ah);
  if (subjectCache.size >= SUBJECT_CACHE_LIMIT) {
    const firstKey = subjectCache.keys().next().value;
    if (firstKey !== undefined) subjectCache.delete(firstKey);
  }
  subjectCache.set(cacheKey, metrics);
  return metrics;
}

export interface SmartBatchAlignPlan {
  perPhotoAdjustments: Record<string, PhotoAdjustments>;
  smartAlignedCount: number;
  fallbackCount: number;
}

export async function buildSmartBatchAdjustments(
  referencePhoto: PhotoRecord,
  referenceAdj: PhotoAdjustments,
  targetPhotos: readonly PhotoRecord[],
): Promise<SmartBatchAlignPlan | null> {
  const refFull = resolveFullAdjustments(referenceAdj);
  const refSubject = await analyzePhotoRecordSubject(referencePhoto, refFull.rotation);
  if (!refSubject || refSubject.confidence < 0.35) return null;

  const perPhotoAdjustments: Record<string, PhotoAdjustments> = {};
  let smartAlignedCount = 0;
  let fallbackCount = 0;
  const chunkSize = 8;

  for (let i = 0; i < targetPhotos.length; i += chunkSize) {
    const chunk = targetPhotos.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (photo) => {
        if (photo.id === referencePhoto.id) {
          return { id: photo.id, adj: normalizePhotoAdjustments(referenceAdj), smart: true };
        }
        const targetRot = refFull.rotation !== 0 ? refFull.rotation : (photo.adjustments.rotation ?? 0);
        const subject = await analyzePhotoRecordSubject(photo, targetRot);
        if (subject && subject.confidence >= 0.35) {
          return {
            id: photo.id,
            adj: computeSmartAlignedFraming(refSubject, referenceAdj, subject, photo.adjustments),
            smart: true,
          };
        }
        return {
          id: photo.id,
          adj: mergePhotoRecipe(photo.adjustments, referenceAdj, true),
          smart: false,
        };
      }),
    );
    for (const item of results) {
      perPhotoAdjustments[item.id] = item.adj;
      if (item.smart) smartAlignedCount += 1;
      else fallbackCount += 1;
    }
  }
  return { perPhotoAdjustments, smartAlignedCount, fallbackCount };
}
