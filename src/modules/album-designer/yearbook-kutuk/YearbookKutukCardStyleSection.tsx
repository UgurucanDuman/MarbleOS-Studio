import React from 'react';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import type { TeacherChartPalette } from '../../../system/storage/teacher-charts/types';
import {
  DEFAULT_KUTUK_NAME_BOX_STYLE,
  DEFAULT_KUTUK_PHOTO_FRAME,
  KUTUK_FRAME_COLOR_SWATCHES,
  KUTUK_NAME_BOX_STYLE_META,
  KUTUK_PHOTO_FRAME_META,
} from '../../../system/storage/yearbook-kutuk/catalog';
import type {
  KutukNameBoxStyle,
  KutukPhotoFrame,
} from '../../../system/storage/yearbook-kutuk/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';

/**
 * İZOLE MODÜL 03 DENETÇİ ALT BÖLÜMÜ: Apple İsim Kutucuğu, Fotoğraf Çerçevesi ve Özel Kutu Rengi Tasarımı
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const YearbookKutukCardStyleSection: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activePalette: TeacherChartPalette;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({ albumConfig, activePalette, onPatchConfig }) => {
  const activeBoxStyle = albumConfig.kutukNameBoxStyle ?? DEFAULT_KUTUK_NAME_BOX_STYLE;
  const activePhotoFrame = albumConfig.kutukPhotoFrame ?? DEFAULT_KUTUK_PHOTO_FRAME;
  const customHex =
    albumConfig.kutukFrameColor && /^#[0-9a-fA-F]{6}$/.test(albumConfig.kutukFrameColor)
      ? albumConfig.kutukFrameColor
      : '';
  const effectiveHex = customHex || activePalette.accent;
  const activeSwatchName =
    KUTUK_FRAME_COLOR_SWATCHES.find((s) => s.hex.toLowerCase() === effectiveHex.toLowerCase())?.name ??
    (customHex ? customHex.toUpperCase() : 'Tema Rengi');

  return (
    <div className="tc-section">
      <span className="tc-section-label">İsim Kutusu &amp; Çerçeve Tasarımı</span>

      <div className="yk-box-style-grid" role="radiogroup" aria-label="Öğrenci isim kutusu stili">
        {KUTUK_NAME_BOX_STYLE_META.map((item) => {
          const isSelected = item.id === activeBoxStyle;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`yk-box-style-card ${isSelected ? 'is-active' : ''}`.trim()}
              onClick={() => onPatchConfig({ kutukNameBoxStyle: item.id as KutukNameBoxStyle })}
            >
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          );
        })}
      </div>

      <div className="tc-field-stack" style={{ marginTop: 4 }}>
        <span className="tc-section-label">Fotoğraf Çerçevesi Kesimi</span>
        <AppleGlassSegment
          ariaLabel="Fotoğraf çerçevesi stili"
          fullWidth
          compact
          hideIcons
          activeId={activePhotoFrame}
          items={KUTUK_PHOTO_FRAME_META.map((f) => ({ id: f.id, label: f.label }))}
          onChange={(id) => onPatchConfig({ kutukPhotoFrame: id as KutukPhotoFrame })}
        />
      </div>

      <div className="tc-section-head" style={{ marginTop: 4 }}>
        <span className="tc-section-label">Kutu &amp; Çerçeve Rengi</span>
        {customHex ? (
          <button
            type="button"
            className="tc-auto-link"
            onClick={() => onPatchConfig({ kutukFrameColor: '' })}
          >
            Temayla Eşitle
          </button>
        ) : (
          <span className="tc-ink-label">{activeSwatchName}</span>
        )}
      </div>

      <div className="tc-ink-grid" role="radiogroup" aria-label="Kutu ve çerçeve rengi">
        {KUTUK_FRAME_COLOR_SWATCHES.map((sw) => {
          const isSelected = effectiveHex.toLowerCase() === sw.hex.toLowerCase();
          return (
            <button
              key={sw.hex}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Çerçeve rengi: ${sw.name}`}
              title={sw.name}
              className={`tc-ink-btn ${isSelected ? 'is-active' : ''}`.trim()}
              onClick={() => onPatchConfig({ kutukFrameColor: sw.hex })}
            >
              <span className="tc-ink-dot" style={{ background: sw.hex }} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <label className="yk-custom-color-row">
        <span>Özel Kutu / Çerçeve Rengi Seç</span>
        <input
          type="color"
          className="yk-color-input"
          aria-label="Özel kutu ve çerçeve rengi"
          value={effectiveHex}
          onChange={(e) => onPatchConfig({ kutukFrameColor: e.target.value })}
        />
      </label>
    </div>
  );
});
