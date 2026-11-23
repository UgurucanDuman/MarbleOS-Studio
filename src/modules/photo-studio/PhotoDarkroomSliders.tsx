import React, { useState } from 'react';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import type { PhotoAdjustments } from '../../system/sqlite/types';
import {
  DEFAULT_PHOTO_ADJUSTMENTS,
  mergePhotoRecipe,
  resolveFullAdjustments,
  STUDIO_DARKROOM_PRESETS,
  type StudioDarkroomPreset,
} from '../../system/storage/photoColorMath';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { rangeFill } from '../../window-system/sheet/rangeFill';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { WheelRange } from '../../window-system/sheet/WheelRange';
import './photo-darkroom-sliders.css';

type DarkroomTab = 'light' | 'crop' | 'presets';

interface SliderSpec {
  key: keyof Required<PhotoAdjustments>;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (val: number) => string;
}

const fmtInt = (v: number) => `${Math.round(v)}`;
const fmtSigned = (v: number) => {
  const r = Math.round(v);
  return r > 0 ? `+${r}` : `${r}`;
};

const LIGHT_SLIDERS: readonly SliderSpec[] = [
  { key: 'brightness', label: 'Pozlama / Işık', min: 70, max: 135, step: 0.5, defaultValue: 100, format: (v) => `%${fmtInt(v)}` },
  { key: 'contrast', label: 'Ton & Kontrast', min: 70, max: 135, step: 0.5, defaultValue: 100, format: (v) => `%${fmtInt(v)}` },
  { key: 'shadows', label: 'Gölgeler (Koyu Detay)', min: -30, max: 50, step: 0.5, defaultValue: 0, format: fmtSigned },
  { key: 'highlights', label: 'Parlak Alan / Beyaz Fon', min: -50, max: 30, step: 0.5, defaultValue: 0, format: fmtSigned },
  { key: 'warmth', label: 'Beyaz Dengesi (Soğuk/Sıcak)', min: -30, max: 30, step: 0.5, defaultValue: 0, format: fmtSigned },
  { key: 'saturation', label: 'Canlılık / Doygunluk', min: 0, max: 140, step: 0.5, defaultValue: 100, format: (v) => `%${fmtInt(v)}` },
  { key: 'sharpen', label: 'Netlik (Göz & Detay)', min: 0, max: 40, step: 0.5, defaultValue: 0, format: fmtInt },
];

const CROP_SLIDERS: readonly SliderSpec[] = [
  { key: 'zoom', label: 'Kadraj Yakınlaştırma', min: 1, max: 2.5, step: 0.005, defaultValue: 1, format: (v) => `%${Math.round(v * 100)}` },
  { key: 'tilt', label: 'Baş Eğimi Düzeltme', min: -10, max: 10, step: 0.2, defaultValue: 0, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}°` },
  { key: 'panX', label: 'Yatay Merkezleme', min: -45, max: 45, step: 0.2, defaultValue: 0, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
  { key: 'panY', label: 'Dikey Merkezleme', min: -45, max: 45, step: 0.2, defaultValue: 0, format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%` },
];

function isPresetActive(full: Required<PhotoAdjustments>, preset: StudioDarkroomPreset): boolean {
  const r = preset.recipe;
  return (
    (r.brightness === undefined || Math.round(full.brightness) === r.brightness) &&
    (r.contrast === undefined || Math.round(full.contrast) === r.contrast) &&
    (r.warmth === undefined || Math.round(full.warmth) === r.warmth) &&
    (r.shadows === undefined || Math.round(full.shadows) === r.shadows) &&
    (r.highlights === undefined || Math.round(full.highlights) === r.highlights) &&
    (r.saturation === undefined || Math.round(full.saturation) === r.saturation) &&
    (r.sharpen === undefined || Math.round(full.sharpen) === r.sharpen)
  );
}

/**
 * İZOLE MODÜL 02 ALT BİLEŞENİ: Apple Pro Karanlık Oda Sürgü, Kadraj & Toplu İş Paneli
 * Sürgüler sürüklenirken veritabanı yazımı tetiklenmez; yalnızca bırakıldığında (pointerup/blur) kaydedilir.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PhotoDarkroomSliders: React.FC<{
  adjustments: PhotoAdjustments;
  checkedCount: number;
  scopeCount: number;
  batchBusy: boolean;
  onPatch: (patch: Partial<PhotoAdjustments>, immediate?: boolean) => void;
  onFlush: () => void;
  onApplyBatch: (target: 'checked' | 'scope', copyFraming: boolean) => void;
  onResetBatch: (target: 'checked' | 'scope') => void;
}> = ({ adjustments, checkedCount, scopeCount, batchBusy, onPatch, onFlush, onApplyBatch, onResetBatch }) => {
  const [tab, setTab] = useState<DarkroomTab>('light');
  const [copyFraming, setCopyFraming] = useState(false);
  const full = resolveFullAdjustments(adjustments);

  const rotateBy = (delta: -90 | 90) => {
    const nextRot = ((full.rotation + delta) % 360 + 360) % 360;
    onPatch({ rotation: nextRot }, true);
  };

  const centerFrame = () => {
    onPatch({
      zoom: DEFAULT_PHOTO_ADJUSTMENTS.zoom,
      panX: 0,
      panY: 0,
      tilt: 0,
      rotation: 0,
    }, true);
  };

  const renderSlider = (spec: SliderSpec) => {
    const val = full[spec.key];
    const modified = Math.abs(val - spec.defaultValue) > 0.001;
    return (
      <label key={spec.key} className="ps-slider-row">
        <span
          className="ps-slider-head"
          title="Varsayılan değere dönmek için çift tıklayın"
          onDoubleClick={() => onPatch({ [spec.key]: spec.defaultValue }, true)}
        >
          <span className="ps-slider-title">
            {modified && <i className="ps-slider-dot" aria-hidden="true" />}
            {spec.label}
          </span>
          <strong className="ps-slider-val">{spec.format(val)}</strong>
        </span>
        <WheelRange
          aria-label={spec.label}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={val}
          style={rangeFill(val, spec.min, spec.max)}
          onValueChange={(value) => onPatch({ [spec.key]: value })}
          onWheelEnd={onFlush}
          onPointerUp={onFlush}
          onPointerCancel={onFlush}
          onKeyUp={onFlush}
          onBlur={onFlush}
          onDoubleClick={() => onPatch({ [spec.key]: spec.defaultValue }, true)}
        />
      </label>
    );
  };

  return (
    <div className="ps-tools-shell">
      <AppleGlassSegment
        ariaLabel="Karanlık oda araç sekmeleri"
        activeId={tab}
        fullWidth
        compact
        onChange={(id) => {
          onFlush();
          setTab(id as DarkroomTab);
        }}
        items={[
          { id: 'light', label: 'Işık & Renk', iconHint: 'Parlaklık' },
          { id: 'crop', label: 'Kadraj', iconHint: 'Kırp' },
          { id: 'presets', label: 'Hazır & Toplu', iconHint: 'Filtre' },
        ]}
      />

      <AppleCrossfadeSlot activeKey={tab} variant="card">
        {tab === 'light' && <div className="ps-sliders-list">{LIGHT_SLIDERS.map(renderSlider)}</div>}

        {tab === 'crop' && (
          <div className="ps-crop-pane">
            <div className="ps-quick-btn-grid">
              <button type="button" className="ps-mini-tool-btn" onClick={() => rotateBy(-90)}>
                <SheetAutoIcon text="Sola Çevir" size={12.5} />
                <span>90° Sola</span>
              </button>
              <button type="button" className="ps-mini-tool-btn" onClick={() => rotateBy(90)}>
                <SheetAutoIcon text="Sağa Çevir" size={12.5} />
                <span>90° Sağa</span>
              </button>
              <button type="button" className="ps-mini-tool-btn" onClick={centerFrame}>
                <SheetAutoIcon text="Geri Al" size={12.5} />
                <span>Ortala</span>
              </button>
            </div>
            <div className="ps-sliders-list">{CROP_SLIDERS.map(renderSlider)}</div>
            {scopeCount > 1 && (
              <div className="ps-batch-actions">
                <button
                  type="button"
                  className="mod-secondary-btn"
                  disabled={batchBusy || checkedCount === 0}
                  onClick={() => onResetBatch('checked')}
                >
                  Seçilileri Orijinale Dön ({checkedCount})
                </button>
                <button
                  type="button"
                  className="mod-secondary-btn"
                  disabled={batchBusy}
                  onClick={() => onResetBatch('scope')}
                >
                  Tümünü Orijinale Dön ({scopeCount})
                </button>
              </div>
            )}
            <p className="ps-stage-hint">
              Portreyi fareyle sürükleyip kaydırabilir, tekerlekle %250’ye kadar yakınlaştırabilirsiniz.
            </p>
          </div>
        )}

        {tab === 'presets' && (
          <div className="ps-presets-pane">
            <div className="ps-preset-grid">
              {STUDIO_DARKROOM_PRESETS.map((preset) => {
                const active = isPresetActive(full, preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`ps-preset-btn ${active ? 'is-active' : ''}`}
                    onClick={() =>
                      onPatch(
                        resolveFullAdjustments(
                          mergePhotoRecipe(adjustments, { ...DEFAULT_PHOTO_ADJUSTMENTS, ...preset.recipe }, false),
                        ),
                        true,
                      )
                    }
                  >
                    <SheetAutoIcon text={preset.hint} size={12.5} />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="ps-batch-box">
              <span className="ps-batch-title">Işık, Renk &amp; Akıllı Kadrajı Sınıfça Eşitle</span>
              <label className="ps-inline-check">
                <input
                  type="checkbox"
                  className="ps-apple-check"
                  checked={copyFraming}
                  onChange={(e) => setCopyFraming(e.target.checked)}
                />
                <span>Kadrajı akıllı hizala (her öğrenciye göre hesapla)</span>
              </label>
              {copyFraming && (
                <p className="ps-stage-hint">
                  Seçili karedeki yüz boyutu ve baş hizasını referans alır; kısa/uzun her öğrenciyi saç kesmeden ortalar.
                </p>
              )}
              <div className="ps-batch-actions">
                <button
                  type="button"
                  className="mod-secondary-btn"
                  disabled={batchBusy || checkedCount === 0}
                  onClick={() => onApplyBatch('checked', copyFraming)}
                >
                  Seçililere Uygula ({checkedCount})
                </button>
                <button
                  type="button"
                  className="mod-secondary-btn"
                  disabled={batchBusy || scopeCount <= 1}
                  onClick={() => onApplyBatch('scope', copyFraming)}
                >
                  Tüm Listeye Uygula ({scopeCount})
                </button>
              </div>
              <div className="ps-batch-actions">
                <button
                  type="button"
                  className="mod-secondary-btn"
                  disabled={batchBusy || checkedCount === 0}
                  onClick={() => onResetBatch('checked')}
                >
                  Seçilileri Orijinale Dön ({checkedCount})
                </button>
                <button
                  type="button"
                  className="mod-secondary-btn"
                  disabled={batchBusy || scopeCount === 0}
                  onClick={() => onResetBatch('scope')}
                >
                  Tümünü Orijinale Dön ({scopeCount})
                </button>
              </div>
            </div>
          </div>
        )}
      </AppleCrossfadeSlot>
    </div>
  );
};
