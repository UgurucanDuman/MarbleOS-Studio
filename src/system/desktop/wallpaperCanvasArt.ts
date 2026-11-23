import type { BuiltinWallpaperId } from '../schemas/desktopPersonalizationSchemas';
import type { ResolvedTheme } from '../theme/useStudioTheme';
import {
  ART_HEIGHT,
  ART_WIDTH,
  mulberry32,
  paintNordicMist,
  paintStudioBokeh,
} from './wallpaperScenePainters';
import { paintGraphiteSilk, paintPolarAurora } from './wallpaperExtraPainters';

const artCache = new Map<string, string>();

function drawVein(
  ctx: CanvasRenderingContext2D,
  rand: () => number,
  x0: number,
  y0: number,
  angle: number,
  steps: number,
  width: number,
  color: string,
  allowBranch: boolean,
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  let x = x0;
  let y = y0;
  let a = angle;
  for (let i = 0; i < steps; i++) {
    a += (rand() - 0.5) * 0.34;
    const stepLen = 18 + rand() * 24;
    x += Math.cos(a) * stepLen;
    y += Math.sin(a) * stepLen;
    ctx.lineTo(x, y);
    if (allowBranch && i > 6 && i < steps - 6 && rand() > 0.87) {
      drawVein(ctx, rand, x, y, a + (rand() > 0.5 ? 0.55 : -0.55), Math.floor(steps * 0.42), width * 0.48, color, false);
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function paintMarble(ctx: CanvasRenderingContext2D, isCarrara: boolean, theme: ResolvedTheme) {
  const rand = mulberry32(isCarrara ? 4109 : 9073);
  const darkBase = !isCarrara || theme === 'dark';
  const bg = ctx.createLinearGradient(0, 0, ART_WIDTH, ART_HEIGHT);
  if (isCarrara && theme === 'light') {
    bg.addColorStop(0, '#f2f0ea');
    bg.addColorStop(0.5, '#e6e3db');
    bg.addColorStop(1, '#edeae3');
  } else if (isCarrara) {
    bg.addColorStop(0, '#1f2229');
    bg.addColorStop(0.55, '#292d36');
    bg.addColorStop(1, '#181a20');
  } else if (theme === 'light') {
    bg.addColorStop(0, '#d7d5ce');
    bg.addColorStop(0.5, '#c8c5bd');
    bg.addColorStop(1, '#dedbd4');
  } else {
    bg.addColorStop(0, '#14161c');
    bg.addColorStop(0.5, '#1c1f27');
    bg.addColorStop(1, '#111318');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);

  for (let i = 0; i < 16; i++) {
    const cx = rand() * ART_WIDTH;
    const cy = rand() * ART_HEIGHT;
    const r = 180 + rand() * 340;
    const g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    const tint = isCarrara && theme === 'light'
      ? (i % 2 === 0 ? 'rgba(255, 255, 255, 0.34)' : 'rgba(120, 128, 142, 0.14)')
      : darkBase
        ? (i % 2 === 0 ? 'rgba(148, 163, 184, 0.09)' : 'rgba(10, 12, 16, 0.24)')
        : 'rgba(255, 255, 255, 0.26)';
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ART_WIDTH, ART_HEIGHT);
  }

  const primaryVein = isCarrara && theme === 'light'
    ? 'rgba(84, 92, 106, 0.28)'
    : theme === 'light'
      ? 'rgba(42, 46, 56, 0.3)'
      : 'rgba(226, 232, 240, 0.24)';
  const accentVein = isCarrara && theme === 'light'
    ? 'rgba(255, 255, 255, 0.65)'
    : 'rgba(212, 198, 172, 0.2)';

  for (let i = 0; i < 11; i++) {
    const startX = -120 + rand() * (ART_WIDTH * 0.45);
    const startY = rand() * ART_HEIGHT;
    drawVein(ctx, rand, startX, startY, -0.35 + rand() * 0.7, 56, 1.4 + rand() * 2.2, primaryVein, true);
  }
  for (let i = 0; i < 6; i++) {
    drawVein(ctx, rand, rand() * ART_WIDTH * 0.6, rand() * ART_HEIGHT, -0.45 + rand() * 0.85, 42, 0.9 + rand() * 1.1, accentVein, true);
  }
}

export function getCachedPresetWallpaperDataUrl(
  presetId: BuiltinWallpaperId,
  theme: ResolvedTheme,
): string | null {
  if (presetId === 'optic-iris') return null;
  return artCache.get(`${presetId}:${theme}`) ?? null;
}

export function renderPresetWallpaperDataUrl(
  presetId: BuiltinWallpaperId,
  theme: ResolvedTheme,
): string | null {
  if (presetId === 'optic-iris' || typeof document === 'undefined') return null;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return null;

  const key = `${presetId}:${theme}`;
  const cached = artCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = ART_WIDTH;
  canvas.height = ART_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (presetId === 'nero-marquina') paintMarble(ctx, false, theme);
  else if (presetId === 'carrara-alabaster') paintMarble(ctx, true, theme);
  else if (presetId === 'nordic-mist') paintNordicMist(ctx, theme);
  else if (presetId === 'polar-aurora') paintPolarAurora(ctx, theme);
  else if (presetId === 'graphite-silk') paintGraphiteSilk(ctx, theme);
  else paintStudioBokeh(ctx, theme);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  artCache.set(key, dataUrl);
  return dataUrl;
}

export function schedulePresetWallpaperDataUrl(
  presetId: BuiltinWallpaperId,
  theme: ResolvedTheme,
  onReady: (dataUrl: string | null) => void,
): () => void {
  if (presetId === 'optic-iris' || typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return () => {};
  }
  const existing = artCache.get(`${presetId}:${theme}`);
  if (existing) {
    onReady(existing);
    return () => {};
  }
  let timerId: number | null = null;
  const rafId = window.requestAnimationFrame(() => {
    timerId = window.setTimeout(() => {
      onReady(renderPresetWallpaperDataUrl(presetId, theme));
    }, 0);
  });
  return () => {
    window.cancelAnimationFrame(rafId);
    if (timerId !== null) window.clearTimeout(timerId);
  };
}
