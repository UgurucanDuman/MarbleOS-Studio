import type { PhotoAdjustments } from '../sqlite/types';

/**
 * İZOLE SİSTEM KATMANI: Stüdyo Karanlık Oda Renk, Işık ve Kadraj Matematiği
 * WebGL Shader (GpuPhotoPreview), CSS Fallback (StudioPhotoImage) ve 300 DPI Çıktı Motoru
 * bu dosyadaki sabitleri, hazır profilleri ve ton eğrisini ortak kullanır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const DEFAULT_PHOTO_ADJUSTMENTS: Required<PhotoAdjustments> = {
  zoom: 1,
  brightness: 100,
  contrast: 100,
  warmth: 0,
  rotation: 0,
  panX: 0,
  panY: 0,
  tilt: 0,
  shadows: 0,
  highlights: 0,
  saturation: 100,
  sharpen: 0,
};

export interface StudioDarkroomPreset {
  id: string;
  label: string;
  hint: string;
  recipe: Partial<PhotoAdjustments>;
}

export const STUDIO_DARKROOM_PRESETS: readonly StudioDarkroomPreset[] = [
  {
    id: 'natural',
    label: 'Doğal',
    hint: 'Sıfırla',
    recipe: { brightness: 100, contrast: 100, warmth: 0, shadows: 0, highlights: 0, saturation: 100, sharpen: 0 },
  },
  {
    id: 'auto-studio',
    label: 'Oto. Stüdyo',
    hint: 'Parlaklık',
    recipe: { brightness: 105, contrast: 104, warmth: 2, shadows: 14, highlights: -8, saturation: 104, sharpen: 10 },
  },
  {
    id: 'clean-white',
    label: 'Beyaz Fon',
    hint: 'Görsel',
    recipe: { brightness: 106, contrast: 107, warmth: -2, shadows: 10, highlights: 14, saturation: 100, sharpen: 8 },
  },
  {
    id: 'vivid-portrait',
    label: 'Canlı Portre',
    hint: 'Filtre',
    recipe: { brightness: 103, contrast: 106, warmth: 5, shadows: 12, highlights: -10, saturation: 112, sharpen: 14 },
  },
  {
    id: 'soft-flash',
    label: 'Yumuşak Flaş',
    hint: 'Parlaklık',
    recipe: { brightness: 102, contrast: 96, warmth: 3, shadows: 18, highlights: -22, saturation: 98, sharpen: 4 },
  },
  {
    id: 'monochrome',
    label: 'Siyah-Beyaz',
    hint: 'Filtre',
    recipe: { brightness: 103, contrast: 112, warmth: 0, shadows: 10, highlights: -10, saturation: 0, sharpen: 12 },
  },
];

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const round2 = (v: number) => Math.round(v * 100) / 100;

export function resolveFullAdjustments(adj: PhotoAdjustments): Required<PhotoAdjustments> {
  const rot = ((adj.rotation ?? 0) % 360 + 360) % 360;
  return {
    zoom: round3(adj.zoom),
    brightness: round2(adj.brightness),
    contrast: round2(adj.contrast),
    warmth: round2(adj.warmth),
    rotation: rot === 90 || rot === 180 || rot === 270 ? rot : 0,
    panX: round2(adj.panX ?? 0),
    panY: round2(adj.panY ?? 0),
    tilt: round2(adj.tilt ?? 0),
    shadows: round2(adj.shadows ?? 0),
    highlights: round2(adj.highlights ?? 0),
    saturation: round2(adj.saturation ?? 100),
    sharpen: round2(adj.sharpen ?? 0),
  };
}

const clampNum = (val: unknown, def: number, min: number, max: number) =>
  Math.min(max, Math.max(min, typeof val === 'number' && Number.isFinite(val) ? val : def));

/** Bozuk veya eski yerel kayıtlardaki ayar nesnesini güvenli sınırlar içinde onarır. */
export function healPhotoAdjustments(raw: unknown): PhotoAdjustments {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rot = a.rotation === 90 || a.rotation === 180 || a.rotation === 270 ? a.rotation : 0;
  return normalizePhotoAdjustments({
    zoom: clampNum(a.zoom, 1, 1, 2.5),
    brightness: clampNum(a.brightness, 100, 70, 135),
    contrast: clampNum(a.contrast, 100, 70, 135),
    warmth: clampNum(a.warmth, 0, -30, 30),
    rotation: rot,
    panX: clampNum(a.panX, 0, -45, 45),
    panY: clampNum(a.panY, 0, -45, 45),
    tilt: clampNum(a.tilt, 0, -10, 10),
    shadows: clampNum(a.shadows, 0, -30, 50),
    highlights: clampNum(a.highlights, 0, -50, 30),
    saturation: clampNum(a.saturation, 100, 0, 140),
    sharpen: clampNum(a.sharpen, 0, 0, 40),
  });
}
export function normalizePhotoAdjustments(adj: PhotoAdjustments): PhotoAdjustments {
  const full = resolveFullAdjustments(adj);
  return {
    zoom: full.zoom,
    brightness: full.brightness,
    contrast: full.contrast,
    warmth: full.warmth,
    ...(full.rotation ? { rotation: full.rotation } : {}),
    ...(full.panX ? { panX: full.panX } : {}),
    ...(full.panY ? { panY: full.panY } : {}),
    ...(full.tilt ? { tilt: full.tilt } : {}),
    ...(full.shadows ? { shadows: full.shadows } : {}),
    ...(full.highlights ? { highlights: full.highlights } : {}),
    ...(full.saturation !== 100 ? { saturation: full.saturation } : {}),
    ...(full.sharpen ? { sharpen: full.sharpen } : {}),
  };
}

export function arePhotoAdjustmentsEqual(a: PhotoAdjustments, b: PhotoAdjustments): boolean {
  const fa = resolveFullAdjustments(a);
  const fb = resolveFullAdjustments(b);
  return (
    fa.zoom === fb.zoom &&
    fa.brightness === fb.brightness &&
    fa.contrast === fb.contrast &&
    fa.warmth === fb.warmth &&
    fa.rotation === fb.rotation &&
    fa.panX === fb.panX &&
    fa.panY === fb.panY &&
    fa.tilt === fb.tilt &&
    fa.shadows === fb.shadows &&
    fa.highlights === fb.highlights &&
    fa.saturation === fb.saturation &&
    fa.sharpen === fb.sharpen
  );
}

export function isDefaultAdjustments(adj: PhotoAdjustments): boolean {
  return arePhotoAdjustmentsEqual(adj, DEFAULT_PHOTO_ADJUSTMENTS);
}

/**
 * Bir fotoğraftaki ışık/renk/netlik tarifini hedef fotoğrafa uygular.
 * copyFraming=false iken hedef öğrencinin bireysel yüz kadrajı (zoom/pan/rotation/tilt) korunur.
 */
export function mergePhotoRecipe(
  target: PhotoAdjustments,
  source: PhotoAdjustments,
  copyFraming = false,
): PhotoAdjustments {
  const s = resolveFullAdjustments(source);
  const t = resolveFullAdjustments(target);
  return normalizePhotoAdjustments({
    zoom: copyFraming ? s.zoom : t.zoom,
    panX: copyFraming ? s.panX : t.panX,
    panY: copyFraming ? s.panY : t.panY,
    rotation: copyFraming ? s.rotation : t.rotation,
    tilt: copyFraming ? s.tilt : t.tilt,
    brightness: s.brightness,
    contrast: s.contrast,
    warmth: s.warmth,
    shadows: s.shadows,
    highlights: s.highlights,
    saturation: s.saturation,
    sharpen: s.sharpen,
  });
}

/**
 * 0..1 aralığındaki doğrusal RGB kanalına karanlık oda ton eğrisini uygular (Canvas 300 DPI & testler için).
 */
export function applyToneToNormalizedRgb(
  rIn: number,
  gIn: number,
  bIn: number,
  full: Required<PhotoAdjustments>,
): [number, number, number] {
  const exp = full.brightness / 100;
  const con = full.contrast / 100;
  let r = (rIn * exp - 0.5) * con + 0.5;
  let g = (gIn * exp - 0.5) * con + 0.5;
  let b = (bIn * exp - 0.5) * con + 0.5;

  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (full.shadows !== 0) {
    const mask = Math.pow(1 - Math.min(1, Math.max(0, luma)), 2);
    const lift = (full.shadows / 100) * 0.48 * mask;
    r += lift;
    g += lift;
    b += lift;
  }
  if (full.highlights !== 0) {
    const mask = Math.pow(Math.min(1, Math.max(0, luma)), 2);
    const pull = (full.highlights / 100) * 0.45 * mask;
    r += pull;
    g += pull;
    b += pull;
  }
  if (full.warmth !== 0) {
    const w = full.warmth / 100;
    r += w * 0.24;
    g += w * 0.05;
    b -= w * 0.26;
  }
  if (full.saturation !== 100) {
    const sat = full.saturation / 100;
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [clamp(r), clamp(g), clamp(b)];
}
