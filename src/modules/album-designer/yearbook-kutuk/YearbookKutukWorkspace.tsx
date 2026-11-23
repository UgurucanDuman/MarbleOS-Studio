import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type {
  AlbumTemplateConfig,
  ClassRecord,
  PhotoRecord,
  StudentRecord,
} from '../../../system/sqlite/types';
import { resolveTeacherChartConfig } from '../../../system/storage/teacher-charts/paginationMath';
import {
  DEFAULT_KUTUK_SCOPE_MODE,
  resolveKutukTemplate,
} from '../../../system/storage/yearbook-kutuk/catalog';
import { KutukPaper } from '../../../system/storage/yearbook-kutuk/KutukPaper';
import {
  buildKutukDossierPages,
  extractDeputyPrincipalOptions,
} from '../../../system/storage/yearbook-kutuk/paginationMath';
import {
  StageZoomBar,
  type StageZoomValue,
  useViewportWheelZoom,
} from '../../../window-system/StageZoomBar';
import '../teacher-charts/teacher-charts-ui.css';
import { YearbookKutukInspector } from './YearbookKutukInspector';
import './yearbook-kutuk-ui.css';

/**
 * İZOLE MODÜL 03 YILLIK & İDARECİ KÜTÜK DOSYASI ÇALIŞMA MASASI:
 * Müdür yardımcısına teslim edilen çok sınıflı (veya sorumlu şube süzmeli) A4 Dikey/Yatay Kütük & Sınıf Albümü.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const YearbookKutukWorkspace: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeSchoolName: string;
  scopedClasses: readonly ClassRecord[];
  activeClass: ClassRecord | undefined;
  allSchoolStudents: readonly StudentRecord[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl: string;
  watermarkOpacity: number;
  principalSigUrl: string;
  deputySigUrl: string;
  coverUrl: string;
  coverZoom: number;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({
  albumConfig,
  activeSchoolName,
  scopedClasses,
  activeClass,
  allSchoolStudents,
  photoMap,
  logoUrl,
  watermarkOpacity,
  principalSigUrl,
  deputySigUrl,
  coverUrl,
  coverZoom,
  onPatchConfig,
}) => {
  const [pageIdx, setPageIdx] = useState(0);
  const [pageDir, setPageDir] = useState(1);
  const [zoom, setZoom] = useState<StageZoomValue>('fit');
  const viewportRef = useViewportWheelZoom<HTMLDivElement>(zoom, setZoom);
  const prevSelectedClassRef = useRef<string | undefined>(activeClass?.id);

  const template = useMemo(
    () =>
      resolveKutukTemplate(
        albumConfig.kutukTemplateId,
        undefined,
        albumConfig.kutukCols,
        albumConfig.kutukRows,
      ),
    [albumConfig.kutukTemplateId, albumConfig.kutukCols, albumConfig.kutukRows],
  );
  const { palette, activeInk } = useMemo(
    () => resolveTeacherChartConfig(albumConfig, activeClass?.name),
    [albumConfig, activeClass?.name],
  );
  const deputyOptions = useMemo(
    () => extractDeputyPrincipalOptions(scopedClasses, allSchoolStudents),
    [scopedClasses, allSchoolStudents],
  );

  const scopeMode = albumConfig.kutukScopeMode ?? DEFAULT_KUTUK_SCOPE_MODE;
  const effectiveDeputyName = useMemo(() => {
    if (albumConfig.kutukDeputyName && deputyOptions.some((d) => d.deputyName === albumConfig.kutukDeputyName)) {
      return albumConfig.kutukDeputyName;
    }
    return deputyOptions[0]?.deputyName ?? albumConfig.kutukDeputyName ?? '';
  }, [albumConfig.kutukDeputyName, deputyOptions]);

  const pages = useMemo(
    () =>
      buildKutukDossierPages({
        classes: scopedClasses,
        students: allSchoolStudents,
        allStaffAndStudents: allSchoolStudents,
        template,
        scopeMode,
        selectedClassId: activeClass?.id ?? albumConfig.selectedClassId,
        selectedDeputyName: effectiveDeputyName,
        includeCover: Boolean(albumConfig.kutukIncludeCover),
        showStaffPortraits: albumConfig.kutukShowStaffPortraits ?? true,
        allowEmptyClasses: true,
      }),
    [
      scopedClasses,
      allSchoolStudents,
      template,
      scopeMode,
      activeClass?.id,
      albumConfig.selectedClassId,
      effectiveDeputyName,
      albumConfig.kutukIncludeCover,
      albumConfig.kutukShowStaffPortraits,
    ],
  );

  useEffect(() => {
    if (prevSelectedClassRef.current === activeClass?.id) return;
    prevSelectedClassRef.current = activeClass?.id;
    if (!activeClass || scopeMode === 'single-class') {
      setPageIdx(0);
      return;
    }
    const targetIdx = pages.findIndex((p) => p.pageKind === 'class-grid' && p.classId === activeClass.id);
    if (targetIdx >= 0) {
      setPageIdx(targetIdx);
    }
  }, [activeClass, pages, scopeMode]);

  const safePageIdx = Math.min(pageIdx, Math.max(0, pages.length - 1));
  const currentPage = pages[safePageIdx] ?? null;
  const baseWidthPx = (currentPage?.landscape ?? template.landscape) ? 650 : 520;
  const zoomWidthPx = zoom === 'fit' ? undefined : Math.round(baseWidthPx * zoom);

  const jumpTabs = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ keyId: string; label: string; targetIndex: number }> = [];
    pages.forEach((p, idx) => {
      if (p.pageKind === 'cover') {
        list.push({ keyId: '__cover__', label: 'Ön Kapak', targetIndex: idx });
        return;
      }
      if (!seen.has(p.classId)) {
        seen.add(p.classId);
        list.push({ keyId: p.classId, label: p.classFullLabel, targetIndex: idx });
      }
    });
    return list;
  }, [pages]);

  const stepPage = (next: number, dir: number) => {
    setPageDir(dir);
    setPageIdx(next);
  };

  const totalClassCount = currentPage?.totalClassCount ?? 0;
  const totalStudentCount = currentPage?.totalStudentCount ?? 0;
  const paperDimLabel = template.landscape ? 'A4 Yatay (297×210 mm · 300 DPI)' : 'A4 Dikey (210×297 mm · 300 DPI)';

  return (
    <div className="tc-workspace">
      <YearbookKutukInspector
        albumConfig={albumConfig}
        activeTemplate={template}
        activePalette={palette}
        activeInk={activeInk}
        deputyOptions={deputyOptions}
        effectiveDeputyName={effectiveDeputyName}
        classSummaryLabel={currentPage?.coverClassSummary ?? `${totalClassCount} Sınıf`}
        totalStudentCount={totalStudentCount}
        totalPageCount={pages.length}
        onPatchConfig={(patch) => {
          if (
            patch.kutukTemplateId ||
            patch.kutukCols !== undefined ||
            patch.kutukRows !== undefined ||
            patch.kutukScopeMode ||
            patch.kutukDeputyName !== undefined
          ) {
            setPageIdx(0);
          }
          onPatchConfig(patch);
        }}
      />

      <div className="tc-stage-panel">
        <div className="tc-stage-bar">
          <div className="tc-stage-info">
            <strong>
              {template.name}
              {currentPage && currentPage.pageKind === 'class-grid' ? ` · ${currentPage.classFullLabel}` : ''}
            </strong>
            <small>
              {paperDimLabel} · {palette.name} · Yazı: {activeInk.name} ·{' '}
              {template.studentsPerPage > 0
                ? `Sayfa başı ${template.studentsPerPage} portre (${template.cols}×${template.rows})`
                : 'İdareci Dosyası Ön Kapak Kalıbı'}
            </small>
          </div>

          <div className="tc-stage-actions">
            {pages.length > 1 && (
              <div className="tc-stepper" role="group" aria-label="Kütük dosyası sayfaları">
                <button
                  type="button"
                  className="tc-step-btn"
                  disabled={safePageIdx <= 0}
                  aria-label="Önceki sayfa"
                  onClick={() => stepPage(Math.max(0, safePageIdx - 1), -1)}
                >
                  ‹
                </button>
                <span>
                  Sayfa {safePageIdx + 1} / {pages.length}
                </span>
                <button
                  type="button"
                  className="tc-step-btn"
                  disabled={safePageIdx >= pages.length - 1}
                  aria-label="Sonraki sayfa"
                  onClick={() => stepPage(Math.min(pages.length - 1, safePageIdx + 1), 1)}
                >
                  ›
                </button>
              </div>
            )}

            <StageZoomBar zoom={zoom} onChangeZoom={setZoom} />
          </div>
        </div>

        {jumpTabs.length > 1 && (
          <div className="yk-branch-jump-strip" role="navigation" aria-label="Dosyadaki sınıflar ve şubeler">
            {jumpTabs.map((tab) => {
              const isCurrent =
                tab.keyId === '__cover__'
                  ? currentPage?.pageKind === 'cover'
                  : currentPage?.pageKind === 'class-grid' && currentPage.classId === tab.keyId;
              return (
                <button
                  key={`${tab.keyId}-${tab.targetIndex}`}
                  type="button"
                  className={`yk-jump-btn ${isCurrent ? 'is-active' : ''}`.trim()}
                  onClick={() => stepPage(tab.targetIndex, tab.targetIndex >= safePageIdx ? 1 : -1)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div ref={viewportRef} className="tc-paper-viewport">
          {currentPage ? (
            <div className="tc-paper-stage">
              <AppleCrossfadeSlot
                activeKey={`${template.id}::${template.cols}x${template.rows}::${palette.id}::${safePageIdx}::${currentPage.classId}`}
                direction={pageDir}
                variant="card"
              >
                <KutukPaper
                  page={currentPage}
                  palette={palette}
                  schoolName={activeSchoolName}
                  headerTitle={albumConfig.headerTitle}
                  coverTitle={albumConfig.coverTitle}
                  coverSubtitle={albumConfig.coverSubtitle}
                  customCoverDataUrl={albumConfig.customCoverDataUrl}
                  customCoverMode={albumConfig.customCoverMode}
                  nameBoxStyle={albumConfig.kutukNameBoxStyle}
                  photoFrame={albumConfig.kutukPhotoFrame}
                  frameColor={albumConfig.kutukFrameColor}
                  showStudentNumbers={albumConfig.showStudentNumbers}
                  showTeacherBadge={albumConfig.showTeacherBadge}
                  showHeader={albumConfig.kutukShowHeader ?? true}
                  showSubtitle={albumConfig.kutukShowSubtitle ?? true}
                  showStaffPortraits={albumConfig.kutukShowStaffPortraits ?? true}
                  showTeacherSig={albumConfig.kutukShowTeacherSig ?? true}
                  showDeputySig={albumConfig.kutukShowDeputySig ?? true}
                  showPrincipalSig={albumConfig.kutukShowPrincipalSig ?? true}
                  showPageNumber={albumConfig.kutukShowPageNumber ?? true}
                  printFontPt={albumConfig.printFontPt}
                  pageNumber={safePageIdx + 1}
                  totalPages={pages.length}
                  fitMaxWidthPx={baseWidthPx}
                  zoomWidthPx={zoomWidthPx}
                  photoMap={photoMap}
                  logoUrl={logoUrl}
                  watermarkOpacity={watermarkOpacity}
                  principalSigUrl={principalSigUrl}
                  deputySigUrl={deputySigUrl}
                  coverUrl={coverUrl}
                  coverZoom={coverZoom}
                />
              </AppleCrossfadeSlot>
            </div>
          ) : (
            <div className="yk-empty-deputy-box">
              <strong>Seçili Müdür Yardımcısına Bağlı Şube Bulunamadı</strong>
              <small>
                Soldaki denetçiden kapsamı &ldquo;Tüm Okul&rdquo; yapabilir veya Sınıf Listesi penceresinden şubelere
                sorumlu müdür yardımcısı atayabilirsiniz.
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
