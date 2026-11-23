import {
  type GradeColumnGroup,
  type StudentIdentityCellMode,
  type TeacherDocCategoryMeta,
  type TeacherDocTemplateSpec,
} from './types';

export { TEACHER_INK_COLOR_LIST, TEACHER_PALETTE_LIST } from './palettes';

/**
 * İZOLE SİSTEM KATALOĞU: MEB Uyumlu Öğretmen Çizelgesi, Cep Defteri, ŞÖK ve Cep Albümü Şablonları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const TEACHER_CATEGORY_META: readonly TeacherDocCategoryMeta[] = [
  { id: 'ilkogretim-cizelge', label: 'İlköğretim Not Çizelgesi', shortLabel: 'İlköğretim', description: 'Anaokulu ve 1–8. Sınıflar' },
  { id: 'lise-cizelge', label: 'Lise Not Çizelgesi', shortLabel: 'Lise Çizelge', description: '16, 24, 28, 30 ve 32 Öğrenci' },
  { id: 'not-defteri', label: 'Lise Cep Not Defteri', shortLabel: 'Not Defteri', description: '6’lı Kes-Katla Forma & Kapak' },
  { id: 'kurul-rapor', label: 'Şube Öğretmenler Kurulu', shortLabel: 'ŞÖK Formu', description: '12 Öğrencili Kurul Görüşü' },
  { id: 'cep-albumu', label: 'Öğretmen Cep Albümü', shortLabel: 'Cep Albümü', description: 'Katlamalı Mini Fotoğraf Albümü' },
];

const LISE_DUAL_TERM_COLS: readonly GradeColumnGroup[] = [
  { title: '1. Dönem', subHeaders: ['Sınav', 'Perf.', 'Proje'], widthWeight: 1.04 },
  { title: '1.D', subHeaders: ['Ort.'], tintKind: 'summary', widthWeight: 1.16 },
  { title: '2. Dönem', subHeaders: ['Sınav', 'Perf.', 'Proje'], widthWeight: 1.04 },
  { title: '2.D', subHeaders: ['Ort.'], tintKind: 'summary', widthWeight: 1.16 },
  { title: 'Yılsonu', subHeaders: ['Puan'], tintKind: 'final', widthWeight: 1.32 },
];

const LISE_CLASSIC_COLS: readonly GradeColumnGroup[] = [
  { title: 'Yazılı Sınavlar', subHeaders: ['1', '2', '3', '4', '5', '6'], widthWeight: 0.86 },
  { title: 'Performans', subHeaders: ['1', '2', '3'], widthWeight: 0.94 },
  { title: 'Ek', subHeaders: ['Uyg', 'Ödv'], widthWeight: 1.14 },
  { title: 'Dönem', subHeaders: ['Puan', 'Not'], tintKind: 'summary', widthWeight: 1.26 },
  { title: 'Ağırlıklı', subHeaders: ['Puan', 'Not'], tintKind: 'final', widthWeight: 1.32 },
];

const NOTEBOOK_COLS: readonly GradeColumnGroup[] = [
  { title: '1. Dönem', subHeaders: ['Snv', 'Prf', 'Prj', 'Uyg', 'Ort'] },
  { title: '2. Dönem', subHeaders: ['Snv', 'Prf', 'Prj', 'Uyg', 'Ort'] },
  { title: 'Son', subHeaders: ['Not'], tintKind: 'final' },
];

function makePrimarySpec(
  id: string, name: string, subtitle: string, officialDocTitle: string, columnGroups: readonly GradeColumnGroup[],
): TeacherDocTemplateSpec {
  return {
    id, categoryId: 'ilkogretim-cizelge', engine: 'tabular-gradebook',
    name, shortBadge: '26 Öğr.', subtitle, officialDocTitle,
    panelCols: 2, rowsPerCol: 13, studentsPerPage: 26,
    identityMode: 'side-vertical', subRowScheme: 'two-terms', showRowSequenceNumber: true, columnGroups,
  };
}

function makeHighDualSpec(
  id: string, name: string, rowsPerCol: number, identityMode: StudentIdentityCellMode, subtitle: string,
): TeacherDocTemplateSpec {
  const total = rowsPerCol * 2;
  return {
    id, categoryId: 'lise-cizelge', engine: 'tabular-gradebook',
    name, shortBadge: `${total} Öğr.`, subtitle, officialDocTitle: 'ÖĞRETMEN NOT ÇİZELGESİ',
    panelCols: 2, rowsPerCol, studentsPerPage: total,
    identityMode, subRowScheme: 'quad-numbered', showRowSequenceNumber: true, columnGroups: LISE_DUAL_TERM_COLS,
  };
}

export const TEACHER_DOC_TEMPLATES: readonly TeacherDocTemplateSpec[] = [
  makePrimarySpec(
    'preschool-26', 'Anaokulu Gözlem Çizelgesi',
    'Okul öncesi gelişim alanları (Özbakım, Motor, Bilişsel, Dil, Sosyal)',
    'OKUL ÖNCESİ ÖĞRENCİ GELİŞİM VE GÖZLEM ÇİZELGESİ',
    [
      { title: 'Gelişim Gözlem Alanları', subHeaders: ['Özb.', 'Mot.', 'Bil.', 'Dil', 'Sos.'] },
      { title: 'Portfolyo', subHeaders: ['Etkn.'], tintKind: 'summary', widthWeight: 1.48 },
      { title: 'Genel', subHeaders: ['Gözl.'], tintKind: 'final', widthWeight: 1.35 },
    ],
  ),
  makePrimarySpec(
    'primary-123-26', '1, 2 ve 3. Sınıflar Çizelgesi',
    'Sınavsız ilkokul ders etkinliklerine katılım (1–5) ve dönem puanı',
    'ÖĞRETMEN PUAN VE ETKİNLİK ÇİZELGESİ',
    [
      { title: 'Ders Etkinliklerine Katılım Çalışması', subHeaders: ['1', '2', '3', '4', '5'] },
      { title: 'Dönem', subHeaders: ['Puanı'], tintKind: 'summary', widthWeight: 1.35 },
      { title: 'Yılsonu', subHeaders: ['Puanı'], tintKind: 'final', widthWeight: 1.4 },
    ],
  ),
  makePrimarySpec(
    'primary-4-26', '4. Sınıflar Puan Çizelgesi',
    'Sınavlar (1–2), ders etkinliklerine katılım (1–5) ve proje (1–2)',
    'ÖĞRETMEN PUAN ÇİZELGESİ',
    [
      { title: 'Sınavlar', subHeaders: ['1', '2'], widthWeight: 0.96 },
      { title: 'Ders Etkinliklerine Katılım Çalışması', subHeaders: ['1', '2', '3', '4', '5'], widthWeight: 0.94 },
      { title: 'Proje', subHeaders: ['1', '2'], widthWeight: 0.96 },
      { title: 'Dönem', subHeaders: ['Puan'], tintKind: 'summary', widthWeight: 1.38 },
      { title: 'Yılsonu', subHeaders: ['Puan'], tintKind: 'final', widthWeight: 1.48 },
    ],
  ),
  makePrimarySpec(
    'middle-5678-26', '5, 6, 7 ve 8. Sınıflar Çizelgesi',
    'Sınavlar (1–3), ders etkinlikleri (1–5), proje (1–2) ve yılsonu',
    'ÖĞRETMEN PUAN ÇİZELGESİ',
    [
      { title: 'Sınavlar', subHeaders: ['1', '2', '3'], widthWeight: 0.92 },
      { title: 'Ders Etkinliklerine Katılım Çalışması', subHeaders: ['1', '2', '3', '4', '5'], widthWeight: 0.92 },
      { title: 'Proje', subHeaders: ['1', '2'], widthWeight: 0.94 },
      { title: 'Dönem', subHeaders: ['Puan'], tintKind: 'summary', widthWeight: 1.38 },
      { title: 'Yılsonu', subHeaders: ['Puan'], tintKind: 'final', widthWeight: 1.5 },
    ],
  ),
  makeHighDualSpec('high-16', 'Şablon 1 · Büyük Portreli (16 Öğrenci)', 8, 'stacked-horizontal', 'Üstte büyük dikey portre, altta yatay isim; 1 ve 2. Dönem 4’lü satır'),
  makeHighDualSpec('high-24', 'Şablon 2 · Dengeli Dizgi (24 Öğrenci)', 12, 'side-vertical', '2×12 ferah satır yüksekliği, dikey öğrenci etiketi ve 2 dönem ızgarası'),
  makeHighDualSpec('high-28', 'Şablon 3 · Standart Lise (28 Öğrenci)', 14, 'side-vertical', '2×14 standart lise sınıf mevcudu, 1. ve 2. Dönem Sınav/Perf/Proje/Ort'),
  makeHighDualSpec('high-30', 'Şablon 4 · Geniş Sınıf (30 Öğrenci)', 15, 'side-vertical', '2×15 yoğunlaştırılmış tek yaprak lise not çizelgesi'),
  {
    id: 'high-classic-28', categoryId: 'lise-cizelge', engine: 'tabular-gradebook',
    name: 'Şablon 5 · Detaylı Klasik (28 Öğrenci)', shortBadge: '28 Öğr.',
    subtitle: '6 Yazılı, 3 Performans, Uygulama, Ödev ve Ağırlıklı Puan/Not (2×14)',
    officialDocTitle: 'ÖĞRETMEN NOT ÇİZELGESİ',
    panelCols: 2, rowsPerCol: 14, studentsPerPage: 28,
    identityMode: 'side-vertical', subRowScheme: 'two-terms', showRowSequenceNumber: true, columnGroups: LISE_CLASSIC_COLS,
  },
  {
    id: 'high-classic-32', categoryId: 'lise-cizelge', engine: 'tabular-gradebook',
    name: 'Şablon 6 · Detaylı Klasik (32 Öğrenci)', shortBadge: '32 Öğr.',
    subtitle: 'Kalabalık şubeler için 2×16 tek yaprak detaylı yazılı/performans tablosu',
    officialDocTitle: 'ÖĞRETMEN NOT ÇİZELGESİ',
    panelCols: 2, rowsPerCol: 16, studentsPerPage: 32,
    identityMode: 'side-vertical', subRowScheme: 'two-terms', showRowSequenceNumber: true, columnGroups: LISE_CLASSIC_COLS,
  },
  {
    id: 'notebook-inner', categoryId: 'not-defteri', engine: 'booklet-gradebook-inner',
    name: 'Seçili Sınıflar Ayrı Defter (6’lı Forma)', shortBadge: 'Ayrı Forma',
    subtitle: 'Her şube ayrı cep kitapçığı; A4’te 3 şerit × 2 sayfa forma dizgisi',
    officialDocTitle: 'CEP NOT DEFTERİ İÇ SAYFA FORMASI',
    panelCols: 2, rowsPerCol: 5, studentsPerPage: 30,
    identityMode: 'side-vertical', subRowScheme: 'quad-numbered', showRowSequenceNumber: false, columnGroups: NOTEBOOK_COLS,
  },
  {
    id: 'notebook-inner-combined', categoryId: 'not-defteri', engine: 'booklet-gradebook-inner',
    name: 'Seçili Sınıflar Tek Defter (Birleşik)', shortBadge: 'Tek Defter',
    subtitle: 'Tüm seçili şubeleri tek bir sürekli öğretmen cep defterinde birleştirir',
    officialDocTitle: 'BİRLEŞİK CEP NOT DEFTERİ FORMASI',
    panelCols: 2, rowsPerCol: 5, studentsPerPage: 30,
    identityMode: 'side-vertical', subRowScheme: 'quad-numbered', showRowSequenceNumber: false, columnGroups: NOTEBOOK_COLS,
  },
  {
    id: 'notebook-cover-front', categoryId: 'not-defteri', engine: 'booklet-gradebook-front',
    name: 'Kapak Ön Taraf (3’lü Şerit)', shortBadge: 'Ön Kapak',
    subtitle: '3 şerit kesimine birebir uyumlu okul ve ders bilgili cep defteri ön kapağı',
    officialDocTitle: 'ÖĞRETMEN NOT DEFTERİ',
    panelCols: 1, rowsPerCol: 3, studentsPerPage: 0,
    identityMode: 'side-vertical', subRowScheme: 'single-open', showRowSequenceNumber: false, columnGroups: [],
  },
  {
    id: 'notebook-cover-back', categoryId: 'not-defteri', engine: 'booklet-gradebook-back',
    name: 'Kapak Arka Taraf · Ders Programı & Tasdik', shortBadge: 'Arka Kapak',
    subtitle: 'Sabah/Öğlen 1–6 Haftalık Ders Programı ve Okul Müdürü tasdik sayfası',
    officialDocTitle: 'HAFTALIK DERS PROGRAMI',
    panelCols: 1, rowsPerCol: 3, studentsPerPage: 0,
    identityMode: 'side-vertical', subRowScheme: 'single-open', showRowSequenceNumber: false, columnGroups: [],
  },
  {
    id: 'sok-12', categoryId: 'kurul-rapor', engine: 'tabular-sok',
    name: 'Şube Öğretmenler Kurulu Görüş Formu', shortBadge: '12 Öğr.',
    subtitle: 'A4 dikey 12 öğrencili geniş kurul görüş ve değerlendirme tutanağı',
    officialDocTitle: 'ŞUBE ÖĞRETMENLER KURULU GÖRÜŞLERİ',
    panelCols: 1, rowsPerCol: 12, studentsPerPage: 12,
    identityMode: 'side-vertical', subRowScheme: 'single-open', showRowSequenceNumber: false,
    columnGroups: [{ title: 'ŞUBE ÖĞRETMENLER KURULU GÖRÜŞLERİ', subHeaders: [''] }],
  },
  {
    id: 'pocket-album-inner', categoryId: 'cep-albumu', engine: 'booklet-album-inner',
    name: 'Öğretmen Cep Albümü · İç Sayfalar', shortBadge: '4 Cep/A4',
    subtitle: 'A4 üzerinde 2 yatay katlamalı şerit, sayfa başı 12 portreli mini albüm forması',
    officialDocTitle: 'ÖĞRETMEN CEP ALBÜMÜ',
    panelCols: 2, rowsPerCol: 2, studentsPerPage: 48,
    identityMode: 'stacked-horizontal', subRowScheme: 'single-open', showRowSequenceNumber: false, columnGroups: [],
  },
  {
    id: 'pocket-album-cover', categoryId: 'cep-albumu', engine: 'booklet-album-cover',
    name: 'Öğretmen Cep Albümü · Kapak Sayfası', shortBadge: '2 Kapak',
    subtitle: '2 yatay şerit kesimine tam uyumlu okul bilgili cep fotoğraf albümü kapağı',
    officialDocTitle: 'FOTOĞRAF ALBÜMÜ',
    panelCols: 1, rowsPerCol: 2, studentsPerPage: 0,
    identityMode: 'stacked-horizontal', subRowScheme: 'single-open', showRowSequenceNumber: false, columnGroups: [],
  },
];
