import { useEffect, type RefObject } from 'react';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  "[tabindex]:not([tabindex='-1'])",
].join(',');

const traps: HTMLElement[] = [];

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.tabIndex !== -1 && el.getAttribute('aria-hidden') !== 'true');
}

/**
 * Form kartı açıkken klavye odağını kart içinde tutar, Escape ile kapatır
 * ve kapanınca odağı açan butona geri verir.
 */
export function useSheetFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
  returnFocusTo: RefObject<HTMLElement | null>,
) {
  const workEnabled = useWindowWorkEnabled();
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !workEnabled || !container) return;
    traps.push(container);
    const isTop = () => traps[traps.length - 1] === container;
    const autofocus = container.querySelector<HTMLElement>('[data-autofocus]');
    (autofocus ?? focusables(container)[0] ?? container).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape') {
        if (event.target instanceof Element && event.target.closest('[data-select-open="true"]')) return;
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && index === items.length - 1) {
        event.preventDefault();
        items[0].focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const position = traps.lastIndexOf(container);
      if (position !== -1) traps.splice(position, 1);
      const target = returnFocusTo.current;
      // Buton kart kapanınca görünür olur; odağı bir sonraki karede geri ver.
      if (target?.isConnected && !target.closest('[data-window-departing="true"], [data-window-minimized="true"]')) {
        requestAnimationFrame(() => target.focus({ preventScroll: true }));
      }
    };
  }, [active, workEnabled, containerRef, onEscape, returnFocusTo]);
}
