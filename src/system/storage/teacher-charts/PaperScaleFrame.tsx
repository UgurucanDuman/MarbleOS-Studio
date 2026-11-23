import React, { useLayoutEffect, useRef, useState } from 'react';
import { useWindowWorkEnabled } from '../../motion/windowWork';

/**
 * İZOLE KANONİK A4 SÜPER-ÖRNEKLEME (SUPERSAMPLING) ÇERÇEVESİ:
 * Küçük zumlarda (Sığdır / 0.5x / 1x) Chromium'un 6px altı font yuvarlama bozulmasını
 * ve alt-piksel (<1px) tablo çizgisi kaybını `--tc-inv-scale` telafisiyle önler;
 * 2x – 5x (%500) zumda ise doğrudan ham vektör genişliğinde jilet gibi çizer.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const CANONICAL_A4_WIDTH_PX = 1040;
export const CANONICAL_A4_LANDSCAPE_WIDTH_PX = 1280;

export const PaperScaleFrame: React.FC<{
  fitMaxWidthPx: number;
  zoomWidthPx?: number;
  landscape?: boolean;
  paperVars: React.CSSProperties;
  paperClassName?: string;
  children: React.ReactNode;
}> = ({ fitMaxWidthPx, zoomWidthPx, landscape = false, paperVars, paperClassName = '', children }) => {
  const workEnabled = useWindowWorkEnabled();
  const frameRef = useRef<HTMLDivElement>(null);
  const [measuredFitW, setMeasuredFitW] = useState<number>(fitMaxWidthPx);

  useLayoutEffect(() => {
    if (!workEnabled || zoomWidthPx !== undefined) return undefined;
    const el = frameRef.current;
    if (!el) return undefined;

    const syncWidth = (w: number) => {
      const rounded = Math.round(w);
      if (rounded > 40) {
        setMeasuredFitW((prev) => (prev === rounded ? prev : rounded));
      }
    };

    if (el.clientWidth > 40) {
      syncWidth(el.clientWidth);
    }

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 40) {
        syncWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [zoomWidthPx, fitMaxWidthPx, landscape, workEnabled]);

  const canonicalW = landscape ? CANONICAL_A4_LANDSCAPE_WIDTH_PX : CANONICAL_A4_WIDTH_PX;
  const paperWidthMm = landscape ? 297 : 210;
  const displayW = zoomWidthPx ?? measuredFitW;
  const isSupersampled = displayW < canonicalW;
  const layoutW = isSupersampled ? canonicalW : displayW;
  const scale = isSupersampled ? displayW / canonicalW : 1;
  const invScale = isSupersampled ? canonicalW / Math.max(1, displayW) : 1;
  const fitWidthCss = landscape
    ? `min(${fitMaxWidthPx}px, var(--tc-paper-landscape-fit-limit, 92vh), 88vw)`
    : `min(${fitMaxWidthPx}px, var(--tc-paper-fit-limit, 56vh), 88vw)`;

  return (
    <div
      ref={frameRef}
      className={`tc-scale-frame ${landscape ? 'is-landscape' : ''}`.trim()}
      style={{
        width: zoomWidthPx ? `${zoomWidthPx}px` : fitWidthCss,
      }}
    >
      <div
        className={`tc-a4-paper ${landscape ? 'is-landscape' : ''} ${paperClassName} ${isSupersampled ? 'is-scaled' : ''}`.trim()}
        style={{
          ...paperVars,
          ...({
            '--tc-mm': `${layoutW / paperWidthMm}px`,
            '--tc-inv-scale': invScale.toFixed(4),
          } as React.CSSProperties),
          width: `${layoutW}px`,
          transform: isSupersampled ? `scale(${scale})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
