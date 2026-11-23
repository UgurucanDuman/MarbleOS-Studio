import React from 'react';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { PVC_PHOTO_SHAPE_OPTIONS } from './pvcInspectorOptions';
import { SmoothRangeSlider } from './SmoothRangeSlider';
import type { PvcLiveSliderPreview } from './usePvcDesignController';

/**
 * İZOLE MODÜL 03 · HAZIR 5 ŞABLON PORTRE SIĞDIRMA & KADRAJ KONTROL BLOĞU
 * 5 hazır şablonda dahi portrenin Kapla/Sığdır, şekil, boyut (%70–%220) ve X/Y kadrajını yönetir.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PvcPortraitQuickControls: React.FC<{
  albumConfig: AlbumTemplateConfig;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
  onLivePreview: (preview: PvcLiveSliderPreview | null) => void;
}> = React.memo(({ albumConfig, onPatchConfig, onLivePreview }) => {
  const photoFit = albumConfig.pvcPhotoFit ?? 'cover';
  const photoZoom = albumConfig.pvcPhotoZoom ?? 1;
  const photoPosX = albumConfig.pvcPhotoPosX ?? 50;
  const photoPosY = albumConfig.pvcPhotoPosY ?? 18;
  const isDirty =
    photoFit !== 'cover' ||
    photoZoom !== 1 ||
    photoPosX !== 50 ||
    albumConfig.pvcPhotoPosY !== undefined ||
    Boolean(albumConfig.pvcPhotoShape);

  return (
    <div className="tc-section">
      <div className="tc-section-head">
        <span className="tc-section-label">Portre Sığdırma &amp; Kadraj</span>
        {isDirty && (
          <button
            type="button"
            className="tc-auto-link"
            onClick={() =>
              onPatchConfig({
                pvcPhotoFit: 'cover',
                pvcPhotoZoom: 1,
                pvcPhotoPosX: 50,
                pvcPhotoPosY: undefined,
                pvcPhotoShape: undefined,
              })
            }
          >
            Sıfırla
          </button>
        )}
      </div>

      <AppleGlassSegment
        ariaLabel="Portre sığdırma modu"
        fullWidth
        compact
        activeId={photoFit}
        items={[
          { id: 'cover', label: 'Kapla (Kırp)', iconHint: 'Kırp' },
          { id: 'contain', label: 'Sığdır (Tam)', iconHint: 'Görsel' },
        ]}
        onChange={(id) => onPatchConfig({ pvcPhotoFit: id as 'cover' | 'contain' })}
      />

      <div className="pvc-shape-pills">
        {PVC_PHOTO_SHAPE_OPTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`pvc-mini-btn ${albumConfig.pvcPhotoShape === s.id ? 'is-active' : ''}`.trim()}
            onClick={() =>
              onPatchConfig({ pvcPhotoShape: albumConfig.pvcPhotoShape === s.id ? undefined : s.id })
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      <SmoothRangeSlider
        label={`Portre Boyutu: %${Math.round(photoZoom * 100)}`}
        min={70}
        max={220}
        step={5}
        value={Math.round(photoZoom * 100)}
        onLiveChange={(v) => onLivePreview({ albumPatch: { pvcPhotoZoom: Number((v / 100).toFixed(2)) } })}
        onCommit={(v) => onPatchConfig({ pvcPhotoZoom: Number((v / 100).toFixed(2)) })}
      />
      <SmoothRangeSlider
        label={`Dikey Kadraj (Yukarı / Aşağı): %${photoPosY}`}
        min={0}
        max={100}
        step={2}
        value={photoPosY}
        onLiveChange={(v) => onLivePreview({ albumPatch: { pvcPhotoPosY: v } })}
        onCommit={(v) => onPatchConfig({ pvcPhotoPosY: v })}
      />
      <SmoothRangeSlider
        label={`Yatay Kadraj (Sol / Sağ): %${photoPosX}`}
        min={0}
        max={100}
        step={2}
        value={photoPosX}
        onLiveChange={(v) => onLivePreview({ albumPatch: { pvcPhotoPosX: v } })}
        onCommit={(v) => onPatchConfig({ pvcPhotoPosX: v })}
      />
    </div>
  );
});
