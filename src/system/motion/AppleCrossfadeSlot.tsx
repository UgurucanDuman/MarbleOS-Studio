import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MotionGlobalConfig, useReducedMotion } from 'motion/react';
import { WindowWorkContext, useWindowWorkEnabled } from './windowWork';
import './apple-crossfade.css';

interface ExitingSnapshot {
  key: string;
  node: React.ReactNode;
  dir: number;
  seq: number;
}

interface EnteringState {
  dir: number;
  seq: number;
}

interface CrossfadeState {
  activeKey: string;
  exiting: ExitingSnapshot | null;
  entering: EnteringState | null;
}

const TIMING = {
  page: { exitMs: 160, enterDelayMs: 45, enterMs: 260 },
  card: { exitMs: 150, enterDelayMs: 30, enterMs: 240 },
  reduced: { exitMs: 100, enterDelayMs: 0, enterMs: 120 },
} as const;

const CrossfadeCell: React.FC<{
  role: 'active' | 'exiting';
  entering: EnteringState | null;
  exitDir: number;
  exitSeq: number;
  variant: 'page' | 'card';
  reduced: boolean;
  className: string;
  onExitDone: (seq: number) => void;
  onEnterDone: (seq: number) => void;
  children: React.ReactNode;
}> = React.memo(({
  role,
  entering,
  exitDir,
  exitSeq,
  variant,
  reduced,
  className,
  onExitDone,
  onEnterDone,
  children,
}) => {
  const workEnabled = useWindowWorkEnabled();
  const isExiting = role === 'exiting';
  const isEntering = !isExiting && entering !== null;
  const dir = isExiting ? exitDir : (entering?.dir ?? 1);
  const animKind = reduced ? 'reduced' : variant;
  const stateClass = isExiting
    ? `os-cf-exit-${animKind}`
    : isEntering
      ? `os-cf-enter-${animKind}`
      : '';

  const style = (isExiting || isEntering) && !reduced && variant === 'page'
    ? ({ '--os-cf-dir': String(dir) } as React.CSSProperties)
    : undefined;

  return (
    <div
      ref={(el) => {
        if (el) el.inert = isExiting;
      }}
      aria-hidden={isExiting || undefined}
      data-exiting={isExiting ? 'true' : undefined}
      data-entering={isEntering ? 'true' : undefined}
      className={`os-crossfade-cell ${stateClass} ${className}`.trim()}
      style={style}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return;
        if (isExiting) onExitDone(exitSeq);
        else if (entering) onEnterDone(entering.seq);
      }}
    >
      <WindowWorkContext.Provider value={workEnabled && !isExiting}>
        {children}
      </WindowWorkContext.Provider>
    </div>
  );
});

/**
 * ORTAK SİSTEM BİLEŞENİ: Apple macOS Pro GPU-Compositor Çapraz Geçiş (`AppleCrossfadeSlot`)
 * - Motion JS döngüsü veya `getComputedStyle` layout okuması olmadan saf CSS GPU compositor
 *   (`opacity` + 1:1 `translate3d`) kullanır; tam ekranda bile ana iş parçacığını kilitlemez.
 * - Eski içerik aynı DOM düğümünü koruyarak (kaydırma konumu bozulmadan) 160ms'de yumuşakça erir
 *   ("pat pat" yapmaz); yeni içerik 45ms GPU ön-rasterizasyon payı sonrası 260ms'de süzülür.
 * - Hızlı tıklamalarda en fazla 1 çıkan katman tutar; geçiş bitince `transform: none` ve
 *   `will-change: auto` ile sıfır boşta VRAM/CPU yüküne döner.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const AppleCrossfadeSlot: React.FC<{
  activeKey: string;
  direction?: number;
  variant?: 'page' | 'card';
  className?: string;
  cellClassName?: string;
  children: React.ReactNode;
}> = React.memo(({
  activeKey,
  direction = 1,
  variant = 'page',
  className = '',
  cellClassName = '',
  children,
}) => {
  const reduced = useReducedMotion() ?? false;
  const seqRef = useRef(0);
  const committedRef = useRef<{ key: string; node: React.ReactNode }>({ key: activeKey, node: children });
  const [state, setState] = useState<CrossfadeState>(() => ({
    activeKey,
    exiting: null,
    entering: null,
  }));

  if (state.activeKey !== activeKey) {
    const skip = Boolean(MotionGlobalConfig.skipAnimations);
    const prev = committedRef.current;
    if (skip || prev.key === activeKey) {
      setState({ activeKey, exiting: null, entering: null });
    } else {
      const seq = ++seqRef.current;
      setState({
        activeKey,
        exiting: { key: prev.key, node: prev.node, dir: direction, seq },
        entering: { dir: direction, seq },
      });
    }
  }

  useLayoutEffect(() => {
    committedRef.current = { key: activeKey, node: children };
  }, [activeKey, children]);

  const timing = reduced ? TIMING.reduced : TIMING[variant];
  const exitSeq = state.exiting?.seq ?? 0;
  const enterSeq = state.entering?.seq ?? 0;

  useEffect(() => {
    if (!exitSeq) return;
    const timer = setTimeout(() => {
      setState((prev) => (prev.exiting?.seq === exitSeq ? { ...prev, exiting: null } : prev));
    }, timing.exitMs + 50);
    return () => clearTimeout(timer);
  }, [exitSeq, timing.exitMs]);

  useEffect(() => {
    if (!enterSeq) return;
    const timer = setTimeout(() => {
      setState((prev) => (prev.entering?.seq === enterSeq ? { ...prev, entering: null } : prev));
    }, timing.enterDelayMs + timing.enterMs + 60);
    return () => clearTimeout(timer);
  }, [enterSeq, timing.enterDelayMs, timing.enterMs]);

  const handleExitDone = useCallback((seq: number) => {
    setState((prev) => (prev.exiting?.seq === seq ? { ...prev, exiting: null } : prev));
  }, []);

  const handleEnterDone = useCallback((seq: number) => {
    setState((prev) => (prev.entering?.seq === seq ? { ...prev, entering: null } : prev));
  }, []);

  const exiting = state.exiting && state.exiting.key !== activeKey ? state.exiting : null;
  const isTransitioning = Boolean(exiting || state.entering);

  const layers = exiting
    ? [
        { key: exiting.key, role: 'exiting' as const, node: exiting.node },
        { key: activeKey, role: 'active' as const, node: children },
      ]
    : [{ key: activeKey, role: 'active' as const, node: children }];

  return (
    <div
      className={`os-crossfade-grid ${className}`.trim()}
      data-variant={variant}
      data-transitioning={isTransitioning ? 'true' : undefined}
    >
      {layers.map((layer) => (
        <CrossfadeCell
          key={layer.key}
          role={layer.role}
          entering={layer.role === 'active' ? state.entering : null}
          exitDir={exiting?.dir ?? direction}
          exitSeq={exiting?.seq ?? 0}
          variant={variant}
          reduced={reduced}
          className={cellClassName}
          onExitDone={handleExitDone}
          onEnterDone={handleEnterDone}
        >
          {layer.node}
        </CrossfadeCell>
      ))}
    </div>
  );
});
