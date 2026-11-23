import React, { useRef } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import { PVC_BUILT_IN_TEMPLATES } from '../../../system/storage/pvc-cards/catalog';
import {
  pvcCardDimensions,
  type PvcCustomDesign,
  type PvcResolvedDesign,
} from '../../../system/storage/pvc-cards/types';
import type {
  TeacherChartInkOption,
  TeacherChartPalette,
} from '../../../system/storage/teacher-charts/types';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';
import type { PvcStageViewMode } from './PvcCardStageArea';
import { PvcQuickStyleSection } from './PvcQuickStyleSection';
import type { PvcLiveSliderPreview } from './usePvcDesignController';

/**
 * İZOLE MODÜL 03 ŞABLON GALERİSİ PANELİ:
 * 5 hazır PVC kimlik tasarımı + fotoğrafçının kayıtlı özel tasarımları + hızlı arka plan yükleme.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PvcTemplateGalleryPanel: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeDesign: PvcResolvedDesign;
  customDesigns: readonly PvcCustomDesign[];
  activePalette: TeacherChartPalette;
  activeInk: TeacherChartInkOption;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
  onLivePreview: (preview: PvcLiveSliderPreview | null) => void;
  onChangeCardRadius: (radiusMm: number) => void;
  onChangeCardSize: (widthMm: number, heightMm: number) => void;
  onChangeViewMode: (mode: PvcStageViewMode) => void;
  onOpenNewSheet: (e: React.MouseEvent<HTMLButtonElement>, baseId?: string) => void;
  onOpenRenameSheet: (e: React.MouseEvent<HTMLButtonElement>, target: PvcCustomDesign) => void;
  onCloneActiveToCustom: () => void;
  onQuickUploadBgToCustom: (dataUrl: string) => void;
  onDeleteCustomDesign: (id: string) => void;
  onSwitchToEditor: () => void;
}> = React.memo(({
  albumConfig,
  activeDesign,
  customDesigns,
  activePalette,
  activeInk,
  onPatchConfig,
  onLivePreview,
  onChangeCardRadius,
  onChangeCardSize,
  onChangeViewMode,
  onOpenNewSheet,
  onOpenRenameSheet,
  onCloneActiveToCustom,
  onQuickUploadBgToCustom,
  onDeleteCustomDesign,
  onSwitchToEditor,
}) => {
  const quickBgRef = useRef<HTMLInputElement | null>(null);

  const handleQuickBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (dataUrl) onQuickUploadBgToCustom(dataUrl);
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <div className="pvc-gallery-stack">
      <div className="tc-section">
        <div className="tc-section-head">
          <span className="tc-section-label">5 Hazır PVC Kart Tasarımı</span>
          <button type="button" className="tc-auto-link" onClick={onCloneActiveToCustom}>
            Kopyala &amp; Düzenle
          </button>
        </div>
        <div className="tc-tpl-list" role="radiogroup" aria-label="5 hazır PVC kart tasarımı">
          {PVC_BUILT_IN_TEMPLATES.map((tpl) => {
            const isSelected = activeDesign.id === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`tc-tpl-card ${isSelected ? 'is-active' : ''}`.trim()}
                onClick={() => onPatchConfig({
                  pvcTemplateId: tpl.id,
                  pvcCodeType: undefined,
                  pvcCardWidthMm: undefined,
                  pvcCardHeightMm: undefined,
                })}
              >
                <div className="tc-tpl-top">
                  <strong>{tpl.name}</strong>
                  <span className="tc-tpl-meta">{tpl.shortBadge}</span>
                </div>
                <small>{tpl.subtitle}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="tc-section">
        <div className="tc-section-head">
          <span className="tc-section-label">Kendi Tasarımlarım ({customDesigns.length})</span>
          <button
            type="button"
            className="tc-auto-link"
            onClick={(e) => onOpenNewSheet(e, 'blank')}
          >
            + Yeni Tasarım
          </button>
        </div>

        {customDesigns.length === 0 ? (
          <p className="pvc-empty-custom-note">
            Henüz kayıtlı özel tasarımınız yok. Sıfırdan yeni kart oluşturabilir, PNG/JPG arka plan
            yükleyebilir veya 5 tasarımdan birini kopyalayıp düzenleyebilirsiniz.
          </p>
        ) : (
          <div className="tc-tpl-list" role="radiogroup" aria-label="Kayıtlı özel PVC kart tasarımları">
            {customDesigns.map((design) => {
              const isSelected = activeDesign.id === design.id;
              const baseDims = pvcCardDimensions(design.orientation);
              const wMm = design.widthMm ?? baseDims.widthMm;
              const hMm = design.heightMm ?? baseDims.heightMm;
              return (
                <div
                  key={design.id}
                  className={`pvc-custom-card-row ${isSelected ? 'is-active' : ''}`.trim()}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className="pvc-custom-card-main"
                    onClick={() => onPatchConfig({ pvcTemplateId: design.id })}
                  >
                    <strong>{design.name}</strong>
                    <small>
                      {hMm > wMm ? 'Dikey' : 'Yatay'} {wMm}×{hMm} mm ·{' '}
                      {design.front.elements.length} ön / {design.back.elements.length} arka katman
                    </small>
                  </button>
                  <div className="pvc-custom-card-tools">
                    <button
                      type="button"
                      className={`pvc-mini-btn ${isSelected ? 'is-primary' : 'is-active'}`}
                      onClick={() => {
                        onPatchConfig({ pvcTemplateId: design.id });
                        onSwitchToEditor();
                      }}
                    >
                      Tuvalde Düzenle
                    </button>
                    <button
                      type="button"
                      className="pvc-mini-btn"
                      onClick={(e) => onOpenRenameSheet(e, design)}
                    >
                      Ad Değiştir
                    </button>
                    <button
                      type="button"
                      className="pvc-mini-btn is-danger"
                      aria-label={`${design.name} tasarımını sil`}
                      onClick={() => onDeleteCustomDesign(design.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <input
          ref={quickBgRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          aria-label="Hızlı arka plan görseli seç"
          onChange={(e) => void handleQuickBgFile(e)}
        />
        <button
          type="button"
          className="mod-cover-upload-btn pvc-bg-upload-btn"
          onClick={() => quickBgRef.current?.click()}
        >
          Özel Arka Plan Yükle (PNG / JPG)
        </button>
      </div>

      <PvcQuickStyleSection
        albumConfig={albumConfig}
        activeDesign={activeDesign}
        activePalette={activePalette}
        activeInk={activeInk}
        onPatchConfig={onPatchConfig}
        onLivePreview={onLivePreview}
        onChangeCardRadius={onChangeCardRadius}
        onChangeCardSize={onChangeCardSize}
        onChangeViewMode={onChangeViewMode}
        onSwitchToEditor={onSwitchToEditor}
      />
    </div>
  );
});
