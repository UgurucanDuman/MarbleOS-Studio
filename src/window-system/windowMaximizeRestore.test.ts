import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { animate, useMotionValue } from 'motion/react';
import {
  useWindowBasePosition,
  useWindowDragMaximize,
  useWindowResize,
  type RestoreOffsetBounds,
} from './useWindowFrameMotion';

vi.mock('motion/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('motion/react')>();
  return {
    ...original,
    animate: vi.fn(() => ({ stop: vi.fn() })),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('maximize and restore animate posLeft, posTop, dragX, dragY, sizeW, sizeH in lockstep on Frame 1', () => {
  const transitionSnapshots: boolean[] = [];
  const { result, rerender } = renderHook(
    ({ max }: { max: boolean }) => {
      const dragX = useMotionValue(180);
      const dragY = useMotionValue(-25);
      const frameWillChange = useMotionValue('auto');
      const resize = useWindowResize({ dragX, dragY, isMaximized: max });
      const baseX = max ? 0 : resize.defaultX;
      const baseY = max ? 0 : resize.defaultY;
      const pos = useWindowBasePosition({ baseX, baseY, isMaximized: max });
      useWindowDragMaximize({
        isDragging: false,
        setIsDragging: vi.fn(),
        isAnimatingRef: { current: false },
        frameWillChange,
        dragX,
        dragY,
        isMaximized: max,
      });
      transitionSnapshots.push(resize.isSizeTransitioning);
      return { ...resize, ...pos, dragX, dragY };
    },
    { initialProps: { max: false } },
  );

  expect(animate).not.toHaveBeenCalled();
  expect(transitionSnapshots).toEqual([false]);

  transitionSnapshots.length = 0;
  act(() => rerender({ max: true }));

  // İlk render karesinden itibaren isSizeTransitioning=true olmalı (1 karelik ölçeksiz zıplama yok).
  expect(transitionSnapshots[0]).toBe(true);
  // 6 eksenin tamamı (sizeW, sizeH, posLeft, posTop, dragX, dragY) aynı useLayoutEffect evresinde başlar.
  expect(animate).toHaveBeenCalledTimes(6);
  expect(vi.mocked(animate).mock.calls.map((c) => c[1])).toEqual([
    result.current.viewport.w,
    result.current.viewport.h,
    0,
    0,
    0,
    0,
  ]);
});

test('rapid maximize -> restore -> maximize preserves true floating offset instead of mid-flight drift', () => {
  let sharedDragX!: ReturnType<typeof useMotionValue<number>>;
  let sharedDragY!: ReturnType<typeof useMotionValue<number>>;
  const hook = renderHook(
    ({ max }: { max: boolean }) => {
      const dragX = useMotionValue(240);
      const dragY = useMotionValue(-30);
      sharedDragX = dragX;
      sharedDragY = dragY;
      const frameWillChange = useMotionValue('auto');
      useWindowDragMaximize({
        isDragging: false,
        setIsDragging: vi.fn(),
        isAnimatingRef: { current: false },
        frameWillChange,
        dragX,
        dragY,
        isMaximized: max,
      });
    },
    { initialProps: { max: false } },
  );

  // 1) Büyüt: preMaxRef = (240, -30) kaydedilir
  act(() => hook.rerender({ max: true }));
  sharedDragX.set(0);
  sharedDragY.set(0);

  // 2) Orta boya çek (Restore başladı ama yay henüz bitmedi; ara değer 95, -12)
  act(() => hook.rerender({ max: false }));
  sharedDragX.set(95);
  sharedDragY.set(-12);

  // 3) Yay bitmeden tekrar büyüt ve tekrar orta boya çek -> 95/-12'ye sapmamalı, 240/-30 korunmalı!
  act(() => hook.rerender({ max: true }));
  vi.mocked(animate).mockClear();
  act(() => hook.rerender({ max: false }));
  expect(vi.mocked(animate).mock.calls.map((c) => c[1])).toEqual([240, -30]);
});

test('restoreBounds clamps floating offset back onto a shrunken viewport', () => {
  const bounds: RestoreOffsetBounds = { minX: -120, maxX: 160, minY: -74, maxY: 140 };
  const { rerender } = renderHook(
    ({ max, rb }: { max: boolean; rb?: RestoreOffsetBounds }) => {
      const dragX = useMotionValue(420);
      const dragY = useMotionValue(290);
      const frameWillChange = useMotionValue('auto');
      useWindowDragMaximize({
        isDragging: false,
        setIsDragging: vi.fn(),
        isAnimatingRef: { current: false },
        frameWillChange,
        dragX,
        dragY,
        isMaximized: max,
        restoreBounds: rb,
      });
    },
    { initialProps: { max: false, rb: undefined as RestoreOffsetBounds | undefined } },
  );

  act(() => rerender({ max: true, rb: bounds }));
  vi.mocked(animate).mockClear();
  act(() => rerender({ max: false, rb: bounds }));
  expect(vi.mocked(animate).mock.calls.map((c) => c[1])).toEqual([160, 140]);
});
