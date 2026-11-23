import React from 'react';
import type { PhotoRecord } from '../../sqlite/types';
import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';
import { photoAdjustmentStyle, StudioPhotoImage } from '../StudioPhotoImage';
import { PaperScaleFrame } from '../teacher-charts/PaperScaleFrame';
import '../teacher-charts/teacher-charts-sheet.css';
import type { TeacherChartPalette } from '../teacher-charts/types';
import {
  DEFAULT_KUTUK_NAME_BOX_STYLE,
  DEFAULT_KUTUK_PHOTO_FRAME,
  hexToRgba,
} from './catalog';
import { kutukCardNameScale, kutukMinimalNameScale } from './drawKutukPrimitives';
import { KutukCoverView } from './KutukCoverView';
import { computeKutukGridMetrics } from './kutukGridMetrics';
import { KutukSheetFooter, KutukSheetHeader } from './KutukSheetChrome';
import { isKutukStaffBranchName, type KutukStudentLike } from './staffDirectory';
import type {
  KutukNameBoxStyle,
  KutukPhotoFrame,
  KutukResolvedPage,
} from './types';
import './kutuk-paper.css';
import './kutuk-cover.css';
import './kutuk-card-styles.css';

/**
 * İZOLE SİSTEM KATMANI · MODÜL 03 & MODÜL 04 ORTAK İDARECİ KÜTÜK & SINIF ALBÜMÜ KAĞIDI:
 * Tek çerçeveli Apple Pro kartlar, eşit kilitli isim kutusu yüksekliği, 40–50 portreli yatay A4 desteği.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

function isStaffNumber(studentNumber: string): boolean {
  const clean = studentNumber.trim();
  return clean === '0' || clean.startsWith('0-');
}

export const KutukPaper: React.FC<{
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  palette: TeacherChartPalette;
  schoolName: string;
  headerTitle?: string;
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverDataUrl?: string;
  customCoverMode?: 'full-bleed' | 'emblem';
  nameBoxStyle?: KutukNameBoxStyle;
  photoFrame?: KutukPhotoFrame;
  frameColor?: string;
  showStudentNumbers: boolean;
  showTeacherBadge: boolean;
  showHeader?: boolean;
  showSubtitle?: boolean;
  showStaffPortraits: boolean;
  showTeacherSig?: boolean;
  showDeputySig?: boolean;
  showPrincipalSig?: boolean;
  showPageNumber?: boolean;
  printFontPt?: PrintFontPoint;
  pageNumber: number;
  totalPages: number;
  fitMaxWidthPx?: number;
  zoomWidthPx?: number;
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl?: string;
  watermarkOpacity?: number;
  principalSigUrl?: string;
  deputySigUrl?: string;
  coverUrl?: string;
  coverZoom?: number;
}> = React.memo(({
  page,
  palette,
  schoolName,
  headerTitle = '',
  coverTitle = '',
  coverSubtitle = '',
  customCoverDataUrl = '',
  customCoverMode = 'emblem',
  nameBoxStyle = DEFAULT_KUTUK_NAME_BOX_STYLE,
  photoFrame = DEFAULT_KUTUK_PHOTO_FRAME,
  frameColor = '',
  showStudentNumbers,
  showTeacherBadge,
  showHeader = true,
  showSubtitle = true,
  showStaffPortraits,
  showTeacherSig = true,
  showDeputySig = true,
  showPrincipalSig = true,
  showPageNumber = true,
  printFontPt = DEFAULT_PRINT_FONT_PT,
  pageNumber,
  totalPages,
  fitMaxWidthPx,
  zoomWidthPx,
  photoMap,
  logoUrl = '',
  watermarkOpacity = 0.25,
  principalSigUrl = '',
  deputySigUrl = '',
  coverUrl = '',
  coverZoom = 1,
}) => {
  const isLandscape = page.landscape;
  const resolvedFitW = fitMaxWidthPx ?? (isLandscape ? 650 : 510);
  const activeFrameHex =
    frameColor && /^#[0-9a-fA-F]{6}$/.test(frameColor) ? frameColor : palette.accent;
  const hasFooter = showTeacherSig || showDeputySig || showPrincipalSig || showPageNumber;
  const metrics = computeKutukGridMetrics({
    landscape: isLandscape,
    cols: page.template.cols,
    rows: page.template.rows,
    hasHeader: showHeader,
    hasSubtitle: showSubtitle,
    hasFooter,
    printFontPt,
  });

  const paperVars = {
    '--tc-ink': palette.inkPrimary,
    '--tc-ink-sub': palette.inkSecondary,
    '--tc-heading-ink': palette.headingInk,
    '--tc-accent': palette.accent,
    '--tc-head-tint': palette.headerTint,
    '--tc-summary-tint': palette.summaryTint,
    '--tc-border': palette.gridBorder,
    '--tc-hairline': palette.gridHairline,
    '--kt-frame-color': activeFrameHex,
    '--kt-frame-soft': hexToRgba(activeFrameHex, 0.09),
    '--kt-frame-border': hexToRgba(activeFrameHex, 0.34),
    '--kt-cols': page.template.cols,
    '--kt-rows': page.template.rows,
    '--kt-pad-top': metrics.topMm,
    '--kt-pad-right': metrics.rightMm,
    '--kt-pad-bottom': metrics.bottomMm,
    '--kt-pad-left': metrics.leftMm,
    '--kt-head-gap': metrics.gridTopGapMm,
    '--kt-gap-x': metrics.gapXMm,
    '--kt-gap-y': metrics.gapYMm,
    '--kt-card-w': metrics.cardWMm,
    '--kt-card-h': metrics.cardHMm,
    '--kt-cap-mm': metrics.captionMm,
    '--kt-name-mm': metrics.nameFontMm,
    '--kt-num-mm': metrics.numFontMm,
    '--kt-radius-mm': metrics.cardRadiusMm,
  } as React.CSSProperties;

  if (page.pageKind === 'cover') {
    return (
      <KutukCoverView
        page={page}
        palette={palette}
        paperVars={paperVars}
        schoolName={schoolName}
        coverTitle={coverTitle}
        coverSubtitle={coverSubtitle}
        customCoverDataUrl={customCoverDataUrl}
        customCoverMode={customCoverMode}
        resolvedFitW={resolvedFitW}
        zoomWidthPx={zoomWidthPx}
        logoUrl={logoUrl}
        watermarkOpacity={watermarkOpacity}
        principalSigUrl={principalSigUrl}
        deputySigUrl={deputySigUrl}
        coverUrl={coverUrl}
        coverZoom={coverZoom}
      />
    );
  }

  const principalBadge = page.staffBadges.find((b) => b.roleLabel === 'Okul Müdürü');
  const portraitBadges = showStaffPortraits
    ? page.staffBadges.filter((b) => Boolean(b.photoRef && photoMap.has(b.photoRef)))
    : [];
  const isStaffClass = isKutukStaffBranchName(page.className);
  const docHeading = headerTitle.trim() || page.template.officialTitle;

  return (
    <PaperScaleFrame
      fitMaxWidthPx={resolvedFitW}
      zoomWidthPx={zoomWidthPx}
      landscape={isLandscape}
      paperVars={paperVars}
      paperClassName="kt-paper"
    >
      {!isLandscape && <div className="kt-binder-guide" aria-hidden="true" />}
      {logoUrl && (
        <img src={logoUrl} alt="" className="tc-watermark" style={{ opacity: watermarkOpacity * 0.2 }} />
      )}

      {showHeader && (
        <KutukSheetHeader
          page={page}
          schoolName={schoolName}
          docHeading={docHeading}
          showSubtitle={showSubtitle}
          showTeacherBadge={showTeacherBadge}
          logoUrl={logoUrl}
          portraitBadges={portraitBadges}
          photoMap={photoMap}
        />
      )}

      <div className="kt-grid" role="list" aria-label={`${page.className} öğrenci kütük ızgarası`}>
        {page.items.map(({ sequenceNumber, student }) => {
          const photo = student.matchedPhotoId ? photoMap.get(student.matchedPhotoId) : undefined;
          const staffEntry = isStaffClass || isStaffNumber(student.studentNumber);
          const numberLine = staffEntry
            ? (student.isPrincipal ? 'Okul Müdürü' : (student.role || 'Öğretmen'))
            : showStudentNumbers
              ? student.studentNumber
              : '';
          const fullName = `${student.firstName} ${student.lastName}`.trim();
          const minimalText = `${numberLine ? `${numberLine} ` : ''}${fullName}`.toLocaleUpperCase('tr-TR');
          const minimalFontMm = Number(
            (metrics.nameFontMm * kutukMinimalNameScale(minimalText, page.template.cols)).toFixed(3),
          );
          const cardNameFontMm = Number(
            (
              metrics.nameFontMm *
              kutukCardNameScale(fullName.toLocaleUpperCase('tr-TR'), metrics.cardWMm, metrics.nameFontMm)
            ).toFixed(3),
          );

          return (
            <div
              key={student.id || sequenceNumber}
              className={`kt-card is-box-${nameBoxStyle} is-frame-${photoFrame}`.trim()}
              role="listitem"
            >
              <div className="kt-photo-wrap">
                <div className={`kt-photo-box is-frame-${photoFrame}`.trim()}>
                  {photo ? (
                    <StudioPhotoImage
                      photo={photo}
                      alt={fullName}
                      loading="lazy"
                      decoding="async"
                      style={photoAdjustmentStyle(photo.adjustments)}
                    />
                  ) : (
                    <span className="kt-photo-missing">Fotoğraf Yok</span>
                  )}
                </div>
              </div>
              <div className="kt-caption">
                {nameBoxStyle === 'minimal-clean' ? (
                  <strong
                    className="kt-stu-name"
                    style={{ fontSize: `calc(${minimalFontMm} * var(--tc-mm))` }}
                  >
                    {minimalText}
                  </strong>
                ) : (
                  <>
                    {numberLine && <span className="kt-stu-num">{numberLine}</span>}
                    <strong
                      className="kt-stu-name"
                      style={{ fontSize: `calc(${cardNameFontMm} * var(--tc-mm))` }}
                    >
                      {fullName}
                    </strong>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasFooter && (
        <KutukSheetFooter
          showTeacherSig={showTeacherSig}
          showDeputySig={showDeputySig}
          showPrincipalSig={showPrincipalSig}
          showPageNumber={showPageNumber}
          showTeacherBadge={showTeacherBadge}
          cleanTeacher={page.teacherName.trim()}
          cleanDeputy={page.deputyPrincipalName.trim()}
          principalName={principalBadge?.fullName ?? ''}
          deputySigUrl={deputySigUrl}
          principalSigUrl={principalSigUrl}
          pageNumber={pageNumber}
          totalPages={totalPages}
        />
      )}
    </PaperScaleFrame>
  );
});
