import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usesDesktopStorage } from './desktopStorage';

/**
 * İZOLE NATIVE PENCERE KÖPRÜSÜ: Windows başlık çubuğu kapalıdır (`decorations: false`);
 * küçültme, büyütme, kapatma ve sürükleme MarbleOS üst barından bu köprüyle yapılır.
 * Tarayıcı önizlemesinde native pencere yoktur; tüm çağrılar sessizce boşa düşer.
 */
export const hasNativeWindowChrome = usesDesktopStorage;

function run(action: (win: ReturnType<typeof getCurrentWindow>) => Promise<unknown>): void {
  if (!hasNativeWindowChrome) return;
  void action(getCurrentWindow()).catch(() => undefined);
}

export const minimizeNativeWindow = () => run((win) => win.minimize());
export const toggleMaximizeNativeWindow = () => run((win) => win.toggleMaximize());
export const closeNativeWindow = () => run((win) => win.close());

/** Etkileşimli öğe dışındaki üst bar boşluğundan pencereyi sürükler; çift tık büyütür. */
export function startNativeWindowDrag(event: { button: number; detail: number; target: EventTarget | null }): void {
  if (!hasNativeWindowChrome || event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest('button, a, input, [role="button"]')) return;
  if (event.detail === 2) toggleMaximizeNativeWindow();
  else run((win) => win.startDragging());
}

export function useNativeWindowMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!hasNativeWindowChrome) return;
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | null = null;
    const sync = () => {
      void win.isMaximized().then((value) => {
        if (!disposed) setMaximized(value);
      }).catch(() => undefined);
    };
    sync();
    void win.onResized(sync).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    }).catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
  return maximized;
}
