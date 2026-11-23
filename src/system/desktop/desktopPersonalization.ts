import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  companyProfileSchema,
  createDefaultPersonalizationState,
  desktopPersonalizationStateSchema,
  desktopWidgetPositionSchema,
  type BuiltinWallpaperId,
  type CompanyProfile,
  type DesktopPersonalizationState,
  type DesktopWidgetId,
  type DesktopWidgetPosition,
  type StudioColorPaletteId,
  type StudioThemePreference,
} from '../schemas/desktopPersonalizationSchemas';
import { safeMultiLine } from '../schemas/textSecurity';
import { findPaletteMeta } from '../theme/themePalettes';
import {
  clearCachedPersonalization,
  hasCachedPersonalization,
  loadDurablePersonalization,
  queueDurablePersonalizationWrite,
  readCachedPersonalization,
  writeCachedPersonalization,
} from './desktopPersonalizationPersistence';
import {
  clearCustomWallpaperMemoryCache,
  deleteCompanyLogoBlob,
  deleteCustomWallpaperBlob,
  loadCompanyLogoDataUrl,
  saveCompanyLogoBlob,
  saveCustomWallpaperBlob,
} from './wallpaperCustomStore';

const listeners = new Set<() => void>();
let state: DesktopPersonalizationState = readCachedPersonalization();
let startupPromise: Promise<void> | undefined;

function publish() {
  listeners.forEach((fn) => fn());
}

function commit(next: DesktopPersonalizationState) {
  const validated = desktopPersonalizationStateSchema.parse(next);
  writeCachedPersonalization(validated);
  state = validated;
  publish();
  void queueDurablePersonalizationWrite(validated);
}

export function startDesktopPersonalization(): Promise<void> {
  startupPromise ??= loadDurablePersonalization().then((durable) => {
    if (durable) {
      if (JSON.stringify(durable) === JSON.stringify(state)) {
        if (!hasCachedPersonalization()) writeCachedPersonalization(durable);
        return;
      }
      state = durable;
      writeCachedPersonalization(durable);
      publish();
      return;
    }
    if (hasCachedPersonalization()) void queueDurablePersonalizationWrite(state);
  });
  return startupPromise;
}

export function getDesktopPersonalizationState(): DesktopPersonalizationState {
  return state;
}

export function selectStudioColorPalette(paletteId: StudioColorPaletteId): void {
  const meta = findPaletteMeta(paletteId);
  commit({
    ...state,
    colorPalette: meta.id,
    themePreference: meta.baseTheme,
  });
}

export function selectStudioThemePreference(pref: StudioThemePreference): void {
  const currentMeta = findPaletteMeta(state.colorPalette);
  let nextPalette = state.colorPalette;
  if (pref === 'dark' && currentMeta.baseTheme !== 'dark') {
    nextPalette = 'anthracite-pro';
  } else if (pref === 'light' && currentMeta.baseTheme !== 'light') {
    nextPalette = 'alabaster-porcelain';
  }
  commit({
    ...state,
    themePreference: pref,
    colorPalette: nextPalette,
  });
}

export function updateCompanyProfile(
  input: Omit<CompanyProfile, 'logoAssetId'> & { logoAssetId?: string | null },
): CompanyProfile {
  const clean = companyProfileSchema.parse({
    ...input,
    logoAssetId: input.logoAssetId !== undefined ? input.logoAssetId : state.company.logoAssetId,
  });
  commit({ ...state, company: clean });
  return clean;
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  const assetId = crypto.randomUUID();
  const dataUrl = await saveCompanyLogoBlob(assetId, file);
  const prevId = state.company.logoAssetId;
  commit({
    ...state,
    company: { ...state.company, logoAssetId: assetId },
  });
  if (prevId && prevId !== assetId) {
    void deleteCompanyLogoBlob(prevId);
  }
  return dataUrl;
}

export function removeCompanyLogo(): void {
  const prevId = state.company.logoAssetId;
  if (!prevId) return;
  commit({
    ...state,
    company: { ...state.company, logoAssetId: null },
  });
  void deleteCompanyLogoBlob(prevId);
}

export function selectBuiltinWallpaper(presetId: BuiltinWallpaperId): void {
  commit({ ...state, wallpaper: { kind: 'builtin', presetId } });
}

export function selectCustomWallpaper(customId: string): void {
  if (!state.customWallpapers.some((item) => item.id === customId)) {
    throw new Error('Seçilen özel duvar kağıdı bulunamadı.');
  }
  commit({ ...state, wallpaper: { kind: 'custom', customId } });
}

export async function uploadAndSelectCustomWallpaper(file: File): Promise<{ id: string; name: string }> {
  const id = crypto.randomUUID();
  const baseName = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 80) || 'Özel Duvar Kağıdı';
  await saveCustomWallpaperBlob(id, file);
  const meta = { id, name: baseName, createdAt: new Date().toISOString() };
  const remaining = state.customWallpapers.slice(0, 11);
  commit({
    ...state,
    customWallpapers: [meta, ...remaining],
    wallpaper: { kind: 'custom', customId: id },
  });
  return meta;
}

export function removeCustomWallpaper(customId: string): void {
  const customWallpapers = state.customWallpapers.filter((item) => item.id !== customId);
  const wallpaper = state.wallpaper.kind === 'custom' && state.wallpaper.customId === customId
    ? { kind: 'builtin' as const, presetId: 'nero-marquina' as const }
    : state.wallpaper;
  commit({ ...state, customWallpapers, wallpaper });
  void deleteCustomWallpaperBlob(customId);
}

export function toggleDesktopWidget(widgetId: DesktopWidgetId): boolean {
  const exists = state.enabledWidgets.includes(widgetId);
  const enabledWidgets = exists
    ? state.enabledWidgets.filter((item) => item !== widgetId)
    : [...state.enabledWidgets, widgetId];
  commit({ ...state, enabledWidgets });
  return !exists;
}

export function updateDesktopWidgetPosition(widgetId: DesktopWidgetId, pos: DesktopWidgetPosition): void {
  const cleanPos = desktopWidgetPositionSchema.parse({
    x: Math.max(0, Math.min(10000, Math.round(pos.x))),
    y: Math.max(0, Math.min(10000, Math.round(pos.y))),
  });
  commit({
    ...state,
    widgetPositions: { ...state.widgetPositions, [widgetId]: cleanPos },
  });
}

export function resetDesktopWidgetPositions(): void {
  if (Object.keys(state.widgetPositions).length === 0) return;
  commit({ ...state, widgetPositions: {} });
}

export function updateDesktopQuickNote(rawNote: string): void {
  const quickNote = safeMultiLine(600).parse(rawNote);
  commit({ ...state, quickNote });
}

export function clearDesktopQuickNote(): void {
  if (!state.quickNote) return;
  commit({ ...state, quickNote: '' });
}

export function resetDesktopPersonalizationForTests(): void {
  startupPromise = undefined;
  clearCustomWallpaperMemoryCache();
  clearCachedPersonalization();
  state = createDefaultPersonalizationState();
  publish();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDesktopPersonalization(): DesktopPersonalizationState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useCompanyProfile(): CompanyProfile {
  return useSyncExternalStore(subscribe, () => state.company);
}

export function useCompanyLogoUrl(): string | null {
  const assetId = useSyncExternalStore(subscribe, () => state.company.logoAssetId);
  const [resolved, setResolved] = useState<{ id: string | null; url: string | null }>({ id: null, url: null });

  useEffect(() => {
    let active = true;
    if (!assetId) {
      setResolved({ id: null, url: null });
      return () => { active = false; };
    }
    void loadCompanyLogoDataUrl(assetId).then((url) => {
      if (active) setResolved({ id: assetId, url });
    });
    return () => { active = false; };
  }, [assetId]);

  return assetId && resolved.id === assetId ? resolved.url : null;
}
