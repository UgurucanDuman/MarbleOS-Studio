import type {
  NormalizedWindowBounds,
  StudioAppDefinition,
  StudioAppId,
  WindowGeometry,
  WindowInstanceState,
  WindowSnapPreset,
  WindowTileColumns,
} from './types';

/**
 * MerbleOS `window-layout.ts` Çalışma Alanı Normalizasyonu (0..1)
 * Navbar ve Dock için piksel boşluklarını her ekran boyutunda korur.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
function getWorkspace({ vw, vh }: { vw: number; vh: number }) {
  const margin = Math.min(16, vw * 0.04);
  const top = Math.min(84, vh * 0.2);
  const bottom = Math.min(104, vh * 0.2);
  return {
    x: margin / vw, y: top / vh,
    w: (vw - 2 * margin) / vw, h: (vh - top - bottom) / vh,
    gapX: Math.min(12, vw * 0.02) / vw,
    gapY: Math.min(12, vh * 0.02) / vh,
  };
}

export function getViewportSize() {
  if (typeof window === 'undefined') return { vw: 1440, vh: 900 };
  return { vw: window.innerWidth, vh: window.innerHeight };
}

/**
 * MerbleOS `createTiledWindowLayouts`:
 * Açık olan 2, 3, 4 veya 5 pencereyi otomatik olarak çakışmayan ızgaraya (grid) böler.
 */
export function createTiledWindowLayouts<AppId extends string>(
  appIds: readonly AppId[],
  requestedColumns: WindowTileColumns,
  viewport = getViewportSize(),
): Partial<Record<AppId, NormalizedWindowBounds>> {
  if (appIds.length === 0) return {};
  const workspace = getWorkspace(viewport);

  const columns = Math.min(requestedColumns, appIds.length);
  const rows = Math.ceil(appIds.length / columns);
  const cellWidth = (workspace.w - workspace.gapX * (columns - 1)) / columns;
  const cellHeight = (workspace.h - workspace.gapY * (rows - 1)) / rows;

  return Object.fromEntries(
    appIds.map((appId, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return [
        appId,
        {
          x: workspace.x + column * (cellWidth + workspace.gapX),
          y: workspace.y + row * (cellHeight + workspace.gapY),
          w: cellWidth,
          h: cellHeight,
        },
      ];
    }),
  ) as Partial<Record<AppId, NormalizedWindowBounds>>;
}

/**
 * MerbleOS `getSmartWindowColumns`:
 * 2 pencere: 2 sütun (yan yana)
 * 3 pencere: geniş ekranda 3 sütun, dizüstünde 2 sütun
 * 4 pencere: 2×2 ızgara
 * 5 pencere: 3×2 ızgara
 */
export function getSmartWindowColumns(
  windowCount: number,
  viewportWidth: number,
): WindowTileColumns {
  if (windowCount <= 2) return 2;
  if (windowCount === 3) return viewportWidth >= 1500 ? 3 : 2;
  if (windowCount === 4) return 2;
  return 3;
}

/**
 * Tekil / Manuel Ekran Bölme Seçeneklerini MerbleOS `NormalizedWindowBounds` (0..1) formatına çevirir.
 */
export function resolvePresetNormalizedBounds(
  preset: WindowSnapPreset, viewport = getViewportSize(),
): NormalizedWindowBounds {
  const workspace = getWorkspace(viewport);
  const halfW = (workspace.w - workspace.gapX) / 2;
  const halfH = (workspace.h - workspace.gapY) / 2;
  const rightX = workspace.x + halfW + workspace.gapX;
  const bottomY = workspace.y + halfH + workspace.gapY;

  switch (preset) {
    case 'left':
    case 'tile-two':
      return { x: workspace.x, y: workspace.y, w: halfW, h: workspace.h };
    case 'right':
      return { x: rightX, y: workspace.y, w: halfW, h: workspace.h };
    case 'top':
      return { x: workspace.x, y: workspace.y, w: workspace.w, h: halfH };
    case 'bottom':
      return { x: workspace.x, y: bottomY, w: workspace.w, h: halfH };
    case 'top-left':
      return { x: workspace.x, y: workspace.y, w: halfW, h: halfH };
    case 'top-right':
      return { x: rightX, y: workspace.y, w: halfW, h: halfH };
    case 'bottom-left':
      return { x: workspace.x, y: bottomY, w: halfW, h: halfH };
    case 'bottom-right':
      return { x: rightX, y: bottomY, w: halfW, h: halfH };
    case 'center':
    default:
      return { x: workspace.x + workspace.w * 0.1, y: workspace.y,
        w: workspace.w * 0.8, h: workspace.h };
  }
}

export function findNextActiveApp(
  map: Record<StudioAppId, WindowInstanceState>,
  excludeId?: StudioAppId,
): StudioAppId | null {
  let bestId: StudioAppId | null = null;
  let bestZ = -1;
  (Object.keys(map) as StudioAppId[]).forEach((id) => {
    const w = map[id];
    if (id !== excludeId && w.isOpen && !w.isMinimized && w.zIndex > bestZ) {
      bestZ = w.zIndex;
      bestId = id;
    }
  });
  return bestId;
}

export function clearAllLayoutBounds(
  prev: Record<StudioAppId, WindowInstanceState>,
): Record<StudioAppId, WindowInstanceState> {
  const next = { ...prev };
  (Object.keys(next) as StudioAppId[]).forEach((id) => {
    if (next[id].layoutBounds || next[id].snapPreset) {
      next[id] = { ...next[id], layoutBounds: null, snapPreset: null };
    }
  });
  return next;
}

export function applyDesktopToggle(
  prev: Record<StudioAppId, WindowInstanceState>,
  visibleIds: StudioAppId[],
  savedIds: StudioAppId[],
): { nextMap: Record<StudioAppId, WindowInstanceState>; nextSaved: StudioAppId[] } {
  const nextMap = { ...prev };
  if (visibleIds.length > 0) {
    visibleIds.forEach((id) => {
      nextMap[id] = { ...nextMap[id], isMinimized: true };
    });
    return { nextMap, nextSaved: visibleIds };
  }

  const restoreList =
    savedIds.length > 0
      ? savedIds.filter((id) => nextMap[id]?.isOpen)
      : (Object.keys(nextMap) as StudioAppId[]).filter(
          (id) => nextMap[id].isOpen && nextMap[id].isMinimized,
        );

  restoreList.forEach((id) => {
    nextMap[id] = { ...nextMap[id], isMinimized: false };
  });
  return { nextMap, nextSaved: [] };
}

export function applyCloseWindow(
  prev: Record<StudioAppId, WindowInstanceState>,
  appId: StudioAppId,
): Record<StudioAppId, WindowInstanceState> {
  return {
    ...prev,
    [appId]: {
      ...prev[appId],
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      snapPreset: null,
      layoutBounds: null,
    },
  };
}

export function createInitialWindowMap(
  apps: StudioAppDefinition[],
): Record<StudioAppId, WindowInstanceState> {
  const { vw, vh } = getViewportSize();
  const map = {} as Record<StudioAppId, WindowInstanceState>;
  apps.forEach((app, idx) => {
    const w = Math.min(960, Math.round(vw * 0.72));
    const h = Math.min(640, Math.round(vh * 0.74));
    const offset = (idx - 2) * 18;
    const x = Math.round((vw - w) / 2 + offset);
    const y = Math.round((vh - h) / 2 - 6 + idx * 8);
    const initialGeo: WindowGeometry = { x, y, width: w, height: h };
    map[app.appId] = {
      appId: app.appId,
      title: app.title,
      subtitle: app.subtitle,
      accentHex: app.accentHex,
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      snapPreset: null,
      layoutBounds: null,
      zIndex: 20 + idx,
      geometry: initialGeo,
    };
  });
  return map;
}
