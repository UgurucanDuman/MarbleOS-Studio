import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { OriginSheet } from './OriginSheet';
import { useOriginSheet } from './useOriginSheet';

MotionGlobalConfig.skipAnimations = true;
afterEach(() => cleanup());

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const sheet = useOriginSheet();
  return (
    <>
      <button type="button" {...sheet.trigger('add')}>Yeni Okul</button>
      <OriginSheet controller={sheet} title="Yeni Okul" submitLabel="Okulu Ekle" onSubmit={onSubmit}>
        <input aria-label="Okul adı" data-autofocus />
      </OriginSheet>
    </>
  );
}

test('trigger hides while the form is open and returns after Escape', async () => {
  render(<Harness onSubmit={() => {}} />);
  const trigger = screen.getByText('Yeni Okul', { selector: 'button' });
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(trigger.getAttribute('data-sheet-trigger')).toBe('hidden');
  expect(document.activeElement).toBe(screen.getByLabelText('Okul adı'));
  act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(trigger.getAttribute('data-sheet-trigger')).toBe('visible');
});

test('Enter submits through the form and Vazgeç closes without submitting', async () => {
  const onSubmit = vi.fn();
  render(<Harness onSubmit={onSubmit} />);
  fireEvent.click(screen.getByText('Yeni Okul', { selector: 'button' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.querySelector('.os-sheet-ghost')?.textContent).toContain('Yeni Okul');
  expect(dialog.querySelector('.os-sheet-content')).toBeTruthy();
  fireEvent.submit(dialog);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Vazgeç'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('outside sheet backdrop does not apply blur or dark tint while keeping card surface intact', () => {
  const css = readFileSync(resolve(__dirname, 'origin-sheet.css'), 'utf8');
  const backdropRule = css.match(/\.os-sheet-backdrop\s*\{[^}]*\}/)?.[0] ?? '';
  const panelRule = css.match(/\.os-sheet-panel\s*\{[^}]*\}/)?.[0] ?? '';
  const animatingRule = css.match(/\.os-sheet-panel\[data-sheet-animating='true'\]\s*\{[^}]*\}/)?.[0] ?? '';
  expect(backdropRule).toContain('background: transparent');
  expect(backdropRule).toContain('backdrop-filter: none');
  expect(backdropRule).not.toMatch(/blur\(/);
  expect(panelRule).toContain('backdrop-filter: blur(');
  // Açılış karesinde cam blur dondurulup sonradan patlatılmaz:
  expect(animatingRule).not.toContain('backdrop-filter: none');
});

test('openFrom hides and restores imperative row trigger DOM attributes cleanly', async () => {
  function RowHarness() {
    const sheet = useOriginSheet();
    return (
      <>
        <button
          type="button"
          data-sheet-trigger="visible"
          onClick={(e) => sheet.openFrom('stu-1', e.currentTarget)}
        >
          Düzenle
        </button>
        <OriginSheet controller={sheet} title="Öğrenci Düzelt" submitLabel="Kaydet">
          <input aria-label="Ad" data-autofocus />
        </OriginSheet>
      </>
    );
  }
  render(<RowHarness />);
  const rowBtn = screen.getByText('Düzenle', { selector: 'button' });
  fireEvent.click(rowBtn);
  expect(rowBtn.getAttribute('data-sheet-trigger')).toBe('hidden');
  act(() => { fireEvent.keyDown(document, { key: 'Escape' }); });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(rowBtn.getAttribute('data-sheet-trigger')).toBe('visible');
});

