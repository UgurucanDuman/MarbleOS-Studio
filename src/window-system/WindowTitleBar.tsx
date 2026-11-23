import React from 'react';
import type { DragControls } from 'motion/react';
import type { SmartWindowLayoutControlState } from './types';
import { WindowControlCapsule } from './WindowControlCapsule';

interface WindowTitleBarProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isMaximized: boolean;
  isTiled: boolean;
  isClosing: boolean;
  isMinimized: boolean;
  isVisuallyActive: boolean;
  dragControls: DragControls;
  smartLayout?: SmartWindowLayoutControlState;
  onMinimize: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMaximize: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClose: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * MarbleOS Studio — MerbleOS `OsWindowTitleBar` Bileşeni
 * Sürükleme tutamacı, uygulama başlığı ve sağ üst kontrol kapsülünü izole eder.
 */
export const WindowTitleBar: React.FC<WindowTitleBarProps> = React.memo(
  ({
    title,
    subtitle,
    icon,
    isMaximized,
    isTiled,
    isClosing,
    isMinimized,
    isVisuallyActive,
    dragControls,
    smartLayout,
    onMinimize,
    onMaximize,
    onClose,
  }) => {
    const isLocked = isMaximized || isTiled;

    return (
      <header
        className={`os-window-titlebar ${isLocked ? 'is-locked' : ''}`}
        onPointerDown={(e) => {
          if (!isLocked && !isClosing && !isMinimized) {
            dragControls.start(e);
          }
        }}
        onDoubleClick={onMaximize}
      >
        <div className="os-titlebar-left">
          <span className="os-titlebar-icon">{icon}</span>
          <span className="os-titlebar-title">{title}</span>
          <span className="os-titlebar-sep">&mdash;</span>
          <span className="os-titlebar-subtitle">{subtitle}</span>
        </div>

        <div className="os-titlebar-drag-spacer" />

        <WindowControlCapsule
          isMaximized={isMaximized}
          smartLayout={isVisuallyActive && !isMaximized ? smartLayout : undefined}
          onMinimize={onMinimize}
          onMaximize={onMaximize}
          onClose={onClose}
        />
      </header>
    );
  },
);

