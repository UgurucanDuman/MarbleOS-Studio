import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { DockOriginBounds, StudioAppId } from './types';

function sameBounds(a: DockOriginBounds | null, b: DockOriginBounds | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.w - b.w) < 1 &&
    Math.abs(a.h - b.h) < 1
  );
}

/**
 * MerbleOS `resolveDockBounds`:
 * Dock ikonu koordinatlarını ölçer. Tam ekranda Dock gizlenirken / açılırken
 * `[data-dock-surface]` ile `[data-dock-anchor]` farkını düşerek sabit hedefi bulur.
 */
export function resolveDockBounds(
  appId: StudioAppId,
  clickOrigin: DockOriginBounds | null = null,
): DockOriginBounds {
  if (typeof document !== 'undefined') {
    const el =
      document.getElementById(`studio-dock-icon-${appId}`) ??
      (document.querySelector(`[data-dock-app="${appId}"]`) as HTMLElement | null);
    if (el) {
      const rect = el.getBoundingClientRect();
      const surface = el.closest<HTMLElement>('[data-dock-surface]');
      const anchor = surface?.parentElement;
      const anchorPadTop = anchor ? parseFloat(getComputedStyle(anchor).paddingTop) || 0 : 0;
      const offsetY = anchor?.hasAttribute('data-dock-anchor')
        ? surface!.getBoundingClientRect().top - (anchor.getBoundingClientRect().top + anchorPadTop)
        : 0;
      const restingY = rect.top - offsetY;
      const maxH = typeof window !== 'undefined' ? window.innerHeight : 900;
      return {
        x: rect.left,
        y: Math.min(restingY, maxH - 64),
        w: rect.width || 50,
        h: rect.height || 50,
      };
    }
  }
  if (clickOrigin) return clickOrigin;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  return { x: vw / 2 - 25, y: vh - 68, w: 50, h: 50 };
}

export function useWindowDockLifecycle({
  appId,
  clickOrigin,
  isMinimized,
  onClose,
  onDockBounce,
  onDepartStart,
}: {
  appId: StudioAppId;
  clickOrigin?: DockOriginBounds | null;
  isMinimized: boolean;
  onClose: (appId: StudioAppId) => void;
  onDockBounce?: (appId: StudioAppId) => void;
  onDepartStart?: (appId: StudioAppId) => void;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const [isFullyMinimized, setIsFullyMinimized] = useState(isMinimized);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeFinishedRef = useRef(false);
  const minimizeLandedRef = useRef(isMinimized);
  const clickOriginRef = useRef(clickOrigin ?? null);
  clickOriginRef.current = clickOrigin ?? null;

  const [dynamicIconBounds, setDynamicIconBounds] = useState<DockOriginBounds | null>(() =>
    clickOrigin ?? resolveDockBounds(appId, clickOrigin),
  );

  const measureDockBounds = useCallback(() => {
    const next = resolveDockBounds(appId, clickOriginRef.current);
    setDynamicIconBounds((prev) => (sameBounds(prev, next) ? prev : next));
  }, [appId]);

  const finishMinimize = useCallback(() => {
    if (!minimizeLandedRef.current) {
      minimizeLandedRef.current = true;
      onDockBounce?.(appId);
    }
    setIsFullyMinimized(true);
  }, [appId, onDockBounce]);

  // Boyama öncesi senkron eşitleme: Dock'tan açılış ve küçültmede hedef koordinatı günceller.
  useLayoutEffect(() => {
    if (!isMinimized) {
      minimizeLandedRef.current = false;
      setIsFullyMinimized(false);
      if (clickOrigin) {
        setDynamicIconBounds((prev) => (sameBounds(prev, clickOrigin) ? prev : clickOrigin));
      }
    } else {
      measureDockBounds();
    }
  }, [isMinimized, clickOrigin, measureDockBounds]);

  useEffect(() => {
    if (!isMinimized) return;
    const timer = setTimeout(finishMinimize, 340);
    return () => clearTimeout(timer);
  }, [finishMinimize, isMinimized]);

  useLayoutEffect(() => {
    if (!clickOriginRef.current) {
      measureDockBounds();
    }
  }, [measureDockBounds]);

  const finishClose = useCallback(() => {
    if (!isClosing || closeFinishedRef.current) return;
    closeFinishedRef.current = true;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    onDockBounce?.(appId);
    onClose(appId);
  }, [appId, isClosing, onClose, onDockBounce]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isClosing || closeFinishedRef.current) return;
      measureDockBounds();
      setIsClosing(true);
      onDepartStart?.(appId);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        if (closeFinishedRef.current) return;
        closeFinishedRef.current = true;
        onDockBounce?.(appId);
        onClose(appId);
      }, 350);
    },
    [appId, isClosing, measureDockBounds, onClose, onDepartStart, onDockBounce],
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return {
    isClosing,
    isFullyMinimized,
    dynamicIconBounds,
    measureDockBounds,
    finishClose,
    finishMinimize,
    handleClose,
  };
}
