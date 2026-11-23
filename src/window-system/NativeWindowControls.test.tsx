// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

const win = vi.hoisted(() => ({
  minimize: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  startDragging: vi.fn(() => Promise.resolve()),
  isMaximized: vi.fn(() => Promise.resolve(true)),
  onResized: vi.fn(() => Promise.resolve(() => undefined)),
}));

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => win }));
vi.mock('../system/desktop/desktopStorage', () => ({ usesDesktopStorage: true }));

const { NativeWindowControls } = await import('./NativeWindowControls');
const { startNativeWindowDrag } = await import('../system/desktop/nativeWindow');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test('embedded window buttons drive the native Tauri window', async () => {
  render(<NativeWindowControls />);
  await act(async () => undefined);

  fireEvent.click(screen.getByRole('button', { name: 'Küçült' }));
  fireEvent.click(screen.getByRole('button', { name: 'Önceki boyuta getir' }));
  fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));

  expect(win.minimize).toHaveBeenCalledTimes(1);
  expect(win.toggleMaximize).toHaveBeenCalledTimes(1);
  expect(win.close).toHaveBeenCalledTimes(1);
});

test('top bar drags from empty space, maximizes on double click and ignores buttons', () => {
  const bar = document.createElement('header');
  const button = document.createElement('button');
  bar.appendChild(button);

  startNativeWindowDrag({ button: 0, detail: 1, target: bar });
  startNativeWindowDrag({ button: 0, detail: 2, target: bar });
  startNativeWindowDrag({ button: 0, detail: 1, target: button });
  startNativeWindowDrag({ button: 2, detail: 1, target: bar });

  expect(win.startDragging).toHaveBeenCalledTimes(1);
  expect(win.toggleMaximize).toHaveBeenCalledTimes(1);
});
