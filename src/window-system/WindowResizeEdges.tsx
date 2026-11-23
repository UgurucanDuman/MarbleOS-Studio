import React from 'react';
import type { ResizeEdge } from './useWindowFrameMotion';

interface WindowResizeEdgesProps {
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>, edge: ResizeEdge) => void;
}

/**
 * MerbleOS `WindowResizeEdges`:
 * Pencerenin 4 kenarı (`t, b, l, r`) ve 4 köşesinden (`tl, tr, bl, br`)
 * görünmez/izsiz olarak boyutlandırılmasını sağlar.
 */
export const WindowResizeEdges: React.FC<WindowResizeEdgesProps> = React.memo(
  ({ onResizeStart }) => {
    return (
      <>
        <div className="os-resize-edge edge-t" onPointerDown={(e) => onResizeStart(e, 't')} />
        <div className="os-resize-edge edge-b" onPointerDown={(e) => onResizeStart(e, 'b')} />
        <div className="os-resize-edge edge-l" onPointerDown={(e) => onResizeStart(e, 'l')} />
        <div className="os-resize-edge edge-r" onPointerDown={(e) => onResizeStart(e, 'r')} />

        <div className="os-resize-edge edge-tl" onPointerDown={(e) => onResizeStart(e, 'tl')} />
        <div className="os-resize-edge edge-tr" onPointerDown={(e) => onResizeStart(e, 'tr')} />
        <div className="os-resize-edge edge-bl" onPointerDown={(e) => onResizeStart(e, 'bl')} />
        <div className="os-resize-edge edge-br" onPointerDown={(e) => onResizeStart(e, 'br')} />
      </>
    );
  },
);
