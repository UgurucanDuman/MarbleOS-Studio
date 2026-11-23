import { useEffect } from 'react';
import type { PvcCardElement } from '../../../system/storage/pvc-cards/types';

/**
 * İZOLE MODÜL 03 HOOK: PVC Kart Tasarımcısı Klavye Kısayolları
 * Ctrl+Z/Y (Geri Al / İleri Al), Ctrl+D (Çoğalt), Delete (Sil), Ok Tuşları (0.5 / 2 mm hareket).
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function usePvcEditorShortcuts(options: {
  enabled: boolean;
  elements: readonly PvcCardElement[];
  selectedElementId: string | null;
  onClearSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onQuickAction: (elId: string, action: 'duplicate' | 'delete') => void;
  onNudge: (elId: string, patch: Partial<PvcCardElement>) => void;
}): void {
  const { enabled, elements, selectedElementId, onClearSelection, onUndo, onRedo, onQuickAction, onNudge } = options;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }
      if (!selectedElementId) return;
      const el = elements.find((it) => it.id === selectedElementId);
      if (!el) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onQuickAction(el.id, 'duplicate');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !el.locked) {
        e.preventDefault();
        onQuickAction(el.id, 'delete');
      } else if (e.key === 'Escape') {
        onClearSelection();
      } else if (!el.locked && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        onNudge(el.id, { xMm: Number((el.xMm + dx).toFixed(2)), yMm: Number((el.yMm + dy).toFixed(2)) });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [elements, enabled, onClearSelection, onNudge, onQuickAction, onRedo, onUndo, selectedElementId]);
}
