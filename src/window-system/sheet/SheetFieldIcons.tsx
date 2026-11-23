import React from 'react';

export type SheetIconKind =
  | 'cancel'
  | 'save'
  | 'add'
  | 'restore'
  | 'backup'
  | 'csv'
  | 'edit'
  | 'school'
  | 'code'
  | 'address'
  | 'note'
  | 'images'
  | 'camera'
  | 'studio-dock'
  | 'biometric'
  | 'branch'
  | 'person'
  | 'badge'
  | 'up'
  | 'down'
  | 'sort'
  | 'copy'
  | 'calendar'
  | 'merge'
  | 'delete'
  | 'excel'
  | 'settings'
  | 'id-card'
  | 'blood'
  | 'family'
  | 'rotate-left'
  | 'rotate-right'
  | 'crop'
  | 'sun'
  | 'undo'
  | 'search';

const iconKindCache = new Map<string, SheetIconKind>();

/** Etiket veya başlık metnine göre en uygun renkli mini ikonu seçer (Türkçe küçültme maliyeti önbelleklenir). */
export function resolveSheetIconKind(text: string): SheetIconKind {
  const cached = iconKindCache.get(text);
  if (cached) return cached;
  if (iconKindCache.size >= 600) iconKindCache.clear();
  const kind = computeSheetIconKind(text);
  iconKindCache.set(text, kind);
  return kind;
}

function computeSheetIconKind(text: string): SheetIconKind {
  const t = text.toLocaleLowerCase('tr-TR');
  if (t.includes('geri al') || t.includes('sıfırla')) return 'undo';
  if (t.includes('sola çevir') || t.includes('sola döndür')) return 'rotate-left';
  if (t.includes('sağa çevir') || t.includes('sağa döndür')) return 'rotate-right';
  if (t.includes('kırp') || t.includes('kadraj') || t.includes('ölçek')) return 'crop';
  if (t.includes('parlaklık') || t.includes('pozlama')) return 'sun';
  if (t === 'ara' || t.includes('arama')) return 'search';
  if (t.includes('seçenek') || t.includes('tercih') || t.includes('filtre') || t.includes('kontrast') || t.includes('ayar') || t.includes('renk') || t.includes('tema') || t.includes('mürekkep')) return 'settings';
  if (t.includes('kan grubu') || t === 'kan') return 'blood';
  if (t.includes('baba') || t.includes('anne') || t.includes('aile')) return 'family';
  if (t.includes('kimlik') || t.includes('nüfus') || t.includes('kütük') || t.includes('yatay')) return 'id-card';
  if (t.includes('vazgeç') || t.includes('iptal') || t.includes('gizle') || t === 'kapat' || t.includes('kapat')) return 'cancel';
  if (t.includes('yukarı')) return 'up';
  if (t.includes('aşağı')) return 'down';
  if (t.includes('sırala')) return 'sort';
  if (t.includes('çoğalt') || t.includes('kopya') || t.includes('çift')) return 'copy';
  if (t.includes('yedekten') || t.includes('yükle')) return 'restore';
  if (t.includes('yedekle') || t.includes('arşiv') || t.includes('zip')) return 'backup';
  if (t.includes('csv') || t.includes('tsv') || t.includes('e-okul')) return 'csv';
  if (t.includes('fotoğrafları düzenle') || t.includes('stüdyo düzenle')) return 'studio-dock';
  if (t.includes('düzenle') || t.includes('düzelt')) return 'edit';
  if (t.includes('sil') || t.includes('kaldır')) return 'delete';
  if (t.includes('birleştir')) return 'merge';
  if (t === 'yeni okul' || t === 'yeni şube' || t.startsWith('yeni öğrenci') || t.startsWith('yeni öğretmen') || t.startsWith('yeni kadro') || t.includes('hızlı ekle')) return 'add';
  if (t.includes('kaydet') || t.includes('onay') || t.includes('hazır') || t === 'ekle' || t === 'aç' || t.includes('okulu ekle') || t.includes('doğrula') || t === 'seç' || t.includes('dahil et')) return 'save';
  if (t.includes('excel') || t.includes('yapıştır') || t.includes('satır')) return 'excel';
  if (t.includes('görsel') || t.includes('logo') || t.includes('imza') || t.includes('klasör') || t.includes('kapak') || t.includes('sığdır')) return 'images';
  if (t.includes('biyometrik') || t.includes('biometrik')) return 'biometric';
  if (t.includes('resim') || t.includes('resmi') || t.includes('vesikalık') || t.includes('fotoğraf') || t.includes('portre') || t.includes('şablon') || t.includes('dikey')) return 'camera';
  if (t.includes('adres') || t.includes('doğum yeri') || t === 'ili' || t === 'il' || t.includes('ilçe') || t.includes('mahalle') || t.includes('köy')) return 'address';
  if (t.includes('not') || t.includes('açıklama') || t.includes('cilt') || t.includes('belge') || t.includes('punto') || t.includes('yazı') || t.includes('metin') || /\b\d+\s*pt\b/i.test(t)) return 'note';
  if (t.includes('yıl') || t.includes('dönem') || t.includes('doğum tar') || t.includes('tarih')) return 'calendar';
  if (t.includes('müdür') || t.includes('md.') || t.includes('unvan') || t.includes('görev') || t.includes('branş') || t.includes('bölüm') || t.includes('alan') || t.includes('grup')) return 'badge';
  if (t.includes('kurum') || t.includes('numara') || t.includes('kod') || t.includes('sıra no') || t.includes('sr no') || t.includes('sicil')) return 'code';
  if (t.includes('şube') || t.includes('sınıf') || /^\d{1,2}\s*[-/]/.test(t)) return 'branch';
  if (t.includes('öğretmen') || t.includes('öğrenci') || t.includes('rehber') || t.includes('standart') || t.includes('kadro') || t === 'ad' || t === 'soyad') return 'person';
  return 'school';
}

/** Form başlıkları, alan etiketleri ve sekmeler için tema uyumlu mini SVG ikon (Turuncu yasaktır). */
export const SheetAutoIcon: React.FC<{ text: string; size?: number }> = ({ text, size = 14.5 }) => {
  const kind = resolveSheetIconKind(text);
  switch (kind) {
    case 'cancel':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.3" fill="rgba(225, 29, 72, 0.16)" stroke="#e11d48" strokeWidth="1.3" />
          <path d="M5.1 5.1l3.8 3.8M8.9 5.1l-3.8 3.8" stroke="#e11d48" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      );
    case 'save':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.4" fill="var(--os-accent-soft)" stroke="var(--os-accent)" strokeWidth="1.35" />
          <path d="M4.6 7.1l1.7 1.7 3.3-3.5" stroke="var(--os-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'add':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.4" fill="var(--os-accent-soft)" stroke="var(--os-accent)" strokeWidth="1.35" />
          <path d="M7 4.4v5.2M4.4 7h5.2" stroke="var(--os-accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'up':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.3" fill="rgba(37, 99, 235, 0.18)" stroke="#2563eb" strokeWidth="1.25" />
          <path d="M7 9.6V4.6M4.9 6.6L7 4.5l2.1 2.1" stroke="#2563eb" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'down':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.3" fill="rgba(124, 58, 237, 0.18)" stroke="#7c3aed" strokeWidth="1.25" />
          <path d="M7 4.4v5M4.9 7.4L7 9.5l2.1-2.1" stroke="#7c3aed" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'sort':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M4.2 3v8M2.5 4.8L4.2 3l1.7 1.8M9.8 11V3M8.1 9.2L9.8 11l1.7-1.8" stroke="#0284c7" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'copy':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="4.6" y="4.6" width="6.8" height="6.8" rx="1.4" fill="rgba(14, 165, 233, 0.2)" stroke="#0284c7" strokeWidth="1.25" />
          <path d="M3 9.2H2.6c-.6 0-1-.4-1-1V2.8c0-.6.4-1 1-1H8c.6 0 1 .4 1 1v.4" stroke="#0284c7" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'badge':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="5.4" r="3.2" fill="var(--os-accent-soft)" stroke="var(--os-accent)" strokeWidth="1.3" />
          <path d="M5.2 8.2L4.3 12l2.7-1.4L9.7 12l-.9-3.8" stroke="var(--os-accent)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'restore':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2" y="2.4" width="10" height="9.4" rx="1.8" fill="rgba(139, 92, 246, 0.18)" stroke="#8b5cf6" strokeWidth="1.3" />
          <path d="M7 9.6V4.8M5.1 6.6L7 4.7l1.9 1.9" stroke="#7c3aed" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'backup':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2" y="2.4" width="10" height="9.4" rx="1.8" fill="rgba(8, 145, 178, 0.18)" stroke="#0891b2" strokeWidth="1.3" />
          <path d="M7 4.6v4.8M5.1 7.5L7 9.4l1.9-1.9" stroke="#0e7490" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'csv':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M3.2 1.8h5.2l2.6 2.6v7c0 .5-.4.8-.9.8H3.2c-.5 0-.9-.3-.9-.8V2.6c0-.5.4-.8.9-.8Z" fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M8.2 1.8v2.7h2.7M4.5 7.4h5M4.5 9.6h3.4" stroke="#0284c7" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'edit':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M8.9 2.3a1.3 1.3 0 0 1 1.8 1.8L4.9 9.9l-2.5.6.6-2.5 5.9-5.7Z" fill="rgba(37, 99, 235, 0.2)" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.2 12h9.6" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'school':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M7 1.7L1.8 4.5h10.4L7 1.7Z" fill="rgba(37, 99, 235, 0.22)" stroke="#2563eb" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="M3.2 4.5v5.8M7 4.5v5.8M10.8 4.5v5.8M1.8 10.5h10.4M1.4 12.1h11.2" stroke="#2563eb" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'code':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="1.8" y="2.5" width="10.4" height="9" rx="1.8" fill="rgba(99, 102, 241, 0.18)" stroke="#6366f1" strokeWidth="1.3" />
          <path d="M4.3 5.5h5.4M4.3 8.2h3.4" stroke="#4f46e5" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'address':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M7 12.2s4-3.4 4-6.4a4 4 0 1 0-8 0c0 3 4 6.4 4 6.4Z" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="1.3" strokeLinejoin="round" />
          <circle cx="7" cy="5.6" r="1.3" fill="#10b981" />
        </svg>
      );
    case 'note':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2.4" y="1.8" width="9.2" height="10.4" rx="1.6" fill="rgba(139, 92, 246, 0.18)" stroke="#8b5cf6" strokeWidth="1.3" />
          <path d="M4.6 5h4.8M4.6 7.4h4.8M4.6 9.6h2.8" stroke="#7c3aed" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'images':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="1.8" y="2.2" width="10.4" height="9.6" rx="1.8" fill="rgba(14, 165, 233, 0.18)" stroke="#0ea5e9" strokeWidth="1.3" />
          <circle cx="5" cy="5.2" r="1.1" fill="#0284c7" />
          <path d="M2.4 10.6l3-2.8 2.2 2 2-1.8 2 2.6" stroke="#0284c7" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'camera':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M2 4.6c0-.7.6-1.3 1.3-1.3h1.4l.8-1.1h3l.8 1.1h1.4c.7 0 1.3.6 1.3 1.3v6c0 .7-.6 1.3-1.3 1.3H3.3c-.7 0-1.3-.6-1.3-1.3v-6Z" fill="rgba(13, 148, 136, 0.18)" stroke="#0d9488" strokeWidth="1.3" />
          <circle cx="7" cy="7.6" r="2.1" stroke="#0f766e" strokeWidth="1.3" />
        </svg>
      );
    case 'studio-dock':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="1.8" y="3.2" width="10.4" height="8.2" rx="2" fill="rgba(37, 99, 235, 0.2)" stroke="#2563eb" strokeWidth="1.3" />
          <path d="M4.8 3.2l.7-1.2h3l.7 1.2" stroke="#2563eb" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="7.3" r="2.1" fill="rgba(56, 189, 248, 0.28)" stroke="#38bdf8" strokeWidth="1.25" />
        </svg>
      );
    case 'biometric':
    case 'crop':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M2.2 4.4V3c0-.5.4-.9.9-.9h1.5M9.4 2.1h1.5c.5 0 .9.4.9.9v1.4M2.2 9.6V11c0 .5.4.9.9.9h1.5M9.4 11.9h1.5c.5 0 .9-.4.9-.9V9.6" stroke="#2563eb" strokeWidth="1.35" strokeLinecap="round" />
          <circle cx="7" cy="5.5" r="1.6" fill="rgba(37, 99, 235, 0.22)" stroke="#2563eb" strokeWidth="1.2" />
          <path d="M4.6 9.8c.5-1.1 1.4-1.7 2.4-1.7s1.9.6 2.4 1.7" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'branch':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2" y="2.2" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.2)" stroke="#0284c7" strokeWidth="1.25" />
          <rect x="7.8" y="2.2" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.2)" stroke="#0284c7" strokeWidth="1.25" />
          <rect x="2" y="7.8" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.2)" stroke="#0284c7" strokeWidth="1.25" />
          <rect x="7.8" y="7.8" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.2)" stroke="#0284c7" strokeWidth="1.25" />
        </svg>
      );
    case 'person':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="4.6" r="2.2" fill="rgba(8, 145, 178, 0.2)" stroke="#0891b2" strokeWidth="1.3" />
          <path d="M3 11.6c0-2 1.8-3.4 4-3.4s4 1.4 4 3.4" stroke="#0891b2" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'family':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="5" cy="4.8" r="1.8" fill="rgba(139, 92, 246, 0.2)" stroke="#8b5cf6" strokeWidth="1.2" />
          <circle cx="9.4" cy="5.2" r="1.5" fill="rgba(139, 92, 246, 0.16)" stroke="#8b5cf6" strokeWidth="1.2" />
          <path d="M2 11.4c0-1.6 1.3-2.8 3-2.8s3 1.2 3 2.8M7.8 11.4c.2-1.2 1.1-2.1 2.4-2.1 1.1 0 2 .8 2 2.1" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'id-card':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="1.5" y="2.6" width="11" height="8.8" rx="1.8" fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.25" />
          <circle cx="4.6" cy="6.2" r="1.3" fill="#0284c7" />
          <path d="M2.9 9.5c.3-.8 1-1.2 1.7-1.2s1.4.4 1.7 1.2M7.6 5.6h3.2M7.6 7.8h2.4" stroke="#0284c7" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'blood':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M7 2C7 2 3.2 6.1 3.2 8.6a3.8 3.8 0 0 0 7.6 0C10.8 6.1 7 2 7 2Z" fill="rgba(225, 29, 72, 0.2)" stroke="#e11d48" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M2.2 4.4h9.6M2.2 9.6h9.6" stroke="#6366f1" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="5.2" cy="4.4" r="1.6" fill="#eef2ff" stroke="#4f46e5" strokeWidth="1.25" />
          <circle cx="8.8" cy="9.6" r="1.6" fill="#eef2ff" stroke="#4f46e5" strokeWidth="1.25" />
        </svg>
      );
    case 'rotate-left':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M3.2 5.2H6M3.2 5.2V2.4M3.5 5A4.6 4.6 0 1 1 2.6 8.4" stroke="#0284c7" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'rotate-right':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M10.8 5.2H8M10.8 5.2V2.4M10.5 5a4.6 4.6 0 1 0 .9 3.4" stroke="#0284c7" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'sun':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="2.6" fill="var(--os-accent-soft)" stroke="var(--os-accent)" strokeWidth="1.3" />
          <path d="M7 1.6v1.3M7 11.1v1.3M1.6 7h1.3M11.1 7h1.3M3.2 3.2l.9.9M9.9 9.9l.9.9M10.8 3.2l-.9.9M4.1 9.9l-.9.9" stroke="var(--os-accent)" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'undo':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M5.2 4.2L2.6 6.8l2.6 2.6M3 6.8h5.2a3.2 3.2 0 1 1 0 6.4H6.5" stroke="#e11d48" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2" y="2.8" width="10" height="9.2" rx="1.6" fill="rgba(124, 58, 237, 0.16)" stroke="#7c3aed" strokeWidth="1.3" />
          <path d="M4.6 1.8v2M9.4 1.8v2M2 5.8h10" stroke="#7c3aed" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'merge':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="1.8" y="2" width="10.4" height="10" rx="1.8" fill="rgba(79, 70, 229, 0.16)" stroke="#4f46e5" strokeWidth="1.25" />
          <path d="M4 4.4l2.8 2.6L4 9.6M6.8 7h3.4" stroke="#4f46e5" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'delete':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M2.5 3.8h9M5.2 3.8V2.6c0-.4.3-.7.7-.7h2.2c.4 0 .7.3.7.7v1.2M3.8 3.8l.5 7.6c0 .6.5 1 1.1 1h3.2c.6 0 1-.4 1.1-1l.5-7.6" stroke="#e11d48" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'excel':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2" y="2" width="10" height="10" rx="1.6" fill="rgba(5, 150, 105, 0.18)" stroke="#059669" strokeWidth="1.3" />
          <path d="M2 5.4h10M2 8.6h10M5.8 2v10" stroke="#059669" strokeWidth="1.2" />
        </svg>
      );
    case 'search':
      return (
        <svg className="os-label-icon" viewBox="0 0 14 14" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="6.2" cy="6.2" r="3.9" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.1 9.1l2.8 2.8" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
        </svg>
      );
  }
};
