import type { AlbumTemplateConfig } from '../../sqlite/types';
import { PVC_TEMPLATES_PART_A } from './builtInTemplatesA';
import { PVC_TEMPLATES_PART_B } from './builtInTemplatesB';
import { cloneDesignToCustom, clonePvcSide, createNewPvcElement, scalePvcSideToSize } from './elementFactory';
import {
  PVC_DEFAULT_CORNER_RADIUS_MM,
  pvcCardDimensions,
  type PvcBuiltInTemplateId,
  type PvcBuiltInTemplateSpec,
  type PvcCardElement,
  type PvcCardSideSpec,
  type PvcCodeSource,
  type PvcCodeType,
  type PvcFieldKey,
  type PvcPrintSidesMode,
  type PvcResolvedDesign,
} from './types';

export { cloneDesignToCustom, createNewPvcElement };

/**
 * İZOLE SİSTEM KATMANI: PVC Kimlik Kartı Şablon Kataloğu (5 Hazır + Fotoğrafçı Özel Tasarımları)
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const DEFAULT_PVC_TEMPLATE_ID: PvcBuiltInTemplateId = 'official-classic';
export const DEFAULT_PVC_PRINT_SIDES: PvcPrintSidesMode = 'front-only';
export const DEFAULT_PVC_CODE_TYPE: PvcCodeType = 'barcode';
export const DEFAULT_PVC_CODE_SOURCE: PvcCodeSource = 'studentNumber';

export const PVC_BUILT_IN_TEMPLATES: readonly PvcBuiltInTemplateSpec[] = [
  ...PVC_TEMPLATES_PART_A,
  ...PVC_TEMPLATES_PART_B,
];

const BUILT_IN_MAP = new Map<string, PvcBuiltInTemplateSpec>(
  PVC_BUILT_IN_TEMPLATES.map((tpl) => [tpl.id, tpl]),
);

export function defaultCodeTypeForTemplate(templateId: string): PvcCodeType {
  return templateId === 'minimal-pro' ? 'qrcode' : DEFAULT_PVC_CODE_TYPE;
}

function applyQuickOverridesToSide(
  side: PvcCardSideSpec,
  config: Partial<AlbumTemplateConfig>,
  templateId: PvcBuiltInTemplateId,
): PvcCardSideSpec {
  const codeType = config.pvcCodeType ?? defaultCodeTypeForTemplate(templateId);
  const codeSource = config.pvcCodeSource ?? DEFAULT_PVC_CODE_SOURCE;
  const showWatermark = config.pvcShowWatermark ?? true;
  const showSignature = config.pvcShowSignature ?? true;
  const showStudio = config.pvcShowStudioInfo ?? true;
  const hiddenSet = new Set<PvcFieldKey>(config.pvcHiddenFields ?? []);
  const backNote = config.pvcBackNote?.trim();
  const hasHeaderOverride = config.pvcHeaderTopText !== undefined;
  const headerTopText = config.pvcHeaderTopText?.trim() ?? '';

  const elements: PvcCardElement[] = [];
  for (const el of side.elements) {
    if ((el.id === 'wm-logo' || el.id === 'back-wm-logo') && !showWatermark) continue;
    if ((el.id === 'front-sig' || el.id === 'front-sig-label') && !showSignature) continue;
    if (el.id.startsWith('studio-') && !showStudio) continue;
    if (el.kind === 'field' && el.fieldKey && hiddenSet.has(el.fieldKey)) continue;

    if (el.id === 'header-top' && hasHeaderOverride) {
      if (!headerTopText) continue;
      elements.push({ ...el, text: headerTopText });
      continue;
    }

    if (el.id === 'mp-qr-frame') {
      if (codeType === 'none') continue;
      elements.push(codeType === 'barcode' ? { ...el, yMm: 19.6, hMm: 13.4 } : { ...el });
      continue;
    }

    if (el.id === 'primary-code') {
      if (codeType === 'none') continue;
      if (codeType === 'qrcode') {
        const qrSrc = codeSource === 'studentNumber' ? 'studentSummary' : codeSource;
        if (el.kind === 'qrcode') {
          elements.push({ ...el, codeSource: qrSrc });
        } else {
          const sq = Math.min(el.wMm, Math.max(el.hMm, 12.2));
          elements.push({
            ...el,
            kind: 'qrcode',
            wMm: sq,
            hMm: sq,
            yMm: Math.min(el.yMm, Math.max(el.yMm - (sq - el.hMm) * 0.5, 34)),
            codeSource: qrSrc,
          });
        }
        continue;
      }
      if (el.kind === 'qrcode') {
        elements.push({
          ...el,
          kind: 'barcode',
          xMm: el.xMm - 0.4,
          yMm: 21.0,
          wMm: el.wMm + 0.8,
          hMm: 10.6,
          showCodeText: true,
          codeSource,
        });
        continue;
      }
      elements.push({ ...el, kind: 'barcode', codeSource });
      continue;
    }

    if (el.id === 'back-code') {
      if (codeType === 'none') continue;
      const src = el.kind === 'qrcode' && codeSource === 'studentNumber' ? 'studentSummary' : codeSource;
      elements.push({ ...el, codeSource: src });
      continue;
    }

    if (el.id === 'back-note' && backNote) {
      elements.push({ ...el, text: backNote });
      continue;
    }

    if (el.kind === 'photo') {
      elements.push({
        ...el,
        ...(config.pvcPhotoShape ? { photoShape: config.pvcPhotoShape } : {}),
        ...(config.pvcPhotoFit ? { imageFit: config.pvcPhotoFit } : {}),
        ...(config.pvcPhotoZoom !== undefined ? { photoZoom: config.pvcPhotoZoom } : {}),
        ...(config.pvcPhotoPosX !== undefined ? { photoPosX: config.pvcPhotoPosX } : {}),
        ...(config.pvcPhotoPosY !== undefined ? { photoPosY: config.pvcPhotoPosY } : {}),
      });
      continue;
    }

    elements.push({ ...el });
  }

  return { ...side, elements };
}

export function resolvePvcCardDesign(
  albumConfig: Partial<AlbumTemplateConfig>,
): PvcResolvedDesign {
  const requestedId = albumConfig.pvcTemplateId ?? DEFAULT_PVC_TEMPLATE_ID;
  const customDesigns = albumConfig.pvcCustomDesigns ?? [];
  const customMatch = customDesigns.find((d) => d.id === requestedId);

  if (customMatch) {
    const dims = pvcCardDimensions(customMatch.orientation);
    const widthMm = customMatch.widthMm ?? dims.widthMm;
    const heightMm = customMatch.heightMm ?? dims.heightMm;
    const orientation = heightMm > widthMm ? 'portrait' : 'landscape';
    return {
      id: customMatch.id,
      name: customMatch.name,
      shortBadge: orientation === 'portrait' ? 'Özel · Dikey' : 'Özel · Yatay',
      subtitle: 'Fotoğrafçı tarafından oluşturulan serbest PVC kart tasarımı',
      isCustom: true,
      orientation,
      widthMm,
      heightMm,
      cardRadiusMm: customMatch.cardRadiusMm ?? PVC_DEFAULT_CORNER_RADIUS_MM,
      front: clonePvcSide(customMatch.front),
      back: clonePvcSide(customMatch.back),
    };
  }

  const builtIn = BUILT_IN_MAP.get(requestedId) ?? PVC_BUILT_IN_TEMPLATES[0]!;
  const dims = pvcCardDimensions(builtIn.orientation);
  const widthMm = albumConfig.pvcCardWidthMm ?? dims.widthMm;
  const heightMm = albumConfig.pvcCardHeightMm ?? dims.heightMm;
  const orientation = heightMm > widthMm ? 'portrait' : 'landscape';
  const rawFront = applyQuickOverridesToSide(builtIn.front, albumConfig, builtIn.id);
  const rawBack = applyQuickOverridesToSide(builtIn.back, albumConfig, builtIn.id);
  return {
    id: builtIn.id,
    name: builtIn.name,
    shortBadge: builtIn.shortBadge,
    subtitle: builtIn.subtitle,
    isCustom: false,
    orientation,
    widthMm,
    heightMm,
    cardRadiusMm: albumConfig.pvcCardRadiusMm ?? builtIn.cardRadiusMm,
    front: scalePvcSideToSize(rawFront, dims.widthMm, dims.heightMm, widthMm, heightMm),
    back: scalePvcSideToSize(rawBack, dims.widthMm, dims.heightMm, widthMm, heightMm),
  };
}
