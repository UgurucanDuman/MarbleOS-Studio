import React, { useCallback, useEffect, useRef } from 'react';
import './stage-zoom-bar.css';

/**
 * İZOLE PENCERE SİSTEMİ · 0.5x – 5x (%500) CANLI KAĞIT ZUM DENETÇİSİ:
 * Modül 03 (Albüm, Çizelge & Kimlik) ve Modül 04 (Baskı & Çıktı Merkezi) sahnelerinde
 * Sığdır + %50 ile %500 (5x) arası kademesiz vektör yakınlaştırma ve Ctrl+Tekerlek zumu sağlar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export type StageZoomValue = 'fit' | number;

export const MIN_STAGE_ZOOM = 0.5;
export const MAX_STAGE_ZOOM = 5;
const ZOOM_STEP = 0.25;
const QUICK_PRESETS = [1, 2, 3, 5] as const;

export function clampStageZoom(value: number): number {
  const rounded = Math.round(value * 20) / 20;
  return Math.min(MAX_STAGE_ZOOM, Math.max(MIN_STAGE_ZOOM, rounded));
}

export function useViewportWheelZoom<T extends HTMLElement>(
  zoom: StageZoomValue,
  onChangeZoom: (next: StageZoomValue) => void,
): React.RefObject<T> {
  const ref = useRef<T>(null);
  const zoomRef = useRef<StageZoomValue>(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = zoomRef.current === 'fit' ? 1 : zoomRef.current;
      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      onChangeZoom(clampStageZoom(current + delta));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [onChangeZoom]);

  return ref;
}

export const StageZoomBar: React.FC<{
  zoom: StageZoomValue;
  onChangeZoom: (next: StageZoomValue) => void;
}> = React.memo(({ zoom, onChangeZoom }) => {
  const numericZoom = zoom === 'fit' ? 1 : zoom;

  const stepBy = useCallback(
    (delta: number) => {
      const base = zoom === 'fit' ? 1 : zoom;
      onChangeZoom(clampStageZoom(base + delta));
    },
    [zoom, onChangeZoom],
  );

  return (
    <div className="sz-zoom-bar" role="group" aria-label="Sahne yakınlaştırma kontrolü">
      <button
        type="button"
        className={`sz-zoom-btn ${zoom === 'fit' ? 'is-active' : ''}`.trim()}
        onClick={() => onChangeZoom('fit')}
        title="Kağıdı sahneye sığdır"
      >
        Sığdır
      </button>

      <span className="sz-zoom-sep" aria-hidden="true" />

      <button
        type="button"
        className="sz-zoom-btn"
        disabled={zoom !== 'fit' && zoom <= MIN_STAGE_ZOOM}
        onClick={() => stepBy(-ZOOM_STEP)}
        aria-label="Uzaklaştır"
        title="Uzaklaştır (-%25)"
      >
        −
      </button>

      <input
        type="range"
        className="sz-zoom-slider"
        min={MIN_STAGE_ZOOM}
        max={MAX_STAGE_ZOOM}
        step={ZOOM_STEP}
        value={numericZoom}
        aria-label="Yakınlaştırma oranı"
        onChange={(e) => onChangeZoom(clampStageZoom(Number(e.target.value)))}
      />

      <button
        type="button"
        className="sz-zoom-btn"
        disabled={zoom !== 'fit' && zoom >= MAX_STAGE_ZOOM}
        onClick={() => stepBy(ZOOM_STEP)}
        aria-label="Yakınlaştır"
        title="Yakınlaştır (+%25, 5x'e kadar)"
      >
        +
      </button>

      <span className="sz-zoom-readout" title="Ctrl + Fare Tekerleği ile yakınlaştırabilirsiniz">
        {zoom === 'fit' ? 'Oto' : `%${Math.round(zoom * 100)}`}
      </span>

      <span className="sz-zoom-sep" aria-hidden="true" />

      {QUICK_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          className={`sz-zoom-btn ${zoom === preset ? 'is-active' : ''}`.trim()}
          onClick={() => onChangeZoom(preset)}
          aria-label={`${preset}x yakınlaştır`}
        >
          {preset}x
        </button>
      ))}
    </div>
  );
});
