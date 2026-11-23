import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SmartWindowLayoutControlState, WindowSnapPreset } from './types';
import './window-tiling.css';

interface WindowControlCapsuleProps {
  isMaximized: boolean;
  smartLayout?: SmartWindowLayoutControlState;
  onMinimize: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMaximize: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClose: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const TILING_PRESETS: Array<{
  preset: WindowSnapPreset;
  label: string;
  zoneClass: string;
}> = [
  { preset: 'left', label: 'Sol Yarı', zoneClass: 'zone-left' },
  { preset: 'right', label: 'Sağ Yarı', zoneClass: 'zone-right' },
  { preset: 'tile-two', label: 'Otomatik Böl', zoneClass: 'zone-split' },
  { preset: 'center', label: 'Merkez Odak', zoneClass: 'zone-center' },
  { preset: 'top-left', label: 'Sol Üst', zoneClass: 'zone-tl' },
  { preset: 'top-right', label: 'Sağ Üst', zoneClass: 'zone-tr' },
  { preset: 'bottom-left', label: 'Sol Alt', zoneClass: 'zone-bl' },
  { preset: 'bottom-right', label: 'Sağ Alt', zoneClass: 'zone-br' },
];

/**
 * MarbleOS Studio — MerbleOS `WindowControlCapsule` + `SmartWindowLayoutControl` + Ekran Bölme
 * - Üstte MerbleOS'un kendi `Akıllı Böl (N pencereyi düzenle)` + `Varsayılan Boyut` sistemi,
 *   altta ise hızlı ekran bölme şablonları tek animasyonlu menüde birleştirilmiştir.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const WindowControlCapsule: React.FC<WindowControlCapsuleProps> = React.memo(
  ({ isMaximized, smartLayout, onMinimize, onMaximize, onClose }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!menuOpen) return;
      const closeOnOutsidePointer = (ev: PointerEvent) => {
        if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) {
          setMenuOpen(false);
        }
      };
      const closeOnEscape = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') setMenuOpen(false);
      };
      document.addEventListener('pointerdown', closeOnOutsidePointer);
      document.addEventListener('keydown', closeOnEscape);
      return () => {
        document.removeEventListener('pointerdown', closeOnOutsidePointer);
        document.removeEventListener('keydown', closeOnEscape);
      };
    }, [menuOpen]);

    const isLayoutActive = Boolean(
      !isMaximized && (smartLayout?.isEnabled || smartLayout?.snapPreset),
    );
    const visibleCount = smartLayout?.visibleCount ?? 1;

    return (
      <div
        ref={wrapRef}
        role="group"
        aria-label="Pencere kontrolleri"
        data-chrome-action="true"
        className="os-control-capsule"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {!isMaximized && smartLayout && (
          <>
            <div className="os-tiling-anchor">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                title="Akıllı Böl & Pencere Düzeni"
                aria-label="Akıllı Böl ve Pencere Düzeni"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`os-capsule-btn ${menuOpen || isLayoutActive ? 'active' : ''}`}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="2" y="2.5" width="5" height="11" rx="1.3" />
                  <rect x="9" y="2.5" width="5" height="4.8" rx="1.2" />
                  <rect x="9" y="8.7" width="5" height="4.8" rx="1.2" />
                </svg>
              </motion.button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    aria-label="Pencere düzeni seçenekleri"
                    className="os-tiling-popover"
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: 'top right' }}
                  >
                    {/* MerbleOS Orijinal Akıllı Böl (Çoklu Pencere Otomatik Izgara) */}
                    <button
                      type="button"
                      role="menuitem"
                      className={`os-smart-tile-primary ${smartLayout.isEnabled ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        smartLayout.onActivateSmartTile();
                        setMenuOpen(false);
                      }}
                    >
                      <span className="os-smart-tile-icon">
                        <svg
                          viewBox="0 0 16 16"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <rect x="2" y="2" width="5" height="5" rx="1.2" />
                          <rect x="9" y="2" width="5" height="5" rx="1.2" />
                          <rect x="2" y="9" width="5" height="5" rx="1.2" />
                          <rect x="9" y="9" width="5" height="5" rx="1.2" />
                        </svg>
                      </span>
                      <span className="os-smart-tile-copy">
                        <strong>Akıllı Böl</strong>
                        <small>
                          {visibleCount >= 2
                            ? `${visibleCount} açık pencereyi düzenle`
                            : '2 pencereyi yan yana düzenle'}
                        </small>
                      </span>
                      <span className="os-smart-tile-count">
                        {visibleCount >= 2 ? visibleCount : 2}
                      </span>
                    </button>

                    {isLayoutActive && (
                      <button
                        type="button"
                        role="menuitem"
                        className="os-smart-tile-reset"
                        onClick={(e) => {
                          e.stopPropagation();
                          smartLayout.onResetLayout();
                          setMenuOpen(false);
                        }}
                      >
                        <svg
                          viewBox="0 0 16 16"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path
                            d="M6 3v3H3M10 3v3h3M6 13v-3H3M10 13v-3h3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>Varsayılan Boyuta Dön</span>
                      </button>
                    )}

                    <div className="os-tiling-divider" />
                    <div className="os-tiling-header">EKRAN BÖLME DÜZENLERİ</div>
                    <div className="os-tiling-grid">
                      {TILING_PRESETS.map((item) => {
                        const isSelected =
                          !smartLayout.isEnabled && smartLayout.snapPreset === item.preset;
                        return (
                          <motion.button
                            key={item.preset}
                            type="button"
                            role="menuitem"
                            whileTap={{ scale: 0.95 }}
                            className={`os-tiling-item ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(false);
                              smartLayout.onSelectPreset(item.preset);
                            }}
                          >
                            <span className={`os-tiling-preview ${item.zoneClass}`} />
                            <span className="os-tiling-label">{item.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className="os-capsule-divider" aria-hidden="true" />
          </>
        )}

        <button
          type="button"
          onClick={(e) => {
            setMenuOpen(false);
            onMinimize(e);
          }}
          title="Küçült"
          aria-label="Pencereyi Küçült"
          className="os-capsule-btn"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3.5" y1="8" x2="12.5" y2="8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            setMenuOpen(false);
            onMaximize(e);
          }}
          title={isMaximized ? 'Geri Yükle' : 'Büyüt'}
          aria-label="Pencereyi Büyüt / Geri Yükle"
          className="os-capsule-btn"
        >
          {isMaximized ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 3v3H3M10 3v3h3M6 13v-3H3M10 13v-3h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            setMenuOpen(false);
            onClose(e);
          }}
          title="Kapat"
          aria-label="Pencereyi Kapat"
          className="os-capsule-btn os-capsule-close"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="4" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="4" x2="4" y2="12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  },
);
