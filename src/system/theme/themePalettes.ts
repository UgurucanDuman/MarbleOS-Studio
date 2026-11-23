import type {
  StudioColorPaletteId,
  StudioThemePreference,
} from '../schemas/desktopPersonalizationSchemas';

export interface StudioPaletteMeta {
  id: StudioColorPaletteId;
  title: string;
  subtitle: string;
  baseTheme: 'dark' | 'light';
  swatchCss: string;
  accentHex: string;
  isPrism?: boolean;
}

/**
 * MarbleOS Studio — 12 Renk ve Tema Paleti Kataloğu
 * Kural: Turuncu renk kesinlikle yasaktır; OLED simsiyah, göz yormayan antrasit,
 * derin stüdyo renkleri, çok renkli Prizma ve yumuşak aydınlık temalar birlikte sunulur.
 */
export const STUDIO_COLOR_PALETTES: readonly StudioPaletteMeta[] = [
  {
    id: 'obsidian-black',
    title: 'Simsiyah OLED',
    subtitle: 'Tam saf siyah (#000000) yüksek kontrastlı stüdyo zemini',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #000000 0%, #09090d 62%, #18181f 100%)',
    accentHex: '#e4e4e7',
  },
  {
    id: 'anthracite-pro',
    title: 'Antrasit Pro',
    subtitle: 'Göz yormayan grimsi antrasit (#131418) dengeli karanlık mod',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #131418 0%, #1e2128 65%, #343947 100%)',
    accentHex: '#e8eaed',
  },
  {
    id: 'sapphire-night',
    title: 'Gece Safiri',
    subtitle: 'Derin lacivert zemin ve safir mavi vurgu tonları',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #091224 0%, #162a52 62%, #3b82f6 100%)',
    accentHex: '#3b82f6',
  },
  {
    id: 'emerald-studio',
    title: 'Zümrüt Stüdyo',
    subtitle: 'Koyu zümrüt yeşili zemin ve botanik kontrast',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #071914 0%, #0e3328 62%, #10b981 100%)',
    accentHex: '#10b981',
  },
  {
    id: 'amethyst-velvet',
    title: 'Ametist Gece',
    subtitle: 'Kadife mor zemin ve ametist kristal vurgular',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #130c22 0%, #271645 62%, #a855f7 100%)',
    accentHex: '#a855f7',
  },
  {
    id: 'ocean-lagoon',
    title: 'Okyanus Derinliği',
    subtitle: 'Derin turkuaz-camgöbeği su altı stüdyo tonu',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #071820 0%, #0d3240 62%, #06b6d4 100%)',
    accentHex: '#06b6d4',
  },
  {
    id: 'crimson-velvet',
    title: 'Yakut Bordo',
    subtitle: 'Asil koyu bordo zemin ve yakut gül vurgular',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #1d0a12 0%, #3d1424 62%, #f43f5e 100%)',
    accentHex: '#f43f5e',
  },
  {
    id: 'indigo-cosmos',
    title: 'Kozmik İndigo',
    subtitle: 'Gece indigosu zemin ve elektrik mavisi detaylar',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #0d1026 0%, #1c2252 62%, #6366f1 100%)',
    accentHex: '#6366f1',
  },
  {
    id: 'aurora-prism',
    title: 'Prizma Rengarenk',
    subtitle: 'Çok renkli camgöbeği, zümrüt, safir ve mor prizmatik geçişler',
    baseTheme: 'dark',
    swatchCss: 'linear-gradient(135deg, #06b6d4 0%, #10b981 32%, #3b82f6 65%, #a855f7 100%)',
    accentHex: '#06b6d4',
    isPrism: true,
  },
  {
    id: 'alabaster-porcelain',
    title: 'Alabaster Porselen',
    subtitle: 'Göz almayan sıcak kırık beyaz porselen aydınlık yüzey',
    baseTheme: 'light',
    swatchCss: 'linear-gradient(135deg, #dad7cf 0%, #eceae4 60%, #f5f4f0 100%)',
    accentHex: '#1e2026',
  },
  {
    id: 'glacier-daylight',
    title: 'Buzul Aydınlık',
    subtitle: 'Ferah buz mavisi gün ışığı ve net okunabilirlik',
    baseTheme: 'light',
    swatchCss: 'linear-gradient(135deg, #d7e5f4 0%, #edf4fc 60%, #0284c7 100%)',
    accentHex: '#0284c7',
  },
  {
    id: 'sage-botanic',
    title: 'Adaçayı Aydınlık',
    subtitle: 'Yumuşak adaçayı yeşili doğal aydınlık çalışma alanı',
    baseTheme: 'light',
    swatchCss: 'linear-gradient(135deg, #d4e3da 0%, #eef5f0 60%, #0d9488 100%)',
    accentHex: '#0d9488',
  },
] as const;

export function findPaletteMeta(id: StudioColorPaletteId): StudioPaletteMeta {
  return (
    STUDIO_COLOR_PALETTES.find((item) => item.id === id) ??
    STUDIO_COLOR_PALETTES[1]
  );
}

export function resolveEffectivePalette(
  preference: StudioThemePreference,
  selectedPalette: StudioColorPaletteId,
  systemIsDark: boolean,
): { resolvedTheme: 'dark' | 'light'; activePalette: StudioColorPaletteId } {
  const meta = findPaletteMeta(selectedPalette);
  const resolvedTheme: 'dark' | 'light' =
    preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  if (meta.baseTheme === resolvedTheme) {
    return { resolvedTheme, activePalette: meta.id };
  }
  return {
    resolvedTheme,
    activePalette: resolvedTheme === 'dark' ? 'anthracite-pro' : 'alabaster-porcelain',
  };
}

