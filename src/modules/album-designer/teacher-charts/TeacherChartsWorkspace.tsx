import React, { useMemo, useState } from 'react';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type {
  AlbumTemplateConfig,
  ClassRecord,
  PhotoRecord,
  StudentRecord,
} from '../../../system/sqlite/types';
import {
  buildBookletA4Sheets,
  paginateTabularRoster,
  resolveTeacherChartConfig,
} from '../../../system/storage/teacher-charts/paginationMath';
import { TeacherBookletPaper } from '../../../system/storage/teacher-charts/TeacherBookletPaper';
import { TeacherTabularPaper } from '../../../system/storage/teacher-charts/TeacherTabularPaper';
import {
  StageZoomBar,
  type StageZoomValue,
  useViewportWheelZoom,
} from '../../../window-system/StageZoomBar';
import { TeacherChartInspector } from './TeacherChartInspector';
import './teacher-charts-ui.css';

/**
 * İZOLE MODÜL 03 ÖĞRETMEN ÇİZELGE, CEP DEFTERİ, ŞÖK & CEP ALBÜMÜ ÇALIŞMA MASASI:
 * Sol Apple Pro şablon & özel kapak rayı + Sağ 5x (%500) vektör zumlu canlı A4 kağıt sahnesi.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const TeacherChartsWorkspace: React.FC<{
  albumConfig: AlbumTemplateConfig;
  activeSchoolName: string;
  activeClass: ClassRecord | undefined;
  allSchoolStudents: readonly StudentRecord[];
  classStudents: readonly StudentRecord[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl: string;
  watermarkOpacity: number;
  principalSigUrl: string;
  onPatchConfig: (patch: Partial<AlbumTemplateConfig>) => void;
}> = React.memo(({
  albumConfig,
  activeSchoolName,
  activeClass,
  allSchoolStudents,
  classStudents,
  photoMap,
  logoUrl,
  watermarkOpacity,
  principalSigUrl,
  onPatchConfig,
}) => {
  const [pageIdx, setPageIdx] = useState(0);
  const [pageDir, setPageDir] = useState(1);
  const [zoom, setZoom] = useState<StageZoomValue>('fit');
  const viewportRef = useViewportWheelZoom<HTMLDivElement>(zoom, setZoom);

  const { category, template, palette, activeInk, courseName } = useMemo(
    () => resolveTeacherChartConfig(albumConfig, activeClass?.name),
    [albumConfig, activeClass?.name],
  );

  const isTabular = template.engine === 'tabular-gradebook' || template.engine === 'tabular-sok';
  const effectiveStudents =
    template.id === 'notebook-inner-combined' && allSchoolStudents.length > 0
      ? allSchoolStudents
      : classStudents;

  const tabularPages = useMemo(
    () => (isTabular ? paginateTabularRoster(effectiveStudents, template) : []),
    [isTabular, effectiveStudents, template],
  );

  const bookletSheets = useMemo(() => {
    if (isTabular) return [];
    if (template.engine === 'booklet-gradebook-inner') {
      return buildBookletA4Sheets(effectiveStudents, 5, 3, true);
    }
    if (template.engine === 'booklet-album-inner') {
      return buildBookletA4Sheets(effectiveStudents, 12, 2, false);
    }
    return [{ sheetIndex: 0, totalBookletPages: 0, strips: [] }];
  }, [isTabular, template.engine, effectiveStudents]);

  const totalPages = isTabular ? tabularPages.length : bookletSheets.length;
  const safePageIdx = Math.min(pageIdx, Math.max(0, totalPages - 1));
  const zoomWidthPx = zoom === 'fit' ? undefined : Math.round(520 * zoom);

  const stepPage = (next: number, dir: number) => {
    setPageDir(dir);
    setPageIdx(next);
  };

  return (
    <div className="tc-workspace">
      <TeacherChartInspector
        albumConfig={albumConfig}
        activeClassName={activeClass?.name}
        activeCategory={category.id}
        activeTemplate={template}
        activePalette={palette}
        activeInk={activeInk}
        onPatchConfig={(patch) => {
          if (patch.chartTemplateId) setPageIdx(0);
          onPatchConfig(patch);
        }}
      />

      <div className="tc-stage-panel">
        <div className="tc-stage-bar">
          <div className="tc-stage-info">
            <strong>{template.name}</strong>
            <small>
              A4 Dikey (210×297 mm · 300 DPI) · {palette.name} · Yazı: {activeInk.name} ·{' '}
              {template.studentsPerPage > 0
                ? `Sayfa başı ${template.studentsPerPage} kayıt`
                : 'Kes-Katla Kapak Kalıbı'}
            </small>
          </div>

          <div className="tc-stage-actions">
            {totalPages > 1 && (
              <div className="tc-stepper" role="group" aria-label="Çizelge sayfaları">
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
                  Sayfa {safePageIdx + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="tc-step-btn"
                  disabled={safePageIdx >= totalPages - 1}
                  aria-label="Sonraki sayfa"
                  onClick={() => stepPage(Math.min(totalPages - 1, safePageIdx + 1), 1)}
                >
                  ›
                </button>
              </div>
            )}

            <StageZoomBar zoom={zoom} onChangeZoom={setZoom} />
          </div>
        </div>

        <div ref={viewportRef} className="tc-paper-viewport">
          <div className="tc-paper-stage">
            <AppleCrossfadeSlot
              activeKey={`${template.id}::${palette.id}::${safePageIdx}`}
              direction={pageDir}
              variant="card"
            >
              {isTabular ? (
                <TeacherTabularPaper
                  template={template}
                  palette={palette}
                  schoolName={activeSchoolName}
                  className={activeClass?.name ?? 'ŞUBE'}
                  academicYear={activeClass?.academicYear ?? '2026-2027'}
                  teacherName={activeClass?.teacherName ?? ''}
                  courseName={courseName}
                  showStudentNumbers={albumConfig.showStudentNumbers}
                  showTeacherBadge={albumConfig.showTeacherBadge}
                  printFontPt={albumConfig.printFontPt}
                  pageNumber={safePageIdx + 1}
                  totalPages={totalPages}
                  fitMaxWidthPx={510}
                  zoomWidthPx={zoomWidthPx}
                  leftColumn={tabularPages[safePageIdx]?.leftColumn ?? []}
                  rightColumn={tabularPages[safePageIdx]?.rightColumn ?? []}
                  photoMap={photoMap}
                  logoUrl={logoUrl}
                  watermarkOpacity={watermarkOpacity}
                  principalSigUrl={principalSigUrl}
                />
              ) : (
                <TeacherBookletPaper
                  template={template}
                  palette={palette}
                  schoolName={activeSchoolName}
                  className={activeClass?.name ?? 'ŞUBE'}
                  academicYear={activeClass?.academicYear ?? '2026-2027'}
                  teacherName={activeClass?.teacherName ?? ''}
                  courseName={courseName}
                  coverTitle={albumConfig.coverTitle}
                  coverSubtitle={albumConfig.coverSubtitle}
                  customCoverDataUrl={albumConfig.customCoverDataUrl}
                  customCoverMode={albumConfig.customCoverMode}
                  showStudentNumbers={albumConfig.showStudentNumbers}
                  printFontPt={albumConfig.printFontPt}
                  fitMaxWidthPx={510}
                  zoomWidthPx={zoomWidthPx}
                  strips={bookletSheets[safePageIdx]?.strips ?? []}
                  photoMap={photoMap}
                  logoUrl={logoUrl}
                />
              )}
            </AppleCrossfadeSlot>
          </div>
        </div>
      </div>
    </div>
  );
});
