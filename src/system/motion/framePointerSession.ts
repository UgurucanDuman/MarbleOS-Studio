export interface PointerPosition {
  clientX: number;
  clientY: number;
}

interface PointerSessionOptions {
  element: HTMLElement;
  pointerId: number;
  onMove: (position: PointerPosition) => void;
  onEnd?: (position: PointerPosition | null, cancelled: boolean) => void;
}

/**
 * MerbleOS Frame Pointer Session:
 * Fare/kalem hareketlerini ekran yenileme hızına (rAF) senkronize eder ve son konumu asla kaçırmaz.
 * Dosya Sınırı Kuralı: .ts <= 250 satır.
 */
export function startFramePointerSession({
  element,
  pointerId,
  onMove,
  onEnd,
}: PointerSessionOptions) {
  const doc = element.ownerDocument;
  const view = doc.defaultView!;
  let frame: number | null = null;
  let pending: PointerPosition | null = null;
  let last: PointerPosition | null = null;
  let stopped = false;

  const flush = () => {
    frame = null;
    if (!pending) return;
    const next = pending;
    pending = null;
    if (last?.clientX === next.clientX && last.clientY === next.clientY) return;
    last = next;
    onMove(next);
  };

  const cleanup = () => {
    stopped = true;
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    pending = null;
    view.removeEventListener('pointermove', move);
    view.removeEventListener('pointerup', up);
    view.removeEventListener('pointercancel', cancel);
    view.removeEventListener('blur', cancel);
    doc.removeEventListener('visibilitychange', visibilityChange);
    element.removeEventListener('lostpointercapture', cancel);
    try {
      element.releasePointerCapture(pointerId);
    } catch {
      // Pointer zaten serbest bırakılmış olabilir
    }
  };

  const finish = (cancelled: boolean, event?: PointerEvent) => {
    if (stopped) return;
    if (event && event.pointerId !== pointerId) return;
    if (event && !cancelled) pending = { clientX: event.clientX, clientY: event.clientY };
    if (frame !== null) view.cancelAnimationFrame(frame);
    flush();
    cleanup();
    onEnd?.(last, cancelled);
  };

  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pending = { clientX: event.clientX, clientY: event.clientY };
    if (frame === null) frame = view.requestAnimationFrame(flush);
  }

  function up(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    finish(false, event);
  }

  function cancel(event: Event) {
    if ('pointerId' in event && (event as PointerEvent).pointerId !== pointerId) return;
    finish(true);
  }

  function visibilityChange() {
    if (doc.visibilityState === 'hidden') finish(true);
  }

  view.addEventListener('pointermove', move, { passive: false });
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', cancel);
  view.addEventListener('blur', cancel);
  doc.addEventListener('visibilitychange', visibilityChange);
  element.addEventListener('lostpointercapture', cancel);
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Capture desteklenmeyen durumlar için güvenli geçiş
  }
  return cleanup;
}

