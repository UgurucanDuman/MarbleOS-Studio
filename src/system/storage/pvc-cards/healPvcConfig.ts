import { pvcAlbumConfigFieldsShape } from '../../schemas/pvcCardSchemas';
import {
  PVC_CODE_SOURCES,
  PVC_CODE_TYPES,
  PVC_FIELD_KEYS,
  PVC_PHOTO_SHAPES,
  PVC_PRINT_SIDES_MODES,
  type PvcCustomDesign,
} from './types';

/**
 * İZOLE SİSTEM YARDIMCISI: Tarayıcı Prototipi PVC Kimlik Alanı İyileştirici
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

type AnyRec = Record<string, unknown>;
const CTRL_RE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g;

function cleanStr(val: unknown, maxLen: number): string {
  return typeof val === 'string' ? val.normalize('NFC').replace(CTRL_RE, ' ').trim().slice(0, maxLen) : '';
}

export function healPvcAlbumFields(ac: AnyRec): AnyRec {
  const out: AnyRec = {};

  if (typeof ac.pvcTemplateId === 'string') {
    const tid = cleanStr(ac.pvcTemplateId, 64);
    if (tid && /^[A-Za-z0-9-]+$/.test(tid)) out.pvcTemplateId = tid;
  }

  if (typeof ac.pvcPrintSides === 'string' && (PVC_PRINT_SIDES_MODES as readonly string[]).includes(ac.pvcPrintSides)) {
    out.pvcPrintSides = ac.pvcPrintSides;
  }
  if (typeof ac.pvcCardsPerPage === 'number' && Number.isFinite(ac.pvcCardsPerPage)) {
    out.pvcCardsPerPage = Math.min(10, Math.max(1, Math.round(ac.pvcCardsPerPage)));
  }

  if (typeof ac.pvcCodeType === 'string' && (PVC_CODE_TYPES as readonly string[]).includes(ac.pvcCodeType)) {
    out.pvcCodeType = ac.pvcCodeType;
  }

  if (typeof ac.pvcCodeSource === 'string' && (PVC_CODE_SOURCES as readonly string[]).includes(ac.pvcCodeSource)) {
    out.pvcCodeSource = ac.pvcCodeSource;
  }

  if (typeof ac.pvcShowWatermark === 'boolean') out.pvcShowWatermark = ac.pvcShowWatermark;
  if (typeof ac.pvcShowSignature === 'boolean') out.pvcShowSignature = ac.pvcShowSignature;
  if (typeof ac.pvcShowStudioInfo === 'boolean') out.pvcShowStudioInfo = ac.pvcShowStudioInfo;
  if (typeof ac.pvcCardRadiusMm === 'number' && Number.isFinite(ac.pvcCardRadiusMm)) {
    out.pvcCardRadiusMm = Math.min(10, Math.max(0, Number(ac.pvcCardRadiusMm.toFixed(2))));
  }
  if (typeof ac.pvcCardWidthMm === 'number' && Number.isFinite(ac.pvcCardWidthMm)) {
    out.pvcCardWidthMm = Math.min(130, Math.max(40, Number(ac.pvcCardWidthMm.toFixed(1))));
  }
  if (typeof ac.pvcCardHeightMm === 'number' && Number.isFinite(ac.pvcCardHeightMm)) {
    out.pvcCardHeightMm = Math.min(130, Math.max(40, Number(ac.pvcCardHeightMm.toFixed(1))));
  }
  if (ac.pvcPhotoFit === 'cover' || ac.pvcPhotoFit === 'contain') out.pvcPhotoFit = ac.pvcPhotoFit;
  if (typeof ac.pvcPhotoZoom === 'number' && Number.isFinite(ac.pvcPhotoZoom)) {
    out.pvcPhotoZoom = Math.min(2.5, Math.max(0.7, Number(ac.pvcPhotoZoom.toFixed(2))));
  }
  if (typeof ac.pvcPhotoPosX === 'number' && Number.isFinite(ac.pvcPhotoPosX)) {
    out.pvcPhotoPosX = Math.min(100, Math.max(0, Math.round(ac.pvcPhotoPosX)));
  }
  if (typeof ac.pvcPhotoPosY === 'number' && Number.isFinite(ac.pvcPhotoPosY)) {
    out.pvcPhotoPosY = Math.min(100, Math.max(0, Math.round(ac.pvcPhotoPosY)));
  }
  if (typeof ac.pvcPhotoShape === 'string' && (PVC_PHOTO_SHAPES as readonly string[]).includes(ac.pvcPhotoShape)) {
    out.pvcPhotoShape = ac.pvcPhotoShape;
  }
  if (typeof ac.pvcHeaderTopText === 'string') {
    const hdr = cleanStr(ac.pvcHeaderTopText, 80);
    if (!hdr || !/^[=+\-@]/.test(hdr)) out.pvcHeaderTopText = hdr;
  }

  if (typeof ac.pvcBackNote === 'string') {
    const note = cleanStr(ac.pvcBackNote, 180);
    if (note && !/^[=+\-@]/.test(note)) out.pvcBackNote = note;
  }

  if (Array.isArray(ac.pvcHiddenFields)) {
    const validHidden = ac.pvcHiddenFields.filter(
      (f): f is string => typeof f === 'string' && (PVC_FIELD_KEYS as readonly string[]).includes(f),
    );
    if (validHidden.length > 0) out.pvcHiddenFields = [...new Set(validHidden)].slice(0, 24);
  }

  if (Array.isArray(ac.pvcCustomDesigns)) {
    const validDesigns: PvcCustomDesign[] = [];
    const seenIds = new Set<string>();
    for (const item of ac.pvcCustomDesigns) {
      const checked = pvcAlbumConfigFieldsShape.pvcCustomDesigns.safeParse([item]);
      const parsed = checked.success ? checked.data?.[0] : undefined;
      if (parsed && !seenIds.has(parsed.id)) {
        seenIds.add(parsed.id);
        validDesigns.push(parsed);
      }
      if (validDesigns.length >= 15) break;
    }
    if (validDesigns.length > 0) out.pvcCustomDesigns = validDesigns;
  }

  return out;
}
