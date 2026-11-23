import {
  KUTUK_SCOPE_MODES,
  KUTUK_TEMPLATE_IDS,
  type KutukScopeMode,
  type KutukTemplateId,
  type KutukTemplateSpec,
} from './types';

export {
  DEFAULT_KUTUK_NAME_BOX_STYLE,
  DEFAULT_KUTUK_PHOTO_FRAME,
  hexToRgba,
  isValidKutukNameBoxStyle,
  isValidKutukPhotoFrame,
  KUTUK_COL_CHOICES,
  KUTUK_FRAME_COLOR_SWATCHES,
  KUTUK_GROUP_META,
  KUTUK_LANDSCAPE_COL_CHOICES,
  KUTUK_LANDSCAPE_ROW_CHOICES,
  KUTUK_NAME_BOX_STYLE_META,
  KUTUK_PHOTO_FRAME_META,
  KUTUK_ROW_CHOICES,
} from './styleCatalog';

/**
 * İZOLE SİSTEM KATALOĞU: Müdür Yardımcısı / İdareci Kütük Dosyası & Sınıf Albümü Şablonları
 * Dikeyde 4–7 sütun, yatayda 6–10 sütun (40–50 portre/sayfa) esnek kütük ızgarasını destekler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const DEFAULT_KUTUK_TEMPLATE_ID: KutukTemplateId = 'kutuk-portrait-30';
export const DEFAULT_KUTUK_SCOPE_MODE: KutukScopeMode = 'all-classes';

export const KUTUK_TEMPLATES: readonly KutukTemplateSpec[] = [
  {
    id: 'kutuk-portrait-25',
    group: 'portrait',
    name: 'Ferah Portreli Kütük (25 Öğrenci)',
    shortBadge: '5×5 · Dikey',
    subtitle: 'Büyük portre, okul numarası ve tam ad soyad (25 ve altı şubeler)',
    officialTitle: 'ÖĞRENCİ KÜTÜK VE SINIF FOTOĞRAF DOSYASI',
    landscape: false,
    isCover: false,
    cols: 5,
    rows: 5,
    studentsPerPage: 25,
  },
  {
    id: 'kutuk-portrait-30',
    group: 'portrait',
    name: 'Standart İdareci Kütüğü (30 Öğrenci)',
    shortBadge: '5×6 · Dikey',
    subtitle: 'Müdür yardımcısı telli klasör standardı; sol delik payı korunmuş 5×6 dizgi',
    officialTitle: 'ÖĞRENCİ KÜTÜK VE SINIF FOTOĞRAF DOSYASI',
    landscape: false,
    isCover: false,
    cols: 5,
    rows: 6,
    studentsPerPage: 30,
  },
  {
    id: 'kutuk-portrait-35',
    group: 'portrait',
    name: '7 Sütunlu Sınıf Kütüğü (35 Öğrenci)',
    shortBadge: '7×5 · Dikey',
    subtitle: 'Soldan sağa 7 portre × 5 satır; 31–35 kişilik şubeleri tek A4 sayfaya sığdırır',
    officialTitle: 'ÖĞRENCİ KÜTÜK VE SINIF FOTOĞRAF DOSYASI',
    landscape: false,
    isCover: false,
    cols: 7,
    rows: 5,
    studentsPerPage: 35,
  },
  {
    id: 'kutuk-portrait-49',
    group: 'portrait',
    name: 'Geniş 7×7 Kütük (49 Öğrenci)',
    shortBadge: '7×7 · Dikey',
    subtitle: 'Soldan sağa 7 × yukarıdan aşağı 7; en kalabalık sınıflar tek A4 sayfada',
    officialTitle: 'ÖĞRENCİ KÜTÜK VE SINIF FOTOĞRAF DOSYASI',
    landscape: false,
    isCover: false,
    cols: 7,
    rows: 7,
    studentsPerPage: 49,
  },
  {
    id: 'kutuk-landscape-24',
    group: 'landscape',
    name: 'Yatay Sınıf Albümü (24 Öğrenci)',
    shortBadge: '6×4 · Yatay',
    subtitle: 'Geniş A4 yatay yaprakta 6×4 ferah portre, okul numarası ve isim dizgisi',
    officialTitle: 'SINIF FOTOĞRAF ALBÜMÜ VE ÖĞRENCİ KÜTÜĞÜ',
    landscape: true,
    isCover: false,
    cols: 6,
    rows: 4,
    studentsPerPage: 24,
  },
  {
    id: 'kutuk-landscape-30',
    group: 'landscape',
    name: 'Geniş Yatay Kütük (30 Öğrenci)',
    shortBadge: '6×5 · Yatay',
    subtitle: 'A4 yatay 6×5 idareci sınıf fotoğraf tablosu',
    officialTitle: 'SINIF FOTOĞRAF ALBÜMÜ VE ÖĞRENCİ KÜTÜĞÜ',
    landscape: true,
    isCover: false,
    cols: 6,
    rows: 5,
    studentsPerPage: 30,
  },
  {
    id: 'kutuk-landscape-35',
    group: 'landscape',
    name: '7 Sütunlu Yatay Albüm (35 Öğrenci)',
    shortBadge: '7×5 · Yatay',
    subtitle: 'Soldan sağa 7 portre × 5 satır; sıkı aralıklı yatay sınıf albümü',
    officialTitle: 'SINIF FOTOĞRAF ALBÜMÜ VE ÖĞRENCİ KÜTÜĞÜ',
    landscape: true,
    isCover: false,
    cols: 7,
    rows: 5,
    studentsPerPage: 35,
  },
  {
    id: 'kutuk-landscape-40',
    group: 'landscape',
    name: 'Kompakt Yatay Kütük (40 Öğrenci)',
    shortBadge: '10×4 · Yatay',
    subtitle: 'Soldan sağa 10 × 4 satır; minimum boşlukla tam 3:4 oranında 40 portre',
    officialTitle: 'SINIF FOTOĞRAF ALBÜMÜ VE ÖĞRENCİ KÜTÜĞÜ',
    landscape: true,
    isCover: false,
    cols: 10,
    rows: 4,
    studentsPerPage: 40,
  },
  {
    id: 'kutuk-landscape-50',
    group: 'landscape',
    name: 'Geniş Yatay Kütük (50 Öğrenci)',
    shortBadge: '10×5 · Yatay',
    subtitle: 'Soldan sağa 10 × 5 satır; en kalabalık şubeler tek A4 yatay sayfada',
    officialTitle: 'SINIF FOTOĞRAF ALBÜMÜ VE ÖĞRENCİ KÜTÜĞÜ',
    landscape: true,
    isCover: false,
    cols: 10,
    rows: 5,
    studentsPerPage: 50,
  },
  {
    id: 'kutuk-cover-portrait',
    group: 'cover',
    name: 'Dikey Kütük Dosyası Ön Kapağı',
    shortBadge: 'A4 Dikey Kapak',
    subtitle: 'Okul logosu, kurum adı, sorumlu müdür yardımcısı ve şube özeti kapak sayfası',
    officialTitle: 'İDARECİ ÖĞRENCİ KÜTÜK VE SINIF ALBÜM DOSYASI',
    landscape: false,
    isCover: true,
    cols: 1,
    rows: 1,
    studentsPerPage: 0,
  },
  {
    id: 'kutuk-cover-landscape',
    group: 'cover',
    name: 'Yatay Sınıf Albümü Ön Kapağı',
    shortBadge: 'A4 Yatay Kapak',
    subtitle: 'Yatay sınıf albümü klasörü için resmi okul ve idareci teslim kapağı',
    officialTitle: 'İDARECİ ÖĞRENCİ KÜTÜK VE SINIF ALBÜM DOSYASI',
    landscape: true,
    isCover: true,
    cols: 1,
    rows: 1,
    studentsPerPage: 0,
  },
];

const TEMPLATE_ID_SET = new Set<string>(KUTUK_TEMPLATE_IDS);
const SCOPE_MODE_SET = new Set<string>(KUTUK_SCOPE_MODES);

export function isValidKutukTemplateId(val: unknown): val is KutukTemplateId {
  return typeof val === 'string' && TEMPLATE_ID_SET.has(val);
}

export function isValidKutukScopeMode(val: unknown): val is KutukScopeMode {
  return typeof val === 'string' && SCOPE_MODE_SET.has(val);
}

export function resolveKutukTemplate(
  templateId?: string,
  forceOrientation?: 'portrait' | 'landscape',
  customCols?: number,
  customRows?: number,
): KutukTemplateSpec {
  const effectiveId = templateId ?? DEFAULT_KUTUK_TEMPLATE_ID;
  const found =
    KUTUK_TEMPLATES.find((t) => t.id === effectiveId) ??
    KUTUK_TEMPLATES.find((t) => t.id === DEFAULT_KUTUK_TEMPLATE_ID) ??
    KUTUK_TEMPLATES[0]!;
  let resolved = found;
  if (forceOrientation) {
    const wantLandscape = forceOrientation === 'landscape';
    if (found.landscape !== wantLandscape) {
      resolved = found.isCover
        ? (KUTUK_TEMPLATES.find((t) => t.isCover && t.landscape === wantLandscape) ?? found)
        : (KUTUK_TEMPLATES.find((t) => !t.isCover && t.landscape === wantLandscape && t.studentsPerPage === found.studentsPerPage) ??
          KUTUK_TEMPLATES.find((t) => !t.isCover && t.landscape === wantLandscape && t.studentsPerPage === 30) ??
          KUTUK_TEMPLATES.find((t) => !t.isCover && t.landscape === wantLandscape) ??
          found);
    }
  }
  if (resolved.isCover) return resolved;
  const maxCols = resolved.landscape ? 10 : 7;
  const cols =
    typeof customCols === 'number' && Number.isInteger(customCols) && customCols >= 3 && customCols <= 10
      ? Math.min(customCols, maxCols)
      : resolved.cols;
  const rows =
    typeof customRows === 'number' && Number.isInteger(customRows) && customRows >= 3 && customRows <= 7
      ? customRows
      : resolved.rows;
  if (cols === resolved.cols && rows === resolved.rows) return resolved;
  return {
    ...resolved,
    cols,
    rows,
    studentsPerPage: cols * rows,
    shortBadge: `${cols}×${rows} · ${resolved.landscape ? 'Yatay' : 'Dikey'}`,
  };
}
