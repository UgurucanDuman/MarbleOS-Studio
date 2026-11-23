import React from 'react';

/**
 * İZOLE MODÜL 04 İKON SETİ: Apple Pro Baskı, Yazıcı, Kimlik, Albüm ve Ölçek İkonları
 * Kesin Kural: Turuncu renk yasaktır; mavi, camgöbeği, zümrüt, mor ve gümüş tonları kullanılır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export type PrintStudioIconKind =
  | 'printer'
  | 'portrait'
  | 'id-card'
  | 'album'
  | 'e-okul'
  | 'pdf'
  | 'jpg'
  | 'zip'
  | 'folder'
  | 'csv'
  | 'refresh'
  | 'ruler'
  | 'copies'
  | 'duplex'
  | 'zoom'
  | 'stop';

export const PrintStudioIcon: React.FC<{
  kind: PrintStudioIconKind;
  size?: number;
}> = React.memo(({ kind, size = 16 }) => {
  switch (kind) {
    case 'printer':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M6 3.2h8v3.3H6V3.2Z" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" strokeWidth="1.35" strokeLinejoin="round" />
          <rect x="2.8" y="6.5" width="14.4" height="7.2" rx="2.2" fill="rgba(14, 165, 233, 0.16)" stroke="#0ea5e9" strokeWidth="1.4" />
          <rect x="5.6" y="11.6" width="8.8" height="5.2" rx="1.1" fill="#09090b" stroke="#38bdf8" strokeWidth="1.35" />
          <path d="M7.4 13.8h5.2M7.4 15.3h3.4" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="14.6" cy="9.1" r="1" fill="#10b981" />
        </svg>
      );
    case 'portrait':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="3" y="2.6" width="6.2" height="7.4" rx="1.3" fill="rgba(37, 99, 235, 0.2)" stroke="#3b82f6" strokeWidth="1.35" />
          <rect x="10.8" y="2.6" width="6.2" height="7.4" rx="1.3" fill="rgba(37, 99, 235, 0.14)" stroke="#60a5fa" strokeWidth="1.35" />
          <rect x="3" y="11.2" width="6.2" height="6.2" rx="1.3" fill="rgba(37, 99, 235, 0.14)" stroke="#60a5fa" strokeWidth="1.35" />
          <rect x="10.8" y="11.2" width="6.2" height="6.2" rx="1.3" fill="rgba(37, 99, 235, 0.2)" stroke="#3b82f6" strokeWidth="1.35" />
          <circle cx="6.1" cy="5.4" r="1.1" fill="#93c5fd" />
          <path d="M4.4 8.5c.4-.9 1-1.3 1.7-1.3s1.3.4 1.7 1.3" stroke="#93c5fd" strokeWidth="1.15" strokeLinecap="round" />
        </svg>
      );
    case 'id-card':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2.2" y="4" width="15.6" height="12" rx="2.2" fill="rgba(6, 182, 212, 0.16)" stroke="#06b6d4" strokeWidth="1.4" />
          <path d="M2.4 7h15.2" stroke="#22d3ee" strokeWidth="1.2" />
          <rect x="4.2" y="8.8" width="4.2" height="5.2" rx="0.9" fill="rgba(34, 211, 238, 0.24)" stroke="#22d3ee" strokeWidth="1.15" />
          <path d="M10.2 9.5h5.2M10.2 11.6h4.2M10.2 13.7h3" stroke="#67e8f9" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'album':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M3 4.4c0-.8.6-1.4 1.4-1.4h4.4c.7 0 1.2.5 1.2 1.2v12.2c-.4-.4-1-.6-1.6-.6H4.4c-.8 0-1.4-.6-1.4-1.4V4.4Z" fill="rgba(168, 85, 247, 0.18)" stroke="#a855f7" strokeWidth="1.35" />
          <path d="M17 4.4c0-.8-.6-1.4-1.4-1.4h-4.4c-.7 0-1.2.5-1.2 1.2v12.2c.4-.4 1-.6 1.6-.6h4c.8 0 1.4-.6 1.4-1.4V4.4Z" fill="rgba(168, 85, 247, 0.12)" stroke="#c084fc" strokeWidth="1.35" />
          <path d="M5.2 6.8h2.6M5.2 9.4h2.6M12.2 6.8h2.6M12.2 9.4h2.6" stroke="#d8b4fe" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'e-okul':
    case 'zip':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="3.2" y="2.8" width="13.6" height="14.4" rx="2.2" fill="rgba(16, 185, 129, 0.16)" stroke="#10b981" strokeWidth="1.4" />
          <path d="M9.2 5.2h1.6M9.2 7.4h1.6M9.2 9.6h1.6" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" />
          <rect x="8.2" y="11.4" width="3.6" height="3.6" rx="0.9" fill="rgba(52, 211, 153, 0.25)" stroke="#34d399" strokeWidth="1.2" />
        </svg>
      );
    case 'pdf':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M4.6 2.6h7.2l3.6 3.6v10c0 .7-.5 1.2-1.2 1.2H4.6c-.7 0-1.2-.5-1.2-1.2V3.8c0-.7.5-1.2 1.2-1.2Z" fill="rgba(14, 165, 233, 0.16)" stroke="#38bdf8" strokeWidth="1.35" strokeLinejoin="round" />
          <path d="M11.6 2.6v3.8h3.8M6.4 10.6h7.2M6.4 13.4h4.8" stroke="#7dd3fc" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'jpg':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2.6" y="3.4" width="14.8" height="13.2" rx="2.2" fill="rgba(16, 185, 129, 0.16)" stroke="#10b981" strokeWidth="1.35" />
          <circle cx="7.2" cy="7.6" r="1.4" fill="#6ee7b7" />
          <path d="M3.6 14.4l3.8-3.8 2.8 2.6 2.6-2.8 3.6 4" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'folder':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M2.6 5.6c0-.9.7-1.6 1.6-1.6h3.6l1.6 1.8h6.4c.9 0 1.6.7 1.6 1.6v7.2c0 .9-.7 1.6-1.6 1.6H4.2c-.9 0-1.6-.7-1.6-1.6V5.6Z" fill="rgba(56, 189, 248, 0.16)" stroke="#38bdf8" strokeWidth="1.35" strokeLinejoin="round" />
        </svg>
      );
    case 'csv':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="3" y="3" width="14" height="14" rx="2.1" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="1.35" />
          <path d="M3 7.6h14M3 12.2h14M8.2 3v14" stroke="#34d399" strokeWidth="1.2" />
        </svg>
      );
    case 'refresh':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <path d="M15.6 6.2A6.2 6.2 0 1 0 16.2 11M15.8 3.4v3.2h-3.2" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'ruler':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="2.2" y="6.6" width="15.6" height="6.8" rx="1.4" fill="rgba(99, 102, 241, 0.16)" stroke="#818cf8" strokeWidth="1.35" />
          <path d="M5.4 6.8v3.2M8.5 6.8v2.1M11.5 6.8v3.2M14.6 6.8v2.1" stroke="#a5b4fc" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'copies':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="6.2" y="6.2" width="10.2" height="10.2" rx="1.8" fill="rgba(56, 189, 248, 0.16)" stroke="#38bdf8" strokeWidth="1.35" />
          <path d="M4.2 13.4h-.4c-.8 0-1.4-.6-1.4-1.4V4.4c0-.8.6-1.4 1.4-1.4H11.4c.8 0 1.4.6 1.4 1.4v.4" stroke="#7dd3fc" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      );
    case 'duplex':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <rect x="3.4" y="3.2" width="9.2" height="12.4" rx="1.5" fill="rgba(139, 92, 246, 0.16)" stroke="#a78bfa" strokeWidth="1.3" />
          <path d="M7.8 16.8h6.8c.8 0 1.4-.6 1.4-1.4V6.2" stroke="#c4b5fd" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'zoom':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="8.8" cy="8.8" r="5.2" fill="rgba(56, 189, 248, 0.14)" stroke="#38bdf8" strokeWidth="1.4" />
          <path d="M12.8 12.8L16.8 16.8M8.8 6.6v4.4M6.6 8.8h4.4" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'stop':
      return (
        <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7.2" fill="rgba(225, 29, 72, 0.18)" stroke="#f43f5e" strokeWidth="1.4" />
          <rect x="7.4" y="7.4" width="5.2" height="5.2" rx="1" fill="#fb7185" />
        </svg>
      );
  }
});

