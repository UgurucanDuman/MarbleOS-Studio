import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from 'motion/react';
import type {
  DockOriginBounds,
  StudioAppDefinition,
  StudioAppId,
  WindowInstanceState,
} from './types';
import { StudioBrandLogo } from '../system/brand/StudioBrandLogo';
import {
  dockMagnifyMaxPx,
  dockMagnifyMinPx,
  useDockMagnification,
  useDockPointerX,
} from '../system/motion/dockMagnification';
import {
  dockLandingBounceDurationS,
  dockLandingBounceKeyframes,
  dockLandingBounceTimes,
  springDockIcon,
  transitionDockActiveDot,
  transitionDockTooltip,
} from '../system/motion/macosMotion';
import './studio-dock.css';

interface StudioDockProps {
  apps: StudioAppDefinition[];
  windows: Record<StudioAppId, WindowInstanceState>;
  activeAppId: StudioAppId | null;
  bouncingAppId: StudioAppId | null;
  isDesktopActive: boolean;
  isHidden?: boolean;
  onToggleDesktop: () => void;
  onToggleApp: (appId: StudioAppId, bounds?: DockOriginBounds) => void;
}

interface DockIconItemProps {
  id: string;
  appId?: StudioAppId;
  label: string;
  icon: React.ReactNode;
  mouseX: MotionValue<number>;
  isHovered: boolean;
  reducedMotion: boolean;
  onHoverChange: (id: string | null) => void;
  isOpen: boolean;
  isMinimized?: boolean;
  isFocused: boolean;
  isBouncing?: boolean;
  onActivateDesktop?: () => void;
  onActivateApp?: (appId: StudioAppId, bounds?: DockOriginBounds) => void;
}

const DESKTOP_DOCK_ICON = <StudioBrandLogo size="lg" variant="icon" />;

/**
 * MerbleOS `PortalDockIcon` + `useDockMagnification`:
 * - Her ikon kendi `ref.current.getBoundingClientRect()` canlı merkezini MotionValue içinden ölçer.
 * - `isHovered` boolean prop ile yalnızca durumu değişen ikon yeniden render olur.
 */
const StudioDockIconItem: React.FC<DockIconItemProps> = React.memo(
  ({
    id,
    appId,
    label,
    icon,
    mouseX,
    isHovered,
    reducedMotion,
    onHoverChange,
    isOpen,
    isMinimized = false,
    isFocused,
    isBouncing = false,
    onActivateDesktop,
    onActivateApp,
  }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const { width, lift } = useDockMagnification(
      ref,
      mouseX,
      dockMagnifyMinPx,
      dockMagnifyMaxPx,
      reducedMotion,
    );

    const handleActivate = () => {
      if (appId && onActivateApp) {
        if (ref.current) {
          const box = ref.current.getBoundingClientRect();
          onActivateApp(appId, { x: box.left, y: box.top, w: box.width, h: box.height });
        } else {
          onActivateApp(appId);
        }
        return;
      }
      onActivateDesktop?.();
    };

    return (
      <div
        id={`studio-dock-icon-${id}`}
        data-dock-app={id}
        className={`os-dock-item-wrapper ${isHovered ? 'is-hovered' : ''}`}
      >
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 8, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 4, x: '-50%' }}
              transition={transitionDockTooltip}
              className="os-dock-tooltip"
              aria-hidden="true"
            >
              <span className="os-dock-tooltip-title">{label}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          ref={ref}
          type="button"
          aria-label={label}
          style={{
            width,
            height: width,
            y: lift,
            willChange: isHovered || isBouncing ? 'transform' : 'auto',
          }}
          transition={springDockIcon}
          whileTap={reducedMotion ? undefined : { scale: 0.88 }}
          onMouseEnter={() => onHoverChange(id)}
          onMouseLeave={() => onHoverChange(null)}
          onFocus={() => onHoverChange(id)}
          onBlur={() => onHoverChange(null)}
          onClick={handleActivate}
          className={`os-dock-btn ${isFocused ? 'os-dock-btn-active' : ''}`}
        >
          <motion.div
            className="os-dock-icon-surface"
            animate={isBouncing && !reducedMotion ? { y: [...dockLandingBounceKeyframes] } : { y: 0 }}
            transition={
              isBouncing
                ? {
                    y: {
                      duration: dockLandingBounceDurationS,
                      times: [...dockLandingBounceTimes],
                      ease: 'easeOut',
                    },
                  }
                : { duration: 0.16, ease: 'easeOut' }
            }
          >
            {icon}
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={transitionDockActiveDot}
              className="os-dock-dot"
              style={{
                backgroundColor: isMinimized ? '#71717a' : 'var(--os-text-primary)',
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  },
);

export const StudioDock: React.FC<StudioDockProps> = React.memo(
  ({
    apps,
    windows,
    activeAppId,
    bouncingAppId,
    isDesktopActive,
    isHidden = false,
    onToggleDesktop,
    onToggleApp,
  }) => {
    const { mouseX, onMouseMove, onMouseLeave } = useDockPointerX();
    const reducedMotion = useReducedMotion() ?? false;
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [isDesktopBouncing, setIsDesktopBouncing] = useState(false);
    const [isPeeking, setIsPeeking] = useState(false);
    const desktopBounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
      if (desktopBounceTimerRef.current) clearTimeout(desktopBounceTimerRef.current);
    }, []);

    useEffect(() => {
      if (!isHidden) {
        setIsPeeking(false);
      }
    }, [isHidden]);

    const shouldHideDock = isHidden && !isPeeking;

    const handleDesktopClick = useCallback(() => {
      if (desktopBounceTimerRef.current) clearTimeout(desktopBounceTimerRef.current);
      setIsDesktopBouncing(true);
      desktopBounceTimerRef.current = setTimeout(() => {
        desktopBounceTimerRef.current = null;
        setIsDesktopBouncing(false);
      }, 560);
      onToggleDesktop();
    }, [onToggleDesktop]);

    return (
      <>
        {isHidden && (
          <div
            className="os-dock-reveal-trigger"
            onPointerEnter={() => setIsPeeking(true)}
            onMouseEnter={() => setIsPeeking(true)}
            aria-hidden="true"
          >
            <span className="os-dock-edge-pill" />
          </div>
        )}

        <div
          className="os-dock-anchor"
          data-dock-anchor="true"
          onPointerLeave={() => {
            onMouseLeave();
            setHoveredId(null);
            if (isHidden) setIsPeeking(false);
          }}
        >
          <motion.footer
            data-dock-surface="true"
            className="os-dock-container"
            aria-label="MarbleOS Studio Dock"
            initial={{ y: 100, opacity: 0 }}
            animate={{
              y: shouldHideDock ? 110 : 0,
              opacity: shouldHideDock ? 0 : 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 280,
              damping: 28,
              mass: 0.9,
            }}
            style={{ pointerEvents: shouldHideDock ? 'none' : 'auto' }}
            onMouseEnter={() => {
              if (isHidden) setIsPeeking(true);
            }}
            onMouseMove={onMouseMove}
            onMouseLeave={() => {
              onMouseLeave();
              setHoveredId(null);
            }}
          >
            <div className="os-dock-glass">
              {/* MerbleOS Sistem / Masaüstü İkonu (En Solda, Dikey Ayraçtan Önce) */}
              <StudioDockIconItem
                id="desktop"
                label="Masaüstü"
                icon={DESKTOP_DOCK_ICON}
                mouseX={mouseX}
                isHovered={hoveredId === 'desktop'}
                reducedMotion={reducedMotion}
                onHoverChange={setHoveredId}
                isOpen={isDesktopActive}
                isFocused={isDesktopActive}
                isBouncing={isDesktopBouncing}
                onActivateDesktop={handleDesktopClick}
              />

              <div className="os-dock-separator" aria-hidden="true" />

              {apps.map((app) => {
                const win = windows[app.appId];
                const isOpen = Boolean(win?.isOpen);
                const isMinimized = Boolean(win?.isMinimized);
                const isFocused = isOpen && !isMinimized && activeAppId === app.appId;
                const isBouncing = bouncingAppId === app.appId;

                return (
                  <StudioDockIconItem
                    key={app.appId}
                    id={app.appId}
                    appId={app.appId}
                    label={app.title}
                    icon={app.icon}
                    mouseX={mouseX}
                    isHovered={hoveredId === app.appId}
                    reducedMotion={reducedMotion}
                    onHoverChange={setHoveredId}
                    isOpen={isOpen}
                    isMinimized={isMinimized}
                    isFocused={isFocused}
                    isBouncing={isBouncing}
                    onActivateApp={onToggleApp}
                  />
                );
              })}
            </div>
          </motion.footer>
        </div>
      </>
    );
  },
);
