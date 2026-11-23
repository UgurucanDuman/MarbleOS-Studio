import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { NormalizedWindowBounds, StudioAppId, WindowInstanceState } from './types';
import { clearAllLayoutBounds, createTiledWindowLayouts, getSmartWindowColumns,
  resolvePresetNormalizedBounds } from './windowGeometry';
import { useWindowViewport } from './useWindowViewport';

type WindowMap = Record<StudioAppId, WindowInstanceState>;
interface LayoutSyncOptions {
  windows: WindowMap;
  setWindows: Dispatch<SetStateAction<WindowMap>>;
  orderedVisibleKey: string;
  isSmartLayoutEnabled: boolean;
  setIsSmartLayoutEnabled: Dispatch<SetStateAction<boolean>>;
  setLayoutOrder: Dispatch<SetStateAction<StudioAppId[]>>;
}

function sameBounds(a: NormalizedWindowBounds | null, b: NormalizedWindowBounds) {
  return a?.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

export function useWindowLayoutSync({ windows, setWindows, orderedVisibleKey,
  isSmartLayoutEnabled, setIsSmartLayoutEnabled, setLayoutOrder }: LayoutSyncOptions) {
  const viewport = useWindowViewport();
  const presetKey = Object.values(windows).map((win) => win.snapPreset ?? '').join(',');

  useEffect(() => {
    const ids = orderedVisibleKey.split(',').filter(Boolean) as StudioAppId[];
    if (isSmartLayoutEnabled && ids.length < 2) {
      setIsSmartLayoutEnabled(false);
      setLayoutOrder([]);
      setWindows(clearAllLayoutBounds);
      return;
    }
    const size = { vw: viewport.w, vh: viewport.h };
    const tiled = isSmartLayoutEnabled
      ? createTiledWindowLayouts(ids, getSmartWindowColumns(ids.length, viewport.w), size)
      : {};
    setWindows((prev) => {
      let next = prev;
      for (const id of Object.keys(prev) as StudioAppId[]) {
        const win = prev[id];
        const bounds = isSmartLayoutEnabled ? tiled[id]
          : win.snapPreset ? resolvePresetNormalizedBounds(win.snapPreset, size) : undefined;
        if (!bounds || sameBounds(win.layoutBounds, bounds)) continue;
        if (next === prev) next = { ...prev };
        next[id] = { ...win, layoutBounds: bounds };
      }
      return next;
    });
  }, [isSmartLayoutEnabled, orderedVisibleKey, presetKey, viewport,
    setWindows, setIsSmartLayoutEnabled, setLayoutOrder]);
}
