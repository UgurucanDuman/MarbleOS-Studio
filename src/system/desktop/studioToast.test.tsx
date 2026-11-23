import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { StudioToastHost } from '../../window-system/StudioToastHost';
import { clearStudioToasts, notifyStudio, TOAST_DURATION_MS, useStudioToasts } from './studioToast';

MotionGlobalConfig.skipAnimations = true;

afterEach(() => {
  clearStudioToasts();
  cleanup();
  vi.useRealTimers();
});

describe('studioToast & StudioToastHost (3 saniyelik bildirim sistemi)', () => {
  it('bildirimi tam 3 saniye (3000ms) tutar ve 3. saniye dolunca otomatik siler', () => {
    vi.useFakeTimers();
    expect(TOAST_DURATION_MS).toBe(3000);
    const { result } = renderHook(() => useStudioToasts());

    act(() => {
      notifyStudio(null);
      notifyStudio('33 fotoğraf başarıyla eşleştirildi.');
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.message).toBe('33 fotoğraf başarıyla eşleştirildi.');
    expect(result.current[0]?.kind).toBe('success');

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toHaveLength(0);
  });

  it('StudioToastHost bildirimleri document.body portalında en üst katmanda gösterir ve kapatır', async () => {
    const { container } = render(
      <div style={{ position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <StudioToastHost />
      </div>,
    );

    act(() => {
      notifyStudio('Seçilen klasördeki fotoğraflar bu şubede zaten yüklü; aynı klasör ikinci kez eklenmedi.');
    });

    const alertEl = screen.getByRole('alert');
    expect(alertEl.textContent).toContain('aynı klasör ikinci kez eklenmedi');
    expect(container.querySelector('.os-toast-stack')).toBeNull();
    expect(document.body.querySelector(':scope > .os-toast-stack')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Bildirimi kapat' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
