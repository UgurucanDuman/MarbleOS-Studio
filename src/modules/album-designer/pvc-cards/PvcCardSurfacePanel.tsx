import React, { useRef } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import { PVC_ARTWORK_OPTIONS } from '../../../system/storage/pvc-cards/fieldResolver';
import type {
  PvcArtworkStyle,
  PvcCardOrientation,
  PvcCardSide,
  PvcCardSideSpec,
  PvcResolvedDesign,
} from '../../../system/storage/pvc-cards/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';
import { PvcCardSizeControls } from './PvcCardSizeControls';
import { PvcColorSwatchPicker } from './PvcColorSwatchPicker';
import { SmoothRangeSlider } from './SmoothRangeSlider';

/**
 * İZOLE MODÜL 03 KART YÜZEYİ & ŞEKLİ DENETÇİSİ:
 * Kartın köşe yuvarlaklığı (0 mm keskin → 10 mm yuvarlatılmış), yönü (Yatay/Dikey),
 * vektör grafik deseni, zemin gradyanı ve PNG/JPG arka plan görseli ayarları.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const ARTWORK_SELECT = PVC_ARTWORK_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
  iconHint: 'Görsel',
}));

const RADIUS_PRESETS: ReadonlyArray<{ label: string; mm: number }> = [
  { label: 'Keskin', mm: 0 },
  { label: 'CR80', mm: 3.18 },
  { label: 'Yumuşak', mm: 5.5 },
  { label: 'Yuvarlak', mm: 9 },
];

export const PvcCardSurfacePanel: React.FC<{
  design: PvcResolvedDesign;
  activeSide: PvcCardSide;
  onLiveCardRadius: (radiusMm: number) => void;
  onLivePatchSide: (patch: Partial<PvcCardSideSpec>) => void;
  onChangeOrientation: (orientation: PvcCardOrientation) => void;
  onChangeCardSize: (widthMm: number, heightMm: number) => void;
  onChangeCardRadius: (radiusMm: number) => void;
  onPatchSide: (patch: Partial<PvcCardSideSpec>) => void;
}> = React.memo(({
  design,
  activeSide,
  onLiveCardRadius,
  onLivePatchSide,
  onChangeOrientation,
  onChangeCardSize,
  onChangeCardRadius,
  onPatchSide,
}) => {
  const bgInputRef = useRef<HTMLInputElement | null>(null);
  const sideSpec = activeSide === 'back' ? design.back : design.front;

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 3_000_000) {
      notifyStudio('Kart arka plan görseli en fazla 3 MB olabilir (PNG, JPG veya WebP).', 'error');
      return;
    }
    try {
      const encoded = await readPhotoFilesAsDataUrls([file]);
      const dataUrl = encoded[0]?.dataUrl;
      if (!dataUrl) return;
      onPatchSide({
        backgroundDataUrl: dataUrl,
        backgroundFit: sideSpec.backgroundFit ?? 'cover',
        backgroundOpacity: sideSpec.backgroundOpacity ?? 1,
      });
      notifyStudio(`${activeSide === 'front' ? 'Ön yüz' : 'Arka yüz'} arka plan görseli yüklendi.`, 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <div className="pvc-prop-inspector">
      <div className="tc-section">
        <span className="tc-section-label">Kart Biçimi &amp; Köşe Şekli</span>
        <AppleGlassSegment
          ariaLabel="Kart yönü"
          fullWidth
          compact
          activeId={design.orientation}
          items={[
            { id: 'landscape', label: 'Yatay', iconHint: 'Kimlik' },
            { id: 'portrait', label: 'Dikey', iconHint: 'Portre' },
          ]}
          onChange={(id) => onChangeOrientation(id as PvcCardOrientation)}
        />

        <SmoothRangeSlider
          label={`Köşe Yuvarlaklığı: ${design.cardRadiusMm.toFixed(1)} mm`}
          min={0}
          max={10}
          step={0.2}
          value={design.cardRadiusMm}
          onLiveChange={onLiveCardRadius}
          onCommit={onChangeCardRadius}
        />
        <div className="pvc-radius-presets">
          {RADIUS_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`pvc-mini-btn ${Math.abs(design.cardRadiusMm - p.mm) < 0.35 ? 'is-active' : ''}`.trim()}
              onClick={() => onChangeCardRadius(p.mm)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <PvcCardSizeControls
          widthMm={design.widthMm}
          heightMm={design.heightMm}
          onChangeSize={onChangeCardSize}
        />
      </div>

      <div className="tc-section">
        <span className="tc-section-label">
          {activeSide === 'front' ? 'Ön Yüz' : 'Arka Yüz'} Grafik Deseni &amp; Zemin
        </span>
        <AppleSelect
          ariaLabel="Kart vektör grafik deseni"
          value={sideSpec.artworkStyle ?? 'none'}
          options={ARTWORK_SELECT}
          onChange={(val) => onPatchSide({ artworkStyle: val as PvcArtworkStyle })}
        />

        <PvcColorSwatchPicker
          label="Zemin Rengi"
          value={sideSpec.backgroundColor}
          onChange={(backgroundColor) => onPatchSide({ backgroundColor })}
        />
        <PvcColorSwatchPicker
          label="2. Gradyan Rengi (İsteğe Bağlı)"
          value={sideSpec.backgroundColor2 ?? ''}
          allowClear
          onChange={(backgroundColor2) => onPatchSide({ backgroundColor2 })}
        />
        {sideSpec.backgroundColor2 && (
          <SmoothRangeSlider
            label={`Gradyan Açısı: ${sideSpec.backgroundGradientAngle ?? 135}°`}
            min={0}
            max={360}
            step={15}
            value={sideSpec.backgroundGradientAngle ?? 135}
            onLiveChange={(backgroundGradientAngle) => onLivePatchSide({ backgroundGradientAngle })}
            onCommit={(backgroundGradientAngle) => onPatchSide({ backgroundGradientAngle })}
          />
        )}
      </div>

      <div className="tc-section">
        <div className="tc-section-head">
          <span className="tc-section-label">Özel Arka Plan Görseli</span>
          {sideSpec.backgroundDataUrl && (
            <button
              type="button"
              className="tc-auto-link"
              onClick={() => onPatchSide({ backgroundDataUrl: '' })}
            >
              Kaldır
            </button>
          )}
        </div>
        <input
          ref={bgInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          aria-label="Kart yüzü özel arka plan dosyası"
          onChange={(e) => void handleBgUpload(e)}
        />
        <button type="button" className="mod-cover-upload-btn pvc-bg-upload-btn" onClick={() => bgInputRef.current?.click()}>
          {sideSpec.backgroundDataUrl ? 'PNG / JPG Görselini Değiştir' : 'Özel Arka Plan Yükle (PNG/JPG)'}
        </button>

        {sideSpec.backgroundDataUrl && (
          <>
            <AppleGlassSegment
              ariaLabel="Arka plan sığdırma"
              fullWidth
              compact
              activeId={sideSpec.backgroundFit ?? 'cover'}
              items={[
                { id: 'cover', label: 'Tam Kapla', iconHint: 'Kırp' },
                { id: 'contain', label: 'Sığdır', iconHint: 'Görsel' },
              ]}
              onChange={(id) => onPatchSide({ backgroundFit: id as 'cover' | 'contain' })}
            />
            <SmoothRangeSlider
              label={`Görsel Opaklığı: %${Math.round((sideSpec.backgroundOpacity ?? 1) * 100)}`}
              min={10}
              max={100}
              step={5}
              value={Math.round((sideSpec.backgroundOpacity ?? 1) * 100)}
              onLiveChange={(v) => onLivePatchSide({ backgroundOpacity: v / 100 })}
              onCommit={(v) => onPatchSide({ backgroundOpacity: v / 100 })}
            />
          </>
        )}
      </div>
    </div>
  );
});
