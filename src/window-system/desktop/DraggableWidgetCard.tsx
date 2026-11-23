import React, { useEffect, useRef } from 'react';
import type {
  DesktopWidgetId,
  DesktopWidgetPosition,
} from '../../system/schemas/desktopPersonalizationSchemas';
import { useWindowViewport } from '../useWindowViewport';

interface DraggableWidgetCardProps {
  widgetId: DesktopWidgetId;
  title: string;
  defaultSlotIndex: number;
  savedPosition?: DesktopWidgetPosition;
  onCommitPosition: (id: DesktopWidgetId, pos: DesktopWidgetPosition) => void;
  onRemove: (id: DesktopWidgetId) => void;
  children: React.ReactNode;
}

const DEFAULT_WIDGET_WIDTH = 244;
const DEFAULT_WIDGET_HEIGHT = 140;

interface StageMetrics {
  stageW: number;
  stageH: number;
  cardW: number;
  cardH: number;
}

function getStageMetrics(cardEl: HTMLElement | null, fallbackVw: number, fallbackVh: number): StageMetrics {
  const stageEl = cardEl?.closest('.os-desktop-stage') as HTMLElement | null;
  const stageW = stageEl && stageEl.clientWidth > 0 ? stageEl.clientWidth : fallbackVw;
  const stageH = stageEl && stageEl.clientHeight > 0 ? stageEl.clientHeight : fallbackVh;
  const cardW = cardEl && cardEl.offsetWidth > 0 ? cardEl.offsetWidth : DEFAULT_WIDGET_WIDTH;
  const cardH = cardEl && cardEl.offsetHeight > 0 ? cardEl.offsetHeight : DEFAULT_WIDGET_HEIGHT;
  return { stageW, stageH, cardW, cardH };
}

function getDefaultWidgetPosition(slotIndex: number, stageW: number): DesktopWidgetPosition {
  const col = slotIndex % 2;
  const row = Math.floor(slotIndex / 2);
  return {
    x: Math.max(16, stageW - (col === 0 ? 516 : 260)),
    y: 88 + row * 172,
  };
}

function clampWithMetrics(pos: DesktopWidgetPosition, m: StageMetrics): DesktopWidgetPosition {
  const maxX = Math.max(8, m.stageW - m.cardW - 8);
  const maxY = Math.max(74, m.stageH - m.cardH - 12);
  return {
    x: Math.max(8, Math.min(maxX, Math.round(pos.x))),
    y: Math.max(74, Math.min(maxY, Math.round(pos.y))),
  };
}

export const DraggableWidgetCard: React.FC<DraggableWidgetCardProps> = React.memo(({
  widgetId,
  title,
  defaultSlotIndex,
  savedPosition,
  onCommitPosition,
  onRemove,
  children,
}) => {
  const viewport = useWindowViewport();
  const cardRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPos: DesktopWidgetPosition;
    lastPos: DesktopWidgetPosition;
    metrics: StageMetrics;
    moved: boolean;
  } | null>(null);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const computeBasePos = (): DesktopWidgetPosition => {
    const metrics = getStageMetrics(cardRef.current, viewport.w, viewport.h);
    const raw = savedPosition ?? getDefaultWidgetPosition(defaultSlotIndex, metrics.stageW);
    return clampWithMetrics(raw, metrics);
  };

  const displayPos = computeBasePos();

  const applyTransform = (pos: DesktopWidgetPosition) => {
    if (cardRef.current) {
      cardRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, textarea, input, select, a')) return;

    const metrics = getStageMetrics(cardRef.current, viewport.w, viewport.h);
    const raw = savedPosition ?? getDefaultWidgetPosition(defaultSlotIndex, metrics.stageW);
    const current = clampWithMetrics(raw, metrics);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos: current,
      lastPos: current,
      metrics,
      moved: false,
    };
    cardRef.current?.classList.add('is-dragging');
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // jsdom veya sentetik olaylarda pointer capture yoksa sessiz devam edilir.
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const next = clampWithMetrics(
      { x: drag.startPos.x + dx, y: drag.startPos.y + dy },
      drag.metrics,
    );
    drag.moved = true;
    drag.lastPos = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (dragRef.current) applyTransform(dragRef.current.lastPos);
      });
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    cardRef.current?.classList.remove('is-dragging');
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }
    } catch {
      // yoksay
    }
    applyTransform(drag.lastPos);
    if (
      drag.moved &&
      (drag.lastPos.x !== drag.startPos.x || drag.lastPos.y !== drag.startPos.y)
    ) {
      onCommitPosition(widgetId, drag.lastPos);
    }
  };

  return (
    <article
      ref={cardRef}
      className="os-widget-card"
      data-widget-id={widgetId}
      style={{ transform: `translate3d(${displayPos.x}px, ${displayPos.y}px, 0)` }}
      onContextMenu={(e) => e.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <header className="os-widget-head">
        <span className="os-widget-title-wrap">
          <svg
            className="os-widget-grip"
            viewBox="0 0 12 12"
            width="11"
            height="11"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="3.5" cy="2.5" r="1" />
            <circle cx="8.5" cy="2.5" r="1" />
            <circle cx="3.5" cy="6" r="1" />
            <circle cx="8.5" cy="6" r="1" />
            <circle cx="3.5" cy="9.5" r="1" />
            <circle cx="8.5" cy="9.5" r="1" />
          </svg>
          <span className="os-widget-title">{title}</span>
        </span>
        <button
          type="button"
          className="os-widget-close"
          aria-label={`${title} widget'ını kaldır`}
          title="Widget'ı kaldır"
          onClick={() => onRemove(widgetId)}
        >
          &times;
        </button>
      </header>
      {children}
    </article>
  );
});

