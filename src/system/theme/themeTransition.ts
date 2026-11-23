import { flushSync } from 'react-dom';

interface ThemeViewTransition {
  ready: Promise<void>;
  finished: Promise<void>;
  skipTransition(): void;
}

type ThemeDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeViewTransition;
};

let active: ThemeViewTransition | null = null;
let revision = 0;

export function runThemeTransition(update: () => void): void {
  const current = ++revision;
  active?.skipTransition();
  active = null;
  const doc = document as ThemeDocument;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced || doc.hidden) {
    doc.documentElement.removeAttribute('data-theme-transition');
    update();
    return;
  }
  doc.documentElement.setAttribute('data-theme-transition', 'native');
  try {
    const transition = doc.startViewTransition(() => {
      // A skipped transition may still run its callback: the latest selection wins.
      if (revision === current) flushSync(update);
    });
    active = transition;
    void transition.ready.catch(() => {}); // Skipping a transition rejects ready normally.
    void transition.finished.catch(() => {}).finally(() => {
      if (revision !== current) return;
      active = null;
      doc.documentElement.removeAttribute('data-theme-transition');
    });
  } catch {
    doc.documentElement.removeAttribute('data-theme-transition');
    if (revision === current) update();
  }
}
