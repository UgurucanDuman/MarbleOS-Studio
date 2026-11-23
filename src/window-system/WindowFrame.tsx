import React, { useRef, useState } from 'react';
import { motion, useDragControls, useMotionValue, useReducedMotion } from 'motion/react';
import type { DockOriginBounds, SmartWindowLayoutControlState, StudioAppId, WindowInstanceState } from './types';
import { WindowTitleBar } from './WindowTitleBar';
import { WindowResizeEdges } from './WindowResizeEdges';
import { WindowSheetHostContext } from './sheet/windowSheetHost';
import { useWindowDockLifecycle } from './useWindowDockLifecycle';
import { useWindowBasePosition, useWindowDragMaximize, useWindowResize } from './useWindowFrameMotion';
import { easeAppleGenieOpen, easeAppleGenieClose } from '../system/motion/macosMotion';
import { WindowWorkContext } from '../system/motion/windowWork';
import './window-system.css';

interface WindowFrameProps {
  windowState: WindowInstanceState;
  icon: React.ReactNode;
  isActive: boolean;
  isSharedForeground?: boolean;
  clickOrigin?: DockOriginBounds | null;
  smartLayout?: SmartWindowLayoutControlState;
  onFocus: (appId: StudioAppId) => void;
  onClose: (appId: StudioAppId) => void;
  onMinimize: (appId: StudioAppId) => void;
  onMaximize: (appId: StudioAppId) => void;
  onDockBounce?: (appId: StudioAppId) => void;
  onDepartStart?: (appId: StudioAppId) => void;
  children: React.ReactNode;
}

/**
 * MarbleOS Studio — MerbleOS Orijinal `OsWindowFrame` Mimarisi
 * - Açılışta `left: baseX, top: baseY` sabittir; yalnızca `originX, originY` üzerinden
 *   `scale: initialScale -> 1` büyür (Çift vurma / sıçrama imkansızdır).
 * - Sürükleme `useDragControls` + `useMotionValue(0)` ile React re-render olmadan GPU'da akar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const WindowFrame: React.FC<WindowFrameProps> = React.memo(
  ({
    windowState, icon, isActive, isSharedForeground = false, clickOrigin = null, smartLayout,
    onFocus, onClose, onMinimize, onMaximize, onDockBounce, onDepartStart, children,
  }) => {
    const { appId, title, subtitle, isMaximized, isMinimized, layoutBounds, zIndex } = windowState;
    const isVisuallyActive = isActive || isSharedForeground;

    const dragControls = useDragControls();
    const reducedMotion = useReducedMotion() ?? false;
    const [isDragging, setIsDragging] = useState(false);
    const [sheetHost, setSheetHost] = useState<HTMLDivElement | null>(null);
    const frameWillChange = useMotionValue('transform');
    const isAnimatingRef = useRef(true);

    const dragX = useMotionValue(0);
    const dragY = useMotionValue(0);

    const {
      isClosing, isFullyMinimized, dynamicIconBounds,
      measureDockBounds, finishClose, finishMinimize, handleClose,
    } = useWindowDockLifecycle({
      appId, clickOrigin, isMinimized, onClose, onDockBounce, onDepartStart,
    });

    const wasMaximizedRef = useRef(isMaximized);
    if (!isClosing) {
      wasMaximizedRef.current = isMaximized;
    }
    const effectiveMaximized = isClosing ? wasMaximizedRef.current : isMaximized;
    const isTiled = Boolean(layoutBounds);

    const {
      viewport, windowSize, sizeW, sizeH, bodyScaleX, bodyScaleY, isResizing, isSizeTransitioning,
      defaultX, defaultY, handleResizePointerDown,
    } = useWindowResize({
      dragX,
      dragY,
      frameWillChange,
      isAnimatingRef,
      isMaximized: effectiveMaximized,
      layoutBounds,
    });

    const baseW = effectiveMaximized
      ? viewport.w
      : layoutBounds
        ? Math.round(viewport.w * layoutBounds.w)
        : windowSize.w;
    const baseH = effectiveMaximized
      ? viewport.h
      : layoutBounds
        ? Math.round(viewport.h * layoutBounds.h)
        : windowSize.h;
    const baseX = effectiveMaximized
      ? 0
      : layoutBounds
        ? Math.round(viewport.w * layoutBounds.x)
        : defaultX;
    const baseY = effectiveMaximized
      ? 0
      : layoutBounds
        ? Math.round(viewport.h * layoutBounds.y)
        : defaultY;

    const { posLeft, posTop } = useWindowBasePosition({
      baseX,
      baseY,
      isMaximized: effectiveMaximized,
      layoutBounds,
      isResizing,
      reducedMotion,
    });

    useWindowDragMaximize({
      isDragging,
      setIsDragging,
      isResizing,
      reducedMotion,
      isAnimatingRef,
      frameWillChange,
      dragX,
      dragY,
      layoutBounds,
      isMaximized,
      restoreBounds: {
        minX: -defaultX,
        maxX: Math.max(-defaultX, viewport.w - (defaultX + windowSize.w)),
        minY: -defaultY,
        maxY: Math.max(-defaultY, viewport.h - 56 - defaultY),
      },
    });

    const handleMinimize = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      measureDockBounds();
      onDepartStart?.(appId);
      onMinimize(appId);
    };

    const handleMaximize = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onMaximize(appId);
    };

    const iconW = dynamicIconBounds?.w ?? clickOrigin?.w ?? 50;
    const iconH = dynamicIconBounds?.h ?? clickOrigin?.h ?? 50;
    const iconCenterX = (dynamicIconBounds?.x ?? clickOrigin?.x ?? baseX + baseW / 2) + iconW / 2;
    const iconCenterY = (dynamicIconBounds?.y ?? clickOrigin?.y ?? viewport.h - 35) + iconH / 2;

    const curWindowX = posLeft.get() + dragX.get();
    const curWindowY = posTop.get() + dragY.get();

    const maxDockScaleX = Math.min(0.08, Math.max(0.02, iconW / Math.max(1, baseW)));
    const dockScale = Math.min(
      maxDockScaleX,
      iconW / Math.max(1, baseW),
      iconH / Math.max(1, baseH),
    );
    const scaleSpan = Math.max(0.001, 1 - dockScale);
    const originX = (iconCenterX - curWindowX - (dockScale * baseW) / 2) / (Math.max(1, baseW) * scaleSpan);
    const originY = (iconCenterY - curWindowY - (dockScale * baseH) / 2) / (Math.max(1, baseH) * scaleSpan);
    const restDockScale = reducedMotion ? 1 : dockScale;

    const canDrag = !isClosing && !isMinimized && !effectiveMaximized && !isTiled && !isSizeTransitioning;
    const dragConstraints = {
      left: -baseX,
      right: Math.max(-baseX, viewport.w - (baseX + baseW)),
      top: Math.min(Math.max(-baseY, 72 - baseY), Math.round(dragY.get())),
      bottom: Math.max(0, viewport.h - 90 - (baseY + baseH), Math.round(dragY.get())),
    };

    const currentZIndex =
      isClosing || (isMinimized && !isFullyMinimized) ? Math.max(zIndex, 680) : zIndex;

    return (
      <motion.section
        id={`window-${appId}`}
        data-window-frame="true"
        data-window-resizing={isResizing ? 'true' : 'false'}
        data-window-size-transitioning={isSizeTransitioning ? 'true' : 'false'}
        data-window-transitioning={isResizing || isSizeTransitioning ? 'true' : 'false'}
        data-window-minimized={isMinimized && isFullyMinimized ? 'true' : 'false'}
        data-window-maximized={effectiveMaximized ? 'true' : undefined}
        data-window-active={isActive && !isMinimized && !isClosing ? 'true' : 'false'}
        data-window-departing={isClosing || (isMinimized && !isFullyMinimized) ? 'true' : 'false'}
        data-window-shared-foreground={isSharedForeground ? 'true' : 'false'}
        data-dock-landing="true"
        onAnimationStart={() => {
          isAnimatingRef.current = true;
          frameWillChange.set('transform');
        }}
        onAnimationComplete={() => {
          isAnimatingRef.current = false;
          if (!isDragging && !isResizing) frameWillChange.set('auto');
          if (isClosing) finishClose();
          else if (isMinimized) finishMinimize();
        }}
        initial={{
          opacity: 0,
          scale: restDockScale,
          borderRadius: effectiveMaximized ? 0 : 24,
        }}
        animate={
          isClosing || isMinimized
            ? {
                opacity: reducedMotion ? 0 : [1, 1, 0],
                scale: restDockScale,
                borderRadius: 24,
              }
            : {
                opacity: 1,
                scale: 1,
                borderRadius: effectiveMaximized ? 0 : 14,
              }
        }
        exit={{
          opacity: 0,
          scale: restDockScale,
          borderRadius: 24,
          transition: reducedMotion ? { duration: 0.12 } : { duration: 0.32, ease: easeAppleGenieClose },
        }}
        transition={{
          default: reducedMotion
            ? { duration: 0.12 }
            : isClosing || isMinimized
              ? { duration: 0.32, ease: easeAppleGenieClose }
              : { duration: 0.34, ease: easeAppleGenieOpen },
          opacity: reducedMotion
            ? { duration: 0.12 }
            : isClosing || isMinimized
              ? { duration: 0.32, times: [0, 0.7, 1], ease: 'easeInOut' }
              : { duration: 0.25, ease: 'easeOut' },
          borderRadius: { duration: reducedMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] },
        }}
        drag={canDrag}
        dragConstraints={canDrag ? dragConstraints : undefined}
        dragElastic={canDrag ? 0.08 : 0}
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        onDragStart={() => {
          setIsDragging(true);
          frameWillChange.set('transform');
        }}
        onDragEnd={() => {
          setIsDragging(false);
          if (!isAnimatingRef.current) frameWillChange.set('auto');
        }}
        className={`os-window-frame ${isActive ? 'os-window-active' : 'os-window-inactive'}`}
        style={{
          zIndex: currentZIndex,
          position: 'fixed',
          visibility: isMinimized && isFullyMinimized ? 'hidden' : 'visible',
          pointerEvents: isClosing || isMinimized || isFullyMinimized ? 'none' : 'auto',
          left: posLeft,
          top: posTop,
          width: sizeW,
          height: sizeH,
          originX,
          originY,
          x: dragX,
          y: dragY,
          willChange: frameWillChange,
        }}
        onMouseDown={() => {
          if (!isActive && !isClosing && !isMinimized) onFocus(appId);
        }}
      >
        <div
          data-window-focus-surface="true"
          data-focus-active={isVisuallyActive || isClosing || isMinimized ? 'true' : 'false'}
          className={`os-focus-surface ${!effectiveMaximized && !isTiled && !isClosing && !isMinimized ? 'os-focus-floating' : ''}`}
        >
          <WindowTitleBar
            title={title}
            subtitle={subtitle}
            icon={icon}
            isMaximized={effectiveMaximized}
            isTiled={isTiled}
            isClosing={isClosing}
            isMinimized={isMinimized}
            isVisuallyActive={isVisuallyActive}
            dragControls={dragControls}
            smartLayout={smartLayout}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
            onClose={handleClose}
          />

          <motion.div
            className="os-window-body"
            style={
              isSizeTransitioning
                ? {
                    width: baseW,
                    height: Math.max(1, baseH - 44),
                    flex: 'none',
                    originX: 0,
                    originY: 0,
                    scaleX: bodyScaleX,
                    scaleY: bodyScaleY,
                    willChange: 'transform',
                  }
                : undefined
            }
          >
            <motion.div
              layoutScroll
              className={`os-window-content ${isDragging || isResizing ? 'os-content-dragging' : ''}`}
            >
              {!isVisuallyActive && !isClosing && !isMinimized && (
                <div
                  className="os-inactive-cover"
                  onClick={() => onFocus(appId)}
                  onWheel={() => onFocus(appId)}
                />
              )}
              <WindowWorkContext.Provider value={!isMinimized && !isClosing}>
                <WindowSheetHostContext.Provider value={sheetHost}>{children}</WindowSheetHostContext.Provider>
              </WindowWorkContext.Provider>
            </motion.div>
            {/* Form kartları içerik kaydırmasından bağımsız bu katmanda açılır. */}
            <div ref={setSheetHost} className="os-window-sheet-host" />
          </motion.div>
        </div>

        {!isMaximized && !isTiled && !isClosing && !isMinimized && (
          <WindowResizeEdges onResizeStart={handleResizePointerDown} />
        )}
      </motion.section>
    );
  },
);
