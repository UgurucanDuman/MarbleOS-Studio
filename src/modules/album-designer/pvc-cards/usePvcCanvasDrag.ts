import { useCallback, useEffect, useRef, useState } from 'react';
import type { PvcResizeHandle } from '../../../system/storage/pvc-cards/PvcCardLiveView';
import { PVC_SAFE_MARGIN_MM, type PvcCardElement } from '../../../system/storage/pvc-cards/types';

/**
 * İZOLE MODÜL 03 HOOK: PVC Kart Tuvalinde Sürükle-Bırak, 8 Yönlü Boyutlandırma ve Döndürme
 * 0.5 mm ızgara yakalama + merkez / 3 mm güvenli kenar / komşu katman akıllı kılavuzları.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const SNAP_STEP_MM = 0.5;
const GUIDE_TOL_MM = 0.85;
const MIN_SIZE_MM = 1.5;

const snapMm = (val: number) => Math.round(val / SNAP_STEP_MM) * SNAP_STEP_MM;
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

function snapAxis(
  pos: number,
  size: number,
  targets: readonly number[],
): { pos: number; guide: number | null } {
  for (const t of targets) {
    if (Math.abs(pos + size / 2 - t) <= GUIDE_TOL_MM) return { pos: t - size / 2, guide: t };
    if (Math.abs(pos - t) <= GUIDE_TOL_MM) return { pos: t, guide: t };
    if (Math.abs(pos + size - t) <= GUIDE_TOL_MM) return { pos: t - size, guide: t };
  }
  return { pos, guide: null };
}

export interface PvcDragDraft {
  elId: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotationDeg: number;
}

interface DragSession {
  mode: 'move' | 'resize' | 'rotate';
  handle?: PvcResizeHandle;
  elId: string;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  origRot: number;
  centerClientX: number;
  centerClientY: number;
  rectW: number;
  rectH: number;
  latest: Omit<PvcDragDraft, 'elId'>;
}

export function usePvcCanvasDrag(options: {
  enabled: boolean;
  cardWidthMm: number;
  cardHeightMm: number;
  elements: readonly PvcCardElement[];
  cardRef: React.RefObject<HTMLDivElement | null>;
  onCommitTransform: (elId: string, box: Omit<PvcDragDraft, 'elId'>) => void;
}) {
  const { enabled, cardWidthMm, cardHeightMm, elements, cardRef, onCommitTransform } = options;
  const sessionRef = useRef<DragSession | null>(null);
  const [draft, setDraft] = useState<PvcDragDraft | null>(null);
  const [snapGuideXMm, setSnapGuideXMm] = useState<number | null>(null);
  const [snapGuideYMm, setSnapGuideYMm] = useState<number | null>(null);

  const beginSession = useCallback(
    (e: React.PointerEvent, el: PvcCardElement, mode: 'move' | 'resize' | 'rotate', handle?: PvcResizeHandle) => {
      if (!enabled || el.locked) return;
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect || rect.width < 20 || rect.height < 20) return;
      e.preventDefault();
      const rot = el.rotationDeg ?? 0;
      const latest = { xMm: el.xMm, yMm: el.yMm, wMm: el.wMm, hMm: el.hMm, rotationDeg: rot };
      sessionRef.current = {
        mode,
        handle,
        elId: el.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: el.xMm,
        origY: el.yMm,
        origW: el.wMm,
        origH: el.hMm,
        origRot: rot,
        centerClientX: rect.left + ((el.xMm + el.wMm / 2) / cardWidthMm) * rect.width,
        centerClientY: rect.top + ((el.yMm + el.hMm / 2) / cardHeightMm) * rect.height,
        rectW: rect.width,
        rectH: rect.height,
        latest,
      };
      setDraft({ elId: el.id, ...latest });
    },
    [enabled, cardRef, cardWidthMm, cardHeightMm],
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s) return;

      if (s.mode === 'rotate') {
        const angleRad = Math.atan2(e.clientY - s.centerClientY, e.clientX - s.centerClientX);
        let deg = Math.round((angleRad * 180) / Math.PI + 90);
        if (deg > 180) deg -= 360;
        if (deg < -180) deg += 360;
        if (!e.altKey) deg = Math.round(deg / 5) * 5;
        if (Math.abs(deg) <= 4) deg = 0;
        s.latest = { ...s.latest, rotationDeg: clamp(deg, -180, 180) };
        setDraft({ elId: s.elId, ...s.latest });
        return;
      }

      const dxMm = ((e.clientX - s.startClientX) / s.rectW) * cardWidthMm;
      const dyMm = ((e.clientY - s.startClientY) / s.rectH) * cardHeightMm;
      let nextX = s.origX;
      let nextY = s.origY;
      let nextW = s.origW;
      let nextH = s.origH;
      let guideX: number | null = null;
      let guideY: number | null = null;

      if (s.mode === 'move') {
        const others = elements.filter((it) => it.id !== s.elId && it.visible !== false);
        const sx = snapAxis(clamp(snapMm(s.origX + dxMm), -15, cardWidthMm - 2), nextW, [
          PVC_SAFE_MARGIN_MM,
          cardWidthMm / 2,
          cardWidthMm - PVC_SAFE_MARGIN_MM,
          ...others.flatMap((it) => [it.xMm, it.xMm + it.wMm / 2, it.xMm + it.wMm]),
        ]);
        const sy = snapAxis(clamp(snapMm(s.origY + dyMm), -15, cardHeightMm - 2), nextH, [
          PVC_SAFE_MARGIN_MM,
          cardHeightMm / 2,
          cardHeightMm - PVC_SAFE_MARGIN_MM,
          ...others.flatMap((it) => [it.yMm, it.yMm + it.hMm / 2, it.yMm + it.hMm]),
        ]);
        nextX = sx.pos;
        nextY = sy.pos;
        guideX = sx.guide;
        guideY = sy.guide;
      } else if (s.handle) {
        const h = s.handle;
        if (h.includes('e')) nextW = clamp(snapMm(s.origW + dxMm), MIN_SIZE_MM, cardWidthMm + 15);
        if (h.includes('s')) nextH = clamp(snapMm(s.origH + dyMm), MIN_SIZE_MM, cardHeightMm + 15);
        if (h.includes('w')) {
          const right = s.origX + s.origW;
          nextX = clamp(snapMm(s.origX + dxMm), -15, right - MIN_SIZE_MM);
          nextW = right - nextX;
        }
        if (h.includes('n')) {
          const bottom = s.origY + s.origH;
          nextY = clamp(snapMm(s.origY + dyMm), -15, bottom - MIN_SIZE_MM);
          nextH = bottom - nextY;
        }
        if (e.shiftKey && s.origH > 0) {
          nextH = clamp(nextW / (s.origW / s.origH), MIN_SIZE_MM, cardHeightMm + 15);
        }
      }

      s.latest = {
        xMm: Number(nextX.toFixed(2)),
        yMm: Number(nextY.toFixed(2)),
        wMm: Number(nextW.toFixed(2)),
        hMm: Number(nextH.toFixed(2)),
        rotationDeg: s.origRot,
      };
      setSnapGuideXMm(guideX);
      setSnapGuideYMm(guideY);
      setDraft({ elId: s.elId, ...s.latest });
    };

    const handleUp = () => {
      const s = sessionRef.current;
      if (!s) return;
      sessionRef.current = null;
      setSnapGuideXMm(null);
      setSnapGuideYMm(null);
      setDraft(null);
      if (
        s.latest.xMm !== s.origX ||
        s.latest.yMm !== s.origY ||
        s.latest.wMm !== s.origW ||
        s.latest.hMm !== s.origH ||
        s.latest.rotationDeg !== s.origRot
      ) {
        onCommitTransform(s.elId, s.latest);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [cardWidthMm, cardHeightMm, elements, onCommitTransform]);

  return {
    draft,
    snapGuideXMm,
    snapGuideYMm,
    onStartMove: useCallback((e: React.PointerEvent, el: PvcCardElement) => beginSession(e, el, 'move'), [beginSession]),
    onStartResize: useCallback(
      (e: React.PointerEvent, el: PvcCardElement, h: PvcResizeHandle) => beginSession(e, el, 'resize', h),
      [beginSession],
    ),
    onStartRotate: useCallback((e: React.PointerEvent, el: PvcCardElement) => beginSession(e, el, 'rotate'), [beginSession]),
  };
}
