import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useNativeDesktopGuard } from './useNativeDesktopGuard';

afterEach(cleanup);

function GuardHarness() {
  useNativeDesktopGuard();
  return (
    <div>
      <span data-testid="table-cell">ZEYNEP GÜNEŞ</span>
      <button type="button" data-testid="action-btn">Kaydet</button>
      <input type="text" data-testid="text-input" defaultValue="Atatürk İlkokulu" />
      <textarea data-testid="text-area" defaultValue="Notlar" />
    </div>
  );
}

describe('useNativeDesktopGuard', () => {
  it('sağ tık (İncele / contextmenu) menüsünü tamamen engeller', () => {
    const { getByTestId } = render(<GuardHarness />);
    const cell = getByTestId('table-cell');

    const contextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    cell.dispatchEvent(contextEvent);

    expect(contextEvent.defaultPrevented).toBe(true);
  });

  it('tablo ve butonlarda metin seçimini (Kopyala/Araştır baloncuğunu) engeller, input içinde izin verir', () => {
    const { getByTestId } = render(<GuardHarness />);
    const cell = getByTestId('table-cell');
    const textInput = getByTestId('text-input');
    const textArea = getByTestId('text-area');

    const cellSelect = new Event('selectstart', { bubbles: true, cancelable: true });
    cell.dispatchEvent(cellSelect);
    expect(cellSelect.defaultPrevented).toBe(true);

    const inputSelect = new Event('selectstart', { bubbles: true, cancelable: true });
    textInput.dispatchEvent(inputSelect);
    expect(inputSelect.defaultPrevented).toBe(false);

    const areaSelect = new Event('selectstart', { bubbles: true, cancelable: true });
    textArea.dispatchEvent(areaSelect);
    expect(areaSelect.defaultPrevented).toBe(false);
  });

  it('F12, Ctrl+Shift+I/C ve Ctrl+U/F gibi tarayıcı inceleme kısayollarını engeller, normal yazmayı bozmaz', () => {
    const { getByTestId } = render(<GuardHarness />);
    const textInput = getByTestId('text-input');

    const f12Event = new KeyboardEvent('keydown', { key: 'F12', bubbles: true, cancelable: true });
    window.dispatchEvent(f12Event);
    expect(f12Event.defaultPrevented).toBe(true);

    const inspectEvent = new KeyboardEvent('keydown', {
      key: 'I',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(inspectEvent);
    expect(inspectEvent.defaultPrevented).toBe(true);

    const viewSourceEvent = new KeyboardEvent('keydown', {
      key: 'u',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(viewSourceEvent);
    expect(viewSourceEvent.defaultPrevented).toBe(true);

    const copyEvent = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    textInput.dispatchEvent(copyEvent);
    expect(copyEvent.defaultPrevented).toBe(false);
  });
});
