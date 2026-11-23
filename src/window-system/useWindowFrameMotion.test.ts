import type React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { animate, useMotionValue } from 'motion/react';
import { useWindowDragMaximize, useWindowResize } from './useWindowFrameMotion';
import type { NormalizedWindowBounds } from './types';

const stops = vi.hoisted(() => [] as ReturnType<typeof vi.fn>[]);
vi.mock('motion/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('motion/react')>();
  return {
    ...original,
    animate: vi.fn(() => {
      const stop = vi.fn();
      stops.push(stop);
      return { stop };
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  stops.length = 0;
});

const bounds: NormalizedWindowBounds = { x: 0.02, y: 0.1, w: 0.45, h: 0.75 };
function useSubject(props: { layout: NormalizedWindowBounds | null; maximized: boolean }) {
  const dragX = useMotionValue(260);
  const dragY = useMotionValue(-35);
  const frameWillChange = useMotionValue('auto');
  useWindowDragMaximize({
    isDragging: false,
    setIsDragging: vi.fn(),
    isAnimatingRef: { current: false },
    frameWillChange,
    dragX,
    dragY,
    layoutBounds: props.layout,
    isMaximized: props.maximized,
  });
  return { dragX, dragY };
}

test('tile geometry refresh does not cancel an unfinished drag-offset reset', () => {
  const { rerender } = renderHook(useSubject, {
    initialProps: { layout: null as NormalizedWindowBounds | null, maximized: false },
  });
  act(() => rerender({ layout: bounds, maximized: false }));
  expect(animate).toHaveBeenCalledTimes(2);
  expect(vi.mocked(animate).mock.calls.map((call) => call[1])).toEqual([0, 0]);
  const runningStops = [...stops];
  act(() => rerender({ layout: { ...bounds, w: 0.3 }, maximized: false }));
  expect(animate).toHaveBeenCalledTimes(2);
  runningStops.forEach((stop) => expect(stop).not.toHaveBeenCalled());
});

test('returning from tile/maximize restores the original floating offsets', () => {
  const { rerender, unmount } = renderHook(useSubject, {
    initialProps: { layout: null as NormalizedWindowBounds | null, maximized: false },
  });
  rerender({ layout: bounds, maximized: false });
  rerender({ layout: bounds, maximized: true });
  rerender({ layout: bounds, maximized: false });
  rerender({ layout: null, maximized: false });
  expect(vi.mocked(animate).mock.calls.slice(-2).map((call) => call[1])).toEqual([260, -35]);
  const lastStops = stops.slice(-2);
  unmount();
  lastStops.forEach((stop) => expect(stop).toHaveBeenCalledOnce());
});

test('manual corner resize updates MotionValues in lockstep without spring lag or per-frame re-renders', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames.length = 0;
  });

  let renderCount = 0;
  const { result } = renderHook(() => {
    renderCount += 1;
    const dragX = useMotionValue(40);
    const dragY = useMotionValue(20);
    const resize = useWindowResize({ dragX, dragY });
    return { ...resize, dragX, dragY };
  });

  const startRightEdge = result.current.defaultX + result.current.dragX.get() + result.current.sizeW.get();
  const startBottomEdge = result.current.defaultY + result.current.dragY.get() + result.current.sizeH.get();

  const handle = document.createElement('div');
  document.body.appendChild(handle);

  act(() => {
    result.current.handleResizePointerDown(
      {
        button: 0,
        clientX: 300,
        clientY: 200,
        pointerId: 7,
        currentTarget: handle,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>,
      'tl',
    );
  });

  expect(result.current.isResizing).toBe(true);
  const rendersAfterStart = renderCount;

  // Drag top-left outward (-120px, -80px) -> width +120, height +80, opposite edges stay 0px locked
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 180, clientY: 120 }));
  frames.shift()?.(16);

  expect(renderCount).toBe(rendersAfterStart);
  expect(animate).not.toHaveBeenCalled();
  expect(result.current.defaultX + result.current.dragX.get() + result.current.sizeW.get()).toBe(startRightEdge);
  expect(result.current.defaultY + result.current.dragY.get() + result.current.sizeH.get()).toBe(startBottomEdge);

  // Drag way past top-left screen boundary -> clamps at x=0, y=0 and still preserves opposite edges
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: -2000, clientY: -2000 }));
  frames.shift()?.(32);

  expect(result.current.defaultX + result.current.dragX.get()).toBe(0);
  expect(result.current.defaultY + result.current.dragY.get()).toBe(0);
  expect(result.current.defaultX + result.current.dragX.get() + result.current.sizeW.get()).toBe(startRightEdge);
  expect(result.current.defaultY + result.current.dragY.get() + result.current.sizeH.get()).toBe(startBottomEdge);

  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 220, clientY: 150 }));
  });

  expect(result.current.isResizing).toBe(false);
  expect(result.current.windowSize).toEqual({
    w: result.current.sizeW.get(),
    h: result.current.sizeH.get(),
  });
  handle.remove();
});

test('maximize mode transition animates sizeW and sizeH with GPU bodyScaleX/Y and settled spring thresholds', () => {
  const { result, rerender } = renderHook(
    ({ max }: { max: boolean }) => {
      const dragX = useMotionValue(0);
      const dragY = useMotionValue(0);
      return useWindowResize({ dragX, dragY, isMaximized: max });
    },
    { initialProps: { max: false } },
  );

  const initialW = result.current.sizeW.get();
  const initialH = result.current.sizeH.get();
  expect(animate).not.toHaveBeenCalled();
  act(() => rerender({ max: true }));
  expect(animate).toHaveBeenCalledTimes(2);
  expect(vi.mocked(animate).mock.calls[0]?.[1]).toBe(result.current.viewport.w);
  expect(vi.mocked(animate).mock.calls[1]?.[1]).toBe(result.current.viewport.h);
  expect(vi.mocked(animate).mock.calls[0]?.[2]).toMatchObject({ restDelta: 0.5, restSpeed: 1 });
  expect(result.current.bodyScaleX.get()).toBeCloseTo(initialW / result.current.viewport.w, 4);
  expect(result.current.bodyScaleY.get()).toBeCloseTo((initialH - 44) / (result.current.viewport.h - 44), 4);
});

test('bottom-right resize clamps to viewport bounds and shrinking viewport pulls floating window back on screen', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames.length = 0;
  });

  const { result } = renderHook(() => {
    const dragX = useMotionValue(120);
    const dragY = useMotionValue(40);
    const resize = useWindowResize({ dragX, dragY });
    return { ...resize, dragX, dragY };
  });

  const handle = document.createElement('div');
  document.body.appendChild(handle);
  act(() => {
    result.current.handleResizePointerDown(
      {
        button: 0,
        clientX: 600,
        clientY: 500,
        pointerId: 9,
        currentTarget: handle,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>,
      'br',
    );
  });

  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: 5000, clientY: 5000 }));
  frames.shift()?.(16);
  expect(result.current.defaultX + result.current.dragX.get() + result.current.sizeW.get()).toBeLessThanOrEqual(
    result.current.viewport.w,
  );
  expect(result.current.defaultY + result.current.dragY.get() + result.current.sizeH.get()).toBeLessThanOrEqual(
    result.current.viewport.h,
  );
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: 5000, clientY: 5000 }));
  });
  handle.remove();

  act(() => {
    vi.stubGlobal('innerWidth', 900);
    vi.stubGlobal('innerHeight', 620);
    window.dispatchEvent(new Event('resize'));
    frames.shift()?.(32);
  });

  expect(result.current.windowSize.w).toBeLessThanOrEqual(900);
  expect(result.current.windowSize.h).toBeLessThanOrEqual(620 - 90);
  expect(result.current.defaultX + result.current.dragX.get()).toBeGreaterThanOrEqual(0);
  expect(result.current.defaultX + result.current.dragX.get() + result.current.windowSize.w).toBeLessThanOrEqual(900);
});
