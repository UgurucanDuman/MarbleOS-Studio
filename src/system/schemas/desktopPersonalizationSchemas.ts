import { z } from 'zod';
import {
  noUnsafeSingleLineChars,
  safeMultiLine,
  safeOptionalSingleLine,
  safeSingleLine,
} from './textSecurity';

export const BUILTIN_WALLPAPER_IDS = [
  'optic-iris',
  'nero-marquina',
  'carrara-alabaster',
  'nordic-mist',
  'studio-bokeh',
  'polar-aurora',
  'graphite-silk',
] as const;

export type BuiltinWallpaperId = (typeof BUILTIN_WALLPAPER_IDS)[number];

export const DESKTOP_WIDGET_IDS = [
  'clock-calendar',
  'studio-stats',
  'quick-note',
  'company-card',
] as const;

export type DesktopWidgetId = (typeof DESKTOP_WIDGET_IDS)[number];

export const STUDIO_COLOR_PALETTE_IDS = [
  'obsidian-black',
  'anthracite-pro',
  'sapphire-night',
  'emerald-studio',
  'amethyst-velvet',
  'ocean-lagoon',
  'crimson-velvet',
  'indigo-cosmos',
  'aurora-prism',
  'alabaster-porcelain',
  'glacier-daylight',
  'sage-botanic',
] as const;

export type StudioColorPaletteId = (typeof STUDIO_COLOR_PALETTE_IDS)[number];

export const STUDIO_THEME_PREFERENCES = ['system', 'dark', 'light'] as const;
export type StudioThemePreference = (typeof STUDIO_THEME_PREFERENCES)[number];

const phoneSchema = z
  .string()
  .transform((val) => val.normalize('NFC').trim())
  .pipe(
    z
      .string()
      .max(30, 'Telefon en fazla 30 karakter olabilir')
      .refine(noUnsafeSingleLineChars, 'Telefon geçersiz karakter içeriyor')
      .regex(/^[0-9+()\- ./]*$/, 'Telefon yalnızca rakam ve +, -, (, ), boşluk içerebilir'),
  );

export const companyProfileSchema = z
  .object({
    companyName: safeOptionalSingleLine(70, 'Şirket / fotoğrafhane adı').transform((v) => v ?? ''),
    ownerName: safeOptionalSingleLine(60, 'Yetkili adı').transform((v) => v ?? ''),
    phone: phoneSchema.default(''),
    address: safeMultiLine(240).default(''),
    logoAssetId: z.string().uuid().nullable().default(null),
  })
  .strict();

export type CompanyProfile = z.infer<typeof companyProfileSchema>;

export const desktopWidgetPositionSchema = z
  .object({
    x: z.number().finite().min(0).max(10000),
    y: z.number().finite().min(0).max(10000),
  })
  .strict();

export type DesktopWidgetPosition = z.infer<typeof desktopWidgetPositionSchema>;

export const desktopWidgetPositionsSchema = z
  .object({
    'clock-calendar': desktopWidgetPositionSchema.optional(),
    'studio-stats': desktopWidgetPositionSchema.optional(),
    'quick-note': desktopWidgetPositionSchema.optional(),
    'company-card': desktopWidgetPositionSchema.optional(),
  })
  .strict()
  .default({});

export type DesktopWidgetPositions = z.infer<typeof desktopWidgetPositionsSchema>;

export const wallpaperSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('builtin'), presetId: z.enum(BUILTIN_WALLPAPER_IDS) }).strict(),
  z.object({ kind: z.literal('custom'), customId: z.string().uuid('Geçersiz duvar kağıdı kimliği') }).strict(),
]);

export type WallpaperSelection = z.infer<typeof wallpaperSelectionSchema>;

export const customWallpaperMetaSchema = z
  .object({
    id: z.string().uuid(),
    name: safeSingleLine(1, 100, 'Duvar kağıdı adı gerekli'),
    createdAt: z.string().min(1).max(50),
  })
  .strict();

export const desktopPersonalizationStateSchema = z
  .object({
    themePreference: z.enum(STUDIO_THEME_PREFERENCES).default('system'),
    colorPalette: z.enum(STUDIO_COLOR_PALETTE_IDS).default('anthracite-pro'),
    company: companyProfileSchema,
    wallpaper: wallpaperSelectionSchema,
    customWallpapers: z.array(customWallpaperMetaSchema).max(12),
    enabledWidgets: z
      .array(z.enum(DESKTOP_WIDGET_IDS))
      .max(4)
      .transform((items) => Array.from(new Set(items))),
    widgetPositions: desktopWidgetPositionsSchema,
    quickNote: safeMultiLine(600),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.wallpaper.kind === 'custom') {
      const targetId = val.wallpaper.customId;
      if (!val.customWallpapers.some((item) => item.id === targetId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Seçili özel duvar kağıdı kaydı bulunamadı.',
          path: ['wallpaper'],
        });
      }
    }
  });

export type DesktopPersonalizationState = z.infer<typeof desktopPersonalizationStateSchema>;

export function createDefaultPersonalizationState(): DesktopPersonalizationState {
  return {
    themePreference: 'system',
    colorPalette: 'anthracite-pro',
    company: {
      companyName: '',
      ownerName: '',
      phone: '',
      address: '',
      logoAssetId: null,
    },
    wallpaper: { kind: 'builtin', presetId: 'nero-marquina' },
    customWallpapers: [],
    enabledWidgets: [],
    widgetPositions: {},
    quickNote: '',
  };
}
