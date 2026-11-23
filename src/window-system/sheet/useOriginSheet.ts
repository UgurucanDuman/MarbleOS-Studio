import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';

export type OriginSheetPhase = 'closed' | 'open' | 'closing';

function setTriggerDomHidden(el: HTMLElement | null, hidden: boolean): void {
  if (!el) return;
  el.setAttribute('data-sheet-trigger', hidden ? 'hidden' : 'visible');
  if (hidden) {
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
  } else {
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
  }
}

/**
 * Butondan açılan form kartının durumu. Açan buton kart açıkken gizlenir,
 * kart kapanıp butona geri döndükten sonra yeniden görünür.
 * `openFrom` referansı %100 sabittir; büyük tablolarda satırları yeniden render etmeden çağrılabilir.
 */
export function useOriginSheet() {
  const [phase, setPhase] = useState<OriginSheetPhase>('closed');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [openSeq, setOpenSeq] = useState(0);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openFrom = useCallback((key: string, element: HTMLElement | null) => {
    if (triggerRef.current && triggerRef.current !== element) {
      setTriggerDomHidden(triggerRef.current, false);
    }
    triggerRef.current = element;
    setTriggerDomHidden(element, true);
    setActiveKey(key);
    setOpenSeq((seq) => seq + 1);
    setPhase('open');
  }, []);

  const close = useCallback(() => {
    setPhase((current) => (current === 'open' ? 'closing' : current));
  }, []);

  const onExitComplete = useCallback(() => {
    setTriggerDomHidden(triggerRef.current, false);
    setPhase((current) => (current === 'closing' ? 'closed' : current));
  }, []);

  const trigger = useCallback((key: string) => {
    const hidden = phase !== 'closed' && activeKey === key;
    return {
      onClick: (event: MouseEvent<HTMLElement>) => openFrom(key, event.currentTarget),
      'aria-haspopup': 'dialog' as const,
      'aria-hidden': hidden || undefined,
      tabIndex: hidden ? -1 : undefined,
      'data-sheet-trigger': hidden ? 'hidden' : 'visible',
    };
  }, [activeKey, openFrom, phase]);

  return useMemo(
    () => ({ phase, isOpen: phase === 'open', openSeq, openFrom, close, onExitComplete, trigger, triggerRef }),
    [phase, openSeq, openFrom, close, onExitComplete, trigger],
  );
}

export type OriginSheetController = ReturnType<typeof useOriginSheet>;
