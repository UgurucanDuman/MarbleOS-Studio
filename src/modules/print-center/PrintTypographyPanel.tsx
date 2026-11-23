import { notifyStudio } from '../../system/desktop/studioToast';
import type { PrintOrientation } from '../../system/desktop/desktopPrinter';
import { useUpdateAlbumConfigMutation } from '../../system/query/useStudioQueries';
import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import {
  DEFAULT_PVC_CODE_TYPE,
  DEFAULT_PVC_PRINT_SIDES,
  PVC_BUILT_IN_TEMPLATES,
  resolvePvcCardDesign,
} from '../../system/storage/pvc-cards/catalog';
import type { PvcCodeType, PvcPrintSidesMode } from '../../system/storage/pvc-cards/types';
import {
  TEACHER_DOC_TEMPLATES,
  TEACHER_INK_COLOR_LIST,
  TEACHER_PALETTE_LIST,
} from '../../system/storage/teacher-charts/catalog';
import {
  detectDefaultTemplateForBranch,
  resolveTeacherChartConfig,
} from '../../system/storage/teacher-charts/paginationMath';
import { resolveKutukTemplate } from '../../system/storage/yearbook-kutuk/catalog';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import { PrintFontSelect } from '../../window-system/sheet/PrintFontSelect';
import { PVC_A4_CARDS_PER_PAGE_CHOICES } from './idCardImpositionPlanner';
import { PrintKutukOptions } from './PrintKutukOptions';
import type { PrintSheetMode } from './printSpecs';

const paletteOptions = TEACHER_PALETTE_LIST.map((palette) => ({
  value: palette.id,
  label: palette.name,
  iconHint: 'Renk',
}));

const templateOptions = TEACHER_DOC_TEMPLATES.map((tpl) => ({
  value: tpl.id,
  label: `${tpl.name} (${tpl.shortBadge})`,
  iconHint: 'Şube',
}));

export function PrintTypographyPanel({
  albumConfig,
  className,
  isRoster,
  isTeacherSheet,
  isKutukSheet = false,
  isPvcCard = false,
  isPvcA4Sheet = false,
  kutukLandscape = false,
  onChangeSheetMode,
  onChangeOrientation,
}: {
  albumConfig: AlbumTemplateConfig;
  className?: string;
  isRoster: boolean;
  isTeacherSheet: boolean;
  isKutukSheet?: boolean;
  isPvcCard?: boolean;
  isPvcA4Sheet?: boolean;
  kutukLandscape?: boolean;
  onChangeSheetMode?: (mode: PrintSheetMode) => void;
  onChangeOrientation?: (next: PrintOrientation) => void;
}) {
  const update = useUpdateAlbumConfigMutation();
  const { template, palette, activeInk } = resolveTeacherChartConfig(albumConfig, className);
  const kutukTemplate = resolveKutukTemplate(
    albumConfig.kutukTemplateId,
    kutukLandscape ? 'landscape' : 'portrait',
    albumConfig.kutukCols,
    albumConfig.kutukRows,
  );
  const pvcDesign = resolvePvcCardDesign(albumConfig);
  const pvcDesignOptions = [
    ...PVC_BUILT_IN_TEMPLATES.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.shortBadge})`,
      iconHint: 'Kimlik',
    })),
    ...(albumConfig.pvcCustomDesigns ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} (Özel · ${d.orientation === 'portrait' ? 'Dikey' : 'Yatay'})`,
      iconHint: 'Görsel',
    })),
  ];
  const defaultBranchTpl = detectDefaultTemplateForBranch(className);
  const patch = (value: Partial<AlbumTemplateConfig>) =>
    update.mutate(value, { onError: (error) => notifyStudio(formErrorMessage(error), 'error') });

  return (
    <section className="pc-panel-section" aria-label="Baskı tipografisi ve renkleri">
      {isPvcCard && (
        <div className="pc-control-field">
          <span className="pc-control-label">PVC Kart Tasarımı</span>
          <AppleSelect
            ariaLabel="PVC kart tasarımı"
            value={pvcDesign.id}
            options={pvcDesignOptions}
            onChange={(pvcTemplateId) => patch({ pvcTemplateId })}
          />
          {isPvcA4Sheet && (
            <>
              <div className="pc-section-head" style={{ marginTop: 4 }}>
                <span className="pc-control-label">A4 Sayfa Başı Kart Adedi</span>
                <span className="pc-ink-active-name">
                  {albumConfig.pvcCardsPerPage ? `${albumConfig.pvcCardsPerPage} Kart / A4` : 'Otomatik'}
                </span>
              </div>
              <AppleGlassSegment
                ariaLabel="A4 sayfa başı PVC kart adedi"
                fullWidth
                compact
                hideArrows
                hideIcons
                activeId={albumConfig.pvcCardsPerPage ? String(albumConfig.pvcCardsPerPage) : 'auto'}
                items={[
                  { id: 'auto', label: 'Oto' },
                  ...PVC_A4_CARDS_PER_PAGE_CHOICES.map((n) => ({ id: String(n), label: String(n) })),
                ]}
                onChange={(val) => {
                  if (val === 'auto') {
                    patch({ pvcCardsPerPage: undefined });
                    return;
                  }
                  const n = Number(val);
                  patch({ pvcCardsPerPage: n });
                  // 10'lu yerleşim yatay kartta A4 Dikey (2×5), dikey kartta A4 Yatay (5×2) tam ölçekle sığar
                  if (n === 10) {
                    onChangeOrientation?.(pvcDesign.orientation === 'portrait' ? 'landscape' : 'portrait');
                  }
                }}
              />
            </>
          )}
          <span className="pc-control-label" style={{ marginTop: 4 }}>Kart Baskı Yüzü</span>
          <AppleGlassSegment
            ariaLabel="Baskı merkezi kart yüzü"
            fullWidth
            compact
            activeId={albumConfig.pvcPrintSides ?? DEFAULT_PVC_PRINT_SIDES}
            items={[
              { id: 'front-only', label: 'Ön Yüz', iconHint: 'Kimlik' },
              { id: 'front-and-back', label: 'Ön + Arka', iconHint: 'Kopya' },
              { id: 'back-only', label: 'Arka', iconHint: 'Not' },
            ]}
            onChange={(id) => patch({ pvcPrintSides: id as PvcPrintSidesMode })}
          />
          {!pvcDesign.isCustom && (
            <>
              <span className="pc-control-label" style={{ marginTop: 4 }}>Barkod / QR</span>
              <AppleGlassSegment
                ariaLabel="Baskı merkezi barkod veya QR"
                fullWidth
                compact
                activeId={albumConfig.pvcCodeType ?? DEFAULT_PVC_CODE_TYPE}
                items={[
                  { id: 'barcode', label: 'Barkod', iconHint: 'Kod' },
                  { id: 'qrcode', label: 'QR Kod', iconHint: 'Şube' },
                  { id: 'none', label: 'Yok', iconHint: 'Gizle' },
                ]}
                onChange={(id) => patch({ pvcCodeType: id as PvcCodeType })}
              />
            </>
          )}
        </div>
      )}
      {isTeacherSheet && (
        <div className="pc-control-field">
          <div className="pc-section-head">
            <span className="pc-control-label">Çizelge Şablonu</span>
            {template.id !== defaultBranchTpl.id && (
              <button
                type="button"
                className="pc-inline-link"
                onClick={() => patch({ chartTemplateId: defaultBranchTpl.id })}
              >
                Şubeye Uyarla
              </button>
            )}
          </div>
          <AppleSelect
            ariaLabel="Çizelge şablonu"
            value={template.id}
            options={templateOptions}
            onChange={(chartTemplateId) => patch({ chartTemplateId })}
          />
        </div>
      )}

      {isKutukSheet && (
        <PrintKutukOptions
          albumConfig={albumConfig}
          kutukTemplate={kutukTemplate}
          onPatch={patch}
          onChangeSheetMode={onChangeSheetMode}
        />
      )}

      {((!isTeacherSheet && !isKutukSheet) ||
        (isTeacherSheet && template.studentsPerPage > 0) ||
        (isKutukSheet && !kutukTemplate.isCover)) && (
        <div className="pc-control-field">
          <span className="pc-control-label">Öğrenci Adı Puntosu</span>
          <PrintFontSelect
            value={albumConfig.printFontPt}
            pointOffset={isRoster ? 4 : isTeacherSheet && template.engine.startsWith('booklet') ? -2 : 0}
            onChange={(printFontPt) => patch({ printFontPt })}
          />
        </div>
      )}

      <div className="pc-control-field">
        <span className="pc-control-label">Çizelge Tablo Teması (Okul Renkleri)</span>
        <AppleSelect
          ariaLabel="Çizelge tablo teması"
          value={palette.id}
          options={paletteOptions}
          onChange={(id) => {
            const selected = TEACHER_PALETTE_LIST.find((item) => item.id === id);
            if (selected) {
              patch({
                chartPaletteId: selected.id,
                chartInkId: selected.defaultInkId,
                accentColor: selected.accent,
              });
            }
          }}
        />
      </div>

      <div className="pc-control-field">
        <div className="pc-section-head">
          <span className="pc-control-label">Yazı Rengi (12 Renk)</span>
          <span className="pc-ink-active-name">{activeInk.name}</span>
        </div>
        <div className="pc-ink-swatch-grid" role="radiogroup" aria-label="Baskı yazı rengi (12 renk)">
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
                className={`pc-ink-swatch-btn ${isSelected ? 'is-active' : ''}`.trim()}
                onClick={() => patch({ chartInkId: ink.id })}
              >
                <span
                  className="pc-ink-swatch-dot"
                  style={{ background: ink.swatch }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
