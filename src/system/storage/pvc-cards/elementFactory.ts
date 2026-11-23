import {
  pvcCardDimensions,
  type PvcCardElement,
  type PvcCardOrientation,
  type PvcCardSideSpec,
  type PvcCustomDesign,
  type PvcFieldKey,
  type PvcResolvedDesign,
  type PvcShapeVariant,
} from './types';

/**
 * İZOLE SİSTEM KATMANI: PVC Kart Öğesi Oluşturucu & Şablon Klonlama Fabrikası
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function clonePvcSide(side: PvcCardSideSpec): PvcCardSideSpec {
  return { ...side, elements: side.elements.map((el) => ({ ...el })) };
}

/** Kart fiziksel boyutu (mm) değiştiğinde tüm katmanları orantılı ölçekler. */
export function scalePvcSideToSize(
  side: PvcCardSideSpec,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number,
): PvcCardSideSpec {
  if (Math.abs(fromW - toW) < 0.05 && Math.abs(fromH - toH) < 0.05) return clonePvcSide(side);
  const sx = toW / Math.max(1, fromW);
  const sy = toH / Math.max(1, fromH);
  const sf = Math.min(sx, sy);
  const r2 = (v: number) => Number(v.toFixed(2));
  return {
    ...side,
    elements: side.elements.map((el) => ({
      ...el,
      xMm: Math.min(140, Math.max(-25, r2(el.xMm * sx))),
      yMm: Math.min(140, Math.max(-25, r2(el.yMm * sy))),
      wMm: Math.min(140, Math.max(0.2, r2(el.wMm * sx))),
      hMm: Math.min(140, Math.max(0.2, r2(el.hMm * sy))),
      ...(el.radiusMm !== undefined ? { radiusMm: Math.min(40, Math.max(0, r2(el.radiusMm * sf))) } : {}),
      ...(el.fontSizePt !== undefined ? { fontSizePt: Math.min(24, Math.max(4, r2(el.fontSizePt * sf))) } : {}),
    })),
  };
}

export function cloneDesignToCustom(
  source: Pick<PvcResolvedDesign, 'orientation' | 'widthMm' | 'heightMm' | 'cardRadiusMm' | 'front' | 'back'>,
  name: string,
): PvcCustomDesign {
  return {
    id: `custom-${crypto.randomUUID().slice(0, 12)}`,
    name: name.trim().slice(0, 60) || 'Özel Kart Tasarımı',
    orientation: source.orientation,
    widthMm: source.widthMm,
    heightMm: source.heightMm,
    cardRadiusMm: source.cardRadiusMm,
    front: clonePvcSide(source.front),
    back: clonePvcSide(source.back),
    updatedAt: new Date().toISOString(),
  };
}

export function createNewPvcElement(
  kind: PvcCardElement['kind'],
  orientation: PvcCardOrientation,
  opts?: {
    fieldKey?: PvcFieldKey;
    shapeVariant?: PvcShapeVariant;
    imageDataUrl?: string;
    atXMm?: number;
    atYMm?: number;
  },
): PvcCardElement {
  const { widthMm, heightMm } = pvcCardDimensions(orientation);
  const cx = opts?.atXMm ?? widthMm / 2;
  const cy = opts?.atYMm ?? heightMm / 2;
  const place = (w: number, h: number) => ({
    xMm: Number(Math.max(0, Math.min(widthMm - w, cx - w / 2)).toFixed(1)),
    yMm: Number(Math.max(0, Math.min(heightMm - h, cy - h / 2)).toFixed(1)),
    wMm: w,
    hMm: h,
  });
  const id = `el-${crypto.randomUUID().slice(0, 8)}`;

  switch (kind) {
    case 'photo':
      return { id, kind, photoShape: 'rounded', imageFit: 'cover', ...place(22, 29.3), radiusMm: 2.0, borderColor: 'accent', borderWidthMm: 0.45, shadow: true };
    case 'school-logo':
    case 'studio-logo':
      return { id, kind, ...place(10, 10), radiusMm: 1.5, opacity: 1 };
    case 'image':
      return { id, kind, imageDataUrl: opts?.imageDataUrl ?? '', imageFit: 'contain', ...place(16, 16), radiusMm: 1, opacity: 1 };
    case 'signature':
      return { id, kind, sigRole: 'principal', ...place(18, 8) };
    case 'barcode':
      return { id, kind, codeSource: 'studentNumber', showCodeText: true, ...place(34, 10), textColor: 'ink' };
    case 'qrcode':
      return { id, kind, codeSource: 'studentSummary', ...place(18, 18), textColor: 'ink' };
    case 'shape': {
      const sv = opts?.shapeVariant ?? 'rect';
      if (sv === 'circle') return { id, kind, shapeVariant: 'circle', ...place(16, 16), fillColor: 'accent', opacity: 0.9 };
      if (sv === 'line') return { id, kind, shapeVariant: 'line', ...place(46, 0.5), fillColor: 'accent', opacity: 0.85 };
      if (sv === 'wave') return { id, kind, shapeVariant: 'wave', xMm: 0, yMm: 0, wMm: widthMm, hMm: 14, fillColor: 'accent', fillColor2: 'accentDeep', gradientAngle: 135 };
      if (sv === 'diagonal') return { id, kind, shapeVariant: 'diagonal', xMm: 0, yMm: 0, wMm: 22, hMm: heightMm, fillColor: 'accent', fillColor2: 'accentDeep', gradientAngle: 150 };
      return { id, kind, shapeVariant: 'rect', ...place(34, 10), fillColor: 'accent', radiusMm: 1.5, opacity: 1 };
    }
    case 'text':
      return { id, kind, text: 'Özel Metin', ...place(40, 6), fontSizePt: 7, fontWeight: 600, textColor: 'ink', align: 'left', maxLines: 2 };
    case 'field':
    default:
      return { id, kind: 'field', fieldKey: opts?.fieldKey ?? 'fullName', prefix: '', ...place(44, 5), fontSizePt: 7.5, fontWeight: 600, textColor: 'ink', align: 'left', maxLines: 1 };
  }
}
