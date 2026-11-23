import React, { useId } from 'react';

/**
 * MarbleOS Sistem Ayarları & El Kitabı — Özel 3D Ekosistem İkonları (<= 350 Satır)
 * Turuncu içermez; safir mavi, zümrüt yeşili, camgöbeği, ametist moru, platin ve yakut tonlarıyla
 * 3D cam yansıma kavislerine sahiptir.
 */

export const BookIconTopbarSettings: React.FC<{ size?: number }> = ({ size = 18 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbTopBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill={`url(#${uid}-sbTopBg)`} />
      <path d="M1.5 9.5C1.5 5.1 5.1 1.5 9.5 1.5h13c4.4 0 8 3.6 8 8v4c-8 1.6-21 1.6-29 0v-4Z" fill="#fff" opacity="0.2" />
      <path
        d="M7.5 10.2A2.2 2.2 0 0 1 9.7 8h4.1c.9 0 1.7.4 2.2 1.1.5-.7 1.3-1.1 2.2-1.1h4.1a2.2 2.2 0 0 1 2.2 2.2v11.1a.9.9 0 0 1-.9.9h-5.1c-.9 0-1.7.4-2.3 1.1-.6-.7-1.4-1.1-2.3-1.1H8.4a.9.9 0 0 1-.9-.9V10.2Z"
        fill="#eff6ff"
      />
      <line x1="16" y1="9.2" x2="16" y2="22.8" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="10" y1="12.5" x2="13.8" y2="12.5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="10" y1="16" x2="13.8" y2="16" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="18.2" y1="12.5" x2="22" y2="12.5" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="18.2" y1="16" x2="22" y2="16" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};

export const BookIconAppearance: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbAppBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${uid}-sbAppBg)`} />
      <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#93c5fd" strokeOpacity="0.45" />
      <path d="M2 14C2 7.4 7.4 2 14 2h20c6.6 0 12 5.4 12 12v7c-13 2.4-31 2.4-44 0v-7Z" fill="#fff" opacity="0.18" />
      <rect x="10" y="12" width="28" height="19" rx="4" fill="#eff6ff" />
      <path d="M14 15h10v13H14a1 1 0 0 1-1-1V16a1 1 0 0 1 1-1Z" fill="#0f172a" />
      <circle cx="29.5" cy="21.5" r="3.5" fill="#2563eb" />
      <path d="M19 35h10M24 31v4" stroke="#dbeafe" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

export const BookIconVaultKey: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbVaultBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="55%" stopColor="#047857" />
          <stop offset="100%" stopColor="#022c22" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${uid}-sbVaultBg)`} />
      <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#6ee7b7" strokeOpacity="0.45" />
      <path d="M2 14C2 7.4 7.4 2 14 2h20c6.6 0 12 5.4 12 12v7c-13 2.4-31 2.4-44 0v-7Z" fill="#fff" opacity="0.18" />
      <path
        d="M24 10l12 4.5v8.8c0 7.4-5.1 13.4-12 15.2-6.9-1.8-12-7.8-12-15.2v-8.8L24 10Z"
        fill="#ecfdf5"
      />
      <circle cx="24" cy="22" r="3.6" fill="#047857" />
      <path d="M24 25.2v6.2M24 29h2.8" stroke="#047857" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
};

export const BookIconBackupArchive: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbBakBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="55%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#083344" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${uid}-sbBakBg)`} />
      <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#67e8f9" strokeOpacity="0.45" />
      <path d="M2 14C2 7.4 7.4 2 14 2h20c6.6 0 12 5.4 12 12v7c-13 2.4-31 2.4-44 0v-7Z" fill="#fff" opacity="0.18" />
      <rect x="11" y="13" width="26" height="22" rx="5" fill="#ecfeff" />
      <path d="M11 19h26" stroke="#0891b2" strokeWidth="1.8" />
      <path d="M24 22.5v8.5M20.5 27.5L24 31l3.5-3.5" stroke="#0e7490" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const BookIconPrivacyShield: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbPrivBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="55%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#2e1065" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${uid}-sbPrivBg)`} />
      <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#c4b5fd" strokeOpacity="0.45" />
      <path d="M2 14C2 7.4 7.4 2 14 2h20c6.6 0 12 5.4 12 12v7c-13 2.4-31 2.4-44 0v-7Z" fill="#fff" opacity="0.18" />
      <rect x="14" y="21" width="20" height="15" rx="4" fill="#f5f3ff" />
      <path d="M18.5 21v-3.5a5.5 5.5 0 0 1 11 0V21" stroke="#ede9fe" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="27.5" r="2.2" fill="#6d28d9" />
      <path d="M24 29.5v2.8" stroke="#6d28d9" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
};

export const BookIconOfficialSeal: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbSealBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e11d48" />
          <stop offset="55%" stopColor="#9f1239" />
          <stop offset="100%" stopColor="#4c0519" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${uid}-sbSealBg)`} />
      <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#fda4af" strokeOpacity="0.45" />
      <path d="M2 14C2 7.4 7.4 2 14 2h20c6.6 0 12 5.4 12 12v7c-13 2.4-31 2.4-44 0v-7Z" fill="#fff" opacity="0.18" />
      <rect x="12" y="11" width="24" height="26" rx="4" fill="#fff1f2" />
      <line x1="16.5" y1="17" x2="31.5" y2="17" stroke="#be123c" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="16.5" y1="21.5" x2="27.5" y2="21.5" stroke="#e11d48" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="28" cy="29" r="4.6" fill="#be123c" />
      <path d="M26.1 29l1.3 1.3 2.7-2.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const BookIconCompanyStudio: React.FC<{ size?: number }> = ({ size = 28 }) => {
  const uid = useId();
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sbCompanyBg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="55%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#${uid}-sbCompanyBg)`} />
      <rect x="2.5" y="2.5" width="43" height="43" rx="11.5" stroke="#cbd5e1" strokeOpacity="0.45" />
      <path d="M2 14C2 7.4 7.4 2 14 2h20c6.6 0 12 5.4 12 12v7c-13 2.4-31 2.4-44 0v-7Z" fill="#fff" opacity="0.18" />
      <rect x="11" y="13" width="26" height="22" rx="4" fill="#f8fafc" />
      <path d="M16 20h16M16 25h10M16 30h13" stroke="#334155" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="31" cy="27.5" r="3" fill="#2563eb" />
    </svg>
  );
};


