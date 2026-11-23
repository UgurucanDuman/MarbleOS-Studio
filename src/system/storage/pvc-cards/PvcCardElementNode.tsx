import React, { useMemo } from 'react';
import type { PhotoRecord } from '../../sqlite/types';
import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';
import { photoAdjustmentStyle, StudioPhotoImage } from '../StudioPhotoImage';
import type { TeacherChartPalette } from '../teacher-charts/types';
import { encodeCode128B } from './code128Encoder';
import {
  PVC_FIELD_MAP,
  pvcFontFamilyCss,
  resolvePvcCodePayload,
  resolvePvcColorToken,
  resolvePvcFieldValue,
} from './fieldResolver';
import { encodeQrMatrix, qrMatrixToSvgPath } from './qrCodeEncoder';
import type { PvcCardDataContext, PvcCardElement } from './types';

/**
 * İZOLE SİSTEM ORTAK PVC KATMAN DÜĞÜMÜ:
 * Portre (kare/yuvarlak/kemer/altıgen), Okul & Stüdyo Logosu, İmza, Özel Görsel,
 * Dinamik/Sabit Metin (çift tıkla satır içi düzenleme), Gerçek Code128 Barkod, QR ve Vektör Şekiller.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const BarcodeSvg: React.FC<{ value: string; color: string; showText: boolean }> = React.memo(
  ({ value, color, showText }) => {
    const encoded = useMemo(() => encodeCode128B(value), [value]);
    return (
      <div className="pvc-barcode-box" role="img" aria-label={`Code128 Barkod: ${encoded.displayValue}`}>
        <svg
          className="pvc-barcode-bars"
          width="100%"
          height="100%"
          viewBox={`0 0 ${encoded.totalModules} 28`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {encoded.bars.map((bar, i) => (
            <rect key={i} x={bar.x} y={0} width={bar.w} height={28} fill={color} />
          ))}
        </svg>
        {showText && (
          <span className="pvc-barcode-num" style={{ color }}>
            {encoded.displayValue}
          </span>
        )}
      </div>
    );
  },
);

const QrCodeSvg: React.FC<{ value: string; color: string }> = React.memo(({ value, color }) => {
  const svg = useMemo(() => qrMatrixToSvgPath(encodeQrMatrix(value)), [value]);
  return (
    <svg
      className="pvc-qr-svg"
      width="100%"
      height="100%"
      viewBox={`0 0 ${svg.viewBoxSize} ${svg.viewBoxSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR Kod: ${value}`}
    >
      <rect width={svg.viewBoxSize} height={svg.viewBoxSize} fill="#ffffff" />
      <path d={svg.d} fill={color} />
    </svg>
  );
});

const ShapeSvg: React.FC<{
  variant: 'wave' | 'diagonal';
  c1: string;
  c2: string;
  idKey: string;
}> = ({ variant, c1, c2, idKey }) => (
  <svg className="pvc-shape-svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id={`sh-${idKey}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={c1} />
        <stop offset="100%" stopColor={c2} />
      </linearGradient>
    </defs>
    {variant === 'wave' ? (
      <path d="M 0 0 L 100 0 L 100 72 Q 66 104, 34 78 T 0 88 Z" fill={`url(#sh-${idKey})`} />
    ) : (
      <polygon points="0,0 100,0 68,100 0,100" fill={`url(#sh-${idKey})`} />
    )}
  </svg>
);

export function photoShapeCss(
  shape: PvcCardElement['photoShape'],
  radiusCss?: string,
): React.CSSProperties {
  if (shape === 'circle') return { borderRadius: '50%' };
  if (shape === 'arch') return { borderRadius: '50% 50% 10% 10% / 38% 38% 6% 6%' };
  if (shape === 'hexagon') {
    return { clipPath: 'polygon(50% 0%, 100% 22%, 100% 78%, 50% 100%, 0% 78%, 0% 22%)' };
  }
  if (shape === 'rect') return { borderRadius: '0px' };
  return { borderRadius: radiusCss };
}

export const PvcCardElementContent: React.FC<{
  el: PvcCardElement;
  cardW: number;
  palette: TeacherChartPalette;
  data: PvcCardDataContext;
  photo?: PhotoRecord | null;
  logoUrl: string;
  studioLogoUrl: string;
  principalSigUrl: string;
  deputySigUrl: string;
  printFontPt: PrintFontPoint;
  isInteractive: boolean;
  isEditingInline: boolean;
  onInlineChange?: (nextText: string) => void;
  onInlineFinish?: () => void;
}> = React.memo(({
  el,
  cardW,
  palette,
  data,
  photo,
  logoUrl,
  studioLogoUrl,
  principalSigUrl,
  deputySigUrl,
  printFontPt,
  isInteractive,
  isEditingInline,
  onInlineChange,
  onInlineFinish,
}) => {
  const fontScale = 1 + (printFontPt - DEFAULT_PRINT_FONT_PT) * 0.14;
  const toCqw = (mm: number) => `${((mm / cardW) * 100).toFixed(4)}cqw`;
  const radiusCss = (el.radiusMm ?? 0) > 0 ? toCqw(el.radiusMm ?? 0) : undefined;

  if (el.kind === 'shape') {
    if (el.shapeVariant === 'wave' || el.shapeVariant === 'diagonal') {
      const c1 = resolvePvcColorToken(el.fillColor, palette, palette.accent);
      const c2 = resolvePvcColorToken(el.fillColor2 || el.fillColor, palette, palette.gridBorder);
      return <ShapeSvg variant={el.shapeVariant} c1={c1} c2={c2} idKey={el.id} />;
    }
    return null;
  }

  if (el.kind === 'photo') {
    const fit = el.imageFit ?? 'cover';
    const zoom = el.photoZoom ?? 1;
    const posX = el.photoPosX ?? 50;
    const defaultPosY = el.wMm / Math.max(0.1, el.hMm) > 0.78 ? 16 : 24;
    const posY = el.photoPosY ?? defaultPosY;
    const adjStyle = photo ? photoAdjustmentStyle(photo.adjustments, true) : undefined;
    const cardScale = zoom !== 1 ? `scale3d(${zoom.toFixed(3)}, ${zoom.toFixed(3)}, 1)` : undefined;
    const outerZoomStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      transformOrigin: `${posX}% ${posY}%`,
      transform: cardScale,
    };
    const imgStyle: React.CSSProperties = {
      ...adjStyle,
      objectFit: fit,
      objectPosition: `${posX}% ${posY}%`,
    };
    return (
      <div
        className="pvc-el-photo"
        style={{
          ...photoShapeCss(el.photoShape, radiusCss),
          background: fit === 'contain' ? '#ffffff' : undefined,
        }}
      >
        {photo ? (
          <div style={outerZoomStyle}>
            <StudioPhotoImage
              photo={photo}
              alt={data.student ? `${data.student.firstName} ${data.student.lastName}` : 'Portre'}
              loading="lazy"
              decoding="async"
              style={imgStyle}
            />
          </div>
        ) : (
          <span className="pvc-el-photo-empty">{data.student ? 'Foto Yok' : 'PORTRE'}</span>
        )}
      </div>
    );
  }

  if (el.kind === 'school-logo' || el.kind === 'studio-logo') {
    const src = el.kind === 'studio-logo' ? studioLogoUrl : logoUrl;
    if (src) {
      return <img src={src} alt="" className="pvc-el-contain-img" style={{ borderRadius: radiusCss }} />;
    }
    return isInteractive ? (
      <span className="pvc-el-ghost-tag">{el.kind === 'studio-logo' ? 'STÜDYO' : 'LOGO'}</span>
    ) : null;
  }

  if (el.kind === 'image') {
    if (el.imageDataUrl) {
      return (
        <img
          src={el.imageDataUrl}
          alt=""
          className="pvc-el-contain-img"
          style={{ objectFit: el.imageFit ?? 'contain', borderRadius: radiusCss }}
        />
      );
    }
    return isInteractive ? <span className="pvc-el-ghost-tag">GÖRSEL</span> : null;
  }

  if (el.kind === 'signature') {
    const sigUrl = el.sigRole === 'deputy' ? deputySigUrl : principalSigUrl;
    if (sigUrl) {
      return (
        <div className="pvc-el-sig-wrap">
          <img src={sigUrl} alt="İmza" className="pvc-el-sig-img" />
          <span className="pvc-el-sig-caption" style={{ color: palette.inkSecondary }}>
            {el.sigRole === 'deputy' ? 'Müdür Yrd.' : 'Okul Müdürü'}
          </span>
        </div>
      );
    }
    return isInteractive ? <span className="pvc-el-ghost-tag">İMZA</span> : null;
  }

  if (el.kind === 'barcode') {
    return (
      <BarcodeSvg
        value={resolvePvcCodePayload(el.codeSource, data)}
        color={resolvePvcColorToken(el.textColor, palette, '#09090b')}
        showText={el.showCodeText ?? true}
      />
    );
  }

  if (el.kind === 'qrcode') {
    return (
      <QrCodeSvg
        value={resolvePvcCodePayload(el.codeSource, data)}
        color={resolvePvcColorToken(el.textColor, palette, '#09090b')}
      />
    );
  }

  const pt = (el.fontSizePt ?? 6.5) * fontScale;
  const fontSizeCqw = `${(((pt * 0.352778) / cardW) * 100).toFixed(4)}cqw`;
  const textStyle: React.CSSProperties = {
    fontSize: fontSizeCqw,
    fontWeight: el.fontWeight ?? 600,
    fontFamily: pvcFontFamilyCss(el.fontFamily),
    color: resolvePvcColorToken(el.textColor, palette, palette.inkPrimary),
    textAlign: el.align ?? 'left',
  };

  if (el.kind === 'text' && isEditingInline) {
    return (
      <input
        type="text"
        className="pvc-inline-text-input"
        style={textStyle}
        value={el.text ?? ''}
        autoFocus
        maxLength={180}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onInlineChange?.(e.target.value)}
        onBlur={() => onInlineFinish?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            onInlineFinish?.();
          }
        }}
      />
    );
  }

  const rawText =
    el.kind === 'field' && el.fieldKey
      ? resolvePvcFieldValue(el.fieldKey, data, el.prefix ?? '')
      : (el.text ?? '');
  const display = el.uppercase ? rawText.toLocaleUpperCase('tr-TR') : rawText;
  if (!display && !isInteractive) return null;

  const isGhost = !display && isInteractive;
  const ghostText =
    el.kind === 'field' && el.fieldKey
      ? `[${PVC_FIELD_MAP.get(el.fieldKey)?.label ?? 'Alan'}]`
      : '[Metin]';

  const maxLines = el.maxLines ?? 1;
  return (
    <span
      className={`pvc-el-text ${maxLines > 1 ? 'is-multiline' : 'is-singleline'} ${isGhost ? 'is-ghost-placeholder' : ''}`.trim()}
      style={{ ...textStyle, WebkitLineClamp: maxLines > 1 ? maxLines : undefined }}
    >
      {display || ghostText}
    </span>
  );
});
