import { invoke } from '@tauri-apps/api/core';
import {
  createDefaultPersonalizationState,
  desktopPersonalizationStateSchema,
  type DesktopPersonalizationState,
} from '../schemas/desktopPersonalizationSchemas';
import { usesDesktopStorage } from './desktopStorage';
import {
  clearPersonalizationIdb,
  loadPersonalizationFromIdb,
  savePersonalizationToIdb,
} from './desktopPersonalizationIdb';

export const PERSONALIZATION_STORAGE_KEY = 'marbleos-desktop-personalization-v1';
const LEGACY_THEME_KEY = 'marbleos-studio-theme-pref';

let pendingState: DesktopPersonalizationState | null = null;
let writeLoop: Promise<void> | null = null;

function readLegacyThemePreference(): 'system' | 'dark' | 'light' | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (saved === 'system' || saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore storage read error
  }
  return null;
}

export function hasCachedPersonalization(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readCachedPersonalization(): DesktopPersonalizationState {
  if (typeof window === 'undefined') return createDefaultPersonalizationState();
  try {
    const raw = window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
    if (!raw) {
      const defaults = createDefaultPersonalizationState();
      const legacyTheme = readLegacyThemePreference();
      if (!legacyTheme) return defaults;
      return {
        ...defaults,
        themePreference: legacyTheme,
        colorPalette: legacyTheme === 'light' ? 'alabaster-porcelain' : 'anthracite-pro',
      };
    }
    const parsed = desktopPersonalizationStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : createDefaultPersonalizationState();
  } catch {
    return createDefaultPersonalizationState();
  }
}

export function writeCachedPersonalization(state: DesktopPersonalizationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Depolama kotası dolu olsa da mevcut oturumda tercih korunur.
  }
}

export function clearCachedPersonalization(): void {
  pendingState = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PERSONALIZATION_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_THEME_KEY);
    } catch {
      // ignore
    }
  }
  void clearPersonalizationIdb();
}

async function writeDurableNow(state: DesktopPersonalizationState): Promise<void> {
  if (usesDesktopStorage) {
    await invoke('studio_save_personalization', {
      stateJson: JSON.stringify(state),
    });
    return;
  }
  await savePersonalizationToIdb(state);
}

export function queueDurablePersonalizationWrite(state: DesktopPersonalizationState): Promise<void> {
  pendingState = state;
  writeLoop ??= (async () => {
    while (pendingState) {
      const next = pendingState;
      pendingState = null;
      try {
        await writeDurableNow(next);
      } catch {
        // Disk geçici olarak meşgulse veya tarayıcı kotası doluysa yerel önbellek korunur.
      }
    }
  })().finally(() => {
    writeLoop = null;
  });
  return writeLoop;
}

export async function loadDurablePersonalization(): Promise<DesktopPersonalizationState | null> {
  try {
    if (usesDesktopStorage) {
      const rawJson = await invoke<string | null>('studio_load_personalization');
      if (!rawJson) return null;
      const parsed = desktopPersonalizationStateSchema.safeParse(JSON.parse(rawJson));
      return parsed.success ? parsed.data : null;
    }
    const raw = await loadPersonalizationFromIdb();
    if (!raw) return null;
    const parsed = desktopPersonalizationStateSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
