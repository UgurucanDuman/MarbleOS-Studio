import React from 'react';
import type { AlbumTemplateConfig, PhotoRecord } from '../../system/sqlite/types';
import {
  buildBookletA4Sheets,
  paginateTabularRoster,
  resolveTeacherChartConfig,
} from '../../system/storage/teacher-charts/paginationMath';
import { TeacherBookletPaper } from '../../system/storage/teacher-charts/TeacherBookletPaper';
import {
  type PaperStudentItem,
  TeacherTabularPaper,
} from '../../system/storage/teacher-charts/TeacherTabularPaper';
import { KutukPaper } from '../../system/storage/yearbook-kutuk/KutukPaper';
import type { ImpositionPage } from './printSpecs';

/**
 * İZOLE MODÜL 04 ALT BİLEŞENİ: Öğretmen Çizelgesi, Cep Defteri ve İdareci Kütük Dosyası Vektör Kağıt Sahnesi
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PrintTeacherAndKutukCanvas: React.FC<{
  page: ImpositionPage;
  pageNumber: number;
  totalPages: number;
  schoolName: string;
  scopeLabel: string;
  albumConfig: AlbumTemplateConfig;
  showCropMarks: boolean;
  zoomWidthPx?: number;
  paperStudents: readonly PaperStudentItem[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl?: string;
  watermarkOpacity?: number;
  principalSigUrl?: string;
  deputySigUrl?: string;
  coverUrl?: string;
  coverZoom?: number;
}> = React.memo(({
  page,
  pageNumber,
  totalPages,
  schoolName,
  scopeLabel,
  albumConfig,
  showCropMarks,
  zoomWidthPx,
  paperStudents,
  photoMap,
  logoUrl = '',
  watermarkOpacity = 0.08,
  principalSigUrl = '',
  deputySigUrl = '',
  coverUrl = '',
  coverZoom = 1,
}) => {
  const rulerOverlay =
    showCropMarks && page.rulerLengthMm > 0 ? (
      <div
        className="pc-paper-ruler"
        style={{ width: `${(page.rulerLengthMm / page.widthMm) * 100}%` }}
        title="Baskıda %100 Gerçek Ölçek kontrol cetveli"
      >
        <div className="pc-paper-ruler-line" />
        <span>%100 ÖLÇEK · {page.rulerLengthMm} mm</span>
      </div>
    ) : null;

  if (page.kind === 'kutuk-sheet' && page.kutukPage) {
    const { palette } = resolveTeacherChartConfig(albumConfig, page.kutukPage.className);
    return (
      <div style={{ position: 'relative', margin: '0 auto', width: 'fit-content' }}>
        <KutukPaper
          page={page.kutukPage}
          palette={palette}
          schoolName={schoolName}
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
          pageNumber={pageNumber}
          totalPages={totalPages}
          fitMaxWidthPx={page.kutukPage.landscape ? 650 : 480}
          zoomWidthPx={zoomWidthPx}
          photoMap={photoMap}
          logoUrl={logoUrl}
          watermarkOpacity={watermarkOpacity}
          principalSigUrl={principalSigUrl}
          deputySigUrl={deputySigUrl}
          coverUrl={coverUrl}
          coverZoom={coverZoom}
        />
        {rulerOverlay}
      </div>
    );
  }

  const { template, palette, courseName } = resolveTeacherChartConfig(albumConfig, page.titleLabel);
  const isTabular = template.engine === 'tabular-gradebook' || template.engine === 'tabular-sok';
  const subIdx = page.subPageIndex ?? 0;
  const subTotal = page.subTotalPages ?? totalPages;

  if (isTabular) {
    const paginated = paginateTabularRoster(paperStudents, template);
    const target = paginated[subIdx] ?? paginated[0];
    return (
      <div style={{ position: 'relative', margin: '0 auto', width: 'fit-content' }}>
        <TeacherTabularPaper
          template={template}
          palette={palette}
          schoolName={schoolName}
          className={page.titleLabel || scopeLabel}
          academicYear={page.academicYear || '2026-2027'}
          teacherName={page.teacherLabel || ''}
          courseName={courseName}
          showStudentNumbers={albumConfig.showStudentNumbers}
          showTeacherBadge={albumConfig.showTeacherBadge}
          printFontPt={albumConfig.printFontPt}
          pageNumber={subIdx + 1}
          totalPages={subTotal}
          fitMaxWidthPx={480}
          zoomWidthPx={zoomWidthPx}
          leftColumn={target?.leftColumn ?? []}
          rightColumn={target?.rightColumn ?? []}
          photoMap={photoMap}
          logoUrl={logoUrl}
          watermarkOpacity={watermarkOpacity}
          principalSigUrl={principalSigUrl}
        />
        {rulerOverlay}
      </div>
    );
  }

  const isAlbum = template.engine === 'booklet-album-inner' || template.engine === 'booklet-album-cover';
  const bookletSheets =
    template.studentsPerPage > 0
      ? buildBookletA4Sheets(paperStudents, isAlbum ? 12 : 5, isAlbum ? 2 : 3, !isAlbum)
      : [{ sheetIndex: 0, totalBookletPages: 0, strips: [] }];

  return (
    <div style={{ position: 'relative', margin: '0 auto', width: 'fit-content' }}>
      <TeacherBookletPaper
        template={template}
        palette={palette}
        schoolName={schoolName}
        className={page.titleLabel || scopeLabel}
        academicYear={page.academicYear || '2026-2027'}
        teacherName={page.teacherLabel || ''}
        courseName={courseName}
        coverTitle={albumConfig.coverTitle}
        coverSubtitle={albumConfig.coverSubtitle}
        customCoverDataUrl={albumConfig.customCoverDataUrl}
        customCoverMode={albumConfig.customCoverMode}
        showStudentNumbers={albumConfig.showStudentNumbers}
        printFontPt={albumConfig.printFontPt}
        fitMaxWidthPx={480}
        zoomWidthPx={zoomWidthPx}
        strips={bookletSheets[subIdx]?.strips ?? []}
        photoMap={photoMap}
        logoUrl={logoUrl}
      />
      {rulerOverlay}
    </div>
  );
});
