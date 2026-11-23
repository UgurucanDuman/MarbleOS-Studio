import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useMotionValue, type MotionValue } from 'motion/react';
import type { NormalizedWindowBounds } from './types';
import { springWindowFluid, springWindowRestore } from '../system/motion/macosMotion';

export { useWindowResize, type ResizeEdge } from './useWindowResize';

export interface RestoreOffsetBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function clampOffset(
  offset: { x: number; y: number },
  bounds: RestoreOffsetBounds | undefined,
): { x: number; y: number } {
  if (!bounds) return offset;
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, offset.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, offset.y)),
  };
}

/**
 * Pencere taban koordinatlarını (`left`, `top`) `useLayoutEffect` evresinde
 * `dragX / dragY / sizeW / sizeH` ile aynı karede ve aynı yayla sürer;
 * `useEffect` kaynaklı 1 karelik faz sapmasını ortadan kaldırır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function useWindowBasePosition({
  baseX,
  baseY,
  isMaximized,
  layoutBounds = null,
  isResizing = false,
  reducedMotion = false,
}: {
  baseX: number;
  baseY: number;
  isMaximized: boolean;
  layoutBounds?: NormalizedWindowBounds | null;
  isResizing?: boolean;
  reducedMotion?: boolean;
}) {
  const posLeft = useMotionValue(baseX);
  const posTop = useMotionValue(baseY);
  const isTiled = Boolean(layoutBounds);
  const layoutKey = layoutBounds
    ? `${layoutBounds.x}:${layoutBounds.y}:${layoutBounds.w}:${layoutBounds.h}`
    : '';
  const prevModeRef = useRef({ isMaximized, isTiled, layoutKey });
  const posAnimRef = useRef<{ stop: () => void; targetX: number; targetY: number } | null>(null);

  useEffect(() => () => {
    posAnimRef.current?.stop();
  }, []);

  useLayoutEffect(() => {
    const prev = prevModeRef.current;
    const modeChanged =
      prev.isMaximized !== isMaximized ||
      prev.isTiled !== isTiled ||
      (isTiled && prev.layoutKey !== layoutKey);
    prevModeRef.current = { isMaximized, isTiled, layoutKey };

    if (isResizing || reducedMotion) {
      posAnimRef.current?.stop();
      posAnimRef.current = null;
      posLeft.set(baseX);
      posTop.set(baseY);
      return;
    }

    const targetShiftedDuringAnim =
      posAnimRef.current !== null &&
      (posAnimRef.current.targetX !== baseX || posAnimRef.current.targetY !== baseY);

    if (modeChanged || targetShiftedDuringAnim) {
      posAnimRef.current?.stop();
      if (Math.round(posLeft.get()) === baseX && Math.round(posTop.get()) === baseY) {
        posLeft.set(baseX);
        posTop.set(baseY);
        posAnimRef.current = null;
        return;
      }
      const activeSpring = isMaximized || isTiled ? springWindowFluid : springWindowRestore;
      let done = 0;
      const markDone = () => {
        done += 1;
        if (done >= 2) {
          posLeft.set(baseX);
          posTop.set(baseY);
          posAnimRef.current = null;
        }
      };
      const lAnim = animate(posLeft, baseX, { ...activeSpring, onComplete: markDone });
      const tAnim = animate(posTop, baseY, { ...activeSpring, onComplete: markDone });
      posAnimRef.current = {
        targetX: baseX,
        targetY: baseY,
        stop: () => {
          lAnim.stop();
          tAnim.stop();
          posAnimRef.current = null;
        },
      };
      return;
    }

    if (posAnimRef.current) return;
    if (posLeft.get() !== baseX) posLeft.set(baseX);
    if (posTop.get() !== baseY) posTop.set(baseY);
  }, [baseX, baseY, isMaximized, isTiled, layoutKey, isResizing, reducedMotion, posLeft, posTop]);

  return { posLeft, posTop };
}

/**
 * MerbleOS `useWindowDragMaximize`:
 * Serbest pencere sürükleme konumunu (`preMaxRef`) korur; art arda hızlı büyüt/küçült
 * tıklamalarında yarı yoldaki ara konumu kaydetmez ve ekran dışına taşmayı sınırlar.
 */
export function useWindowDragMaximize({
  isDragging,
  setIsDragging,
  isResizing = false,
  reducedMotion = false,
  isAnimatingRef,
  frameWillChange,
  dragX,
  dragY,
  layoutBounds,
  isMaximized,
  restoreBounds,
}: {
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  isResizing?: boolean;
  reducedMotion?: boolean;
  isAnimatingRef: React.MutableRefObject<boolean>;
  frameWillChange: MotionValue<string>;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  layoutBounds?: NormalizedWindowBounds | null;
  isMaximized: boolean;
  restoreBounds?: RestoreOffsetBounds;
}) {
  const preMaxRef = useRef({ x: 0, y: 0 });
  const restoreActiveRef = useRef(false);
  const restoreBoundsRef = useRef(restoreBounds);
  restoreBoundsRef.current = restoreBounds;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const didMountMaxRef = useRef(false);
  const isTiled = Boolean(layoutBounds);
  const previousTiledRef = useRef(isTiled);
  const previousMaximizedRef = useRef(isMaximized);

  if (isDragging || isResizing) {
    restoreActiveRef.current = false;
  }

  useEffect(() => {
    if (!isDragging) return;
    const up = () => {
      setIsDragging(false);
      if (!isAnimatingRef.current) frameWillChange.set('auto');
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    };
  }, [isDragging, frameWillChange, isAnimatingRef, setIsDragging]);

  useLayoutEffect(() => {
    const wasTiled = previousTiledRef.current;
    const wasMaximized = previousMaximizedRef.current;
    const isNowMaximized = isMaximized;

    previousTiledRef.current = isTiled;
    previousMaximizedRef.current = isMaximized;

    if (!didMountMaxRef.current) {
      didMountMaxRef.current = true;
      return;
    }

    const stateChanged = wasTiled !== isTiled || wasMaximized !== isNowMaximized;
    if (!stateChanged) return;

    if (!wasTiled && !wasMaximized && (isTiled || isNowMaximized) && !restoreActiveRef.current) {
      preMaxRef.current = { x: dragX.get(), y: dragY.get() };
    }

    const enteringDocked = isNowMaximized || isTiled;
    const target = enteringDocked
      ? { x: 0, y: 0 }
      : clampOffset(preMaxRef.current, restoreBoundsRef.current);
    if (!enteringDocked) {
      preMaxRef.current = target;
    }

    if (reducedMotionRef.current) {
      restoreActiveRef.current = false;
      dragX.set(target.x);
      dragY.set(target.y);
      return;
    }

    restoreActiveRef.current = !enteringDocked;
    const activeSpring = enteringDocked ? springWindowFluid : springWindowRestore;
    let done = 0;
    const markDone = () => {
      done += 1;
      if (done >= 2) {
        dragX.set(target.x);
        dragY.set(target.y);
        restoreActiveRef.current = false;
      }
    };
    const x = animate(dragX, target.x, { ...activeSpring, onComplete: markDone });
    const y = animate(dragY, target.y, { ...activeSpring, onComplete: markDone });
    return () => {
      x.stop();
      y.stop();
    };
  }, [isMaximized, isTiled, dragX, dragY]);
}
