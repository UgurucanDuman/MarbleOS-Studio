import { useEffect } from 'react';

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isEditableDesktopTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const editable = target.closest('input, textarea, [contenteditable="true"]');
  if (!editable) {
    return false;
  }
  if (editable instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(editable.type.toLowerCase());
  }
  return true;
}

export function isBlockedBrowserShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toUpperCase();
  const ctrlOrMeta = event.ctrlKey || event.metaKey;

  if (key === 'F12' || key === 'F3' || key === 'F7') {
    return true;
  }

  // Windows/Linux DevTools: Ctrl+Shift+I / J / C / K
  if (ctrlOrMeta && event.shiftKey && (key === 'I' || key === 'J' || key === 'C' || key === 'K')) {
    return true;
  }

  // macOS DevTools: Cmd+Opt+I / J / C / U
  if (event.metaKey && event.altKey && (key === 'I' || key === 'J' || key === 'C' || key === 'U')) {
    return true;
  }

  // Tarayıcı kaynak kodu, kaydetme, yazdırma ve arama çubuğu: Ctrl+U / S / P / F / G
  if (ctrlOrMeta && !event.shiftKey && !event.altKey && (key === 'U' || key === 'S' || key === 'P' || key === 'F' || key === 'G')) {
    return true;
  }

  return false;
}

function clearBrowserSelection(): void {
  try {
    const selection = window.getSelection?.();
    if (selection && selection.rangeCount > 0 && selection.isCollapsed !== true) {
      selection.removeAllRanges();
    }
  } catch {
    // Seçim temizleme hatası yoksayılır.
  }
}

export function useNativeDesktopGuard(): void {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleSelectStart = (event: Event) => {
      if (!isEditableDesktopTarget(event.target)) {
        event.preventDefault();
        clearBrowserSelection();
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!isEditableDesktopTarget(event.target)) {
        clearBrowserSelection();
      }
    };

    const handleDragStart = (event: DragEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[draggable="true"]')) {
        return;
      }
      if (!isEditableDesktopTarget(target)) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isBlockedBrowserShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('selectstart', handleSelectStart, { capture: true });
    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('dragstart', handleDragStart, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('selectstart', handleSelectStart, { capture: true });
      window.removeEventListener('mousedown', handleMouseDown, { capture: true });
      window.removeEventListener('dragstart', handleDragStart, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
}

