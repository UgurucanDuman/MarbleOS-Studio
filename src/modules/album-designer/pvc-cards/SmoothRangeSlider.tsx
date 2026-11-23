import React, { useEffect, useRef, useState } from 'react';

/**
 * İZOLE MODÜL 03 · 60 FPS SIFIR-KASMA KAYDIRICI:
 * Sürükleme sırasında yalnızca hafif yerel önizleme durumunu günceller;
 * fare bırakıldığında (pointerup/blur) veya klavye duraklamasında tek atomik kayıt yapar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const SmoothRangeSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  resetLabel?: string;
  onReset?: () => void;
  onLiveChange?: (next: number) => void;
  onCommit: (next: number) => void;
}> = React.memo(({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  resetLabel,
  onReset,
  onLiveChange,
  onCommit,
}) => {
  const [localVal, setLocalVal] = useState(value);
  const draggingRef = useRef(false);
  const latestRef = useRef(value);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!draggingRef.current) {
      setLocalVal(value);
      latestRef.current = value;
    }
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const flushCommit = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    draggingRef.current = false;
    onLiveChange?.(latestRef.current);
    onCommit(latestRef.current);
  };

  return (
    <label className="pvc-range-field">
      <div className="tc-section-head">
        <span>{label}</span>
        {resetLabel && onReset && (
          <button
            type="button"
            className="tc-auto-link"
            onClick={(e) => {
              e.preventDefault();
              if (timerRef.current !== null) window.clearTimeout(timerRef.current);
              draggingRef.current = false;
              onReset();
            }}
          >
            {resetLabel}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={localVal}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={flushCommit}
        onPointerCancel={flushCommit}
        onBlur={() => {
          if (latestRef.current !== value) flushCommit();
        }}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          setLocalVal(next);
          latestRef.current = next;
          onLiveChange?.(next);
          if (!draggingRef.current) {
            if (timerRef.current !== null) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
              timerRef.current = null;
              onCommit(latestRef.current);
            }, 140);
          }
        }}
      />
    </label>
  );
});
