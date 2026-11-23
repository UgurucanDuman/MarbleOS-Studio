import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});
afterEach(() => {
  Reflect.deleteProperty(document, 'startViewTransition');
  document.documentElement.removeAttribute('data-theme-transition');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('unsupported browser still applies the theme', async () => {
  const { runThemeTransition } = await import('./themeTransition');
  const update = vi.fn();
  runThemeTransition(update);
  expect(update).toHaveBeenCalledOnce();
});

test('reduced motion bypasses native snapshots', async () => {
  const start = vi.fn();
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  vi.mocked(matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  const { runThemeTransition } = await import('./themeTransition');
  const update = vi.fn();
  runThemeTransition(update);
  expect(update).toHaveBeenCalledOnce();
  expect(start).not.toHaveBeenCalled();
});

test('rapid changes skip older snapshots and only commit the latest callback', async () => {
  const callbacks: Array<() => void> = [];
  const transitions: Array<{ ready: Promise<void>; finished: Promise<void>; skipTransition: ReturnType<typeof vi.fn> }> = [];
  const start = (callback: () => void) => {
    callbacks.push(callback);
    const transition = { ready: Promise.resolve(), finished: Promise.resolve(), skipTransition: vi.fn() };
    transitions.push(transition);
    return transition;
  };
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  const { runThemeTransition } = await import('./themeTransition');
  const older = vi.fn();
  const latest = vi.fn();
  runThemeTransition(older);
  runThemeTransition(latest);
  callbacks[0]();
  callbacks[1]();
  expect(transitions[0].skipTransition).toHaveBeenCalledOnce();
  expect(older).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
  await Promise.all(transitions.map((transition) => transition.finished));
});
