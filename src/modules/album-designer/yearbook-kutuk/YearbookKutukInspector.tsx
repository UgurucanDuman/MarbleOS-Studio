import React, { useMemo, useState } from 'react';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type { AlbumTemplateConfig } from '../../../system/sqlite/types';
import type {
  TeacherChartInkOption,
  TeacherChartPalette,
} from '../../../system/storage/teacher-charts/types';
import {
  DEFAULT_KUTUK_SCOPE_MODE,
  KUTUK_COL_CHOICES,
  KUTUK_GROUP_META,
  KUTUK_LANDSCAPE_COL_CHOICES,
  KUTUK_LANDSCAPE_ROW_CHOICES,
  KUTUK_ROW_CHOICES,
  KUTUK_TEMPLATES,
} from '../../../system/storage/yearbook-kutuk/catalog';
import type {
  DeputyScopeOption,
  KutukScopeMode,
  KutukTemplateGroupId,
  KutukTemplateSpec,
} from '../../../system/storage/yearbook-kutuk/types';
import { AppleGlassSegment } from '../../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { YearbookKutukCardStyleSection } from './YearbookKutukCardStyleSection';
import { YearbookKutukCoverAndStyleSection } from './YearbookKutukCoverAndStyleSection';

/**
 * İZOLE MODÜL 03 SOL DENETÇİ: Müdür Yardımcısı / İdareci Kütük Dosyası & Sınıf Albümü Ayarları
 * Esnek Sütun × Satır seçici (Dikey 4–7×4–7, Yatay 6–10×3–6) ve üst/orta başlık anahtarları içerir.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const YearbookKutukInspector: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeTemplate: KutukTemplateSpec;
  activePalette: TeacherChartPalette;
  activeInk: TeacherChartInkOption;
  deputyOptions: readonly DeputyScopeOption[];
  effectiveDeputyName: string;
  classSummaryLabel: string;
  totalStudentCount: number;
  totalPageCount: number;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({
  albumConfig,
  activeTemplate,
  activePalette,
  activeInk,
  deputyOptions,
  effectiveDeputyName,
  classSummaryLabel,
  totalStudentCount,
  totalPageCount,
  onPatchConfig,
}) => {
  const [groupDir, setGroupDir] = useState(1);
  const scopeMode = albumConfig.kutukScopeMode ?? DEFAULT_KUTUK_SCOPE_MODE;
  const activeGroup = activeTemplate.group;
  const showCoverEditor = activeTemplate.isCover || Boolean(albumConfig.kutukIncludeCover);
  const showHeader = albumConfig.kutukShowHeader ?? true;
  const showSubtitle = albumConfig.kutukShowSubtitle ?? true;
  const colChoices = activeTemplate.landscape ? KUTUK_LANDSCAPE_COL_CHOICES : KUTUK_COL_CHOICES;
  const rowChoices = activeTemplate.landscape ? KUTUK_LANDSCAPE_ROW_CHOICES : KUTUK_ROW_CHOICES;

  const groupTemplates = useMemo(
    () => KUTUK_TEMPLATES.filter((t) => t.group === activeGroup),
    [activeGroup],
  );

  const deputySelectOptions = useMemo(
    () =>
      deputyOptions.map((opt) => ({
        value: opt.deputyName,
        label:
          opt.branchCount > 0
            ? `${opt.deputyName} · ${opt.branchCount} Şube (${opt.branchNames.slice(0, 4).join(', ')}${opt.branchCount > 4 ? '…' : ''})`
            : `${opt.deputyName} · Atanmış şube yok`,
        iconHint: 'Müdür',
      })),
    [deputyOptions],
  );

  const handleSelectGroup = (nextGroup: KutukTemplateGroupId) => {
    const prevIdx = KUTUK_GROUP_META.findIndex((g) => g.id === activeGroup);
    const nextIdx = KUTUK_GROUP_META.findIndex((g) => g.id === nextGroup);
    if (prevIdx !== nextIdx) setGroupDir(nextIdx > prevIdx ? 1 : -1);
    if (activeTemplate.group === nextGroup) return;
    const first = KUTUK_TEMPLATES.find((t) => t.group === nextGroup) ?? activeTemplate;
    onPatchConfig({
      kutukTemplateId: first.id,
      ...(first.isCover ? {} : { columns: first.cols, kutukCols: first.cols, kutukRows: first.rows }),
    });
  };

  return (
    <aside className="tc-rail" aria-label="Yıllık ve idareci kütük denetçisi" tabIndex={0}>
      <div className="tc-section">
        <span className="tc-section-label">İdareci Dosya Kapsamı</span>
        <AppleGlassSegment
          ariaLabel="Kütük dosyası kapsamı"
          fullWidth
          compact
          activeId={scopeMode}
          items={[
            { id: 'all-classes', label: 'Tüm Okul', iconHint: 'Okul' },
            { id: 'deputy', label: 'Md. Yrd.', iconHint: 'Müdür' },
            { id: 'single-class', label: 'Tek Sınıf', iconHint: 'Şube' },
          ]}
          onChange={(id) => {
            const nextScope = id as KutukScopeMode;
            const autoDeputy =
              nextScope === 'deputy' && !albumConfig.kutukDeputyName && deputyOptions[0]
                ? deputyOptions[0].deputyName
                : albumConfig.kutukDeputyName;
            onPatchConfig({ kutukScopeMode: nextScope, kutukDeputyName: autoDeputy });
          }}
        />

        {scopeMode === 'deputy' && (
          deputySelectOptions.length > 0 ? (
            <AppleSelect
              ariaLabel="Sorumlu müdür yardımcısı seç"
              value={effectiveDeputyName}
              placeholder="Müdür yardımcısı seçin…"
              options={deputySelectOptions}
              onChange={(val) => onPatchConfig({ kutukDeputyName: val })}
            />
          ) : (
            <div className="yk-scope-summary">
              Şubelere henüz sorumlu <strong>Müdür Yardımcısı</strong> atanmamış. Sınıf Listesi modülünden şube düzenleyerek veya kadrodan Md. Yrd. atayarak süzebilirsiniz.
            </div>
          )
        )}

        <div className="yk-scope-summary">
          Dosyada <strong>{classSummaryLabel}</strong>, <strong>{totalStudentCount} öğrenci</strong> ve toplam{' '}
          <strong>{totalPageCount} A4 sayfa</strong> yer alıyor.
        </div>
      </div>

      <div className="tc-section">
        <span className="tc-section-label">Kâğıt Düzeni &amp; Kütük Türü</span>
        <div className="tc-cat-list" role="tablist" aria-label="Kütük sayfa düzeni kategorileri">
          {KUTUK_GROUP_META.map((grp) => {
            const isSelected = grp.id === activeGroup;
            return (
              <button
                key={grp.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`tc-cat-btn ${isSelected ? 'is-active' : ''}`.trim()}
                onClick={() => handleSelectGroup(grp.id)}
              >
                <span className="tc-cat-btn-text">
                  <strong>{grp.label}</strong>
                  <small>{grp.description}</small>
                </span>
                <span className="tc-cat-indicator" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <AppleCrossfadeSlot activeKey={activeGroup} direction={groupDir} variant="card">
          <div className="tc-tpl-list" role="radiogroup" aria-label="Kütük ve sınıf albümü şablonları">
            {groupTemplates.map((tpl) => {
              const isSelected =
                tpl.id === activeTemplate.id &&
                (tpl.isCover || (tpl.cols === activeTemplate.cols && tpl.rows === activeTemplate.rows));
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`tc-tpl-card ${isSelected ? 'is-active' : ''}`.trim()}
                  onClick={() =>
                    onPatchConfig({
                      kutukTemplateId: tpl.id,
                      ...(tpl.isCover ? {} : { columns: tpl.cols, kutukCols: tpl.cols, kutukRows: tpl.rows }),
                    })
                  }
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

        {!activeTemplate.isCover && (
          <div className="yk-grid-picker">
            <div className="tc-section-head">
              <span className="tc-section-label">Izgara Dizgisi (Sütun × Satır)</span>
              <span className="tc-ink-label">
                {activeTemplate.cols}×{activeTemplate.rows} · {activeTemplate.studentsPerPage} portre
              </span>
            </div>
            <div className="yk-grid-picker-row">
              <span className="yk-grid-axis-label">Soldan Sağa</span>
              <AppleGlassSegment
                ariaLabel="Soldan sağa sütun sayısı"
                fullWidth
                compact
                hideArrows
                hideIcons
                activeId={String(activeTemplate.cols)}
                items={colChoices.map((n) => ({ id: String(n), label: String(n) }))}
                onChange={(val) => {
                  const n = Number(val);
                  onPatchConfig({ kutukCols: n, columns: n });
                }}
              />
            </div>
            <div className="yk-grid-picker-row">
              <span className="yk-grid-axis-label">Yukarıdan Aşağı</span>
              <AppleGlassSegment
                ariaLabel="Yukarıdan aşağı satır sayısı"
                fullWidth
                compact
                hideArrows
                hideIcons
                activeId={String(activeTemplate.rows)}
                items={rowChoices.map((n) => ({ id: String(n), label: String(n) }))}
                onChange={(val) => onPatchConfig({ kutukRows: Number(val) })}
              />
            </div>
          </div>
        )}
      </div>

      {!activeTemplate.isCover && (
        <YearbookKutukCardStyleSection
          albumConfig={albumConfig}
          activePalette={activePalette}
          onPatchConfig={onPatchConfig}
        />
      )}

      <div className="tc-section">
        <span className="tc-section-label">Başlık, Kadro &amp; İmza Seçenekleri</span>
        <div className="tc-field-stack">
          {!activeTemplate.isCover && (
            <>
              <label className="mod-check-label">
                <input
                  type="checkbox"
                  checked={showHeader}
                  onChange={(e) => onPatchConfig({ kutukShowHeader: e.target.checked })}
                />
                Üst Başlık Bloğunu Göster (Okul · Sınıf)
              </label>
              {showHeader && (
                <label className="mod-check-label">
                  <input
                    type="checkbox"
                    checked={showSubtitle}
                    onChange={(e) => onPatchConfig({ kutukShowSubtitle: e.target.checked })}
                  />
                  Orta Başlık Satırını Göster
                </label>
              )}
              <label className="mod-check-label">
                <input
                  type="checkbox"
                  checked={Boolean(albumConfig.kutukIncludeCover)}
                  onChange={(e) => onPatchConfig({ kutukIncludeCover: e.target.checked })}
                />
                Dosya Başına Ön Kapak Sayfası Ekle
              </label>
            </>
          )}
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.kutukShowStaffPortraits ?? true}
              onChange={(e) => onPatchConfig({ kutukShowStaffPortraits: e.target.checked })}
            />
            Üstte İdareci &amp; Öğretmen Portresi Göster
          </label>
          <label className="mod-check-label">
            <input
              type="checkbox"
              checked={albumConfig.showTeacherBadge}
              onChange={(e) => onPatchConfig({ showTeacherBadge: e.target.checked })}
            />
            Sınıf Öğretmeni Bilgisini Göster
          </label>
          {!activeTemplate.isCover && (
            <>
              <label className="mod-check-label">
                <input
                  type="checkbox"
                  checked={albumConfig.kutukShowTeacherSig ?? true}
                  onChange={(e) => onPatchConfig({ kutukShowTeacherSig: e.target.checked })}
                />
                Sınıf / Rehber Öğretmeni İmzası
              </label>
              <label className="mod-check-label">
                <input
                  type="checkbox"
                  checked={albumConfig.kutukShowDeputySig ?? true}
                  onChange={(e) => onPatchConfig({ kutukShowDeputySig: e.target.checked })}
                />
                Sorumlu Müdür Yardımcısı İmzası
              </label>
              <label className="mod-check-label">
                <input
                  type="checkbox"
                  checked={albumConfig.kutukShowPrincipalSig ?? true}
                  onChange={(e) => onPatchConfig({ kutukShowPrincipalSig: e.target.checked })}
                />
                Okul Müdürü İmzası
              </label>
              <label className="mod-check-label">
                <input
                  type="checkbox"
                  checked={albumConfig.kutukShowPageNumber ?? true}
                  onChange={(e) => onPatchConfig({ kutukShowPageNumber: e.target.checked })}
                />
                Alt Sayfa Numarasını Göster
              </label>
            </>
          )}
        </div>
      </div>

      <YearbookKutukCoverAndStyleSection
        albumConfig={albumConfig}
        isCoverTemplate={activeTemplate.isCover}
        showCoverEditor={showCoverEditor}
        activePalette={activePalette}
        activeInk={activeInk}
        onPatchConfig={onPatchConfig}
      />
    </aside>
  );
});
