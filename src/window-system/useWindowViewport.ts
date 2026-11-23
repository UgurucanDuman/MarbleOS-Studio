import { useSyncExternalStore } from 'react';

interface ViewportSize { w: number; h: number }
const fallback: ViewportSize = { w: 1440, h: 900 };
const read = (): ViewportSize => typeof window === 'undefined'
  ? fallback
  : { w: window.innerWidth, h: window.innerHeight };
let snapshot = read();
let pendingFrame: number | null = null;
const listeners = new Set<() => void>();

function publish() {
  const next = read();
  if (next.w === snapshot.w && next.h === snapshot.h) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function scheduleResize() {
  if (pendingFrame !== null) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = null;
    publish();
  });
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    publish();
    window.addEventListener('resize', scheduleResize);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener('resize', scheduleResize);
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
  };
}

/** One resize listener for the desktop; at most one publication per frame. */
export function useWindowViewport() {
  return useSyncExternalStore(subscribe, () => snapshot, () => fallback);
}
