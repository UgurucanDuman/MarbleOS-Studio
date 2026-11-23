import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useWindowManager } from './useWindowManager';
import type { StudioAppDefinition } from './types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const apps: StudioAppDefinition[] = [
  'excel-list', 'photo-studio', 'album-designer', 'print-center',
].map((id) => ({
  appId: id as StudioAppDefinition['appId'], title: id, code: id, shortLabel: id,
  subtitle: '', accentHex: '#fff', icon: null,
  defaultGeometry: { x: 0, y: 0, width: 600, height: 400 },
}));

test('smart tiling settles without a render loop and preserves order on focus', () => {
  const { result } = renderHook(() => useWindowManager(apps));
  act(() => result.current.activateSmartTile());
  expect(result.current.visibleCount).toBe(2);
  expect(result.current.isSmartLayoutEnabled).toBe(true);
  const left = result.current.windows['excel-list'].layoutBounds;
  const right = result.current.windows['photo-studio'].layoutBounds;
  expect(left?.x).toBeLessThan(right!.x);
  act(() => result.current.focusWindow('photo-studio'));
  expect(result.current.windows['excel-list'].layoutBounds).toEqual(left);
  expect(result.current.windows['photo-studio'].layoutBounds).toEqual(right);
  expect(result.current.activeAppId).toBe('photo-studio');
});

test('minimize preserves open state and deactivates tiling when one remains', () => {
  const { result } = renderHook(() => useWindowManager(apps));
  act(() => result.current.activateSmartTile());
  act(() => result.current.minimizeWindow('photo-studio'));
  expect(result.current.windows['photo-studio'].isOpen).toBe(true);
  expect(result.current.windows['photo-studio'].isMinimized).toBe(true);
  expect(result.current.isSmartLayoutEnabled).toBe(false);
  expect(result.current.visibleCount).toBe(1);
  act(() => result.current.focusWindow('photo-studio'));
  expect(result.current.visibleCount).toBe(2);
});

test('opening and closing a third window retile the visible set', () => {
  const { result } = renderHook(() => useWindowManager(apps));
  act(() => result.current.activateSmartTile());
  act(() => result.current.focusWindow('album-designer'));
  expect(result.current.visibleCount).toBe(3);
  expect(result.current.windows['album-designer'].layoutBounds).not.toBeNull();
  const threeWidth = result.current.windows['excel-list'].layoutBounds!.w;
  act(() => result.current.closeWindow('album-designer'));
  expect(result.current.windows['album-designer'].layoutBounds).toBeNull();
  expect(result.current.windows['excel-list'].layoutBounds!.w).toBeGreaterThanOrEqual(threeWidth);
});

test('resize recalculates three columns to two without unmaximizing a window', () => {
  let pending: FrameRequestCallback | undefined;
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 1080);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending = callback;
    return 1;
  });
  const { result } = renderHook(() => useWindowManager(apps));
  act(() => result.current.activateSmartTile());
  act(() => result.current.focusWindow('album-designer'));
  expect(result.current.windows['album-designer'].layoutBounds!.y)
    .toBe(result.current.windows['excel-list'].layoutBounds!.y);
  act(() => result.current.toggleMaximizeWindow('photo-studio'));
  act(() => {
    vi.stubGlobal('innerWidth', 1366);
    vi.stubGlobal('innerHeight', 768);
    window.dispatchEvent(new Event('resize'));
    pending!(0);
  });
  expect(result.current.windows['album-designer'].layoutBounds!.y)
    .toBeGreaterThan(result.current.windows['excel-list'].layoutBounds!.y);
  expect(result.current.windows['photo-studio'].isMaximized).toBe(true);
});

test('manual snap maintains navbar and Dock space after viewport resize', () => {
  let pending: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending = callback;
    return 1;
  });
  const { result } = renderHook(() => useWindowManager(apps));
  act(() => result.current.focusWindow('excel-list'));
  act(() => result.current.snapWindow('excel-list', 'right'));
  act(() => {
    vi.stubGlobal('innerHeight', 768);
    window.dispatchEvent(new Event('resize'));
    pending!(0);
  });
  const bounds = result.current.windows['excel-list'].layoutBounds!;
  expect(bounds.y * 768).toBeCloseTo(84);
  expect((bounds.y + bounds.h) * 768).toBeCloseTo(768 - 104);
});
