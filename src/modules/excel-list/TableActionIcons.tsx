import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  easeAppleOut,
  springWindowRestore,
} from '../../system/motion/macosMotion';

/**
 * Tablo başlığındaki yuvarlak "Tümünü Seç" onay kutusu ve seçildiğinde
 * hemen yanında Apple popover tarzında açılan "Seçilenleri Sil (X)" aksiyonu.
 */
export const TableMasterCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  label: string;
  checkedCount?: number;
  onDeleteChecked?: () => void;
  onChange: () => void;
}> = ({
  checked,
  indeterminate,
  disabled = false,
  label,
  checkedCount = 0,
  onDeleteChecked,
  onChange,
}) => {
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    setConfirming(false);
  }, [checkedCount]);

  return (
    <span className="xl-master-check-anchor">
      <input
        type="checkbox"
        className="xl-row-check"
        aria-label={label}
        disabled={disabled}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={() => {
          setConfirming(false);
          onChange();
        }}
      />
      <AnimatePresence initial={false}>
        {checkedCount > 0 && onDeleteChecked && (
          <motion.button
            layout="size"
            layoutDependency={confirming}
            key="master-del-popover"
            type="button"
            className={`xl-master-del-popover ${confirming ? 'is-confirming' : ''}`}
            aria-label={
              confirming
                ? 'Tümünü silmek istediğinizden emin misiniz?'
                : `Seçilenleri Sil (${checkedCount})`
            }
            initial={{ opacity: 0, scale: 0.86, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.86, x: -6 }}
            transition={springWindowRestore}
            onBlur={() => setConfirming(false)}
            onClick={(e) => {
              e.stopPropagation();
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setConfirming(false);
              onDeleteChecked();
            }}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
              <path
                d="M4.2 4.2l.6 8.6c0 .7.6 1.2 1.3 1.2h3.8c.7 0 1.2-.5 1.3-1.2l.6-8.6H4.2Z"
                fill="rgba(255, 255, 255, 0.24)"
              />
              <path
                d="M2.5 4.2h11M6 4.2V2.8c0-.4.3-.8.8-.8h2.4c.5 0 .8.4.8.8v1.4M4.2 4.2l.6 8.6c0 .7.6 1.2 1.3 1.2h3.8c.7 0 1.2-.5 1.3-1.2l.6-8.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={confirming ? 'confirm' : 'initial'}
                className="xl-master-del-text"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.16, ease: easeAppleOut }}
              >
                {confirming
                  ? 'Tümünü silmek istediğinizden emin misiniz?'
                  : `Seçilenleri Sil (${checkedCount})`}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </span>
  );
};

/** Satır içi profesyonel renkli Düzenle (Mavi Kalem) ikonu butonu. */
export const RowEditIconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
> = ({ label, className = '', ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`xl-icon-btn xl-icon-btn-edit ${className}`.trim()}
    {...rest}
  >
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
      <path
        d="M11.4 2.3a1.5 1.5 0 0 1 2.1 2.1L5.3 12.6l-2.8.7.7-2.8 8.2-8.2Z"
        fill="rgba(56, 189, 248, 0.24)"
        stroke="#2563eb"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9.8 3.9l2.1 2.1" stroke="#0ea5e9" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  </button>
);

/** Satır içi profesyonel renkli Sil (Kırmızı Çöp Kutusu) ikonu butonu (isteğe bağlı 2 adımlı onaylı). */
export const RowDeleteIconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; confirmText?: string }
> = ({ label, confirmText, className = '', onClick, onBlur, ...rest }) => {
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      aria-label={confirming && confirmText ? `${label} (${confirmText})` : label}
      title={confirming && confirmText ? confirmText : label}
      className={`xl-icon-btn xl-icon-btn-danger ${confirming ? 'is-confirming' : ''} ${className}`.trim()}
      onBlur={(e) => {
        setConfirming(false);
        onBlur?.(e);
      }}
      onClick={(e) => {
        if (confirmText && !confirming) {
          e.stopPropagation();
          setConfirming(true);
          return;
        }
        setConfirming(false);
        onClick?.(e);
      }}
      {...rest}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
        <path
          d="M4.2 4.2l.6 8.6c0 .7.6 1.2 1.3 1.2h3.8c.7 0 1.2-.5 1.3-1.2l.6-8.6H4.2Z"
          fill="rgba(244, 63, 94, 0.22)"
        />
        <path
          d="M2.5 4.2h11M6 4.2V2.8c0-.4.3-.8.8-.8h2.4c.5 0 .8.4.8.8v1.4M4.2 4.2l.6 8.6c0 .7.6 1.2 1.3 1.2h3.8c.7 0 1.2-.5 1.3-1.2l.6-8.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="6.7" y1="6.8" x2="6.7" y2="11.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="9.3" y1="6.8" x2="9.3" y2="11.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      {confirming && confirmText && <span>{confirmText}</span>}
    </button>
  );
};

/** 20'şer kayıtlık sonsuz kaydırma alt bilgi ve gözlemci çubuğu. */
export const TableInfiniteFooter: React.FC<{
  visibleCount: number;
  totalCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  sentinelRef?: React.RefObject<HTMLDivElement>;
}> = ({ visibleCount, totalCount, hasMore, onLoadMore, sentinelRef }) => {
  if (totalCount === 0) return null;
  return (
    <div className="xl-table-footer">
      <span>
        Gösterilen: <strong>{visibleCount}</strong> / <strong>{totalCount}</strong> kayıt
        {hasMore && " · Kaydırdıkça 20'şer yüklenir"}
      </span>
      {hasMore && (
        <>
          {sentinelRef && <div ref={sentinelRef} className="xl-scroll-sentinel" aria-hidden="true" />}
          <button type="button" className="xl-btn xl-btn-sm" onClick={onLoadMore}>
            +20 Kayıt Daha Göster
          </button>
        </>
      )}
    </div>
  );
};

export { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
export { AppleSchoolPicker, AppleSearchField } from './AppleControls';
