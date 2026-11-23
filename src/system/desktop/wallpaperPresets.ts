import type { BuiltinWallpaperId } from '../schemas/desktopPersonalizationSchemas';

export interface BuiltinWallpaperPreset {
  id: BuiltinWallpaperId;
  title: string;
  subtitle: string;
  swatchCss: string;
  fallbackDarkCss: string;
  fallbackLightCss: string;
}

export const BUILTIN_WALLPAPERS: readonly BuiltinWallpaperPreset[] = [
  {
    id: 'nero-marquina',
    title: 'Nero Marquina Mermer',
    subtitle: 'MarbleOS imza koyu taş ve sedef damar dokusu',
    swatchCss:
      'radial-gradient(circle at 24% 24%, rgba(226, 232, 240, 0.22), transparent 54%), linear-gradient(125deg, #16181e 0%, #242833 48%, #121419 100%)',
    fallbackDarkCss:
      'radial-gradient(62% 58% at 28% 26%, rgba(148, 163, 184, 0.14), transparent 65%), linear-gradient(135deg, #13151a 0%, #1d2029 52%, #111318 100%)',
    fallbackLightCss:
      'radial-gradient(62% 58% at 28% 26%, rgba(255, 255, 255, 0.5), transparent 65%), linear-gradient(135deg, #d7d5cf 0%, #c8c5bd 52%, #dddad3 100%)',
  },
  {
    id: 'carrara-alabaster',
    title: 'Carrara Alabaster',
    subtitle: 'Sıcak porselen mermer plakası ve yumuşak gri damarlar',
    swatchCss:
      'radial-gradient(circle at 72% 28%, rgba(255, 255, 255, 0.72), transparent 52%), linear-gradient(135deg, #e7e5de 0%, #f4f2ec 54%, #dcd9d0 100%)',
    fallbackDarkCss:
      'radial-gradient(60% 60% at 65% 30%, rgba(203, 213, 225, 0.14), transparent 64%), linear-gradient(135deg, #1e2128 0%, #272b34 50%, #191c22 100%)',
    fallbackLightCss:
      'radial-gradient(60% 60% at 65% 30%, rgba(255, 255, 255, 0.7), transparent 64%), linear-gradient(135deg, #edece7 0%, #e3e0d8 52%, #f3f2ed 100%)',
  },
  {
    id: 'nordic-mist',
    title: 'Kuzey Fiyordu & Sisli Dağlar',
    subtitle: 'Atmosferik alacakaranlık dağ silüeti ve göl yansıması',
    swatchCss:
      'linear-gradient(180deg, #1f2d42 0%, #374b63 48%, #1d2735 55%, #121821 100%)',
    fallbackDarkCss:
      'radial-gradient(60% 42% at 50% 24%, rgba(96, 165, 250, 0.16), transparent 68%), linear-gradient(180deg, #16202e 0%, #263447 46%, #18212d 68%, #11161f 100%)',
    fallbackLightCss:
      'radial-gradient(60% 42% at 50% 24%, rgba(255, 255, 255, 0.65), transparent 68%), linear-gradient(180deg, #cfd9e4 0%, #dde3ea 48%, #c5ced8 72%, #b4bfcc 100%)',
  },
  {
    id: 'studio-bokeh',
    title: 'Karanlık Oda & Gümüş Bokeh',
    subtitle: 'Prime objektiften safir, zümrüt ve gümüş ışık halkaları',
    swatchCss:
      'radial-gradient(circle at 28% 36%, rgba(56, 189, 248, 0.4), transparent 36%), radial-gradient(circle at 72% 62%, rgba(16, 185, 129, 0.34), transparent 38%), linear-gradient(145deg, #151822 0%, #1f2433 100%)',
    fallbackDarkCss:
      'radial-gradient(45% 45% at 28% 36%, rgba(59, 130, 246, 0.16), transparent 70%), radial-gradient(40% 40% at 72% 65%, rgba(16, 185, 129, 0.12), transparent 70%), linear-gradient(145deg, #13161e 0%, #1c202c 100%)',
    fallbackLightCss:
      'radial-gradient(45% 45% at 28% 36%, rgba(59, 130, 246, 0.15), transparent 70%), radial-gradient(40% 40% at 72% 65%, rgba(16, 185, 129, 0.12), transparent 70%), linear-gradient(145deg, #e7e5de 0%, #dce1ea 100%)',
  },
  {
    id: 'optic-iris',
    title: 'MarbleOS Optik Diyafram',
    subtitle: '9 bıçaklı hassas lens diyaframı ve vizör kadrajı',
    swatchCss:
      'radial-gradient(circle at 50% 50%, #273668 0%, #191c24 38%, #131418 100%)',
    fallbackDarkCss: 'linear-gradient(145deg, #131418 0%, #1a1d24 100%)',
    fallbackLightCss: 'linear-gradient(145deg, #eceae4 0%, #e1dfd8 100%)',
  },
  {
    id: 'polar-aurora',
    title: 'Kutup Işıkları',
    subtitle: 'Yıldızlı gece, zümrüt-mor aurora perdeleri ve dağ silüeti',
    swatchCss:
      'radial-gradient(70% 40% at 45% 32%, rgba(52, 211, 153, 0.45), transparent 70%), radial-gradient(40% 30% at 75% 22%, rgba(139, 92, 246, 0.35), transparent 70%), linear-gradient(180deg, #02040a 0%, #0b1d2c 72%, #03070d 100%)',
    fallbackDarkCss:
      'radial-gradient(70% 40% at 45% 32%, rgba(52, 211, 153, 0.2), transparent 70%), linear-gradient(180deg, #02040a 0%, #071224 55%, #03070d 100%)',
    fallbackLightCss:
      'radial-gradient(70% 40% at 45% 32%, rgba(52, 211, 153, 0.24), transparent 70%), linear-gradient(180deg, #1b2a4a 0%, #2f4f77 55%, #122033 100%)',
  },
  {
    id: 'graphite-silk',
    title: 'Grafit İpek Dalgalar',
    subtitle: 'Saf siyah zeminde safir ve gümüş ışıklı ipek şeritler',
    swatchCss:
      'radial-gradient(80% 26% at 50% 44%, rgba(56, 189, 248, 0.42), transparent 70%), radial-gradient(80% 22% at 50% 64%, rgba(148, 163, 184, 0.3), transparent 70%), linear-gradient(135deg, #000000 0%, #070a12 55%, #000000 100%)',
    fallbackDarkCss:
      'radial-gradient(80% 30% at 50% 50%, rgba(37, 99, 235, 0.2), transparent 70%), linear-gradient(135deg, #000000 0%, #070a12 55%, #000000 100%)',
    fallbackLightCss:
      'radial-gradient(80% 30% at 50% 50%, rgba(37, 99, 235, 0.16), transparent 70%), linear-gradient(135deg, #f1f3f7 0%, #dfe5ee 50%, #eef0f4 100%)',
  },
];

export function getBuiltinWallpaper(id: BuiltinWallpaperId): BuiltinWallpaperPreset {
  return BUILTIN_WALLPAPERS.find((item) => item.id === id) ?? BUILTIN_WALLPAPERS[0]!;
}

