import React, { useId } from 'react';
import './brand.css';

interface StudioBrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon';
  companyName?: string;
  companySubtitle?: string;
  logoUrl?: string | null;
}

export const StudioBrandLogo: React.FC<StudioBrandLogoProps> = ({
  size = 'md',
  variant = 'full',
  companyName,
  companySubtitle,
  logoUrl,
}) => {
  const uid = useId().replace(/:/g, '');
  const paperGradId = `marble-paper-${uid}`;
  const pencilGradId = `marble-pencil-${uid}`;
  const iconDimensions = size === 'sm' ? 30 : size === 'lg' ? 46 : 36;
  const cleanLogoUrl = logoUrl?.trim();

  const icon = cleanLogoUrl ? (
    <img
      src={cleanLogoUrl}
      width={iconDimensions}
      height={iconDimensions}
      alt=""
      draggable={false}
      className="studio-brand-icon is-custom-logo"
    />
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={iconDimensions}
      height={iconDimensions}
      fill="none"
      aria-hidden="true"
      className="studio-brand-icon"
    >
      <defs>
        <linearGradient id={paperGradId} x2="1" y2="1">
          <stop stopColor="#fffefa" />
          <stop offset="1" stopColor="#dedbd2" />
        </linearGradient>
        <linearGradient id={pencilGradId} x2="1" y2="0">
          <stop stopColor="#697586" />
          <stop offset="1" stopColor="#2e3745" />
        </linearGradient>
      </defs>
      <path
        d="M22 13h41l17 17v55a7 7 0 0 1-7 7H22a7 7 0 0 1-7-7V20a7 7 0 0 1 7-7Z"
        fill="#111827"
        opacity=".24"
        transform="translate(2 2)"
      />
      <path
        d="M22 9h41l17 17v55a7 7 0 0 1-7 7H22a7 7 0 0 1-7-7V16a7 7 0 0 1 7-7Z"
        fill={`url(#${paperGradId})`}
        stroke="#9ba1a9"
        strokeWidth="2"
      />
      <path d="M63 10v11a5 5 0 0 0 5 5h11" fill="#c8ced6" stroke="#9ba1a9" strokeWidth="2" />
      <g strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m27 59 19 17 19-17" stroke="#485566" />
        <path d="m27 50 19 17 19-17" stroke="#93836d" />
        <path d="m27 40 19-17 19 17-19 17Z" stroke="#9c623b" />
      </g>
      <g transform="translate(59 85) rotate(45)">
        <path d="M-5.5-10 0 0l5.5-10Z" fill="#c3a17b" />
        <path d="M-2.1-3.8 0 0l2.1-3.8Z" fill="#2e3745" />
        <path d="M-5.5-10v-29a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v29Z" fill={`url(#${pencilGradId})`} />
        <path d="M-5.5-35h11v5h-11Z" fill="#c8ced6" />
      </g>
    </svg>
  );

  if (variant === 'icon') return icon;

  const cleanCompany = companyName?.trim();
  const cleanSubtitle = companySubtitle?.trim();

  return (
    <div className={`studio-brand-logo studio-brand-${size}`}>
      {icon}
      <div className="studio-brand-wordmark">
        <div className="studio-brand-mainline">
          <span className="brand-marble">Marble</span>
          <span className="brand-os">OS</span>
          {cleanCompany && <span className="brand-studio">{cleanCompany}</span>}
        </div>
        {cleanSubtitle && <span className="studio-brand-subline">{cleanSubtitle}</span>}
      </div>
    </div>
  );
};
