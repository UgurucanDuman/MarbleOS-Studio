import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { springWindowFluid } from '../../system/motion/macosMotion';
import { SheetAutoIcon } from './SheetFieldIcons';
import { useSegmentScroll } from './useSegmentScroll';
import './apple-glass-segment.css';

/**
 * Ortak Apple macOS Liquid Glass tarzı yumuşak kayan seçici sekme çubuğu (Segmented Control).
 * Tüm modüller (Excel Listesi, Fotoğraf Stüdyosu, Albüm/Kimlik, Baskı Merkezi) tarafından paylaşılır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const AppleGlassSegment: React.FC<{
  ariaLabel: string;
  items: ReadonlyArray<{ id: string; label: string; iconHint?: string }>;
  activeId: string;
  onChange: (id: string) => void;
  fullWidth?: boolean;
  compact?: boolean;
  hideArrows?: boolean;
  hideIcons?: boolean;
  emptyText?: string;
}> = ({
  ariaLabel, items, activeId, onChange, fullWidth = false, compact = false, hideArrows = false, hideIcons = false, emptyText,
}) => {
  const pillId = useId();
  const reduced = useReducedMotion() ?? false;
  const { trackRef, itemsRef, edges, scrollByStep } = useSegmentScroll(activeId, items.length, fullWidth, reduced);
  const showArrows = !hideArrows && !fullWidth && items.length > 4 && (edges.left || edges.right);

  return (
    <div className={`xl-segment-shell ${fullWidth ? 'is-full' : ''} ${hideArrows || items.length <= 4 ? 'is-fixed' : ''}`.trim()}>
      {showArrows && (
        <button
          type="button"
          className="xl-segment-nav-btn"
          aria-label="Önceki şubeler"
          title="Sola kaydır"
          disabled={!edges.left}
          onClick={() => scrollByStep(-1)}
        >
          ‹
        </button>
      )}
      <motion.div
        ref={trackRef}
        layoutScroll
        className={`xl-segment xl-glass-segment ${fullWidth ? 'xl-sheet-tabs' : ''}`.trim()}
        role="tablist"
        aria-label={ariaLabel}
      >
        <div className="xl-segment-items" ref={itemsRef}>
          {items.length === 0 && emptyText && <span className="xl-muted">{emptyText}</span>}
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`xl-segment-item ${active ? 'is-active' : ''}`}
                style={compact ? { padding: '4.5px 9px', fontSize: '13.5px' } : undefined}
                onClick={() => onChange(item.id)}
              >
                {active && (
                  <motion.span
                    layoutId={pillId}
                    layoutDependency={activeId}
                    className="xl-glass-pill"
                    transition={springWindowFluid}
                    aria-hidden="true"
                  />
                )}
                <span className="xl-segment-label">
                  {!hideIcons && <SheetAutoIcon text={item.iconHint ?? item.label} size={compact ? 12 : 13} />}
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
      {showArrows && (
        <button
          type="button"
          className="xl-segment-nav-btn"
          aria-label="Sonraki şubeler"
          title="Sağa kaydır"
          disabled={!edges.right}
          onClick={() => scrollByStep(1)}
        >
          ›
        </button>
      )}
    </div>
  );
};
