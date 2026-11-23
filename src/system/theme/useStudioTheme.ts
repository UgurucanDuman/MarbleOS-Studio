import { useEffect, useLayoutEffect, useState } from 'react';
import {
  selectStudioColorPalette,
  selectStudioThemePreference,
  useDesktopPersonalization,
} from '../desktop/desktopPersonalization';
import type {
  StudioColorPaletteId,
  StudioThemePreference,
} from '../schemas/desktopPersonalizationSchemas';
import { resolveEffectivePalette } from './themePalettes';
import { runThemeTransition } from './themeTransition';
import './theme-palettes.css';
import './theme-transition.css';

export type ThemePreference = StudioThemePreference;
export type ColorPaletteId = StudioColorPaletteId;
export type ResolvedTheme = 'dark' | 'light';

function getSystemDarkPreference(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * İZOLE SİSTEM KATMANI: Karanlık/Aydınlık Mod, Sistem Teması ve 12 Renk Paleti Yönetimi
 * Kullanıcının tema ve renk tercihi kalıcı yerel depolamadan okunup anlık uygulanır.
 */
export function useStudioTheme() {
  const { themePreference: preference, colorPalette } = useDesktopPersonalization();
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => getSystemDarkPreference());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => runThemeTransition(() => setSystemIsDark(e.matches));
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const { resolvedTheme, activePalette } = resolveEffectivePalette(
    preference,
    colorPalette,
    systemIsDark,
  );

  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
      document.documentElement.setAttribute('data-palette', activePalette);
    }
  }, [resolvedTheme, activePalette]);

  return {
    preference,
    resolvedTheme,
    activePalette,
    setPreference: (next: ThemePreference) => {
      runThemeTransition(() => selectStudioThemePreference(next));
    },
    setPalette: (next: ColorPaletteId) => {
      runThemeTransition(() => selectStudioColorPalette(next));
    },
  };
}
