import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PhotoAdjustments, PhotoRecord } from '../sqlite/types';
import { createGlPipeline, drawGlFrame, type GlPipeline } from './glDarkroomPipeline';
import { DEFAULT_PHOTO_ADJUSTMENTS } from './photoColorMath';
import { computePhotoDragPan, stepPhotoWheelZoom } from './portraitSmartAlignMath';
import { photoAdjustmentStyle, StudioPhotoImage, useResolvedPhotoPreviewUrl } from './StudioPhotoImage';
import { useWindowWorkEnabled } from '../motion/windowWork';

/**
 * Ekran Kartı (WebGL Shader) hızlandırmalı, sıfır titremeli etkileşimli portre sahnesi.
 * - Sürükleyerek kadraj kaydırma (panX / panY: -45%..+45%) ve kesintisiz tekerlek yakınlaştırma (zoom: 1.00..2.50x)
 * - Biyometrik (50×60 mm) / Vesikalık (45×60 mm) kafa-göz-çene hiza kılavuzu
 * - Önce / Sonra karşılaştırma (compareOriginal) ve çift tıklamayla sahne büyütme
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const GpuPhotoPreview: React.FC<{
  photo: PhotoRecord;
  adjustments: PhotoAdjustments;
  alt: string;
  showGuide?: boolean;
  compareOriginal?: boolean;
  onInteractiveFrame?: (patch: Partial<PhotoAdjustments>, commitNow?: boolean) => void;
  onDoubleClickStage?: () => void;
}> = React.memo(({
  photo,
  adjustments,
  alt,
  showGuide = false,
  compareOriginal = false,
  onInteractiveFrame,
  onDoubleClickStage,
}) => {
  const effectiveAdj = compareOriginal ? DEFAULT_PHOTO_ADJUSTMENTS : adjustments;
  const workEnabled = useWindowWorkEnabled();
  const { src } = useResolvedPhotoPreviewUrl(photo, true);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipeRef = useRef<GlPipeline | null>(null);
  const uploadedRef = useRef<{ pipe: GlPipeline; src: string } | null>(null);
  const adjRef = useRef<PhotoAdjustments>(effectiveAdj);
  adjRef.current = effectiveAdj;
  const callbackRef = useRef(onInteractiveFrame);
  callbackRef.current = onInteractiveFrame;
  const wheelCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; basePanX: number; basePanY: number } | null>(null);
  const [gpuReady, setGpuReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [contextEpoch, setContextEpoch] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pipe = createGlPipeline(canvas);
    pipeRef.current = pipe;
    if (!pipe) {
      setGpuReady(false);
      return;
    }
    const onLost = (e: Event) => {
      e.preventDefault();
      setGpuReady(false);
    };
    const onRestored = () => {
      pipeRef.current = createGlPipeline(canvas);
      setContextEpoch((n) => n + 1);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      if (wheelCommitTimerRef.current) clearTimeout(wheelCommitTimerRef.current);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      const current = pipeRef.current;
      if (current) {
        current.gl.deleteTexture(current.texture);
        current.gl.deleteBuffer(current.buffer);
        current.gl.deleteProgram(current.program);
      }
      pipeRef.current = null;
      uploadedRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!workEnabled || !gpuReady || !canvas || typeof ResizeObserver === 'undefined') return;
    let observing = true;
    const observer = new ResizeObserver(() => {
      if (observing && pipeRef.current) drawGlFrame(pipeRef.current, canvas, adjRef.current, true);
    });
    observer.observe(canvas);
    return () => {
      observing = false;
      observer.disconnect();
    };
  }, [workEnabled, gpuReady]);

  useEffect(() => {
    if (!workEnabled) return;
    const pipe = pipeRef.current;
    const canvas = canvasRef.current;
    if (!pipe || !canvas || !src) {
      setGpuReady(false);
      return;
    }
    if (uploadedRef.current?.pipe === pipe && uploadedRef.current.src === src) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled || !pipeRef.current || !canvasRef.current) return;
      const activePipe = pipeRef.current;
      activePipe.imgW = Math.max(1, img.naturalWidth || img.width || 1);
      activePipe.imgH = Math.max(1, img.naturalHeight || img.height || 1);
      activePipe.gl.bindTexture(activePipe.gl.TEXTURE_2D, activePipe.texture);
      activePipe.gl.texImage2D(
        activePipe.gl.TEXTURE_2D, 0, activePipe.gl.RGBA, activePipe.gl.RGBA, activePipe.gl.UNSIGNED_BYTE, img,
      );
      uploadedRef.current = { pipe: activePipe, src };
      drawGlFrame(activePipe, canvasRef.current, adjRef.current, true);
      setGpuReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setGpuReady(false);
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src, contextEpoch, workEnabled]);

  // Senkron GPU çizimi: sürgü veya fare tekerleği oynadığında 1 kare bile gecikmeden aynı boyama adımında çizilir
  useLayoutEffect(() => {
    if (!workEnabled || !gpuReady || !pipeRef.current || !canvasRef.current) return;
    drawGlFrame(pipeRef.current, canvasRef.current, effectiveAdj, true);
  }, [gpuReady, effectiveAdj, workEnabled]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!workEnabled || !stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!callbackRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const nextZoom = stepPhotoWheelZoom(adjRef.current.zoom, e.deltaY, e.deltaMode);
      if (nextZoom === adjRef.current.zoom) return;
      callbackRef.current({ zoom: nextZoom }, false);
      if (wheelCommitTimerRef.current) clearTimeout(wheelCommitTimerRef.current);
      wheelCommitTimerRef.current = setTimeout(() => {
        wheelCommitTimerRef.current = null;
        callbackRef.current?.({}, true);
      }, 220);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [workEnabled]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onInteractiveFrame || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      basePanX: adjustments.panX ?? 0,
      basePanY: adjustments.panY ?? 0,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage || !onInteractiveFrame) return;
    const { panX, panY } = computePhotoDragPan(
      drag.basePanX,
      drag.basePanY,
      e.clientX - drag.startX,
      e.clientY - drag.startY,
      stage.clientWidth,
      stage.clientHeight,
      adjustments.zoom,
    );
    onInteractiveFrame({ panX, panY }, false);
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    onInteractiveFrame?.({}, true);
  };

  const fallbackStyle = photoAdjustmentStyle(effectiveAdj, true, true);

  return (
    <div
      ref={stageRef}
      className={`mod-gpu-preview-stage ${onInteractiveFrame ? 'is-interactive' : ''} ${isDragging ? 'is-dragging' : ''}`.trim()}
      data-gpu-accelerated={gpuReady ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onDoubleClickStage}
    >
      <canvas
        ref={canvasRef}
        className="mod-gpu-preview-canvas"
        aria-hidden="true"
        style={{ opacity: gpuReady ? 1 : 0, pointerEvents: 'none' }}
      />
      <StudioPhotoImage
        decoding="async"
        photo={photo}
        alt={alt}
        style={{
          ...fallbackStyle,
          opacity: gpuReady ? 0 : 1,
          pointerEvents: gpuReady ? 'none' : 'auto',
        }}
      />
      {showGuide && (
        <svg className="ps-biometric-overlay" viewBox="0 0 150 200" aria-hidden="true">
          <rect x="10" y="10" width="130" height="180" rx="8" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="75" y1="12" x2="75" y2="188" stroke="rgba(56,189,248,0.42)" strokeWidth="0.9" strokeDasharray="3 3" />
          <line x1="22" y1="28" x2="128" y2="28" stroke="rgba(56,189,248,0.72)" strokeWidth="1" strokeDasharray="3 2.5" />
          <line x1="30" y1="78" x2="120" y2="78" stroke="rgba(56,189,248,0.55)" strokeWidth="0.9" strokeDasharray="2 2.5" />
          <line x1="22" y1="124" x2="128" y2="124" stroke="rgba(56,189,248,0.72)" strokeWidth="1" strokeDasharray="3 2.5" />
          <ellipse cx="75" cy="76" rx="33" ry="46" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1" />
        </svg>
      )}
      {compareOriginal && <span className="ps-compare-tag">ORİJİNAL</span>}
    </div>
  );
});
