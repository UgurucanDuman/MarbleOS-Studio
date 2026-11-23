import {
  KUTUK_NAME_BOX_STYLES,
  KUTUK_PHOTO_FRAMES,
  type KutukNameBoxStyle,
  type KutukPhotoFrame,
  type KutukTemplateGroupMeta,
} from './types';

/**
 * İZOLE SİSTEM KATALOĞU: Kütük Grup Metaları, Kart Stilleri, Çerçeve Kesimleri ve Renk Paleti
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const DEFAULT_KUTUK_NAME_BOX_STYLE: KutukNameBoxStyle = 'apple-soft';
export const DEFAULT_KUTUK_PHOTO_FRAME: KutukPhotoFrame = 'rounded';
export const KUTUK_COL_CHOICES = [4, 5, 6, 7] as const;
export const KUTUK_ROW_CHOICES = [4, 5, 6, 7] as const;
export const KUTUK_LANDSCAPE_COL_CHOICES = [6, 7, 8, 9, 10] as const;
export const KUTUK_LANDSCAPE_ROW_CHOICES = [3, 4, 5, 6] as const;

export const KUTUK_GROUP_META: readonly KutukTemplateGroupMeta[] = [
  {
    id: 'portrait',
    label: 'A4 Dikey Klasör Kütüğü',
    description: 'Telli dosya ve şeffaf föy uyumlu idareci sınıf kütük sayfaları',
  },
  {
    id: 'landscape',
    label: 'A4 Yatay Sınıf Albümü',
    description: 'Geniş yatay sınıf fotoğraf albümü ve 40–50 portreli kompakt kütük',
  },
  {
    id: 'cover',
    label: 'Kütük Dosyası Kapağı',
    description: 'Müdür yardımcısına teslim edilen klasörün resmi ön kapak kalıbı',
  },
];

export const KUTUK_NAME_BOX_STYLE_META: ReadonlyArray<{
  id: KutukNameBoxStyle;
  label: string;
  description: string;
}> = [
  { id: 'apple-soft', label: 'Apple Kutu', description: 'Tek yumuşak çerçeveli tam kenar portre ve zarif isim alanı' },
  { id: 'filled-band', label: 'Renkli Bant', description: 'İç çerçevesiz tam kenar portre ve renkli alt isim şeridi' },
  { id: 'minimal-clean', label: 'Saf Minimal', description: 'Dış kutusuz ferah portre ve altında uyumlu isim kutusu' },
  { id: 'classic-grid', label: 'Klasik Kütük', description: 'Tek çizgili resmi kütük hücresi ve net ayırıcı' },
];

export const KUTUK_PHOTO_FRAME_META: ReadonlyArray<{
  id: KutukPhotoFrame;
  label: string;
}> = [
  { id: 'rounded', label: 'Yumuşak' },
  { id: 'sharp', label: 'Keskin' },
  { id: 'double-frame', label: 'Paspartulu' },
  { id: 'frameless', label: 'Çerçevesiz' },
];

export const KUTUK_FRAME_COLOR_SWATCHES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'MEB Laciverti', hex: '#1b365d' },
  { name: 'Saf Antrasit', hex: '#18181b' },
  { name: 'Kraliyet Mavisi', hex: '#1d4ed8' },
  { name: 'Selçuklu Turkuazı', hex: '#0f5c6e' },
  { name: 'Zümrüt Yeşili', hex: '#14532d' },
  { name: 'Çam Yeşili', hex: '#365314' },
  { name: 'Gece İndigosu', hex: '#312e81' },
  { name: 'Mürdüm Moru', hex: '#581c87' },
  { name: 'Vişne Bordo', hex: '#881337' },
  { name: 'Anadolu Bordosu', hex: '#6b1d2f' },
  { name: 'Kuzey Çeliği', hex: '#334155' },
  { name: 'Krom Gri', hex: '#52525b' },
];

const NAME_BOX_SET = new Set<string>(KUTUK_NAME_BOX_STYLES);
const PHOTO_FRAME_SET = new Set<string>(KUTUK_PHOTO_FRAMES);

export function isValidKutukNameBoxStyle(val: unknown): val is KutukNameBoxStyle {
  return typeof val === 'string' && NAME_BOX_SET.has(val);
}

export function isValidKutukPhotoFrame(val: unknown): val is KutukPhotoFrame {
  return typeof val === 'string' && PHOTO_FRAME_SET.has(val);
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.slice(1) : '1b365d';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
