import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useMotionValue, type MotionValue } from 'motion/react';
import type { NormalizedWindowBounds } from './types';
import { springWindowFluid, springWindowRestore } from '../system/motion/macosMotion';
import { startFramePointerSession, type PointerPosition } from '../system/motion/framePointerSession';
import { useWindowViewport } from './useWindowViewport';

export type ResizeEdge = 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br';

/**
 * MerbleOS `useWindowResize`: 8 yönlü (4 kenar + 4 köşe) rAF pencere boyutlandırma.
 * Sürükleme boyunca React re-render tetiklemeden `MotionValue` ile tam piksel kilitli çalışır;
 * sol/üst kenar büyütmelerinde karşı kenar 0px kayma ile sabit kalır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function useWindowResize({
  dragX,
  dragY,
  frameWillChange,
  isAnimatingRef,
  isMaximized = false,
  layoutBounds = null,
}: {
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  frameWillChange?: MotionValue<string>;
  isAnimatingRef?: React.MutableRefObject<boolean>;
  isMaximized?: boolean;
  layoutBounds?: NormalizedWindowBounds | null;
}) {
  const viewport = useWindowViewport();

  const defaultWidth = Math.min(1000, Math.round(viewport.w * 0.78));
  const defaultHeight = Math.min(680, Math.round(viewport.h * 0.76));
  const defaultX = Math.round((viewport.w - defaultWidth) / 2);
  const defaultY = Math.max(74, Math.round((viewport.h - defaultHeight) / 2 - 6));

  const [windowSize, setWindowSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [isResizing, setIsResizing] = useState(false);
  const [isSizeTransitioning, setIsSizeTransitioning] = useState(false);
  const hasUserResized = useRef(false);
  const prevViewportRef = useRef({ w: viewport.w, h: viewport.h });
  const stopResizeRef = useRef<(() => void) | null>(null);
  const sizeAnimRef = useRef<{ stop: () => void } | null>(null);

  const isTiled = Boolean(layoutBounds);
  const layoutKey = layoutBounds ? `${layoutBounds.w}:${layoutBounds.h}` : '';
  const targetW = isMaximized
    ? viewport.w
    : layoutBounds
      ? Math.round(viewport.w * layoutBounds.w)
      : windowSize.w;
  const targetH = isMaximized
    ? viewport.h
    : layoutBounds
      ? Math.round(viewport.h * layoutBounds.h)
      : windowSize.h;

  const sizeW = useMotionValue(targetW);
  const sizeH = useMotionValue(targetH);
  const bodyScaleX = useMotionValue(1);
  const bodyScaleY = useMotionValue(1);
  const targetRef = useRef({ w: targetW, h: targetH });
  targetRef.current = { w: targetW, h: targetH };
  const prevModeRef = useRef({ isMaximized, isTiled, layoutKey });
  const applyBodyScale = (tw: number, th: number) => {
    bodyScaleX.set(Math.max(0.1, sizeW.get() / Math.max(1, tw)));
    bodyScaleY.set(Math.max(0.1, Math.max(1, sizeH.get() - 44) / Math.max(1, th - 44)));
  };
  const modePending =
    !isResizing &&
    (prevModeRef.current.isMaximized !== isMaximized ||
      prevModeRef.current.isTiled !== isTiled ||
      (isTiled && prevModeRef.current.layoutKey !== layoutKey)) &&
    (Math.round(sizeW.get()) !== targetW || Math.round(sizeH.get()) !== targetH);
  if (modePending) applyBodyScale(targetW, targetH);

  useEffect(() => {
    const syncBody = () => {
      if (sizeAnimRef.current) applyBodyScale(targetRef.current.w, targetRef.current.h);
    };
    const unsubW = sizeW.on('change', syncBody);
    const unsubH = sizeH.on('change', syncBody);
    return () => {
      unsubW();
      unsubH();
      stopResizeRef.current?.();
      sizeAnimRef.current?.stop();
    };
  }, [sizeW, sizeH, bodyScaleX, bodyScaleY]);

  useLayoutEffect(() => {
    const vpChanged =
      prevViewportRef.current.w !== viewport.w || prevViewportRef.current.h !== viewport.h;
    prevViewportRef.current = { w: viewport.w, h: viewport.h };

    const maxWinW = Math.max(420, viewport.w);
    const maxWinH = Math.max(320, viewport.h - 90);
    const nextW = hasUserResized.current ? Math.min(windowSize.w, maxWinW) : defaultWidth;
    const nextH = hasUserResized.current ? Math.min(windowSize.h, maxWinH) : defaultHeight;

    setWindowSize((prev) => (prev.w === nextW && prev.h === nextH ? prev : { w: nextW, h: nextH }));

    if (vpChanged && !isMaximized && !isTiled && !isResizing) {
      const minX = -defaultX;
      const maxX = Math.max(minX, viewport.w - (defaultX + nextW));
      const minY = Math.max(-defaultY, 72 - defaultY);
      const maxY = Math.max(minY, viewport.h - 90 - (defaultY + nextH));
      const clampedX = Math.min(maxX, Math.max(minX, dragX.get()));
      const clampedY = Math.min(maxY, Math.max(minY, dragY.get()));
      if (clampedX !== dragX.get()) dragX.set(clampedX);
      if (clampedY !== dragY.get()) dragY.set(clampedY);
    }
  }, [viewport.w, viewport.h, defaultWidth, defaultHeight, defaultX, defaultY, isMaximized, isTiled, isResizing, windowSize.w, windowSize.h, dragX, dragY]);

  useLayoutEffect(() => {
    if (isResizing) return;
    const prev = prevModeRef.current;
    const modeChanged =
      prev.isMaximized !== isMaximized ||
      prev.isTiled !== isTiled ||
      (isTiled && prev.layoutKey !== layoutKey);
    prevModeRef.current = { isMaximized, isTiled, layoutKey };

    if (modeChanged) {
      sizeAnimRef.current?.stop();
      const finishAtTarget = () => {
        sizeW.set(targetW);
        sizeH.set(targetH);
        bodyScaleX.set(1);
        bodyScaleY.set(1);
        sizeAnimRef.current = null;
        setIsSizeTransitioning(false);
      };
      if (Math.round(sizeW.get()) === targetW && Math.round(sizeH.get()) === targetH) {
        finishAtTarget();
        return;
      }
      applyBodyScale(targetW, targetH);
      const activeSpring = isMaximized || isTiled ? springWindowFluid : springWindowRestore;
      let done = 0;
      const markDone = () => {
        done += 1;
        if (done >= 2) finishAtTarget();
      };
      const wAnim = animate(sizeW, targetW, { ...activeSpring, onComplete: markDone });
      const hAnim = animate(sizeH, targetH, { ...activeSpring, onComplete: markDone });
      sizeAnimRef.current = {
        stop: () => {
          wAnim.stop();
          hAnim.stop();
          bodyScaleX.set(1);
          bodyScaleY.set(1);
          sizeAnimRef.current = null;
        },
      };
      setIsSizeTransitioning(true);
      return;
    }

    if (sizeAnimRef.current) return;
    if (Math.round(sizeW.get()) !== targetW) sizeW.set(targetW);
    if (Math.round(sizeH.get()) !== targetH) sizeH.set(targetH);
  }, [targetW, targetH, isMaximized, isTiled, layoutKey, isResizing, sizeW, sizeH, bodyScaleX, bodyScaleY]);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    hasUserResized.current = true;
    stopResizeRef.current?.();
    sizeAnimRef.current?.stop();
    setIsSizeTransitioning(false);
    frameWillChange?.set('transform');

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = Math.round(sizeW.get());
    const startH = Math.round(sizeH.get());
    const startDragX = Math.round(dragX.get());
    const startDragY = Math.round(dragY.get());
    let latestSize = { w: startW, h: startH };
    setIsResizing(true);

    const handlePointerMove = (moveEvent: PointerPosition) => {
      const deltaX = Math.round(moveEvent.clientX - startX);
      const deltaY = Math.round(moveEvent.clientY - startY);
      let newW = startW;
      let newH = startH;
      let newDragX = startDragX;
      let newDragY = startDragY;

      if (edge.includes('r')) {
        const maxRightW = Math.max(420, viewport.w - (defaultX + startDragX));
        newW = Math.min(maxRightW, Math.max(420, startW + deltaX));
      } else if (edge.includes('l')) {
        const rawNewW = Math.max(420, startW - deltaX);
        newDragX = Math.max(-defaultX, startDragX + (startW - rawNewW));
        newW = startW + (startDragX - newDragX);
      }
      if (edge.includes('b')) {
        const maxBottomH = Math.max(320, viewport.h - (defaultY + startDragY));
        newH = Math.min(maxBottomH, Math.max(320, startH + deltaY));
      } else if (edge.includes('t')) {
        const rawNewH = Math.max(320, startH - deltaY);
        newDragY = Math.max(-defaultY, startDragY + (startH - rawNewH));
        newH = startH + (startDragY - newDragY);
      }

      latestSize = { w: newW, h: newH };
      sizeW.set(newW);
      sizeH.set(newH);
      dragX.set(newDragX);
      dragY.set(newDragY);
    };

    stopResizeRef.current = startFramePointerSession({
      element: e.currentTarget,
      pointerId: e.pointerId,
      onMove: handlePointerMove,
      onEnd: () => {
        stopResizeRef.current = null;
        setIsResizing(false);
        if (!isAnimatingRef?.current) frameWillChange?.set('auto');
        setWindowSize((prev) =>
          prev.w === latestSize.w && prev.h === latestSize.h ? prev : latestSize,
        );
      },
    });
  };

  return {
    viewport, windowSize, sizeW, sizeH, bodyScaleX, bodyScaleY, isResizing,
    isSizeTransitioning: isSizeTransitioning || modePending,
    defaultX, defaultY, handleResizePointerDown,
  };
}

