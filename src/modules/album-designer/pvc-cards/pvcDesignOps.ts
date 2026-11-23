import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import { resolvePvcCardDesign } from '../../../system/storage/pvc-cards/catalog';
import type {
  PvcCardElement,
  PvcCardSide,
  PvcCardSideSpec,
  PvcCustomDesign,
  PvcResolvedDesign,
} from '../../../system/storage/pvc-cards/types';

/**
 * İZOLE MODÜL 03 YARDIMCISI: PVC Tasarım Canlı Slider Önizleme & Katman Hızlı İşlem Fonksiyonları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PvcLiveSliderPreview {
  albumPatch?: Partial<AlbumTemplateConfig>;
  cardRadiusMm?: number;
  sidePatch?: Partial<PvcCardSideSpec>;
  elementPatch?: { id: string; patch: Partial<PvcCardElement> };
}

export function resolveDesignWithLivePreview(
  albumConfig: AlbumTemplateConfig,
  activeSide: PvcCardSide,
  livePreview: PvcLiveSliderPreview | null,
): PvcResolvedDesign {
  const effectiveConfig = livePreview?.albumPatch
    ? { ...albumConfig, ...livePreview.albumPatch }
    : albumConfig;
  const base = resolvePvcCardDesign(effectiveConfig);
  if (!livePreview) return base;

  let next =
    livePreview.cardRadiusMm !== undefined
      ? { ...base, cardRadiusMm: livePreview.cardRadiusMm }
      : base;

  if (livePreview.sidePatch || livePreview.elementPatch) {
    const sideSpec = activeSide === 'back' ? next.back : next.front;
    next = {
      ...next,
      [activeSide]: {
        ...sideSpec,
        ...(livePreview.sidePatch ?? {}),
        elements: livePreview.elementPatch
          ? sideSpec.elements.map((el) =>
              el.id === livePreview.elementPatch!.id
                ? { ...el, ...livePreview.elementPatch!.patch }
                : el,
            )
          : sideSpec.elements,
      },
    };
  }
  return next;
}

export function applySideElementAction(
  prev: PvcCustomDesign,
  activeSide: PvcCardSide,
  elId: string,
  action: 'up' | 'down' | 'duplicate' | 'delete',
  cardWidthMm: number,
  cardHeightMm: number,
): { next: PvcCustomDesign; nextSelectedId?: string | null } {
  const sideSpec = activeSide === 'back' ? prev.back : prev.front;
  const now = new Date().toISOString();

  if (action === 'delete') {
    return {
      next: {
        ...prev,
        updatedAt: now,
        [activeSide]: { ...sideSpec, elements: sideSpec.elements.filter((el) => el.id !== elId) },
      },
      nextSelectedId: null,
    };
  }

  if (action === 'duplicate') {
    const target = sideSpec.elements.find((e) => e.id === elId);
    if (!target) return { next: prev };
    const copy: PvcCardElement = {
      ...target,
      id: `el-${crypto.randomUUID().slice(0, 8)}`,
      xMm: Number(Math.min(cardWidthMm - 4, target.xMm + 2).toFixed(2)),
      yMm: Number(Math.min(cardHeightMm - 4, target.yMm + 2).toFixed(2)),
      locked: false,
    };
    return {
      next: {
        ...prev,
        updatedAt: now,
        [activeSide]: { ...sideSpec, elements: [...sideSpec.elements, copy] },
      },
      nextSelectedId: copy.id,
    };
  }

  const idx = sideSpec.elements.findIndex((e) => e.id === elId);
  const dst = action === 'up' ? idx + 1 : idx - 1;
  if (idx < 0 || dst < 0 || dst >= sideSpec.elements.length) return { next: prev };
  const list = [...sideSpec.elements];
  [list[idx], list[dst]] = [list[dst]!, list[idx]!];
  return {
    next: { ...prev, updatedAt: now, [activeSide]: { ...sideSpec, elements: list } },
  };
}
