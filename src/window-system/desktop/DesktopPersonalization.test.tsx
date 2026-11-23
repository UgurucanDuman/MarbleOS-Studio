import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import App from '../../App';
import * as desktopPersonalizationIdb from '../../system/desktop/desktopPersonalizationIdb';
import {
  getDesktopPersonalizationState,
  resetDesktopPersonalizationForTests,
  startDesktopPersonalization,
} from '../../system/desktop/desktopPersonalization';
import { createDefaultPersonalizationState } from '../../system/schemas/desktopPersonalizationSchemas';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';

MotionGlobalConfig.skipAnimations = true;

function renderStudioApp(): void {
  render(
    <StudioQueryProvider>
      <App />
    </StudioQueryProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDesktopPersonalizationForTests();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  resetDesktopPersonalizationForTests();
  vi.restoreAllMocks();
});

test('desktop right-click opens context menu only on stage, toggles widgets, and removes them', async () => {
  renderStudioApp();

  const stage = document.querySelector('main.os-desktop-stage');
  expect(stage).toBeTruthy();

  fireEvent.contextMenu(stage!, { clientX: 200, clientY: 200 });
  expect(await screen.findByRole('menu', { name: 'Masaüstü menüsü' })).toBeTruthy();

  // Escape closes menu
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('menu', { name: 'Masaüstü menüsü' })).toBeNull();

  // Re-open via stage contextMenu and close via outside pointerDown
  fireEvent.contextMenu(stage!, { clientX: 200, clientY: 200 });
  expect(await screen.findByRole('menu', { name: 'Masaüstü menüsü' })).toBeTruthy();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu', { name: 'Masaüstü menüsü' })).toBeNull();

  // Add Saat & Takvim widget
  fireEvent.contextMenu(stage!, { clientX: 200, clientY: 200 });
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: "Saat & Takvim Widget'ı" }));
  const clockWidget = document.querySelector('[data-widget-id="clock-calendar"]') as HTMLElement | null;
  expect(clockWidget).toBeTruthy();

  // Drag Saat & Takvim widget freely across the desktop stage and persist position
  fireEvent.pointerDown(clockWidget!, { button: 0, clientX: 900, clientY: 110, pointerId: 1 });
  fireEvent.pointerMove(clockWidget!, { clientX: 240, clientY: 320, pointerId: 1 });
  fireEvent.pointerUp(clockWidget!, { clientX: 240, clientY: 320, pointerId: 1 });

  const movedPos = getDesktopPersonalizationState().widgetPositions['clock-calendar'];
  expect(movedPos).toBeTruthy();
  expect(clockWidget!.style.transform).toContain(
    `translate3d(${movedPos!.x}px, ${movedPos!.y}px, 0)`,
  );

  // Reset widget positions from desktop context menu
  fireEvent.contextMenu(stage!, { clientX: 200, clientY: 200 });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Widget Konumlarını Sıfırla' }));
  expect(getDesktopPersonalizationState().widgetPositions['clock-calendar']).toBeUndefined();

  // Add Hızlı Çekim Notu widget, edit note, and delete it with 2-step confirmation
  fireEvent.contextMenu(stage!, { clientX: 220, clientY: 220 });
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: "Hızlı Çekim Notu Widget'ı" }));
  const noteInput = await screen.findByLabelText('Hızlı Çekim Notu');
  fireEvent.change(noteInput, { target: { value: 'Yarın 09:30 stüdyo çekimi' } });
  expect((noteInput as HTMLTextAreaElement).value).toBe('Yarın 09:30 stüdyo çekimi');
  fireEvent.click(screen.getByRole('button', { name: 'Notu Sil' }));
  fireEvent.click(screen.getByRole('button', { name: 'Silinsin mi?' }));
  expect((noteInput as HTMLTextAreaElement).value).toBe('');
  expect(getDesktopPersonalizationState().quickNote).toBe('');

  // Remove Saat & Takvim widget via × button
  fireEvent.click(screen.getByRole('button', { name: "Saat & Takvim widget'ını kaldır" }));
  expect(document.querySelector('[data-widget-id="clock-calendar"]')).toBeNull();

  // Opening a window via Dock disables desktop menu when right-clicking inside the window frame
  const excelDockButton = document.querySelector('[data-dock-app="excel-list"] button');
  expect(excelDockButton).toBeTruthy();
  fireEvent.click(excelDockButton!);

  const windowFrame = await waitFor(() => {
    const frame = document.querySelector('.os-window-frame');
    expect(frame).toBeTruthy();
    return frame!;
  });

  fireEvent.contextMenu(windowFrame, { clientX: 260, clientY: 260 });
  expect(screen.queryByRole('menu', { name: 'Masaüstü menüsü' })).toBeNull();
});

test('desktop context menu switches built-in wallpaper, validates custom upload, and opens company settings', async () => {
  renderStudioApp();

  const stage = document.querySelector('main.os-desktop-stage');
  const wallpaperLayer = document.querySelector('.os-desktop-wallpaper-layer');
  expect(stage).toBeTruthy();
  expect(wallpaperLayer).toBeTruthy();

  // Switch built-in wallpaper to Kuzey Fiyordu & Sisli Dağlar
  fireEvent.contextMenu(stage!, { clientX: 180, clientY: 180 });
  fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Kuzey Fiyordu & Sisli Dağlar' }));
  expect(wallpaperLayer?.getAttribute('data-wallpaper-kind')).toBe('builtin');
  expect(wallpaperLayer?.getAttribute('data-wallpaper-id')).toBe('nordic-mist');

  // Invalid non-image file is rejected without overwriting active wallpaper
  const fileInput = screen.getByLabelText('Masaüstü duvar kağıdı dosyası seç') as HTMLInputElement;
  const badFile = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'fake.pdf', {
    type: 'application/pdf',
  });
  fireEvent.change(fileInput, { target: { files: [badFile] } });

  await waitFor(() => {
    expect(wallpaperLayer?.getAttribute('data-wallpaper-kind')).toBe('builtin');
    expect(wallpaperLayer?.getAttribute('data-wallpaper-id')).toBe('nordic-mist');
  });

  // Valid PNG magic header activates custom wallpaper
  const pngBytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
  ]);
  const validPng = new File([pngBytes], 'marble-custom.png', { type: 'image/png' });
  fireEvent.change(fileInput, { target: { files: [validPng] } });

  await waitFor(() => {
    expect(wallpaperLayer?.getAttribute('data-wallpaper-kind')).toBe('custom');
  });

  // Switch color palette directly from right-click menu palette dots
  fireEvent.contextMenu(stage!, { clientX: 180, clientY: 180 });
  await screen.findByRole('group', { name: 'Hızlı renk paleti seçimi' });
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Simsiyah OLED' }));
  expect(document.documentElement.getAttribute('data-palette')).toBe('obsidian-black');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  // Shortcut opens Settings Book directly to SAYFA 02 / 04 (Şirket, Stüdyo ve Adres Bilgileri)
  fireEvent.contextMenu(stage!, { clientX: 200, clientY: 200 });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Şirket & Adres Bilgilerini Düzenle...' }));

  const dialog = await screen.findByRole('dialog', { name: 'MarbleOS Sistem Ayarları ve El Kitabı' });
  expect(dialog).toBeTruthy();
  expect(await screen.findByText('SAYFA 02 / 04')).toBeTruthy();
  expect(screen.getByText('Şirket, Stüdyo ve Adres Bilgileri')).toBeTruthy();
});

test('startDesktopPersonalization restores durable company info, note and palette even after localStorage wipe', async () => {
  const saved = {
    ...createDefaultPersonalizationState(),
    themePreference: 'dark' as const,
    colorPalette: 'amethyst-velvet' as const,
    company: {
      companyName: 'Foto Ufuk',
      ownerName: 'Ufuk Demir',
      phone: '0555 123 4567',
      address: 'Moda Cad. Kadıköy',
      logoAssetId: null,
    },
    quickNote: 'Salı sınıf listeleri kontrol edilecek',
  };
  vi.spyOn(desktopPersonalizationIdb, 'loadPersonalizationFromIdb').mockResolvedValue(saved);
  localStorage.clear();

  await startDesktopPersonalization();

  const restored = getDesktopPersonalizationState();
  expect(restored.colorPalette).toBe('amethyst-velvet');
  expect(restored.company.companyName).toBe('Foto Ufuk');
  expect(restored.company.phone).toBe('0555 123 4567');
  expect(restored.quickNote).toBe('Salı sınıf listeleri kontrol edilecek');
});
