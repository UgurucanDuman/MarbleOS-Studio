import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useAnimationControls, type ResolvedValues } from 'motion/react';
import { easeOriginSheetClose, springOriginSheet } from '../../system/motion/macosMotion';
import {
  SHEET_RADIUS,
  centeredSheetRect,
  readTriggerLook,
  relativeTriggerRect,
  shrinkInPlace,
  type MorphState,
  type OriginRect,
} from './sheetOrigin';

function sameRect(a: OriginRect, b: OriginRect): boolean {
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * MerbleOS `card-morph-travel` + `OriginSheet` Buton <-> Kart Dönüşümü:
 * - Kart tıklanan butonun tam kutusu ve köşe yarıçapından başlar, gerçek genişlik/yükseklikle büyür.
 * - Cam yüzeyi (`backdrop-filter`) açılışın ilk karesinden itibaren aktiftir; sonradan blur patlaması yapmaz.
 * - Kare başı string/renk/gölge ayrıştırması yapılmaz; yalnızca sayısal geometri ve GPU `scale3d` akar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function useSheetMorph(
  triggerRef: RefObject<HTMLElement | null>,
  width: number,
  reduced: boolean,
) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLSpanElement | null>(null);
  const controls = useAnimationControls();
  const targetRef = useRef<OriginRect | null>(null);
  const originRectRef = useRef<OriginRect | null>(null);
  const settledRef = useRef(false);
  const closingRef = useRef(false);
  const wasGhostingRef = useRef(false);
  const [look] = useState(() => readTriggerLook(triggerRef.current));

  const setFlightState = useCallback((flying: boolean) => {
    const panel = contentRef.current?.parentElement;
    if (!panel) return;
    if (flying) panel.setAttribute('data-sheet-animating', 'true');
    else panel.removeAttribute('data-sheet-animating');
  }, []);

  const setGhostingAttr = useCallback((ghosting: boolean) => {
    if (wasGhostingRef.current === ghosting) return;
    wasGhostingRef.current = ghosting;
    const panel = contentRef.current?.parentElement;
    if (!panel) return;
    if (ghosting) panel.setAttribute('data-sheet-ghosting', '');
    else panel.removeAttribute('data-sheet-ghosting');
  }, []);

  const measureTarget = useCallback((): OriginRect => {
    const layer = layerRef.current;
    const content = contentRef.current;
    if (!layer || !content) return { left: 0, top: 0, width: 0, height: 0 };
    const layerW = layer.clientWidth;
    const layerH = layer.clientHeight;
    content.style.width = `${Math.max(0, Math.min(width, layerW - 32))}px`;
    content.style.maxHeight = `${Math.max(0, layerH - 24)}px`;
    return centeredSheetRect(layerW, layerH, width, content.offsetHeight);
  }, [width]);

  const openState = useCallback(
    (target: OriginRect): MorphState => ({
      left: target.left,
      top: target.top,
      width: target.width,
      height: target.height,
      borderRadius: SHEET_RADIUS,
      opacity: 1,
    }),
    [],
  );

  const originState = useCallback((): MorphState => {
    const target = targetRef.current ?? measureTarget();
    if (reduced) return { ...openState(target), opacity: 0 };
    const trigger = triggerRef.current;
    const layer = layerRef.current;
    const current = readTriggerLook(trigger);
    const rect =
      trigger && layer && current
        ? relativeTriggerRect(
          trigger.getBoundingClientRect(),
          layer.getBoundingClientRect(),
          trigger.offsetWidth,
          trigger.offsetHeight,
        )
        : null;
    originRectRef.current = rect;
    if (!rect || !current) return shrinkInPlace(target);
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius: current.radius,
      opacity: 1,
    };
  }, [measureTarget, openState, reduced, triggerRef]);

  const syncFrame = useCallback(
    (currentW: number) => {
      const content = contentRef.current;
      const ghost = ghostRef.current;
      const target = targetRef.current;
      if (!content || !target || target.width <= 0) return;
      if (reduced) {
        content.style.transform = '';
        content.style.opacity = '1';
        if (ghost) ghost.style.opacity = '0';
        return;
      }

      const scale = clamp01(currentW / target.width);
      const rounded = Math.round(scale * 10000) / 10000;
      content.style.transform = scale >= 0.998 ? '' : `scale3d(${rounded}, ${rounded}, 1)`;

      const originW = originRectRef.current?.width ?? target.width * 0.2;
      const p = clamp01((currentW - originW) / Math.max(1, target.width - originW));

      if (closingRef.current) {
        const contentAlpha = clamp01((p - 0.38) / 0.52);
        const ghostAlpha = triggerRef.current?.isConnected ? clamp01((0.48 - p) / 0.38) : 0;
        content.style.opacity = `${Math.round(contentAlpha * 1000) / 1000}`;
        if (ghost) {
          ghost.style.opacity = `${Math.round(ghostAlpha * 1000) / 1000}`;
          setGhostingAttr(ghostAlpha > 0.35);
        }
      } else {
        const contentAlpha = clamp01((p - 0.04) / 0.44);
        const ghostAlpha = clamp01(1 - p / 0.32);
        content.style.opacity = `${Math.round(contentAlpha * 1000) / 1000}`;
        if (ghost) ghost.style.opacity = `${Math.round(ghostAlpha * 1000) / 1000}`;
      }
    },
    [reduced, setGhostingAttr, triggerRef],
  );

  const handleUpdate = useCallback(
    (latest: ResolvedValues) => {
      const w = typeof latest.width === 'number' ? latest.width : parseFloat(String(latest.width));
      if (Number.isFinite(w)) syncFrame(w);
    },
    [syncFrame],
  );

  const closedVariant = useCallback(() => {
    settledRef.current = false;
    closingRef.current = true;
    setFlightState(true);
    controls.stop();
    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    if (activeEl && layerRef.current?.contains(activeEl)) activeEl.blur();
    const closeLook = readTriggerLook(triggerRef.current);
    if (ghostRef.current) {
      ghostRef.current.style.background = closeLook?.background || 'transparent';
      if (closeLook?.color) ghostRef.current.style.color = closeLook.color;
    }
    return {
      ...originState(),
      transition: reduced ? { duration: 0.12 } : { duration: 0.34, ease: easeOriginSheetClose },
    };
  }, [controls, originState, reduced, setFlightState, triggerRef]);

  useLayoutEffect(() => {
    let cancelled = false;
    closingRef.current = false;
    settledRef.current = false;
    wasGhostingRef.current = false;
    setFlightState(!reduced);
    if (ghostRef.current) ghostRef.current.style.background = 'transparent';
    const initialTarget = measureTarget();
    targetRef.current = initialTarget;
    const start = originState();
    controls.set(start);
    syncFrame(start.width);

    const updateTarget = () => {
      if (cancelled || closingRef.current || !settledRef.current) return;
      const next = measureTarget();
      if (targetRef.current && sameRect(targetRef.current, next)) return;
      targetRef.current = next;
      void controls.start({ ...openState(next), transition: reduced ? { duration: 0 } : springOriginSheet });
    };

    void controls
      .start({ ...openState(initialTarget), transition: reduced ? { duration: 0.15 } : springOriginSheet })
      .then(() => {
        if (cancelled || closingRef.current) return;
        settledRef.current = true;
        setFlightState(false);
        syncFrame(targetRef.current?.width ?? initialTarget.width);
        updateTarget();
      });

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateTarget);
    if (layerRef.current) observer?.observe(layerRef.current);
    if (contentRef.current) observer?.observe(contentRef.current);
    return () => {
      cancelled = true;
      observer?.disconnect();
      controls.stop();
    };
  }, []);

  return { layerRef, contentRef, ghostRef, controls, closedVariant, handleUpdate, look };
}
