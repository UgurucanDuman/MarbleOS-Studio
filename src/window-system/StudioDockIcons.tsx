import React, { useId } from 'react';

/**
 * MarbleOS Studio — 3D Pro Rengarenk Ekosistem Dock İkonları (<= 350 Satır)
 * Apple Pro & MarbleOS standartlarında; izometrik 3D derinlik, cam yansıma kavisleri,
 * canlı renk degradeleri ve renkli alt parlama (drop-shadow) ile tasarlanmıştır.
 */

// 01. EXCEL & SINIF LİSTELERİ (3D Zümrüt Yeşili & Altın Tablo İkonu)
export const DockIconExcel: React.FC = () => {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="os-3d-dock-svg os-shadow-emerald">
      <defs>
        <linearGradient id={`${uid}-exBase`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#047857" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
        <linearGradient id={`${uid}-exBorder`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#34d399" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#065f46" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${uid}-exSheet`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d1fae5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${uid}-exBase)`} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="14.5" stroke={`url(#${uid}-exBorder)`} strokeWidth="1.2" />
      <path d="M 2 17 C 2 8.7 8.7 2 17 2 L 47 2 C 55.3 2 62 8.7 62 17 L 62 29 C 45 32 19 32 2 29 Z" fill="#ffffff" opacity="0.18" />

      {/* 3D Sınıf Tablosu Yaprağı */}
      <rect x="14" y="15" width="36" height="34" rx="6" fill={`url(#${uid}-exSheet)`} />
      <path d="M 14 21 C 14 17.7 16.7 15 20 15 H 44 C 47.3 15 50 17.7 50 21 V 25 H 14 V 21 Z" fill="#059669" />
      <line x1="27" y1="25" x2="27" y2="49" stroke="#6ee7b7" strokeWidth="1.6" />
      <line x1="14" y1="33" x2="50" y2="33" stroke="#6ee7b7" strokeWidth="1.6" />
      <line x1="14" y1="41" x2="50" y2="41" stroke="#6ee7b7" strokeWidth="1.6" />
      <rect x="18" y="28" width="6" height="2.5" rx="1" fill="#047857" />
      <rect x="31" y="28" width="14" height="2.5" rx="1" fill="#10b981" />
      <rect x="18" y="36" width="6" height="2.5" rx="1" fill="#047857" />
      <rect x="31" y="36" width="12" height="2.5" rx="1" fill="#10b981" />
      <rect x="18" y="44" width="6" height="2.5" rx="1" fill="#047857" />
      <rect x="31" y="44" width="15" height="2.5" rx="1" fill="#10b981" />
    </svg>
  );
};

// 02. FOTOĞRAF STÜDYO & EŞLEŞTİRME (3D Kehribar Altın & Safir Kamera Merceği)
export const DockIconPhotoStudio: React.FC = () => {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="os-3d-dock-svg os-shadow-amber">
      <defs>
        <linearGradient id={`${uid}-phBase`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id={`${uid}-phBorder`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#78350f" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`${uid}-phLens`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${uid}-phBase)`} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="14.5" stroke={`url(#${uid}-phBorder)`} strokeWidth="1.2" />
      <path d="M 2 17 C 2 8.7 8.7 2 17 2 L 47 2 C 55.3 2 62 8.7 62 17 L 62 29 C 45 32 19 32 2 29 Z" fill="#ffffff" opacity="0.2" />

      {/* 3D Kamera Gövdesi ve Safir Optik Lens */}
      <rect x="13" y="19" width="38" height="28" rx="7" fill="#fffbeb" stroke="#fde68a" strokeWidth="1" />
      <path d="M 24 19 L 27 14 H 37 L 40 19 Z" fill="#fef3c7" />
      <circle cx="32" cy="33" r="10.5" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
      <circle cx="32" cy="33" r="7.5" fill={`url(#${uid}-phLens)`} />
      <circle cx="29.5" cy="30.5" r="2.2" fill="#ffffff" opacity="0.85" />
      <circle cx="44" cy="24.5" r="2" fill="#ef4444" />
    </svg>
  );
};

// 03. ALBÜM & KİMLİK TASARIMI (3D Ametist Mor & Altın Tasarım Kalemi)
export const DockIconAlbumDesigner: React.FC = () => {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="os-3d-dock-svg os-shadow-purple">
      <defs>
        <linearGradient id={`${uid}-alBase`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="50%" stopColor="#581c87" />
          <stop offset="100%" stopColor="#2e1065" />
        </linearGradient>
        <linearGradient id={`${uid}-alBorder`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#c084fc" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${uid}-alGoldPen`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${uid}-alBase)`} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="14.5" stroke={`url(#${uid}-alBorder)`} strokeWidth="1.2" />
      <path d="M 2 17 C 2 8.7 8.7 2 17 2 L 47 2 C 55.3 2 62 8.7 62 17 L 62 29 C 45 32 19 32 2 29 Z" fill="#ffffff" opacity="0.18" />

      {/* 3D Katmanlı Albüm Sayfası + Altın Kalem */}
      <rect x="15" y="15" width="30" height="35" rx="5" fill="#f3e8ff" stroke="#d8b4fe" strokeWidth="1" />
      <rect x="20" y="20" width="12" height="12" rx="2.5" fill="#9333ea" opacity="0.85" />
      <rect x="20" y="36" width="20" height="2.8" rx="1.4" fill="#7e22ce" />
      <rect x="20" y="41" width="14" height="2.5" rx="1.2" fill="#a855f7" />
      <g transform="translate(42, 34) rotate(-38)">
        <rect x="-3.5" y="-16" width="7" height="24" rx="2" fill={`url(#${uid}-alGoldPen)`} stroke="#ffffff" strokeWidth="0.7" />
        <path d="M -3.5 8 L 0 15 L 3.5 8 Z" fill="#fef08a" />
      </g>
    </svg>
  );
};

// 04. BASKI & ÇIKTI MERKEZİ (3D Turkuaz/Camgöbeği & CMYK Baskı İkonu)
export const DockIconPrintCenter: React.FC = () => {
  const uid = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="os-3d-dock-svg os-shadow-cyan">
      <defs>
        <linearGradient id={`${uid}-prBase`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#083344" />
        </linearGradient>
        <linearGradient id={`${uid}-prBorder`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#155e75" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${uid}-prBase)`} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="14.5" stroke={`url(#${uid}-prBorder)`} strokeWidth="1.2" />
      <path d="M 2 17 C 2 8.7 8.7 2 17 2 L 47 2 C 55.3 2 62 8.7 62 17 L 62 29 C 45 32 19 32 2 29 Z" fill="#ffffff" opacity="0.18" />

      {/* 3D Stüdyo Baskı Makinesi ve CMYK Renk Barları */}
      <rect x="20" y="13" width="24" height="10" rx="2.5" fill="#ecfeff" />
      <rect x="13" y="22" width="38" height="18" rx="5" fill="#ffffff" stroke="#a5f3fc" strokeWidth="1" />
      <rect x="19" y="34" width="26" height="16" rx="3" fill="#cffafe" />
      <circle cx="44" cy="28" r="2" fill="#10b981" />
      {/* CMYK Renk Kontrol Şeritleri */}
      <rect x="23" y="39" width="4" height="7" rx="1" fill="#06b6d4" />
      <rect x="29" y="39" width="4" height="7" rx="1" fill="#ec4899" />
      <rect x="35" y="39" width="4" height="7" rx="1" fill="#eab308" />
    </svg>
  );
};

