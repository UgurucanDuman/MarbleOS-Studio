import { useCallback, useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';
import { springDockMagnify } from './macosMotion';

/**
 * İZOLE SİSTEM KATMANI: MerbleOS Orijinal Gaussian Dock Büyüteç & MotionValue Hook'ları
 * - Fare hareketinde React state güncellemesi (re-render) yapılmaz; MotionValue üzerinden akar.
 * - Her ikon kendi canlı merkezine (`getBoundingClientRect`) göre büyür; komşu ikonlar
 *   genişlediğinde imleç altındaki ikon kaymaz ve takılmaz.
 * Dosya Sınırı Kuralı: .ts dosyaları <= 250 satır.
 */

const dockMagnifySigmaPx = 96;
export const dockMagnifyMinPx = 50;
export const dockMagnifyMaxPx = 74;
const dockMagnifyEffectRadiusPx = 240;
const LIFT_RATIO = 0.3;

const MAGNIFY_TABLE_SIZE = 512;
const magnifyTable = new Float32Array(MAGNIFY_TABLE_SIZE);

(function buildMagnifyLookupTable() {
  const s = dockMagnifySigmaPx;
  const range = dockMagnifyMaxPx - dockMagnifyMinPx;
  for (let i = 0; i < MAGNIFY_TABLE_SIZE; i++) {
    const g = Math.exp(-(i * i) / (2 * s * s));
    magnifyTable[i] = dockMagnifyMinPx + range * g;
  }
})();

export function dockMagnifiedWidthPx(
  distanceFromCenterPx: number,
  basePx: number = dockMagnifyMinPx,
  maxPx: number = dockMagnifyMaxPx,
): number {
  const d = Math.abs(distanceFromCenterPx);
  if (d > dockMagnifyEffectRadiusPx) return basePx;
  if (basePx === dockMagnifyMinPx && maxPx === dockMagnifyMaxPx) {
    const idx = Math.min(d | 0, MAGNIFY_TABLE_SIZE - 1);
    return magnifyTable[idx];
  }
  const s = dockMagnifySigmaPx;
  const g = Math.exp(-(d * d) / (2 * s * s));
  return basePx + (maxPx - basePx) * g;
}

/** Yüksek Hz farelerde bile ekran karesi başına tek MotionValue yayını yapar (0 React re-render). */
export function useDockPointerX() {
  const mouseX = useMotionValue(Infinity);
  const pendingX = useRef(Infinity);
  const frame = useRef<number | null>(null);

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      pendingX.current = event.clientX;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        mouseX.set(pendingX.current);
      });
    },
    [mouseX],
  );

  const onMouseLeave = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    mouseX.set(Infinity);
  }, [mouseX]);

  useEffect(() => onMouseLeave, [onMouseLeave]);

  return { mouseX, onMouseMove, onMouseLeave };
}

/**
 * MerbleOS `useDockMagnification`:
 * İkonun canlı merkezine göre büyüteç genişliğini ve dikey kalkışını (`lift`) hesaplar.
 */
export function useDockMagnification(
  ref: RefObject<HTMLElement | null>,
  mouseX: MotionValue<number>,
  baseSize: number = dockMagnifyMinPx,
  maxSize: number = dockMagnifyMaxPx,
  disabled: boolean = false,
) {
  const targetSize = useTransform(mouseX, (pointerX) => {
    if (disabled) return baseSize;
    const element = ref.current;
    if (!element || !Number.isFinite(pointerX)) return baseSize;
    const bounds = element.getBoundingClientRect();
    return dockMagnifiedWidthPx(pointerX - (bounds.left + bounds.width / 2), baseSize, maxSize);
  });
  const width = useSpring(targetSize, springDockMagnify);
  const lift = useTransform(width, (size) => (disabled ? 0 : -Math.max(0, size - baseSize) * LIFT_RATIO));
  return { width, lift };
}
