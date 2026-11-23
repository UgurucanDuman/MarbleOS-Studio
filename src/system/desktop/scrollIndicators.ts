const SCROLL_INDICATOR_TIMEOUT_MS = 700;

export function installScrollIndicators(root: HTMLElement) {
  const pending = new Map<HTMLElement, number>();

  function showIndicator(event: Event) {
    const scroller = event.target;
    if (!(scroller instanceof HTMLElement)) return;

    const previous = pending.get(scroller);
    if (previous !== undefined) {
      window.clearTimeout(previous);
    } else {
      scroller.setAttribute('data-scroll-active', '');
    }

    pending.set(scroller, window.setTimeout(() => {
      scroller.removeAttribute('data-scroll-active');
      pending.delete(scroller);
    }, SCROLL_INDICATOR_TIMEOUT_MS));
  }

  root.addEventListener('scroll', showIndicator, { capture: true, passive: true });
  return () => {
    root.removeEventListener('scroll', showIndicator, true);
    for (const [scroller, timer] of pending) {
      window.clearTimeout(timer);
      scroller.removeAttribute('data-scroll-active');
    }
    pending.clear();
  };
}
