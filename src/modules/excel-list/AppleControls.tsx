import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { springWindowRestore } from '../../system/motion/macosMotion';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';
import type { SchoolRecord } from '../../system/sqlite/types';
import { useResolvedSchoolAssetUrl } from '../../system/storage/useSchoolAssetUrl';
import { measureSelectPopover } from '../../window-system/sheet/selectPopoverPlacement';

/** Apple macOS 3D Okul Kampüsü / Kurum Squircle Rozeti (okul logosu varsa logoyu gösterir). */
const AppleSchoolSquircle: React.FC<{ logoDataUrl?: string; size?: number }> = ({
  logoDataUrl,
  size = 34,
}) => {
  const resolvedLogo = useResolvedSchoolAssetUrl(logoDataUrl, 'preview');
  if (resolvedLogo) {
    return (
      <span className="xl-school-squircle is-logo" style={{ width: size, height: size }} aria-hidden="true">
        <img src={resolvedLogo} alt="" />
      </span>
    );
  }
  return (
    <span className="xl-school-squircle" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
        <defs>
          <linearGradient id="appleSchoolBg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="55%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8.5" fill="url(#appleSchoolBg)" />
        <rect x="0.6" y="0.6" width="30.8" height="30.8" rx="8" stroke="rgba(255,255,255,0.26)" strokeWidth="1" />
        {/* Klasik Okul Kampüsü Çatısı, Saat ve Sütunlar */}
        <path d="M16 6.2L6.6 11.4h18.8L16 6.2Z" fill="#ffffff" fillOpacity="0.96" />
        <circle cx="16" cy="9.5" r="1.15" fill="#38bdf8" />
        <rect x="8.2" y="11.4" width="15.6" height="1.5" rx="0.6" fill="rgba(255,255,255,0.85)" />
        <rect x="9.6" y="13.2" width="2.2" height="8.6" rx="0.8" fill="#ffffff" fillOpacity="0.92" />
        <rect x="14.9" y="13.2" width="2.2" height="8.6" rx="0.8" fill="#ffffff" fillOpacity="0.92" />
        <rect x="20.2" y="13.2" width="2.2" height="8.6" rx="0.8" fill="#ffffff" fillOpacity="0.92" />
        <rect x="7.4" y="21.8" width="17.2" height="2" rx="0.9" fill="#ffffff" />
        <rect x="6.2" y="24.2" width="19.6" height="1.6" rx="0.8" fill="#38bdf8" />
      </svg>
    </span>
  );
};

/** Apple tarzı büyüteç ikonlu arama kutusu. */
export const AppleSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  wide?: boolean;
}> = ({ value, onChange, placeholder, ariaLabel, wide = false }) => (
  <label className={`xl-search-wrap ${wide ? 'xl-search-wide' : ''}`.trim()}>
    <svg className="xl-search-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="rgba(14, 165, 233, 0.18)" stroke="#0284c7" strokeWidth="1.45" />
      <path d="M10.4 10.4L13.7 13.7" stroke="#0284c7" strokeWidth="1.55" strokeLinecap="round" />
    </svg>
    <input
      type="search"
      className="xl-search"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

/**
 * Üst bardaki aktif okulu, okul kodunu, kurum kodunu ve eğitim dönemini
 * tek bir Apple macOS Workspace Switcher kartında birleştiren ve okul isminin
 * uzunluğuna göre akıllı boyutlanan seçici bileşen.
 */
export const AppleSchoolPicker: React.FC<{
  schools: ReadonlyArray<SchoolRecord>;
  activeSchool: SchoolRecord;
  academicYear?: string;
  onSelect: (schoolId: string) => void;
}> = ({ schools, activeSchool, academicYear, onSelect }) => {
  const workEnabled = useWindowWorkEnabled();
  const [placement, setPlacement] = useState<ReturnType<typeof measureSelectPopover> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const open = Boolean(placement) && workEnabled;

  useEffect(() => {
    if (!workEnabled) setPlacement(null);
  }, [workEnabled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPlacement(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const nameLen = activeSchool.name.length;
  const sizeTier = nameLen > 38 ? 'is-xlong' : nameLen > 24 ? 'is-long' : 'is-normal';

  return (
    <div
      ref={wrapRef}
      className="xl-school-picker"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setPlacement(null);
      }}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        setPlacement(null);
        triggerRef.current?.focus({ preventScroll: true });
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Seçili okul"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`xl-school-picker-btn ${open ? 'is-open' : ''}`}
        onClick={(event) => setPlacement(open ? null : measureSelectPopover(event.currentTarget, 7, 280))}
      >
        <AppleSchoolSquircle logoDataUrl={activeSchool.logoDataUrl} size={34} />
        <span className="xl-school-picker-body">
          <span className={`xl-school-picker-name ${sizeTier}`}>{activeSchool.name}</span>
          <span className="xl-school-picker-meta">
            <span>Kod {activeSchool.code}</span>
            {activeSchool.institutionCode && <span>· Kurum {activeSchool.institutionCode}</span>}
            {academicYear && <span>· {academicYear}</span>}
          </span>
        </span>
        <span className="xl-school-picker-chev-pill" aria-hidden="true">
          <svg
            className="xl-school-picker-chev"
            viewBox="0 0 12 12"
            width="11"
            height="11"
            fill="none"
          >
            <path d="M2.6 4.4L6 7.8l3.4-3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <AnimatePresence>
        {open && placement && (
          <motion.div
            role="listbox"
            aria-label="Okullar listesi"
            className="xl-school-popover"
            data-placement={placement.opensUp ? 'above' : 'below'}
            style={{ maxHeight: placement.maxHeight }}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={springWindowRestore}
          >
            <div className="xl-school-popover-head">OKUL DEĞİŞTİR ({schools.length})</div>
            {schools.map((s) => {
              const selected = s.id === activeSchool.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`xl-school-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => {
                    onSelect(s.id);
                    setPlacement(null);
                    triggerRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <AppleSchoolSquircle logoDataUrl={s.logoDataUrl} size={26} />
                  <span className="xl-school-option-copy">
                    <span className="xl-school-option-name">{s.name}</span>
                    <span className="xl-school-option-sub">
                      Kod {s.code}
                      {s.institutionCode ? ` · Kurum ${s.institutionCode}` : ''}
                    </span>
                  </span>
                  {selected && (
                    <span className="xl-school-option-check" aria-hidden="true">
                      <svg viewBox="0 0 14 14" width="13" height="13" fill="none">
                        <path d="M3 7.2l2.5 2.5L11 4.2" stroke="var(--os-accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
