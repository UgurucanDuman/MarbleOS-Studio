import React from 'react';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import {
  DEFAULT_PVC_CODE_SOURCE,
  DEFAULT_PVC_PRINT_SIDES,
  defaultCodeTypeForTemplate,
} from '../../../system/storage/pvc-cards/catalog';
import {
  DEFAULT_PVC_BACK_NOTE,
  DEFAULT_PVC_HEADER_TOP_TEXT,
} from '../../../system/storage/pvc-cards/fieldResolver';
import type {
  PvcCodeSource,
  PvcCodeType,
  PvcFieldKey,
  PvcPrintSidesMode,
  PvcResolvedDesign,
} from '../../../system/storage/pvc-cards/types';
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
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { PrintFontSelect } from '../../../window-system/sheet/PrintFontSelect';
import { useDebouncedTextField } from '../useDebouncedTextField';
import type { PvcStageViewMode } from './PvcCardStageArea';
import { PVC_CODE_SRC_SELECT_OPTIONS } from './pvcInspectorOptions';
import { PvcCardSizeControls } from './PvcCardSizeControls';
import { PvcPortraitQuickControls } from './PvcPortraitQuickControls';
import { SmoothRangeSlider } from './SmoothRangeSlider';
import type { PvcLiveSliderPreview } from './usePvcDesignController';

/**
 * İZOLE MODÜL 03 HIZLI STİL, PORTRE KADRAJI & BARKOD BÖLÜMÜ:
 * Çift yüzlü baskı seçimi, 60 FPS akıcı köşe yuvarlaklığı, Barkod/QR/Yok,
 * portre sığdırma/kadraj, T.C. üst başlık metni, alanlar, punto, renk teması ve 12 mürekkep.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const TOGGLE_FIELDS: ReadonlyArray<{ key: PvcFieldKey; label: string }> = [
  { key: 'department', label: 'Bölümü / Alanı' },
  { key: 'nationalId', label: 'T.C. Kimlik No' },
  { key: 'bloodType', label: 'Kan Grubu' },
  { key: 'birthInfo', label: 'Doğum Yeri / Tarihi' },
];

export const PvcQuickStyleSection: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeDesign: PvcResolvedDesign;
  activePalette: TeacherChartPalette;
  activeInk: TeacherChartInkOption;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
  onLivePreview: (preview: PvcLiveSliderPreview | null) => void;
  onChangeCardRadius: (radiusMm: number) => void;
  onChangeCardSize: (widthMm: number, heightMm: number) => void;
  onChangeViewMode: (mode: PvcStageViewMode) => void;
  onSwitchToEditor: () => void;
}> = React.memo(({
  albumConfig,
  activeDesign,
  activePalette,
  activeInk,
  onPatchConfig,
  onLivePreview,
  onChangeCardRadius,
  onChangeCardSize,
  onChangeViewMode,
  onSwitchToEditor,
}) => {
  const hiddenFields = albumConfig.pvcHiddenFields ?? [];
  const codeType = albumConfig.pvcCodeType ?? defaultCodeTypeForTemplate(activeDesign.id);
  const codeSource = albumConfig.pvcCodeSource ?? DEFAULT_PVC_CODE_SOURCE;
  const printSides = albumConfig.pvcPrintSides ?? DEFAULT_PVC_PRINT_SIDES;
  const cardRadius = activeDesign.cardRadiusMm;

  const headerTopField = useDebouncedTextField(
    albumConfig.pvcHeaderTopText ?? DEFAULT_PVC_HEADER_TOP_TEXT,
    (pvcHeaderTopText) => onPatchConfig({ pvcHeaderTopText }),
  );
  const backNoteField = useDebouncedTextField(
    albumConfig.pvcBackNote ?? '',
    (pvcBackNote) => onPatchConfig({ pvcBackNote }),
  );

  const toggleField = (key: PvcFieldKey, show: boolean) => {
    const next = show
      ? hiddenFields.filter((f) => f !== key)
      : [...new Set([...hiddenFields, key])];
    onPatchConfig({ pvcHiddenFields: next });
  };

  const handlePrintSideChange = (mode: PvcPrintSidesMode) => {
    onPatchConfig({ pvcPrintSides: mode });
    if (mode === 'back-only') onChangeViewMode('back');
    else if (mode === 'front-and-back') onChangeViewMode('both');
    else onChangeViewMode('front');
  };

  return (
    <>
      <div className="tc-section">
        <span className="tc-section-label">Çift Yüzlü Baskı &amp; Köşe Şekli</span>
        <AppleGlassSegment
          ariaLabel="PVC kart baskı yüzü"
          fullWidth
          compact
          activeId={printSides}
          items={[
            { id: 'front-only', label: 'Ön Yüz', iconHint: 'Kimlik' },
            { id: 'front-and-back', label: 'Ön + Arka', iconHint: 'Kopya' },
            { id: 'back-only', label: 'Arka', iconHint: 'Not' },
          ]}
          onChange={(id) => handlePrintSideChange(id as PvcPrintSidesMode)}
        />

        <SmoothRangeSlider
          label={`Kart Köşe Şekli: ${cardRadius.toFixed(1)} mm`}
          min={0}
          max={10}
          step={0.2}
          value={cardRadius}
          resetLabel={Math.abs(cardRadius - 3.18) > 0.25 ? 'CR80' : undefined}
          onReset={() => onChangeCardRadius(3.18)}
          onLiveChange={(v) => onLivePreview({ cardRadiusMm: v })}
          onCommit={(v) => onChangeCardRadius(v)}
        />

        <PvcCardSizeControls
          widthMm={activeDesign.widthMm}
          heightMm={activeDesign.heightMm}
          onChangeSize={onChangeCardSize}
        />

        {activeDesign.isCustom ? (
          <div className="pvc-custom-edit-callout">
            <span>Özel tasarım aktif — katmanları, barkodu ve görselleri tuvalden düzenleyin.</span>
            <button type="button" className="tc-auto-link" onClick={onSwitchToEditor}>
              Tasarla Sekmesini Aç
            </button>
          </div>
        ) : (
          <>
            <span className="tc-section-label" style={{ marginTop: 2 }}>Barkod / QR Kod</span>
            <AppleGlassSegment
              ariaLabel="Kart barkod veya QR türü"
              fullWidth
              compact
              activeId={codeType}
              items={[
                { id: 'barcode', label: 'Barkod', iconHint: 'Kod' },
                { id: 'qrcode', label: 'QR Kod', iconHint: 'Şube' },
                { id: 'none', label: 'Yok', iconHint: 'Gizle' },
              ]}
              onChange={(id) => onPatchConfig({ pvcCodeType: id as PvcCodeType })}
            />
            {codeType !== 'none' && (
              <AppleSelect
                ariaLabel="Barkod ve QR veri kaynağı"
                value={codeSource}
                options={PVC_CODE_SRC_SELECT_OPTIONS}
                onChange={(val) => onPatchConfig({ pvcCodeSource: val as PvcCodeSource })}
              />
            )}
          </>
        )}
      </div>

      {!activeDesign.isCustom && (
        <PvcPortraitQuickControls
          albumConfig={albumConfig}
          onPatchConfig={onPatchConfig}
          onLivePreview={onLivePreview}
        />
      )}

      {!activeDesign.isCustom && (
        <div className="tc-section">
          <span className="tc-section-label">T.C. Başlığı &amp; Kart Alanları</span>
          <div className="tc-field-stack">
            <input
              type="text"
              className="mod-input"
              maxLength={80}
              value={headerTopField.value}
              onChange={(e) => headerTopField.onChange(e.target.value)}
              onBlur={headerTopField.onBlur}
              placeholder="T.C. MİLLÎ EĞİTİM BAKANLIĞI (boş = gizle)"
              aria-label="Kart üst T.C. başlık metni"
            />
            <label className="mod-check-label">
              <input
                type="checkbox"
                checked={albumConfig.pvcShowWatermark ?? true}
                onChange={(e) => onPatchConfig({ pvcShowWatermark: e.target.checked })}
              />
              Okul Logosu Filigranı
            </label>
            <label className="mod-check-label">
              <input
                type="checkbox"
                checked={albumConfig.pvcShowSignature ?? true}
                onChange={(e) => onPatchConfig({ pvcShowSignature: e.target.checked })}
              />
              Okul Müdürü İmzası
            </label>
            {TOGGLE_FIELDS.map((field) => (
              <label key={field.key} className="mod-check-label">
                <input
                  type="checkbox"
                  checked={!hiddenFields.includes(field.key)}
                  onChange={(e) => toggleField(field.key, e.target.checked)}
                />
                {field.label}
              </label>
            ))}
            <input
              type="text"
              className="mod-input"
              maxLength={180}
              value={backNoteField.value}
              onChange={(e) => backNoteField.onChange(e.target.value)}
              onBlur={backNoteField.onBlur}
              placeholder={DEFAULT_PVC_BACK_NOTE}
              aria-label="Arka yüz bilgi notu"
            />
          </div>
        </div>
      )}

      <div className="tc-section">
        <div className="tc-field-stack">
          <div className="tc-section-head">
            <span className="tc-section-label">Yazı Puntosu (Tüm Yazılar)</span>
            <button type="button" className="tc-auto-link" onClick={onSwitchToEditor}>
              Ayrı px Ayarla
            </button>
          </div>
          <PrintFontSelect
            value={albumConfig.printFontPt}
            onChange={(printFontPt) => onPatchConfig({ printFontPt })}
          />
        </div>

        <span className="tc-section-label">Kart Renk Teması</span>
        <div className="tc-palette-grid" role="radiogroup" aria-label="Kart renk teması">
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
              >
                <span className="tc-swatch" style={{ background: pal.accent }} aria-hidden="true" />
                <span>{pal.name}</span>
              </button>
            );
          })}
        </div>

        <div className="tc-section-head" style={{ marginTop: 4 }}>
          <span className="tc-section-label">Yazı Mürekkebi (12 Renk)</span>
          <span className="tc-ink-label">{activeInk.name}</span>
        </div>
        <div className="tc-ink-grid" role="radiogroup" aria-label="Kart yazı rengi (12 renk)">
          {TEACHER_INK_COLOR_LIST.map((ink) => {
            const isSelected = ink.id === activeInk.id;
            return (
              <button
                key={ink.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Kart yazı rengi: ${ink.name}`}
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
