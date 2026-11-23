import React, { useMemo, useRef, useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import { readPhotoFilesAsDataUrls } from '../../../system/storage/photoImport';
import {
  TEACHER_CATEGORY_META,
  TEACHER_DOC_TEMPLATES,
  TEACHER_INK_COLOR_LIST,
  TEACHER_PALETTE_LIST,
} from '../../../system/storage/teacher-charts/catalog';
import { detectDefaultTemplateForBranch } from '../../../system/storage/teacher-charts/paginationMath';
import type {
  TeacherChartInkOption,
  TeacherChartPalette,
  TeacherChartPaletteId,
  TeacherDocCategoryId,
  TeacherDocTemplateSpec,
} from '../../../system/storage/teacher-charts/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { PrintFontSelect } from '../../../window-system/sheet/PrintFontSelect';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';
import { useDebouncedTextField } from '../useDebouncedTextField';

/**
 * İZOLE MODÜL 03 DENETÇİ RAYI:
 * İlköğretim/Lise Not Çizelgesi, Cep Not Defteri, ŞÖK, Cep Albümü, 8 Okul Teması & 12 Yazı Rengi.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const TeacherChartInspector: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeClassName?: string;
  activeCategory: TeacherDocCategoryId;
  activeTemplate: TeacherDocTemplateSpec;
  activePalette: TeacherChartPalette;
  activeInk: TeacherChartInkOption;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({
  albumConfig, activeClassName, activeCategory, activeTemplate, activePalette, activeInk, onPatchConfig,
}) => {
  const [catDir, setCatDir] = useState(1);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverTitleField = useDebouncedTextField(albumConfig.coverTitle ?? '', (coverTitle) => {
    onPatchConfig({ coverTitle });
  });
  const coverSubField = useDebouncedTextField(albumConfig.coverSubtitle ?? '', (coverSubtitle) => {
    onPatchConfig({ coverSubtitle });
  });

  const categoryTemplates = useMemo(
    () => TEACHER_DOC_TEMPLATES.filter((t) => t.categoryId === activeCategory),
    [activeCategory],
  );
  const defaultBranchTemplate = useMemo(
    () => detectDefaultTemplateForBranch(activeClassName),
    [activeClassName],
  );

  const showCoverStudio =
    activeCategory === 'not-defteri' ||
    activeCategory === 'cep-albumu' ||
    activeTemplate.engine === 'booklet-gradebook-front' ||
    activeTemplate.engine === 'booklet-album-cover';

  const handleSelectCategory = (nextCategory: TeacherDocCategoryId) => {
    const prevIdx = TEACHER_CATEGORY_META.findIndex((c) => c.id === activeCategory);
    const nextIdx = TEACHER_CATEGORY_META.findIndex((c) => c.id === nextCategory);
    if (prevIdx !== nextIdx) setCatDir(nextIdx > prevIdx ? 1 : -1);
    if (activeTemplate.categoryId === nextCategory) return;
    const preferred =
      nextCategory === defaultBranchTemplate.categoryId
        ? defaultBranchTemplate
        : TEACHER_DOC_TEMPLATES.find((t) => t.categoryId === nextCategory) ?? defaultBranchTemplate;
    onPatchConfig({ chartTemplateId: preferred.id });
  };

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
      const targetCoverId = activeCategory === 'cep-albumu' ? 'pocket-album-cover' : 'notebook-cover-front';
      const isAlreadyCover =
        activeTemplate.engine === 'booklet-gradebook-front' || activeTemplate.engine === 'booklet-album-cover';
      onPatchConfig({
        customCoverDataUrl: dataUrl,
        customCoverMode: albumConfig.customCoverMode ?? 'full-bleed',
        ...(isAlreadyCover ? {} : { chartTemplateId: targetCoverId }),
      });
      notifyStudio('Özel kapak tasarımı yüklendi ve canlı sahneye uygulandı.', 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <aside className="tc-rail" aria-label="Çizelge ve cep defteri şablon denetçisi" tabIndex={0}>
      <div className="tc-section">
        <div className="tc-section-head">
          <span className="tc-section-label">Baskı Belge Türü</span>
          {activeTemplate.id !== defaultBranchTemplate.id && (
            <button
              type="button"
              className="tc-auto-link"
              onClick={() => onPatchConfig({ chartTemplateId: defaultBranchTemplate.id })}
            >
              Şubeye Uyarla
            </button>
          )}
        </div>
        <div className="tc-cat-list" role="tablist" aria-label="Çizelge belge kategorileri">
          {TEACHER_CATEGORY_META.map((cat) => {
            const isSelected = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`tc-cat-btn ${isSelected ? 'is-active' : ''}`.trim()}
                onClick={() => handleSelectCategory(cat.id)}
              >
                <span className="tc-cat-btn-text">
                  <strong>{cat.label}</strong>
                  <small>{cat.description}</small>
                </span>
                <span className="tc-cat-indicator" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="tc-section">
        <span className="tc-section-label">Şablon Dizgisi ({categoryTemplates.length})</span>
        <AppleCrossfadeSlot activeKey={activeCategory} direction={catDir} variant="card">
          <div className="tc-tpl-list" role="radiogroup" aria-label="Kategori şablonları">
            {categoryTemplates.map((tpl) => {
              const isSelected = tpl.id === activeTemplate.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`tc-tpl-card ${isSelected ? 'is-active' : ''}`.trim()}
                  onClick={() => onPatchConfig({ chartTemplateId: tpl.id })}
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
        </AppleCrossfadeSlot>
      </div>

      {showCoverStudio && (
        <div className="tc-section">
          <div className="tc-section-head">
            <span className="tc-section-label">Kapak Tasarımı &amp; Özel Görsel</span>
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
              placeholder="Kapak ana başlığı (Örn: Öğretmen Defteri)"
              aria-label="Kapak ana başlığı"
            />
            <input
              type="text"
              className="mod-input"
              maxLength={80}
              value={coverSubField.value}
              onChange={(e) => coverSubField.onChange(e.target.value)}
              onBlur={coverSubField.onBlur}
              placeholder="Kapak şerit yazısı (Boşsa eğitim yılı)"
              aria-label="Kapak alt başlığı"
            />
            <AppleGlassSegment
              ariaLabel="Özel kapak yerleşim modu"
              fullWidth
              compact
              activeId={albumConfig.customCoverMode ?? 'full-bleed'}
              items={[
                { id: 'full-bleed', label: 'Tam Kapak', iconHint: 'Görsel' },
                { id: 'emblem', label: 'Çerçeveli Orta', iconHint: 'Kırp' },
              ]}
              onChange={(id) => onPatchConfig({ customCoverMode: id as 'full-bleed' | 'emblem' })}
            />
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              aria-label="Özel kapak görseli dosyası"
              onChange={(e) => void handleCoverUpload(e)}
            />
            <button type="button" className="mod-cover-upload-btn" onClick={() => coverInputRef.current?.click()}>
              {albumConfig.customCoverDataUrl
                ? 'Kendi Kapak Görselini Değiştir'
                : 'Kendi Kapak Görselini Yükle (JPG/PNG)'}
            </button>
          </div>
        </div>
      )}

      <div className="tc-section">
        {activeTemplate.studentsPerPage > 0 && (
          <div className="tc-field-stack">
            <span className="tc-section-label">Öğrenci Adı Puntosu</span>
            <PrintFontSelect
              value={albumConfig.printFontPt}
              pointOffset={activeTemplate.engine.startsWith('booklet') ? -2 : 0}
              onChange={(printFontPt) => onPatchConfig({ printFontPt })}
            />
          </div>
        )}
        <span className="tc-section-label">Çizelge Tablo Teması</span>
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

      <div className="tc-section">
        <span className="tc-section-label">Ders &amp; İmza Bilgisi</span>
        <div className="tc-field-stack">
          <input
            type="text"
            className="mod-input"
            maxLength={60}
            value={albumConfig.courseName ?? ''}
            onChange={(e) => onPatchConfig({ courseName: e.target.value })}
            placeholder="Ders adı (Boşsa noktalı alan)"
            aria-label="Ders adı"
          />
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.showTeacherBadge}
              onChange={(e) => onPatchConfig({ showTeacherBadge: e.target.checked })}
            />
            Öğretmen Adını İmzada Göster
          </label>
        </div>
      </div>
    </aside>
  );
});
