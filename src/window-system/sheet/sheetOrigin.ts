export interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Butonun görünüşü: kart bu görünüşten başlar ve kapanırken yine buna döner. */
export interface TriggerLook {
  label: string;
  /** Canlı kaynak ikon; hayalet katman yalnızca `cloneSafeSvg` kopyasını yerleştirir. */
  svg?: SVGSVGElement;
  background: string;
  color: string;
  radius: number;
  opacity: number;
  font: { fontSize: string; fontWeight: string; fontFamily: string; letterSpacing: string };
}

// `type` (interface değil): motion hedef tipine doğrudan atanabilsin.
export type MorphState = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
  opacity: number;
};

export const SHEET_RADIUS = 16;

/** Kartın son yeri: katmanın ortası; kenarlarda 16 px, üst-altta 12 px boşluk kalır. */
export function centeredSheetRect(layerW: number, layerH: number, desiredW: number, contentH: number): OriginRect {
  const width = Math.max(0, Math.min(desiredW, layerW - 32));
  const height = Math.max(0, Math.min(contentH, layerH - 24));
  return { left: (layerW - width) / 2, top: (layerH - height) / 2, width, height };
}

/**
 * Butonun katmana göre kutusu. Merkez ekrandaki konumdan, boyut ise dönüşümsüz
 * ölçüden alınır; basılıyken küçülen buton kapanışta küçük bir zıplama yaratmaz.
 */
export function relativeTriggerRect(
  trigger: OriginRect, layer: OriginRect, restWidth: number, restHeight: number,
): OriginRect | null {
  const width = restWidth || trigger.width;
  const height = restHeight || trigger.height;
  if (width <= 0 || height <= 0) return null;
  const centerX = trigger.left + trigger.width / 2 - layer.left;
  const centerY = trigger.top + trigger.height / 2 - layer.top;
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}

/** Buton yoksa (silinmiş satır vb.) kart yerinde hafifçe küçülerek kaybolur. */
export function shrinkInPlace(target: OriginRect): MorphState {
  const width = target.width * 0.96;
  const height = target.height * 0.96;
  return {
    left: target.left + (target.width - width) / 2,
    top: target.top + (target.height - height) / 2,
    width,
    height,
    borderRadius: SHEET_RADIUS,
    opacity: 0,
  };
}

export function readTriggerLook(trigger: HTMLElement | null): TriggerLook | null {
  if (!trigger?.isConnected) return null;
  const style = getComputedStyle(trigger);
  const svg = trigger.querySelector('svg');
  const isMultiLineCard = style.flexDirection === 'column' || trigger.offsetHeight > 46;
  const bg =
    style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent'
      ? style.backgroundColor
      : '';
  return {
    label: isMultiLineCard ? '' : (trigger.textContent?.trim() ?? ''),
    svg: svg ?? undefined,
    background: bg,
    color: style.color,
    radius: parseFloat(style.borderTopLeftRadius) || 8,
    opacity: Number(style.opacity) || 1,
    font: {
      fontSize: style.fontSize, fontWeight: style.fontWeight,
      fontFamily: style.fontFamily, letterSpacing: style.letterSpacing,
    },
  };
}
