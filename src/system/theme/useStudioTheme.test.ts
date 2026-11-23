import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useStudioTheme } from './useStudioTheme';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('unavailable preference storage does not crash the desktop or prevent changing theme', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
  const { result } = renderHook(useStudioTheme);
  expect(result.current.preference).toBe('system');
  act(() => result.current.setPreference('dark'));
  expect(result.current.resolvedTheme).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
});
