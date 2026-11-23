import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import App from '../../App';
import { resetDesktopPersonalizationForTests } from '../../system/desktop/desktopPersonalization';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';
import { STUDIO_COLOR_PALETTES } from '../../system/theme/themePalettes';

MotionGlobalConfig.skipAnimations = true;

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

test('topbar opens animated settings book with separate General Settings and Privacy/IP tabs', async () => {
  render(
    <StudioQueryProvider>
      <App />
    </StudioQueryProvider>,
  );

  expect(document.querySelector('.os-theme-icon-group')).toBeNull();
  expect(screen.queryByRole('group', { name: /Görünüm Teması/i })).toBeNull();
  expect(document.querySelector('.os-topbar-logo-box svg.studio-brand-icon')).toBeTruthy();
  expect(document.querySelector('.os-desktop-root')?.hasAttribute('data-theme')).toBe(false);

  const titleRow = document.querySelector('.os-topbar-title-row');
  const watermark = document.querySelector('.os-desktop-watermark');
  expect(titleRow?.textContent).toContain('MarbleOS');
  expect(titleRow?.textContent).not.toContain('Studio');
  expect(watermark?.textContent).toContain('MarbleOS');
  expect(watermark?.textContent).not.toContain('Studio');

  fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));

  const dialog = await screen.findByRole('dialog', { name: 'MarbleOS Sistem Ayarları ve El Kitabı' });
  expect(dialog).toBeTruthy();
  const dialogSvgColors = Array.from(dialog.querySelectorAll('svg *')).map((el) => el.getAttribute('stroke') ?? '');
  expect(dialogSvgColors.some((s) => s.toLowerCase() === '#eab308')).toBe(false);

  // 1) Normal Sistem Ayarları (4 sayfa: Görünüm -> Şirket/Adres -> Veri Kasası -> Yedekleme)
  expect(screen.getByText('SAYFA 01 / 04')).toBeTruthy();
  expect(screen.getByText('Görünüm, Duvar Kağıdı ve Masaüstü')).toBeTruthy();
  expect(screen.queryByText('Gizlilik Politikası ve Yerel Veri Egemenliği')).toBeNull();

  fireEvent.click(screen.getByRole('radio', { name: /Antrasit Karanlık/i }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  fireEvent.click(screen.getByRole('radio', { name: /Alabaster Aydınlık/i }));
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');

  // 12 Renk Paleti seçimi: Simsiyah OLED, Ametist Gece, Prizma Rengarenk ve Buzul Aydınlık
  const paletteGroup = screen.getByRole('radiogroup', { name: '12 renk ve tema paleti' });
  expect(paletteGroup.querySelectorAll('[role="radio"]')).toHaveLength(12);

  fireEvent.click(screen.getByRole('radio', { name: /Simsiyah OLED/i }));
  expect(document.documentElement.getAttribute('data-palette')).toBe('obsidian-black');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

  fireEvent.click(screen.getByRole('radio', { name: /Ametist Gece/i }));
  expect(document.documentElement.getAttribute('data-palette')).toBe('amethyst-velvet');

  fireEvent.click(screen.getByRole('radio', { name: /Prizma Rengarenk/i }));
  expect(document.documentElement.getAttribute('data-palette')).toBe('aurora-prism');

  fireEvent.click(screen.getByRole('radio', { name: /Buzul Aydınlık/i }));
  expect(document.documentElement.getAttribute('data-palette')).toBe('glacier-daylight');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');

  for (const p of STUDIO_COLOR_PALETTES) {
    const hexes = `${p.swatchCss} ${p.accentHex}`.match(/#[0-9a-fA-F]{6}/g) ?? [];
    for (const hex of hexes) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const isOrangeHue = r > g && g > b && (max - min) > 40 && (g - b) / (max - min) > 0.25 && (g - b) / (max - min) < 0.72;
      expect(isOrangeHue, `Orange hue disallowed in palette ${p.id}: ${hex}`).toBe(false);
    }
  }

  fireEvent.click(screen.getByRole('button', { name: 'Sonraki Sayfa →' }));
  expect(await screen.findByText('SAYFA 02 / 04')).toBeTruthy();
  expect(screen.getByText('Şirket, Stüdyo ve Adres Bilgileri')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Şirket / Fotoğrafhane Adı'), {
    target: { value: 'Foto Ufuk' },
  });
  fireEvent.change(screen.getByLabelText('Adres'), {
    target: { value: 'Atatürk Cad. No: 12 Kadıköy' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Bilgileri Kaydet' }));

  expect(titleRow?.textContent).toContain('Foto Ufuk');
  expect(document.querySelector('.os-topbar-context-label')?.textContent).toContain(
    'Atatürk Cad. No: 12 Kadıköy',
  );
  expect(watermark?.textContent).toContain('Foto Ufuk');
  expect(watermark?.textContent).toContain('Atatürk Cad. No: 12 Kadıköy');

  const logoInput = screen.getByLabelText('Şirket logosu dosyası seç') as HTMLInputElement;
  const pngBytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
  ]);
  const logoFile = new File([pngBytes], 'foto-ufuk-logo.png', { type: 'image/png' });
  fireEvent.change(logoInput, { target: { files: [logoFile] } });

  // Firma logosu kaydedilir ama MarbleOS sistem ikonu üst barda ve masaüstü ambleminde sabit kalır.
  expect(await screen.findByText('Logoyu Kaldır')).toBeTruthy();
  expect(document.querySelector('.os-topbar-logo-box svg.studio-brand-icon')).toBeTruthy();
  expect(document.querySelector('.os-topbar-logo-box img')).toBeNull();
  expect(document.querySelector('.os-desktop-watermark img')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Sonraki Sayfa →' }));
  expect(await screen.findByText('SAYFA 03 / 04')).toBeTruthy();
  expect(screen.getByText('Yerel Veri Kasası ve 256-bit Kurtarma Anahtarı')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Sonraki Sayfa →' }));
  expect(await screen.findByText('SAYFA 04 / 04')).toBeTruthy();
  expect(screen.getByText('Şifreli Yedekleme ve Geri Yükleme Merkezi')).toBeTruthy();

  // 2) Ayrı "Gizlilik & Tescil" kategorisine geçiş (2 sayfa: Gizlilik -> Telif & Marka Tescili)
  fireEvent.click(screen.getByRole('tab', { name: 'Gizlilik & Tescil' }));
  expect(await screen.findByText('SAYFA 01 / 02')).toBeTruthy();
  expect(screen.getByText('Gizlilik Politikası ve Yerel Veri Egemenliği')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Sonraki Sayfa →' }));
  expect(await screen.findByText('SAYFA 02 / 02')).toBeTruthy();
  expect(screen.getByText('Fikri Mülkiyet, Telif Tescili ve Marka Hakları')).toBeTruthy();
  expect(screen.getByText('2026/20687 · 25.09.2026')).toBeTruthy();
  expect(screen.getByText(/f3c36074-9363-4d54-8a38-ee968fc69dfa/)).toBeTruthy();
  expect(screen.getByText(/marbleos enterprise system/)).toBeTruthy();
  expect(screen.getByText('2026/996447 · 23.09.2026')).toBeTruthy();
  expect(screen.getByText(/2DD016F2-1972-47B3-BF79-B796631729F9/)).toBeTruthy();
  expect(dialog.textContent).not.toMatch(/\b\d{11}\b/);

  fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
