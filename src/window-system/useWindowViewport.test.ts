import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useWindowViewport } from './useWindowViewport';

const original = { w: window.innerWidth, h: window.innerHeight };
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: original.w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: original.h });
});

test('all windows share one resize listener and one publication for a resize burst', () => {
  let frame: FrameRequestCallback | undefined;
  const raf = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 7; });
  vi.stubGlobal('requestAnimationFrame', raf);
  const added = vi.spyOn(window, 'addEventListener');
  const removed = vi.spyOn(window, 'removeEventListener');
  const first = renderHook(useWindowViewport);
  const second = renderHook(useWindowViewport);
  expect(added.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
  const before = first.result.current;
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1919 });
    window.dispatchEvent(new Event('resize'));
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
    window.dispatchEvent(new Event('resize'));
  });
  expect(raf).toHaveBeenCalledOnce();
  expect(first.result.current).toBe(before);
  act(() => frame!(0));
  expect(first.result.current.w).toBe(1920);
  expect(second.result.current).toBe(first.result.current);
  first.unmount();
  expect(removed.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(0);
  second.unmount();
  expect(removed.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
});

test('pending resize work is canceled when the desktop unmounts', () => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 23));
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const subject = renderHook(useWindowViewport);
  act(() => window.dispatchEvent(new Event('resize')));
  subject.unmount();
  expect(cancel).toHaveBeenCalledWith(23);
});
