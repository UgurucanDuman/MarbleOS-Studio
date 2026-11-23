import type { TeacherChartPalette } from '../teacher-charts/types';
import type {
  PvcArtworkStyle,
  PvcCardDataContext,
  PvcCodeSource,
  PvcFieldKey,
  PvcFontFamily,
} from './types';

/**
 * İZOLE SİSTEM KATMANI: PVC Kimlik Kartı Dinamik Alan Çözücü (Öğrenci, Okul & Fotoğrafçı Stüdyo)
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const DEFAULT_PVC_HEADER_TOP_TEXT = 'T.C. MİLLÎ EĞİTİM BAKANLIĞI';
export const DEFAULT_PVC_BACK_NOTE =
  'Bu kimlik kartı kişiye özeldir. Kaybolması hâlinde okul idaresine teslim edilmesi rica olunur.';

export const PVC_FIELD_META: ReadonlyArray<{
  key: PvcFieldKey;
  label: string;
  group: 'student' | 'school' | 'studio';
  placeholder: string;
}> = [
    { key: 'fullName', label: 'Ad Soyad', group: 'student', placeholder: '[AD SOYAD]' },
    { key: 'firstName', label: 'Ad', group: 'student', placeholder: '[AD]' },
    { key: 'lastName', label: 'Soyad', group: 'student', placeholder: '[SOYAD]' },
    { key: 'studentNumber', label: 'Okul No', group: 'student', placeholder: '[OKUL NO]' },
    { key: 'className', label: 'Sınıf / Şube', group: 'student', placeholder: '[SINIF]' },
    { key: 'classAndNumber', label: 'Sınıf & Okul No', group: 'student', placeholder: '[SINIF · NO]' },
    { key: 'role', label: 'Görevi / Branş', group: 'student', placeholder: '[GÖREVİ]' },
    { key: 'department', label: 'Bölümü / Alanı', group: 'student', placeholder: '[BÖLÜMÜ]' },
    { key: 'nationalId', label: 'T.C. Kimlik No', group: 'student', placeholder: '[T.C. KİMLİK]' },
    { key: 'bloodType', label: 'Kan Grubu', group: 'student', placeholder: '[KAN GRUBU]' },
    { key: 'birthDate', label: 'Doğum Tarihi', group: 'student', placeholder: '[DOĞUM TAR.]' },
    { key: 'birthPlace', label: 'Doğum Yeri', group: 'student', placeholder: '[DOĞUM YERİ]' },
    { key: 'birthInfo', label: 'Doğum Yeri / Tarihi', group: 'student', placeholder: '[DOĞUM BİLGİSİ]' },
    { key: 'fatherName', label: 'Baba Adı', group: 'student', placeholder: '[BABA ADI]' },
    { key: 'motherName', label: 'Anne Adı', group: 'student', placeholder: '[ANNE ADI]' },
    { key: 'registryNo', label: 'Sicil No', group: 'student', placeholder: '[SİCİL NO]' },
    { key: 'schoolName', label: 'Okul Adı', group: 'school', placeholder: '[OKUL ADI]' },
    { key: 'schoolAddress', label: 'Okul Adresi', group: 'school', placeholder: '[OKUL ADRESİ]' },
    { key: 'academicYear', label: 'Eğitim Yılı', group: 'school', placeholder: '2026-2027' },
    { key: 'cardTitle', label: 'Kart Başlığı', group: 'school', placeholder: 'ÖĞRENCİ KİMLİK KARTI' },
    { key: 'studioName', label: 'Fotoğrafhane Adı', group: 'studio', placeholder: 'Fotoğraf Stüdyosu' },
    { key: 'studioOwner', label: 'Fotoğrafçı / Yetkili', group: 'studio', placeholder: '[YETKİLİ ADI]' },
    { key: 'studioPhone', label: 'Stüdyo Telefonu', group: 'studio', placeholder: '[TELEFON]' },
    { key: 'studioAddress', label: 'Stüdyo Adresi', group: 'studio', placeholder: '[STÜDYO ADRESİ]' },
  ];

export const PVC_FIELD_MAP = new Map(PVC_FIELD_META.map((item) => [item.key, item]));

export const PVC_CODE_SOURCE_OPTIONS: ReadonlyArray<{ value: PvcCodeSource; label: string }> = [
  { value: 'studentNumber', label: 'Okul Numarası' },
  { value: 'nationalId', label: 'T.C. Kimlik Numarası (Boşsa Okul No)' },
  { value: 'institutionAndNumber', label: 'Kurum Kodu + Okul No' },
  { value: 'studentSummary', label: 'Okul No + Ad Soyad + Sınıf (QR için ideal)' },
];

export const PVC_ARTWORK_OPTIONS: ReadonlyArray<{ value: PvcArtworkStyle; label: string }> = [
  { value: 'none', label: 'Düz / Desensiz' },
  { value: 'corporate-wave', label: 'Kurumsal Dalga' },
  { value: 'modern-diagonal', label: 'Modern Çapraz Kurdele' },
  { value: 'academic-crest', label: 'Akademik Taç & Arma' },
  { value: 'lanyard-arch', label: 'Dikey Kavisli Kemer' },
  { value: 'swiss-minimal', label: 'İsviçre Minimal Halkalar' },
  { value: 'guilloche-net', label: 'Güvenlik Ağı (Guilloché)' },
];

export function pvcFontFamilyCss(family?: PvcFontFamily): string {
  switch (family) {
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    case 'display':
      return '"Trebuchet MS", "Segoe UI", Inter, sans-serif';
    case 'mono':
      return 'ui-monospace, Consolas, "Courier New", monospace';
    case 'sans':
    default:
      return 'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif';
  }
}

export function resolvePvcFieldValue(
  fieldKey: PvcFieldKey,
  ctx: PvcCardDataContext,
  prefix = '',
): string {
  const stu = ctx.student;
  const idCard = stu?.idCard;
  const meta = PVC_FIELD_MAP.get(fieldKey);

  if (fieldKey === 'schoolName') return `${prefix}${ctx.schoolName || 'OKUL ADI'}`.trim();
  if (fieldKey === 'schoolAddress') {
    const addr = (ctx.schoolAddress ?? '').trim();
    return addr ? `${prefix}${addr}` : '';
  }
  if (fieldKey === 'academicYear') {
    const yr = (ctx.academicYear ?? '').trim();
    return yr ? `${prefix}${yr}` : '';
  }
  if (fieldKey === 'cardTitle') {
    const title = ctx.isStaffCard ? 'ÖĞRETMEN / PERSONEL KİMLİK KARTI' : 'ÖĞRENCİ KİMLİK KARTI';
    return `${prefix}${title}`;
  }
  if (fieldKey === 'studioName') {
    const v = (ctx.studio?.companyName ?? '').trim();
    return v ? `${prefix}${v}` : '';
  }
  if (fieldKey === 'studioOwner') {
    const v = (ctx.studio?.ownerName ?? '').trim();
    return v ? `${prefix}${v}` : '';
  }
  if (fieldKey === 'studioPhone') {
    const v = (ctx.studio?.phone ?? '').trim();
    return v ? `${prefix}${v}` : '';
  }
  if (fieldKey === 'studioAddress') {
    const v = (ctx.studio?.address ?? '').trim();
    return v ? `${prefix}${v}` : '';
  }

  if (!stu) return `${prefix}${meta?.placeholder ?? ''}`;

  const rawValue = (() => {
    switch (fieldKey) {
      case 'fullName': return `${stu.firstName} ${stu.lastName}`.trim();
      case 'firstName': return stu.firstName.trim();
      case 'lastName': return stu.lastName.trim();
      case 'studentNumber':
        return ctx.isStaffCard ? (idCard?.registryNo?.trim() ?? '') : stu.studentNumber.trim();
      case 'className':
        return ctx.isStaffCard
          ? (stu.isPrincipal ? 'Okul Müdürü' : (stu.role?.trim() || 'Öğretmen'))
          : (ctx.className ?? '').trim();
      case 'classAndNumber':
        return ctx.isStaffCard
          ? (stu.isPrincipal ? 'Okul Müdürü' : (stu.role?.trim() || 'Öğretmen'))
          : `${ctx.className || '—'} · ${stu.studentNumber}`;
      case 'role':
        return stu.isPrincipal ? 'Okul Müdürü' : (stu.role?.trim() || (ctx.isStaffCard ? 'Öğretmen' : ''));
      case 'department': return ctx.isStaffCard ? '' : (idCard?.department?.trim() ?? '');
      case 'nationalId': return idCard?.nationalId?.trim() ?? '';
      case 'bloodType': return idCard?.bloodType?.trim() ?? '';
      case 'birthDate': return idCard?.birthDate?.trim() ?? '';
      case 'birthPlace': return idCard?.birthPlace?.trim() ?? '';
      case 'birthInfo':
        return [idCard?.birthPlace?.trim(), idCard?.birthDate?.trim()].filter(Boolean).join(' / ');
      case 'fatherName': return idCard?.fatherName?.trim() ?? '';
      case 'motherName': return idCard?.motherName?.trim() ?? '';
      case 'registryNo': return idCard?.registryNo?.trim() ?? '';
      default: return '';
    }
  })();

  if (!rawValue) return '';
  if (fieldKey === 'classAndNumber') {
    if (ctx.isStaffCard && prefix.toLowerCase().startsWith('sınıf')) return `Görevi: ${rawValue}`;
    return prefix ? `${prefix}${rawValue}` : rawValue;
  }
  if (fieldKey === 'className' && ctx.isStaffCard && prefix.toLowerCase().startsWith('sınıf')) {
    return `Görevi: ${rawValue}`;
  }
  if (fieldKey === 'studentNumber' && ctx.isStaffCard && prefix.toLowerCase().includes('okul no')) {
    return `Sicil No: ${rawValue}`;
  }
  return `${prefix}${rawValue}`;
}

export function resolvePvcCodePayload(
  source: PvcCodeSource | undefined,
  ctx: PvcCardDataContext,
): string {
  const mode = source ?? 'studentNumber';
  const stu = ctx.student;
  if (!stu) return '000000';
  const num = stu.studentNumber.trim() || '0';
  const tc = stu.idCard?.nationalId?.trim() ?? '';
  const inst = (ctx.institutionCode ?? '').trim();

  if (mode === 'nationalId') return tc || num;
  if (mode === 'institutionAndNumber') return inst ? `${inst}-${num}` : num;
  if (mode === 'studentSummary') {
    return [
      ctx.schoolName.slice(0, 28),
      `${stu.firstName} ${stu.lastName}`.trim().slice(0, 32),
      ctx.className ? `${ctx.className} / ${num}` : num,
    ].filter(Boolean).join(' | ');
  }
  return num;
}

export function resolvePvcColorToken(
  token: string | undefined,
  palette: TeacherChartPalette,
  fallback = '#09090b',
): string {
  if (!token) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(token)) return token;
  switch (token) {
    case 'accent': return palette.accent;
    case 'accentSoft': return palette.headerTint;
    case 'accentDeep': return palette.gridBorder;
    case 'surface': return '#ffffff';
    case 'ink': return palette.inkPrimary;
    case 'inkMuted': return palette.inkSecondary;
    case 'onAccent': return '#ffffff';
    case 'border': return palette.gridHairline;
    default: return fallback;
  }
}

/** Turuncu kesinlikle yasak — profesyonel kurumsal renk paleti (12 renk) */
export const PVC_ELEMENT_COLOR_SWATCHES: ReadonlyArray<{ hex: string; label: string }> = [
  { hex: '#ffffff', label: 'Beyaz' },
  { hex: '#f8fafc', label: 'Buz Beyazı' },
  { hex: '#09090b', label: 'Saf Siyah' },
  { hex: '#334155', label: 'Arduvaz Gri' },
  { hex: '#1b365d', label: 'MEB Laciverti' },
  { hex: '#1d4ed8', label: 'Akademik Mavi' },
  { hex: '#0284c7', label: 'Kraliyet Göğü' },
  { hex: '#0f766e', label: 'Selçuklu Firuzesi' },
  { hex: '#065f46', label: 'Kolej Zümrüdü' },
  { hex: '#4338ca', label: 'Gece İndigosu' },
  { hex: '#5b21b6', label: 'Özel Erguvan' },
  { hex: '#881337', label: 'Anadolu Bordosu' },
];
