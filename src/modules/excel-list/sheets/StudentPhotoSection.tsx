import React, { useEffect, useRef, useState } from 'react';
import type { PhotoAdjustments, PhotoRecord } from '../../../system/sqlite/types';
import { DEFAULT_PHOTO_ADJUSTMENTS } from '../../../system/storage/photoColorMath';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import { computePhotoDragPan, stepPhotoWheelZoom } from '../../../system/storage/portraitSmartAlignMath';
import { photoAdjustmentStyle, StudioPhotoImage } from '../../../system/storage/StudioPhotoImage';
import { rangeFill } from '../../../window-system/sheet/rangeFill';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import { WheelRange } from '../../../window-system/sheet/WheelRange';
import { formErrorMessage } from './formHelpers';

export interface PendingStudentPhoto {
  fileName: string;
  dataUrl: string;
  contentHash?: string;
}

type ActiveTool = 'crop' | 'brightness' | 'filters';

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Portre Stüdyosu & Biyometrik Kadraj Paneli
 * - Sıfır titremeli GPU compositor (translate3d + scale3d), tekerlekle %250'ye kadar yakınlaştırma ve sürükle-kaydır
 * - Sola/Sağa Çevir, Kırp, Parlaklık, Oto. Parlaklık, Diğer Filtreler, Geri Al
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const StudentPhotoSection: React.FC<{
  isStaff: boolean;
  existingPhoto: PhotoRecord | undefined;
  pendingPhoto: PendingStudentPhoto | null;
  photoRemoved: boolean;
  adjustments: PhotoAdjustments;
  onSelectPending: (photo: PendingStudentPhoto) => void;
  onRemovePhoto: () => void;
  onChangeAdjustments: (next: PhotoAdjustments) => void;
  onError: (msg: string | null) => void;
}> = React.memo(({
  isStaff,
  existingPhoto,
  pendingPhoto,
  photoRemoved,
  adjustments,
  onSelectPending,
  onRemovePhoto,
  onChangeAdjustments,
  onError,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const adjRef = useRef(adjustments);
  adjRef.current = adjustments;
  const onChangeRef = useRef(onChangeAdjustments);
  onChangeRef.current = onChangeAdjustments;
  const dragRef = useRef<{ startX: number; startY: number; basePanX: number; basePanY: number } | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('crop');
  const [isDragging, setIsDragging] = useState(false);

  const hasPhoto = Boolean(pendingPhoto || (existingPhoto && !photoRemoved));
  const style = photoAdjustmentStyle(adjustments, true, true);
  const currentRotation = ((adjustments.rotation ?? 0) % 360 + 360) % 360;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !hasPhoto) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const nextZoom = stepPhotoWheelZoom(adjRef.current.zoom, e.deltaY, e.deltaMode);
      if (nextZoom !== adjRef.current.zoom) {
        onChangeRef.current({ ...adjRef.current, zoom: nextZoom });
      }
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [hasPhoto]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasPhoto || e.button !== 0) return;
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
    const frame = frameRef.current;
    if (!drag || !frame) return;
    const { panX, panY } = computePhotoDragPan(
      drag.basePanX,
      drag.basePanY,
      e.clientX - drag.startX,
      e.clientY - drag.startY,
      frame.clientWidth,
      frame.clientHeight,
      adjustments.zoom,
    );
    onChangeAdjustments({ ...adjustments, panX, panY });
  };

  const handlePointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onError(null);
    try {
      const encoded = await readPhotoFilesAsDataUrls([file]);
      if (!encoded[0]) return;
      onSelectPending(encoded[0]);
    } catch (err) {
      onError(formErrorMessage(err));
    }
  };

  const rotateBy = (delta: number) => {
    const nextRot = ((currentRotation + delta) % 360 + 360) % 360;
    onChangeAdjustments({ ...adjustments, rotation: nextRot });
  };

  const applyAutoBrightness = () => {
    onChangeAdjustments({ ...adjustments, brightness: 106, contrast: 105 });
  };

  const resetAll = () => {
    onChangeAdjustments({ ...DEFAULT_PHOTO_ADJUSTMENTS });
  };

  return (
    <aside className="xl-stu-photo-pane" aria-label={isStaff ? 'Öğretmen Resmi' : 'Öğrenci Resmi'}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void handleFileChange(e)}
      />

      <div className="xl-stu-photo-header">
        <SheetAutoIcon text="Fotoğraf" size={13.5} />
        <span>{isStaff ? 'Öğretmen Portresi' : 'Öğrenci Portresi'}</span>
      </div>

      <div className="xl-stu-photo-body">
        <div className="xl-stu-photo-stage-col">
          <div
            ref={frameRef}
            className={`xl-stu-photo-frame ${hasPhoto ? 'is-interactive' : ''} ${isDragging ? 'is-dragging' : ''}`.trim()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {pendingPhoto ? (
              <img
                src={pendingPhoto.dataUrl}
                alt="Seçilen kişi resmi"
                className="xl-stu-photo-img"
                style={style}
              />
            ) : existingPhoto && !photoRemoved ? (
              <StudioPhotoImage
                photo={existingPhoto}
                alt="Kayıtlı kişi resmi"
                className="xl-stu-photo-img"
                style={style}
              />
            ) : (
              <button
                type="button"
                className="xl-stu-photo-empty"
                onClick={() => fileInputRef.current?.click()}
              >
                <SheetAutoIcon text="Fotoğraf" size={26} />
                <strong>Portre Seçilmedi</strong>
                <small>Fotoğraf yüklemek için tıklayın</small>
              </button>
            )}
            <div className="xl-stu-frame-reticle" aria-hidden="true" />
          </div>

          <div className="xl-stu-photo-bottom-actions">
            <button type="button" className="xl-mini-btn" onClick={() => fileInputRef.current?.click()}>
              <SheetAutoIcon text="Fotoğraf" size={12.5} />
              Seç
            </button>
            <button type="button" className="xl-mini-btn" disabled={!hasPhoto} onClick={onRemovePhoto}>
              <SheetAutoIcon text="Sil" size={12.5} />
              Sil
            </button>
          </div>
        </div>

        <div className="xl-stu-photo-tools-col">
          <button type="button" className="xl-stu-tool-btn" disabled={!hasPhoto} onClick={() => rotateBy(-90)}>
            <SheetAutoIcon text="Sola Çevir" size={12.5} />
            <span>Sola Çevir</span>
          </button>
          <button type="button" className="xl-stu-tool-btn" disabled={!hasPhoto} onClick={() => rotateBy(90)}>
            <SheetAutoIcon text="Sağa Çevir" size={12.5} />
            <span>Sağa Çevir</span>
          </button>
          <button
            type="button"
            className={`xl-stu-tool-btn ${activeTool === 'crop' ? 'is-active' : ''}`}
            disabled={!hasPhoto}
            onClick={() => setActiveTool('crop')}
          >
            <SheetAutoIcon text="Kırp" size={12.5} />
            <span>Kırp</span>
          </button>
          <button
            type="button"
            className={`xl-stu-tool-btn ${activeTool === 'brightness' ? 'is-active' : ''}`}
            disabled={!hasPhoto}
            onClick={() => setActiveTool('brightness')}
          >
            <SheetAutoIcon text="Parlaklık" size={12.5} />
            <span>Parlaklık</span>
          </button>
          <button type="button" className="xl-stu-tool-btn" disabled={!hasPhoto} onClick={applyAutoBrightness}>
            <SheetAutoIcon text="Parlaklık" size={12.5} />
            <span>Oto. Parlaklık</span>
          </button>
          <button
            type="button"
            className={`xl-stu-tool-btn ${activeTool === 'filters' ? 'is-active' : ''}`}
            disabled={!hasPhoto}
            onClick={() => setActiveTool('filters')}
          >
            <SheetAutoIcon text="Filtre" size={12.5} />
            <span>Diğer Filtreler</span>
          </button>
          <button type="button" className="xl-stu-tool-btn" disabled={!hasPhoto} onClick={resetAll}>
            <SheetAutoIcon text="Geri Al" size={12.5} />
            <span>Geri Al</span>
          </button>
        </div>
      </div>

      <div className="xl-stu-crop-guide" aria-label="Biyometrik kadraj kılavuzu">
        <svg viewBox="0 0 68 86" className="xl-stu-crop-silhouette" aria-hidden="true">
          <rect x="4" y="4" width="60" height="78" rx="8" fill="none" stroke="currentColor" strokeDasharray="3 2.5" strokeWidth="1.2" opacity="0.4" />
          <line x1="12" y1="16" x2="56" y2="16" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.75" />
          <line x1="12" y1="47" x2="56" y2="47" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" opacity="0.75" />
          <circle cx="34" cy="31" r="11.5" fill="currentColor" opacity="0.68" />
          <path d="M14 76c2-14.5 10.5-21.5 20-21.5S52 61.5 54 76" fill="currentColor" opacity="0.52" />
        </svg>
        <div className="xl-stu-crop-copy">
          <span>Standart Portre Kadrajı</span>
          <small>Sürükleyerek kaydırın · Tekerlekle %250’ye kadar yakınlaştırın</small>
        </div>
      </div>

      <div className="xl-stu-tool-popover">
        <div className="xl-stu-metrics-row">
          <span>Kadraj %{Math.round(adjustments.zoom * 100)}</span>
          <span>Işık %{Math.round(adjustments.brightness)}</span>
          <span>{currentRotation}°</span>
        </div>

        {activeTool === 'crop' && (
          <label className="xl-stu-slider-label">
            <span>Yakınlaştırma ({Math.round(adjustments.zoom * 100)}%)</span>
            <WheelRange
              min={1}
              max={2.5}
              step={0.005}
              value={adjustments.zoom}
              style={rangeFill(adjustments.zoom, 1, 2.5)}
              disabled={!hasPhoto}
              onValueChange={(zoom) => onChangeAdjustments({ ...adjustments, zoom })}
            />
          </label>
        )}

        {activeTool === 'brightness' && (
          <label className="xl-stu-slider-label">
            <span>Parlaklık ({Math.round(adjustments.brightness)}%)</span>
            <WheelRange
              min={70}
              max={135}
              step={0.5}
              value={adjustments.brightness}
              style={rangeFill(adjustments.brightness, 70, 135)}
              disabled={!hasPhoto}
              onValueChange={(brightness) => onChangeAdjustments({ ...adjustments, brightness })}
            />
          </label>
        )}

        {activeTool === 'filters' && (
          <div className="xl-stu-dual-sliders">
            <label className="xl-stu-slider-label">
              <span>Kontrast ({Math.round(adjustments.contrast)}%)</span>
              <WheelRange
                min={70}
                max={135}
                step={0.5}
                value={adjustments.contrast}
                style={rangeFill(adjustments.contrast, 70, 135)}
                disabled={!hasPhoto}
                onValueChange={(contrast) => onChangeAdjustments({ ...adjustments, contrast })}
              />
            </label>
            <label className="xl-stu-slider-label">
              <span>Sıcaklık ({Math.round(adjustments.warmth)})</span>
              <WheelRange
                min={-30}
                max={30}
                step={0.5}
                value={adjustments.warmth}
                style={rangeFill(adjustments.warmth, -30, 30)}
                disabled={!hasPhoto}
                onValueChange={(warmth) => onChangeAdjustments({ ...adjustments, warmth })}
              />
            </label>
          </div>
        )}
      </div>
    </aside>
  );
});
