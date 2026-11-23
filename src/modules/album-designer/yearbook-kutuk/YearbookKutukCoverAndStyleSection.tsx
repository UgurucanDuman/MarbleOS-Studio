import React, { useRef } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import {
  TEACHER_INK_COLOR_LIST,
  TEACHER_PALETTE_LIST,
} from '../../../system/storage/teacher-charts/catalog';
import type {
  TeacherChartInkOption,
  TeacherChartPalette,
  TeacherChartPaletteId,
} from '../../../system/storage/teacher-charts/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { PrintFontSelect } from '../../../window-system/sheet/PrintFontSelect';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';
import { useDebouncedTextField } from '../useDebouncedTextField';

/**
 * İZOLE MODÜL 03 DENETÇİ ALT BÖLÜMÜ: Kütük Dosyası Kapak Görseli, Yazı Puntosu, Okul Teması & 12 Mürekkep Rengi
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const YearbookKutukCoverAndStyleSection: React.FC<{
  albumConfig: AlbumTemplateConfig;
  isCoverTemplate: boolean;
  showCoverEditor: boolean;
  activePalette: TeacherChartPalette;
  activeInk: TeacherChartInkOption;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({
  albumConfig,
  isCoverTemplate,
  showCoverEditor,
  activePalette,
  activeInk,
  onPatchConfig,
}) => {
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverTitleField = useDebouncedTextField(albumConfig.coverTitle ?? '', (coverTitle) => {
    onPatchConfig({ coverTitle });
  });
  const coverSubField = useDebouncedTextField(albumConfig.coverSubtitle ?? '', (coverSubtitle) => {
    onPatchConfig({ coverSubtitle });
  });

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 3_000_000) {
      notifyStudio('Kapak görseli en fazla 3 MB olabilir (JPEG, PNG veya WebP).', 'error');
      return;
    }
    try {
      const encoded = await readPhotoFilesAsDataUrls([file]);
      const dataUrl = encoded[0]?.dataUrl;
      if (!dataUrl) return;
      onPatchConfig({
        customCoverDataUrl: dataUrl,
        customCoverMode: albumConfig.customCoverMode ?? 'emblem',
      });
      notifyStudio('Kütük dosyası kapak görseli yüklendi.', 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <>
      {showCoverEditor && (
        <div className="tc-section">
          <div className="tc-section-head">
            <span className="tc-section-label">Kapak Başlığı &amp; Görsel</span>
            {albumConfig.customCoverDataUrl && (
              <button type="button" className="tc-auto-link" onClick={() => onPatchConfig({ customCoverDataUrl: '' })}>
                Görseli Kaldır
              </button>
            )}
          </div>
          <div className="tc-field-stack">
            <input
              type="text"
              className="mod-input"
              maxLength={80}
              value={coverTitleField.value}
              onChange={(e) => coverTitleField.onChange(e.target.value)}
              onBlur={coverTitleField.onBlur}
              placeholder="Kapak başlığı (Boşsa resmi kütük başlığı)"
              aria-label="Kütük kapak ana başlığı"
            />
            <input
              type="text"
              className="mod-input"
              maxLength={80}
              value={coverSubField.value}
              onChange={(e) => coverSubField.onChange(e.target.value)}
              onBlur={coverSubField.onBlur}
              placeholder="Kapak alt başlığı (Boşsa şube/idareci özeti)"
              aria-label="Kütük kapak alt başlığı"
            />
            {albumConfig.customCoverDataUrl && (
              <AppleGlassSegment
                ariaLabel="Kütük özel kapak yerleşimi"
                fullWidth
                compact
                activeId={albumConfig.customCoverMode ?? 'emblem'}
                items={[
                  { id: 'emblem', label: 'Çerçeveli Orta', iconHint: 'Kırp' },
                  { id: 'full-bleed', label: 'Tam Kapak', iconHint: 'Görsel' },
                ]}
                onChange={(id) => onPatchConfig({ customCoverMode: id as 'full-bleed' | 'emblem' })}
              />
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              aria-label="Kütük kapak görseli dosyası"
              onChange={(e) => void handleCoverUpload(e)}
            />
            <button type="button" className="mod-cover-upload-btn" onClick={() => coverInputRef.current?.click()}>
              {albumConfig.customCoverDataUrl ? 'Kapak Görselini Değiştir' : 'Özel Kapak Görseli Yükle (JPG/PNG)'}
            </button>
          </div>
        </div>
      )}

      <div className="tc-section">
        {!isCoverTemplate && (
          <div className="tc-field-stack">
            <span className="tc-section-label">Öğrenci Adı Puntosu</span>
            <PrintFontSelect
              value={albumConfig.printFontPt}
              onChange={(printFontPt) => onPatchConfig({ printFontPt })}
            />
          </div>
        )}

        <span className="tc-section-label">Kütük Tablo Teması</span>
        <div className="tc-palette-grid" role="radiogroup" aria-label="Baskı renk tonu">
          {TEACHER_PALETTE_LIST.map((pal) => {
            const isSelected = pal.id === activePalette.id;
            return (
              <button
                key={pal.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`tc-palette-btn ${isSelected ? 'is-active' : ''}`.trim()}
                onClick={() =>
                  onPatchConfig({
                    chartPaletteId: pal.id as TeacherChartPaletteId,
                    chartInkId: pal.defaultInkId,
                    accentColor: pal.accent,
                  })
                }
                title={pal.subtitle}
              >
                <span className="tc-swatch" style={{ background: pal.accent }} aria-hidden="true" />
                <span>{pal.name}</span>
              </button>
            );
          })}
        </div>

        <div className="tc-section-head" style={{ marginTop: 4 }}>
          <span className="tc-section-label">Yazı Rengi (12 Renk)</span>
          <span className="tc-ink-label">{activeInk.name}</span>
        </div>
        <div className="tc-ink-grid" role="radiogroup" aria-label="Baskı yazı rengi (12 renk)">
          {TEACHER_INK_COLOR_LIST.map((ink) => {
            const isSelected = ink.id === activeInk.id;
            return (
              <button
                key={ink.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Yazı rengi: ${ink.name}`}
                title={ink.name}
                className={`tc-ink-btn ${isSelected ? 'is-active' : ''}`.trim()}
                onClick={() => onPatchConfig({ chartInkId: ink.id })}
              >
                <span className="tc-ink-dot" style={{ background: ink.swatch }} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
});
