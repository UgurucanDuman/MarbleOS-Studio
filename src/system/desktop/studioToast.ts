import { useSyncExternalStore } from 'react';

export const TOAST_DURATION_MS = 3000;
const MAX_VISIBLE_TOASTS = 3;

export type StudioToastKind = 'success' | 'error' | 'info';

export interface StudioToastItem {
  id: string;
  message: string;
  kind: StudioToastKind;
  createdAt: number;
  durationMs: number;
}

const ERROR_KEYWORDS =
  /hata|başarısız|bulunamadı|geçersiz|yinelenen|aşıyor|okunamadı|açılamadı|eklenmedi|en fazla|değiştirilmedi|seçin|kaydedin|uygulanmadı|bozuk/i;
const SUCCESS_KEYWORDS =
  /aktarıldı|eşleştirildi|eklendi|kaydedildi|silindi|korundu|oluşturuldu|güncellendi|çoğaltıldı|tamamlandı/i;

export function inferToastKind(message: string): StudioToastKind {
  if (ERROR_KEYWORDS.test(message)) return 'error';
  if (SUCCESS_KEYWORDS.test(message)) return 'success';
  return 'info';
}

let toastsState: ReadonlyArray<StudioToastItem> = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function scheduleDismiss(id: string, durationMs: number): void {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    timers.delete(id);
    dismissStudioToast(id);
  }, durationMs);
  timers.set(id, handle);
}

export function dismissStudioToast(id: string): void {
  const existingTimer = timers.get(id);
  if (existingTimer) {
    clearTimeout(existingTimer);
    timers.delete(id);
  }
  const next = toastsState.filter((item) => item.id !== id);
  if (next.length !== toastsState.length) {
    toastsState = next;
    emitChange();
  }
}

export function clearStudioToasts(): void {
  for (const handle of timers.values()) {
    clearTimeout(handle);
  }
  timers.clear();
  if (toastsState.length > 0) {
    toastsState = [];
    emitChange();
  }
}

/**
 * Sistem genelinde 3 saniyelik Apple macOS tarzı Toast bildirimi gösterir.
 * `onNotice: (msg: string | null) => void` imzasıyla doğrudan uyumludur.
 */
export function notifyStudio(
  rawMessage: string | null | undefined,
  explicitKind?: StudioToastKind,
  durationMs: number = TOAST_DURATION_MS,
): void {
  if (!rawMessage) return;
  const message = rawMessage.trim();
  if (!message) return;

  const kind = explicitKind ?? inferToastKind(message);
  const now = Date.now();
  const duplicate = toastsState.find((item) => item.message === message);

  if (duplicate) {
    const refreshed: StudioToastItem = {
      ...duplicate,
      kind,
      createdAt: now,
      durationMs,
    };
    toastsState = [
      ...toastsState.filter((item) => item.id !== duplicate.id),
      refreshed,
    ];
    scheduleDismiss(duplicate.id, durationMs);
    emitChange();
    return;
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `toast-${now}-${Math.random().toString(36).slice(2, 8)}`;

  const nextToast: StudioToastItem = {
    id,
    message,
    kind,
    createdAt: now,
    durationMs,
  };

  const trimmed =
    toastsState.length >= MAX_VISIBLE_TOASTS
      ? toastsState.slice(toastsState.length - (MAX_VISIBLE_TOASTS - 1))
      : toastsState;

  for (const old of toastsState) {
    if (!trimmed.some((item) => item.id === old.id)) {
      const oldTimer = timers.get(old.id);
      if (oldTimer) {
        clearTimeout(oldTimer);
        timers.delete(old.id);
      }
    }
  }

  toastsState = [...trimmed, nextToast];
  scheduleDismiss(id, durationMs);
  emitChange();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ReadonlyArray<StudioToastItem> {
  return toastsState;
}

export function useStudioToasts(): ReadonlyArray<StudioToastItem> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

