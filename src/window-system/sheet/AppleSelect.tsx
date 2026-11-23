import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { springWindowRestore } from '../../system/motion/macosMotion';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';
import { SheetAutoIcon } from './SheetFieldIcons';
import { measureSelectPopover } from './selectPopoverPlacement';
import './apple-select.css';

export interface AppleSelectOption {
  value: string;
  label: string;
  iconHint?: string;
}

interface AppleSelectProps {
  value: string;
  options: ReadonlyArray<AppleSelectOption>;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  inline?: boolean;
  expandMenu?: boolean;
  className?: string;
}

/**
 * Apple macOS Pro tarzı özel açılır seçici (Popover Listbox).
 * Ham tarayıcı/Windows `<select>` kutusunun yerine tüm modüllerde kullanılır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const AppleSelect: React.FC<AppleSelectProps> = React.memo(
  ({
    value,
    options,
    onChange,
    placeholder = 'Seçin…',
    ariaLabel,
    disabled = false,
    inline = false,
    expandMenu = false,
    className = '',
  }) => {
    const workEnabled = useWindowWorkEnabled();
    const reduced = useReducedMotion() ?? false;
    const [placement, setPlacement] = useState<{ opensUp: boolean; maxHeight?: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const open = Boolean(placement) && !disabled && workEnabled;

    useEffect(() => {
      if (!workEnabled || disabled) setPlacement(null);
    }, [disabled, workEnabled]);

    useEffect(() => {
      if (!open) return;
      const onPointerDown = (e: PointerEvent) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
          setPlacement(null);
        }
      };
      document.addEventListener('pointerdown', onPointerDown);
      return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    const closeAndFocus = () => {
      setPlacement(null);
      triggerRef.current?.focus({ preventScroll: true });
    };

    const activeOption = options.find((opt) => opt.value === value);
    const displayLabel = activeOption ? activeOption.label : placeholder;
    const iconKey = activeOption?.iconHint ?? activeOption?.label ?? ariaLabel ?? placeholder;

    return (
      <div
        ref={wrapRef}
        data-menu-layout={expandMenu ? 'expanded' : undefined}
        data-select-open={open || undefined}
        onBlur={(event) => {
          if (open && !event.currentTarget.contains(event.relatedTarget)) setPlacement(null);
        }}
        onKeyDown={(event) => {
          if (!open || event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          closeAndFocus();
        }}
        className={`os-apple-select ${inline ? 'is-inline' : ''} ${className}`.trim()}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className={`os-apple-select-btn ${open ? 'is-open' : ''}`}
          onClick={(event) => {
            if (open) {
              setPlacement(null);
              return;
            }
            setPlacement(expandMenu ? { opensUp: false } : measureSelectPopover(event.currentTarget, 5, 224));
          }}
        >
          <span className="os-apple-select-lead">
            <SheetAutoIcon text={iconKey} size={13} />
            <span className={`os-apple-select-text ${!activeOption ? 'is-placeholder' : ''}`}>
              {displayLabel}
            </span>
          </span>
          <span className="os-apple-select-chev" aria-hidden="true">
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
              <path
                d="M2.6 4.4L6 7.8l3.4-3.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        <AnimatePresence>
          {open && placement && (
            <motion.div
              role="listbox"
              aria-label={ariaLabel}
              className="os-apple-select-popover"
              data-placement={placement.opensUp ? 'above' : 'below'}
              style={{
                maxHeight: placement.maxHeight,
                transformOrigin: placement.opensUp ? 'bottom center' : 'top center',
              }}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: placement.opensUp ? 5 : -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: placement.opensUp ? 5 : -5, scale: 0.97 }}
              transition={reduced ? { duration: 0.1 } : springWindowRestore}
            >
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`os-apple-select-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      closeAndFocus();
                    }}
                  >
                    <span className="os-apple-select-opt-lead">
                      <SheetAutoIcon text={opt.iconHint ?? opt.label} size={12.5} />
                      <span className="os-apple-select-opt-label">{opt.label}</span>
                    </span>
                    {selected && (
                      <span className="os-apple-select-check" aria-hidden="true">
                        <svg viewBox="0 0 14 14" width="12.5" height="12.5" fill="none">
                          <path
                            d="M3 7.2l2.5 2.5L11 4.2"
                            stroke="var(--os-accent)"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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
  },
);
