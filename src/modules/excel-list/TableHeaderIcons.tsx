import React from 'react';

export type TableHeaderIconKind =
  | 'order'
  | 'code'
  | 'person'
  | 'surname'
  | 'institution'
  | 'school'
  | 'address'
  | 'note'
  | 'branch'
  | 'students'
  | 'camera'
  | 'eye'
  | 'group'
  | 'status'
  | 'actions';

/**
 * Tablo sütun başlıklarının solundaki renkli mini ikonlar (Turuncu yasaktır).
 */
export const TableHeaderIcon: React.FC<{ kind: TableHeaderIconKind }> = ({ kind }) => {
  switch (kind) {
    case 'order':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <rect x="2" y="2.2" width="10" height="9.6" rx="2" fill="rgba(100, 116, 139, 0.16)" stroke="#64748b" strokeWidth="1.25" />
          <path d="M4.5 5.2h5M4.5 7.2h5M4.5 9.2h3" stroke="#475569" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'code':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <rect x="1.8" y="2.5" width="10.4" height="9" rx="1.8" fill="rgba(99, 102, 241, 0.18)" stroke="#6366f1" strokeWidth="1.25" />
          <path d="M4.3 5.5h5.4M4.3 8.2h3.4" stroke="#4f46e5" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'person':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <circle cx="7" cy="4.6" r="2.2" fill="rgba(37, 99, 235, 0.18)" stroke="#2563eb" strokeWidth="1.3" />
          <path d="M3.2 11.5c0-1.9 1.7-3.3 3.8-3.3s3.8 1.4 3.8 3.3" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'surname':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <rect x="1.8" y="2.6" width="10.4" height="8.8" rx="1.8" fill="rgba(124, 58, 237, 0.16)" stroke="#7c3aed" strokeWidth="1.25" />
          <circle cx="4.8" cy="6.2" r="1.3" fill="#7c3aed" />
          <path d="M3.2 9.4c.4-1 1-1.4 1.6-1.4s1.2.4 1.6 1.4M7.6 5.6h2.8M7.6 8h2.2" stroke="#6d28d9" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'institution':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <rect x="1.8" y="2.5" width="10.4" height="9" rx="1.8" fill="rgba(14, 165, 233, 0.16)" stroke="#0ea5e9" strokeWidth="1.3" />
          <path d="M4.3 5.5h5.4M4.3 8.2h3.4" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case 'school':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <path d="M7 1.7L1.8 4.5h10.4L7 1.7Z" fill="rgba(37, 99, 235, 0.22)" stroke="#2563eb" strokeWidth="1.25" strokeLinejoin="round" />
          <path d="M3.2 4.5v5.8M7 4.5v5.8M10.8 4.5v5.8M1.8 10.5h10.4M1.4 12.1h11.2" stroke="#2563eb" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'address':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <path d="M7 12.2s4-3.4 4-6.4a4 4 0 1 0-8 0c0 3 4 6.4 4 6.4Z" fill="rgba(16, 185, 129, 0.18)" stroke="#10b981" strokeWidth="1.3" strokeLinejoin="round" />
          <circle cx="7" cy="5.6" r="1.3" fill="#10b981" />
        </svg>
      );
    case 'note':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <rect x="2.4" y="1.8" width="9.2" height="10.4" rx="1.6" fill="rgba(139, 92, 246, 0.16)" stroke="#8b5cf6" strokeWidth="1.3" />
          <path d="M4.6 5h4.8M4.6 7.4h4.8M4.6 9.6h2.8" stroke="#7c3aed" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );
    case 'branch':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <rect x="2" y="2.2" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.25" />
          <rect x="7.8" y="2.2" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.25" />
          <rect x="2" y="7.8" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.25" />
          <rect x="7.8" y="7.8" width="4.2" height="4.2" rx="1" fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.25" />
        </svg>
      );
    case 'students':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <circle cx="5.4" cy="4.6" r="2" fill="rgba(13, 148, 136, 0.2)" stroke="#0d9488" strokeWidth="1.3" />
          <path d="M2 11.4c0-1.7 1.5-3 3.4-3s3.4 1.3 3.4 3" stroke="#0d9488" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="9.8" cy="5.2" r="1.5" stroke="#14b8a6" strokeWidth="1.2" />
          <path d="M9.6 8.5c1.4.2 2.4 1.2 2.4 2.6" stroke="#14b8a6" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'camera':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <path d="M2 4.6c0-.7.6-1.3 1.3-1.3h1.4l.8-1.1h3l.8 1.1h1.4c.7 0 1.3.6 1.3 1.3v6c0 .7-.6 1.3-1.3 1.3H3.3c-.7 0-1.3-.6-1.3-1.3v-6Z" fill="rgba(13, 148, 136, 0.18)" stroke="#0d9488" strokeWidth="1.3" />
          <circle cx="7" cy="7.6" r="2.1" stroke="#0f766e" strokeWidth="1.3" />
        </svg>
      );
    case 'eye':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <path d="M1.6 7s2.1-3.6 5.4-3.6S12.4 7 12.4 7s-2.1 3.6-5.4 3.6S1.6 7 1.6 7Z" fill="rgba(2, 132, 199, 0.16)" stroke="#0284c7" strokeWidth="1.25" strokeLinejoin="round" />
          <circle cx="7" cy="7" r="1.6" fill="#0284c7" />
        </svg>
      );
    case 'group':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <path d="M2.2 5.4V2.8c0-.4.3-.6.6-.6h2.6l5.8 5.8a.9.9 0 0 1 0 1.2l-2 2a.9.9 0 0 1-1.2 0L2.2 5.4Z" fill="rgba(8, 145, 178, 0.16)" stroke="#0891b2" strokeWidth="1.25" strokeLinejoin="round" />
          <circle cx="4.6" cy="4.6" r="1" fill="#0891b2" />
        </svg>
      );
    case 'status':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="rgba(16, 185, 129, 0.16)" stroke="#10b981" strokeWidth="1.3" />
          <path d="M4.7 7.1l1.5 1.6 3.1-3.3" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'actions':
      return (
        <svg className="xl-th-icon" viewBox="0 0 14 14" width="12.5" height="12.5" fill="none" aria-hidden="true">
          <path d="M2.4 4.4h9.2M2.4 9.6h9.2" stroke="#6366f1" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="5.2" cy="4.4" r="1.5" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="1.2" />
          <circle cx="8.8" cy="9.6" r="1.5" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="1.2" />
        </svg>
      );
  }
};

export const TableHeaderLabel: React.FC<{
  icon: TableHeaderIconKind;
  label: string;
  align?: 'left' | 'right' | 'center';
}> = ({ icon, label, align = 'left' }) => (
  <span className={`xl-th-label is-${align}`}>
    <TableHeaderIcon kind={icon} />
    <span>{label}</span>
  </span>
);

