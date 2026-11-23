import React, { useState } from 'react';
import type { PhotoRecord } from '../../sqlite/types';
import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';
import type { TeacherChartPalette } from '../teacher-charts/types';
import { PvcCardArtworkSvg } from './cardArtworkSvg';
import { resolvePvcColorToken } from './fieldResolver';
import { resolveElementsForMedia } from './mediaLayoutAdjust';
import { photoShapeCss, PvcCardElementContent } from './PvcCardElementNode';
import {
  PVC_LANYARD_TOP_MM,
  PVC_SAFE_MARGIN_MM,
  type PvcCardDataContext,
  type PvcCardElement,
  type PvcCardSide,
  type PvcResolvedDesign,
} from './types';
import './pvc-card-live.css';

/**
 * İZOLE SİSTEM ORTAK PVC KİMLİK KARTI CANLI ÖNİZLEME & ETKİLEŞİMLİ TUVAL BİLEŞENİ:
 * Dış .pvc-card-shell konteyneri sayesinde kart köşesi (3.18 mm) ve tipografi cqw oranları
 * milimetrik doğrulukla ölçeklenir. Sürükle-bırak, 8 tutamaç, döndürme, çift tıkla yazma
 * ve araç kutusundan doğrudan karta sürükleyip bırakma (drop) destekler.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export type PvcResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const RESIZE_HANDLES: readonly PvcResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface PvcCardInteractiveProps {
  selectedElementId: string | null;
  snapGuideXMm?: number | null;
  snapGuideYMm?: number | null;
  onSelectElement: (id: string | null) => void;
  onStartMove: (e: React.PointerEvent, el: PvcCardElement) => void;
  onStartResize: (e: React.PointerEvent, el: PvcCardElement, handle: PvcResizeHandle) => void;
  onStartRotate?: (e: React.PointerEvent, el: PvcCardElement) => void;
  onInlineTextChange?: (elId: string, nextText: string) => void;
  onQuickAction?: (elId: string, action: 'up' | 'down' | 'duplicate' | 'lock' | 'delete') => void;
  onDropPaletteItem?: (payloadJson: string, xMm: number, yMm: number) => void;
}

export const PvcCardLiveView: React.FC<{
  design: PvcResolvedDesign;
  side: PvcCardSide;
  palette: TeacherChartPalette;
  data: PvcCardDataContext;
  photo?: PhotoRecord | null;
  logoUrl?: string;
  studioLogoUrl?: string;
  principalSigUrl?: string;
  deputySigUrl?: string;
  printFontPt?: PrintFontPoint;
  showSafeGuides?: boolean;
  squareCorners?: boolean;
  interactive?: PvcCardInteractiveProps;
  cardRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  style?: React.CSSProperties;
}> = React.memo(({
  design,
  side,
  palette,
  data,
  photo,
  logoUrl = '',
  studioLogoUrl = '',
  principalSigUrl = '',
  deputySigUrl = '',
  printFontPt = DEFAULT_PRINT_FONT_PT,
  showSafeGuides = false,
  squareCorners = false,
  interactive,
  cardRef,
  className = '',
  style,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dropMarker, setDropMarker] = useState<{ xMm: number; yMm: number } | null>(null);
  const spec = side === 'back' ? design.back : design.front;
  const cardW = design.widthMm;
  const cardH = design.heightMm;
  const toXPct = (mm: number) => `${(mm / cardW) * 100}%`;
  const toYPct = (mm: number) => `${(mm / cardH) * 100}%`;
  const toCqw = (mm: number) => `${((mm / cardW) * 100).toFixed(4)}cqw`;

  const bg1 = resolvePvcColorToken(spec.backgroundColor, palette, '#ffffff');
  const bg2 = spec.backgroundColor2 ? resolvePvcColorToken(spec.backgroundColor2, palette, bg1) : '';
  const bgStyle: React.CSSProperties = bg2
    ? { backgroundImage: `linear-gradient(${spec.backgroundGradientAngle ?? 135}deg, ${bg1}, ${bg2})` }
    : { backgroundColor: bg1 };

  const cardRadiusCss = squareCorners ? '0px' : toCqw(design.cardRadiusMm);
  const renderedElements = interactive
    ? spec.elements
    : resolveElementsForMedia(spec.elements, {
      hasSchoolLogo: Boolean(logoUrl),
      hasStudioLogo: Boolean(studioLogoUrl),
      cardWidthMm: cardW,
    });

  const clientToMm = (clientX: number, clientY: number, el: HTMLDivElement) => {
    const r = el.getBoundingClientRect();
    return {
      xMm: Number((((clientX - r.left) / Math.max(1, r.width)) * cardW).toFixed(1)),
      yMm: Number((((clientY - r.top) / Math.max(1, r.height)) * cardH).toFixed(1)),
    };
  };

  return (
    <div className={`pvc-card-shell ${className}`.trim()} style={style}>
      <div
        ref={cardRef as React.RefObject<HTMLDivElement>}
        className={`pvc-live-card ${interactive ? 'is-interactive' : ''} ${dropMarker ? 'is-drop-active' : ''}`.trim()}
        style={{
          aspectRatio: `${cardW} / ${cardH}`,
          borderRadius: cardRadiusCss,
          ...bgStyle,
        }}
        onPointerDown={(e) => {
          if (interactive && e.target === e.currentTarget) {
            interactive.onSelectElement(null);
            setEditingId(null);
          }
        }}
        onDragOver={
          interactive?.onDropPaletteItem
            ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setDropMarker(clientToMm(e.clientX, e.clientY, e.currentTarget));
            }
            : undefined
        }
        onDragLeave={() => setDropMarker(null)}
        onDrop={
          interactive?.onDropPaletteItem
            ? (e) => {
              e.preventDefault();
              const payload = e.dataTransfer.getData('application/x-marbleos-pvc');
              const pt = clientToMm(e.clientX, e.clientY, e.currentTarget);
              setDropMarker(null);
              if (payload) interactive.onDropPaletteItem?.(payload, pt.xMm, pt.yMm);
            }
            : undefined
        }
      >
        {spec.artworkStyle && spec.artworkStyle !== 'none' && (
          <PvcCardArtworkSvg
            styleId={spec.artworkStyle}
            side={side}
            widthMm={cardW}
            heightMm={cardH}
            palette={palette}
          />
        )}

        {spec.backgroundDataUrl && (
          <img
            src={spec.backgroundDataUrl}
            alt=""
            aria-hidden="true"
            className="pvc-live-bg-img"
            style={{
              objectFit: spec.backgroundFit ?? 'cover',
              opacity: spec.backgroundOpacity ?? 1,
            }}
          />
        )}

        {renderedElements.map((el) => {
          if (el.visible === false) return null;
          const isSelected = interactive?.selectedElementId === el.id;
          const radiusCss = (el.radiusMm ?? 0) > 0 ? toCqw(el.radiusMm ?? 0) : undefined;
          const borderCss =
            el.borderColor && (el.borderWidthMm ?? 0) > 0
              ? `${toCqw(el.borderWidthMm ?? 0.35)} solid ${resolvePvcColorToken(el.borderColor, palette, palette.accent)}`
              : undefined;

          const boxStyle: React.CSSProperties = {
            left: toXPct(el.xMm),
            top: toYPct(el.yMm),
            width: toXPct(el.wMm),
            height: toYPct(el.hMm),
            opacity: el.opacity ?? 1,
            transform: el.rotationDeg ? `rotate(${el.rotationDeg}deg)` : undefined,
            borderRadius: el.kind === 'shape' && el.shapeVariant === 'circle' ? '50%' : radiusCss,
            boxShadow: el.shadow ? '0 1.4cqw 3.4cqw rgba(15, 23, 42, 0.24)' : undefined,
          };

          if (el.kind === 'shape' && el.shapeVariant !== 'wave' && el.shapeVariant !== 'diagonal') {
            const c1 = el.fillColor ? resolvePvcColorToken(el.fillColor, palette, palette.accent) : '';
            const c2 = el.fillColor2 ? resolvePvcColorToken(el.fillColor2, palette, c1) : '';
            if (c1 && c2) {
              boxStyle.backgroundImage = `linear-gradient(${el.gradientAngle ?? 135}deg, ${c1}, ${c2})`;
            } else if (c1) {
              boxStyle.backgroundColor = c1;
            }
            boxStyle.border = borderCss;
          } else if (el.kind === 'photo') {
            Object.assign(boxStyle, photoShapeCss(el.photoShape, radiusCss));
            if (el.photoShape !== 'hexagon') boxStyle.border = borderCss;
          }

          return (
            <div
              key={el.id}
              data-pvc-el={el.id}
              className={`pvc-live-el is-kind-${el.kind} ${isSelected ? 'is-selected' : ''} ${el.locked ? 'is-locked' : ''}`.trim()}
              style={boxStyle}
              onDoubleClick={
                interactive && el.kind === 'text' && !el.locked
                  ? (e) => {
                    e.stopPropagation();
                    setEditingId(el.id);
                  }
                  : undefined
              }
              onPointerDown={
                interactive
                  ? (e) => {
                    e.stopPropagation();
                    if (editingId && editingId !== el.id) setEditingId(null);
                    interactive.onSelectElement(el.id);
                    if (!el.locked && editingId !== el.id) interactive.onStartMove(e, el);
                  }
                  : undefined
              }
            >
              <PvcCardElementContent
                el={el}
                cardW={cardW}
                palette={palette}
                data={data}
                photo={photo}
                logoUrl={logoUrl}
                studioLogoUrl={studioLogoUrl}
                principalSigUrl={principalSigUrl}
                deputySigUrl={deputySigUrl}
                printFontPt={printFontPt}
                isInteractive={Boolean(interactive)}
                isEditingInline={editingId === el.id}
                onInlineChange={(txt) => interactive?.onInlineTextChange?.(el.id, txt)}
                onInlineFinish={() => setEditingId(null)}
              />

              {interactive && isSelected && !el.locked && (
                <>
                  {RESIZE_HANDLES.map((h) => (
                    <span
                      key={h}
                      className={`pvc-resize-handle is-${h}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        interactive.onStartResize(e, el, h);
                      }}
                    />
                  ))}
                  {interactive.onStartRotate && (
                    <span
                      className="pvc-rotate-handle"
                      title="Döndürmek için sürükleyin"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        interactive.onStartRotate?.(e, el);
                      }}
                    />
                  )}
                </>
              )}

              {interactive && isSelected && interactive.onQuickAction && (
                <div
                  className="pvc-float-toolbar"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button type="button" title="Arkaya al" onClick={() => interactive.onQuickAction?.(el.id, 'down')}>↓</button>
                  <button type="button" title="Öne al" onClick={() => interactive.onQuickAction?.(el.id, 'up')}>↑</button>
                  <button type="button" title="Çoğalt" onClick={() => interactive.onQuickAction?.(el.id, 'duplicate')}>⧉</button>
                  <button type="button" title={el.locked ? 'Kilidi aç' : 'Kilitle'} onClick={() => interactive.onQuickAction?.(el.id, 'lock')}>
                    {el.locked ? 'Aç' : 'Kilit'}
                  </button>
                  <button type="button" className="is-danger" title="Sil" onClick={() => interactive.onQuickAction?.(el.id, 'delete')}>×</button>
                </div>
              )}
            </div>
          );
        })}

        {showSafeGuides && (
          <div
            className="pvc-safe-guide"
            aria-hidden="true"
            style={{
              left: toXPct(PVC_SAFE_MARGIN_MM),
              right: toXPct(PVC_SAFE_MARGIN_MM),
              top: toYPct(PVC_SAFE_MARGIN_MM),
              bottom: toYPct(PVC_SAFE_MARGIN_MM),
            }}
          >
            {design.orientation === 'portrait' && (
              <div
                className="pvc-lanyard-guide"
                style={{ height: `${((PVC_LANYARD_TOP_MM - PVC_SAFE_MARGIN_MM) / (cardH - 2 * PVC_SAFE_MARGIN_MM)) * 100}%` }}
              />
            )}
          </div>
        )}

        {dropMarker && (
          <div
            className="pvc-drop-pin"
            style={{ left: toXPct(dropMarker.xMm), top: toYPct(dropMarker.yMm) }}
            aria-hidden="true"
          >
            <span>{dropMarker.xMm}×{dropMarker.yMm} mm</span>
          </div>
        )}

        {interactive?.snapGuideXMm != null && (
          <div className="pvc-snap-line is-vertical" style={{ left: toXPct(interactive.snapGuideXMm) }} aria-hidden="true" />
        )}
        {interactive?.snapGuideYMm != null && (
          <div className="pvc-snap-line is-horizontal" style={{ top: toYPct(interactive.snapGuideYMm) }} aria-hidden="true" />
        )}
      </div>
    </div>
  );
});
