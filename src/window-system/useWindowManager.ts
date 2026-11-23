import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowLayoutSync } from './useWindowLayoutSync';
import type {
  DockOriginBounds,
  StudioAppDefinition,
  StudioAppId,
  WindowInstanceState,
  WindowSnapPreset,
} from './types';
import {
  applyCloseWindow,
  applyDesktopToggle,
  clearAllLayoutBounds,
  createInitialWindowMap,
  createTiledWindowLayouts,
  findNextActiveApp,
  getSmartWindowColumns,
  getViewportSize,
  resolvePresetNormalizedBounds,
} from './windowGeometry';

// One state owner; tile order remains stable while focus changes.
export function useWindowManager(apps: StudioAppDefinition[]) {
  const [windows, setWindows] = useState<Record<StudioAppId, WindowInstanceState>>(() =>
    createInitialWindowMap(apps),
  );
  const [activeAppId, setActiveAppId] = useState<StudioAppId | null>(null);
  const [bouncingAppId, setBouncingAppId] = useState<StudioAppId | null>(null);
  const [isSmartLayoutEnabled, setIsSmartLayoutEnabled] = useState(false);
  const [layoutOrder, setLayoutOrder] = useState<StudioAppId[]>([]);
  const [windowOrigins, setWindowOrigins] = useState<Partial<Record<StudioAppId, DockOriginBounds>>>({});

  const topZRef = useRef<number>(35);
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopSavedRef = useRef<StudioAppId[]>([]);
  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  useEffect(() => () => {
    if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
  }, []);

  const visibleApps = useMemo(
    () => apps.map((a) => a.appId).filter((id) => windows[id]?.isOpen && !windows[id]?.isMinimized),
    [apps, windows],
  );
  const activeAppIdRef = useRef<StudioAppId | null>(activeAppId);
  activeAppIdRef.current = activeAppId;
  const visibleAppsRef = useRef<StudioAppId[]>(visibleApps);
  visibleAppsRef.current = visibleApps;

  const orderedVisibleKey = useMemo(() => {
    if (!isSmartLayoutEnabled || layoutOrder.length === 0) return visibleApps.join(',');
    const preserved = layoutOrder.filter((id) => visibleApps.includes(id));
    const added = visibleApps.filter((id) => !layoutOrder.includes(id));
    return [...preserved, ...added].join(',');
  }, [isSmartLayoutEnabled, layoutOrder, visibleApps]);

  const triggerDockBounce = useCallback((appId: StudioAppId) => {
    if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    setBouncingAppId(appId);
    bounceTimerRef.current = setTimeout(() => {
      bounceTimerRef.current = null;
      setBouncingAppId((current) => (current === appId ? null : current));
    }, 560);
  }, []);

  const recordDockOrigin = useCallback((appId: StudioAppId, bounds?: DockOriginBounds) => {
    if (bounds) setWindowOrigins((prev) => ({ ...prev, [appId]: bounds }));
  }, []);

  const focusWindow = useCallback((appId: StudioAppId) => {
    const curr = windowsRef.current[appId];
    if (activeAppIdRef.current === appId && curr?.isOpen && !curr.isMinimized) return;
    const nextZ = ++topZRef.current;
    setWindows((prev) => ({
      ...prev,
      [appId]: { ...prev[appId], isOpen: true, isMinimized: false, zIndex: nextZ },
    }));
    setActiveAppId(appId);
  }, []);

  const toggleDesktop = useCallback(() => {
    const { nextMap, nextSaved } = applyDesktopToggle(
      windowsRef.current,
      visibleAppsRef.current,
      desktopSavedRef.current,
    );
    desktopSavedRef.current = nextSaved;
    setWindows(nextMap);
    setActiveAppId(findNextActiveApp(nextMap));
  }, []);

  const toggleFromDock = useCallback(
    (appId: StudioAppId, bounds?: DockOriginBounds) => {
      if (bounds) recordDockOrigin(appId, bounds);
      triggerDockBounce(appId);
      const prevMap = windowsRef.current;
      const current = prevMap[appId];

      if (!current.isOpen || current.isMinimized) {
        const nextZ = ++topZRef.current;
        setWindows((prev) => ({
          ...prev,
          [appId]: { ...prev[appId], isOpen: true, isMinimized: false, zIndex: nextZ },
        }));
        setActiveAppId(appId);
        return;
      }

      if (activeAppIdRef.current === appId) {
        const nextMap = { ...prevMap, [appId]: { ...current, isMinimized: true } };
        setWindows(nextMap);
        setActiveAppId(findNextActiveApp(nextMap, appId));
        return;
      }

      const nextZ = ++topZRef.current;
      setWindows((prev) => ({ ...prev, [appId]: { ...prev[appId], zIndex: nextZ } }));
      setActiveAppId(appId);
    },
    [recordDockOrigin, triggerDockBounce],
  );

  useWindowLayoutSync({ windows, setWindows, orderedVisibleKey, isSmartLayoutEnabled,
    setIsSmartLayoutEnabled, setLayoutOrder });

  const closeWindow = useCallback((appId: StudioAppId) => {
    const nextMap = applyCloseWindow(windowsRef.current, appId);
    setWindows(nextMap);
    setActiveAppId((prevActive) =>
      prevActive === appId ? findNextActiveApp(nextMap, appId) : prevActive,
    );
  }, []);

  const minimizeWindow = useCallback((appId: StudioAppId) => {
    const prevMap = windowsRef.current;
    const nextMap = { ...prevMap, [appId]: { ...prevMap[appId], isMinimized: true } };
    setWindows(nextMap);
    setActiveAppId((prevActive) =>
      prevActive === appId ? findNextActiveApp(nextMap, appId) : prevActive,
    );
  }, []);

  const toggleMaximizeWindow = useCallback((appId: StudioAppId) => {
    const nextZ = ++topZRef.current;
    setWindows((prev) => ({
      ...prev,
      [appId]: { ...prev[appId], isMaximized: !prev[appId].isMaximized, zIndex: nextZ },
    }));
    setActiveAppId(appId);
  }, []);

  const activateSmartTile = useCallback(() => {
    const { vw } = getViewportSize();
    let targetIds = [...visibleAppsRef.current];
    if (targetIds.length < 2) {
      const primary = activeAppIdRef.current ?? targetIds[0] ?? 'excel-list';
      const partner: StudioAppId = primary === 'excel-list' ? 'photo-studio' : 'excel-list';
      targetIds = [primary, partner];
    }

    const cols = getSmartWindowColumns(targetIds.length, vw);
    const layouts = createTiledWindowLayouts(targetIds, cols);
    const baseZ = (topZRef.current += targetIds.length);

    setLayoutOrder(targetIds);
    setIsSmartLayoutEnabled(true);
    setWindows((prev) => {
      const next = { ...prev };
      targetIds.forEach((id, idx) => {
        next[id] = {
          ...next[id],
          isOpen: true,
          isMinimized: false,
          isMaximized: false,
          snapPreset: null,
          layoutBounds: layouts[id] ?? null,
          zIndex: baseZ - idx,
        };
      });
      return next;
    });
  }, []);

  const resetWindowLayouts = useCallback(() => {
    setIsSmartLayoutEnabled(false);
    setLayoutOrder([]);
    setWindows(clearAllLayoutBounds);
  }, []);

  const snapWindow = useCallback(
    (appId: StudioAppId, preset: WindowSnapPreset) => {
      if (preset === 'tile-two') {
        activateSmartTile();
        return;
      }
      setIsSmartLayoutEnabled(false);
      setLayoutOrder([]);
      const nextZ = ++topZRef.current;
      const bounds = resolvePresetNormalizedBounds(preset);
      setWindows((prev) => ({
        ...prev,
        [appId]: {
          ...prev[appId],
          isMaximized: false,
          snapPreset: preset,
          layoutBounds: bounds,
          zIndex: nextZ,
        },
      }));
      setActiveAppId(appId);
    },
    [activateSmartTile],
  );

  return {
    windows,
    activeAppId,
    bouncingAppId,
    isSmartLayoutEnabled,
    visibleCount: visibleApps.length,
    windowOrigins,
    triggerDockBounce,
    focusWindow,
    toggleDesktop,
    toggleFromDock,
    closeWindow,
    minimizeWindow,
    toggleMaximizeWindow,
    activateSmartTile,
    resetWindowLayouts,
    snapWindow,
  };
}
