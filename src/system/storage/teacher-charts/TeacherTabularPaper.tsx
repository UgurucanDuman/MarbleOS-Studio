import React from 'react';
import type { PhotoRecord } from '../../sqlite/types';
import { DEFAULT_PRINT_FONT_PT, printFontCqi, type PrintFontPoint } from '../printTypography';
import { photoAdjustmentStyle, StudioPhotoImage } from '../StudioPhotoImage';
import type { NumberedRosterRow } from './paginationMath';
import { PaperScaleFrame } from './PaperScaleFrame';
import {
  TABLE_SHEET,
  fitHeaderCellPoints,
  getIdentityDimensions,
  identityFontPoints,
  layoutStudentNameLines,
  teacherSheetHead,
} from './tabularPrintLayout';
import type { TeacherChartPalette, TeacherDocTemplateSpec } from './types';
import './teacher-charts-sheet.css';
import './teacher-charts-tabular.css';
import './teacher-tabular-print.css';

/**
 * İZOLE SİSTEM KATMANI · MODÜL 03 & MODÜL 04 ORTAK FOTOKOPİ-GÜVENLİ A4 TABLO ÇİZELGE & ŞÖK KAĞIDI:
 * Başlık ve gövde sütunlarını tek CSS Grid şablonuna kilitleyerek 0.00px çizgi kayması sağlar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export interface PaperStudentItem {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  matchedPhotoId?: string | null;
}

export const TeacherTabularPaper: React.FC<{
  template: TeacherDocTemplateSpec;
  palette: TeacherChartPalette;
  schoolName: string;
  className: string;
  academicYear: string;
  teacherName: string;
  courseName: string;
  showStudentNumbers: boolean;
  showTeacherBadge: boolean;
  printFontPt?: PrintFontPoint;
  pageNumber: number;
  totalPages: number;
  fitMaxWidthPx?: number;
  zoomWidthPx?: number;
  leftColumn: readonly NumberedRosterRow<PaperStudentItem>[];
  rightColumn: readonly NumberedRosterRow<PaperStudentItem>[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl?: string;
  watermarkOpacity?: number;
  principalSigUrl?: string;
}> = React.memo(({
  template, palette, schoolName, className, academicYear, teacherName, courseName,
  showStudentNumbers, showTeacherBadge, printFontPt = DEFAULT_PRINT_FONT_PT,
  pageNumber, totalPages, fitMaxWidthPx = 510, zoomWidthPx,
  leftColumn, rightColumn, photoMap, logoUrl = '', watermarkOpacity = 0.08, principalSigUrl = '',
}) => {
  const isSok = template.engine === 'tabular-sok';
  const head = teacherSheetHead(schoolName, academicYear, courseName, isSok);
  const dimensions = getIdentityDimensions(template);
  const availableMm = TABLE_SHEET.widthMm - 2 * TABLE_SHEET.marginMm;
  const rowMm = (297 - TABLE_SHEET.topMm - TABLE_SHEET.footerMm - TABLE_SHEET.headerMm) / template.rowsPerCol;
  const isStacked = template.identityMode === 'stacked-horizontal';
  const isZoneEndIdentity = template.subRowScheme === 'single-open';
  const cleanTeacher = teacherName.trim();
  const panels = template.panelCols === 2 ? [leftColumn, rightColumn] : [leftColumn];

  const flatCols = template.columnGroups.flatMap((grp, gIdx) => {
    const tintBg = grp.tintKind === 'final' ? palette.finalTint : grp.tintKind === 'summary' ? palette.summaryTint : undefined;
    const isLastGroup = gIdx === template.columnGroups.length - 1;
    return grp.subHeaders.map((sub, sIdx) => ({
      sub,
      weight: grp.widthWeight ?? 1,
      tintBg,
      isGroupEnd: !isLastGroup && sIdx === grp.subHeaders.length - 1,
    }));
  });

  const gridColsCss = flatCols.map((c) => `minmax(0, ${c.weight}fr)`).join(' ');
  const totalWeight = Math.max(1, flatCols.reduce((acc, c) => acc + c.weight, 0));
  const panelMm = template.panelCols === 2 ? (availableMm - TABLE_SHEET.panelGapMm) / 2 : availableMm;
  const gridMm = Math.max(20, panelMm - dimensions.sequenceMm - dimensions.identityMm - dimensions.periodMm);
  const subRowCount = template.subRowScheme === 'quad-numbered' ? 4 : template.subRowScheme === 'two-terms' ? 2 : 1;

  const paperVars = {
    '--tc-ink': palette.inkPrimary,
    '--tc-ink-sub': palette.inkSecondary,
    '--tc-heading-ink': palette.headingInk,
    '--tc-accent': palette.accent,
    '--tc-head-tint': palette.headerTint,
    '--tc-summary-tint': palette.summaryTint,
    '--tc-border': palette.gridBorder,
    '--tc-hairline': palette.gridHairline,
    '--tc-margin-mm': TABLE_SHEET.marginMm,
    '--tc-table-top-mm': TABLE_SHEET.topMm,
    '--tc-footer-mm': TABLE_SHEET.footerMm,
    '--tc-panel-gap-mm': TABLE_SHEET.panelGapMm,
    '--tc-header-mm': TABLE_SHEET.headerMm,
    '--tc-sequence-mm': dimensions.sequenceMm,
    '--tc-identity-mm': dimensions.identityMm,
    '--tc-name-mm': dimensions.nameMm,
    '--tc-period-mm': dimensions.periodMm,
    '--tc-row-mm': rowMm,
  } as React.CSSProperties;

  return (
    <PaperScaleFrame fitMaxWidthPx={fitMaxWidthPx} zoomWidthPx={zoomWidthPx} paperVars={paperVars} paperClassName="tc-tabular-paper">
      {logoUrl && <img src={logoUrl} alt="" className="tc-watermark" style={{ opacity: watermarkOpacity * 0.22 }} />}

      <div className="tc-tabular-head">
        <div className="tc-inst-rule" aria-hidden="true" />
        <header className="tc-doc-head">
          <div>{logoUrl && <img src={logoUrl} alt="Okul logosu" className="tc-head-logo" />}</div>
          <div className="tc-head-center">
            <div
              className="tc-head-school"
              style={{ fontSize: printFontCqi(identityFontPoints(head.school.length, 12.6, availableMm - 28), availableMm) }}
            >
              {head.school}
            </div>
            <div className="tc-head-course">{head.context}</div>
            <div className="tc-head-title">{template.officialDocTitle}</div>
          </div>
          <div />
        </header>

        <div className="tc-meta-strip">
          <span>
            <span className="tc-meta-branch">{className || 'ŞUBE'}</span>
            {showTeacherBadge && cleanTeacher && <span className="tc-meta-teacher">· {cleanTeacher}</span>}
          </span>
          <span>Sayfa No: {pageNumber} / {totalPages}</span>
        </div>
      </div>

      <div className={`tc-panels-grid cols-${template.panelCols}`}>
        {panels.map((rows, pIdx) => (
          <div key={pIdx} className="tc-table-panel">
            <div className="tc-thead">
              {template.showRowSequenceNumber && <div className="tc-seq-cell is-head">Sıra</div>}
              <div className="tc-th-id">
                <span>{showStudentNumbers ? 'Okul No · Adı Soyadı' : 'Adı Soyadı'}</span>
                <span className="tc-th-id-sub">Fotoğraf</span>
              </div>
              <div className={`tc-th-groups ${isSok ? 'is-sok' : ''}`.trim()} style={{ gridTemplateColumns: gridColsCss }}>
                {template.columnGroups.map((grp, gIdx) => {
                  const isLastGrp = gIdx === template.columnGroups.length - 1;
                  const grpBg = grp.tintKind === 'final' ? palette.finalTint : grp.tintKind === 'summary' ? palette.summaryTint : undefined;
                  const grpSpanMm = ((grp.subHeaders.length * (grp.widthWeight ?? 1)) / totalWeight) * gridMm;
                  const grpPt = fitHeaderCellPoints(grp.title, isSok ? 9.2 : 7.0, grpSpanMm, true);
                  return (
                    <div
                      key={`${grp.title}-${gIdx}`}
                      className={`tc-th-group-title ${isLastGrp ? 'is-last-group' : ''}`.trim()}
                      style={{
                        gridColumn: `span ${grp.subHeaders.length}`,
                        background: grpBg,
                        fontSize: printFontCqi(grpPt, availableMm),
                      }}
                    >
                      {grp.title}
                    </div>
                  );
                })}
                {!isSok &&
                  flatCols.map((col, cIdx) => {
                    const colMm = (col.weight / totalWeight) * gridMm;
                    const subPt = fitHeaderCellPoints(col.sub, 6.4, colMm, false);
                    return (
                      <span
                        key={`${col.sub}-${cIdx}`}
                        className={`tc-th-sub-cell ${col.isGroupEnd ? 'is-group-end' : ''} ${cIdx === flatCols.length - 1 ? 'is-last-col' : ''}`.trim()}
                        style={{
                          ...(col.tintBg ? { background: col.tintBg } : undefined),
                          fontSize: printFontCqi(subPt, availableMm),
                        }}
                      >
                        {col.sub}
                      </span>
                    );
                  })}
              </div>
            </div>

            <div className="tc-tbody" style={{ gridTemplateRows: `repeat(${template.rowsPerCol}, minmax(0, 1fr))` }}>
              {rows.map((row) => {
                const stu = row.student;
                const photo = stu?.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) : undefined;
                const labelLengthMm = isStacked ? dimensions.identityMm - 1.1 : rowMm - 0.85;
                const labelThickMm = isStacked
                  ? Math.min(9, rowMm * 0.32) - 0.55
                  : dimensions.nameMm - 0.5;
                const nameLayout = stu
                  ? layoutStudentNameLines({
                      studentNumber: stu.studentNumber,
                      firstName: stu.firstName,
                      lastName: stu.lastName,
                      showStudentNumbers,
                      targetPoints: printFontPt,
                      availableLengthMm: labelLengthMm,
                      availableThicknessMm: labelThickMm,
                      maxLines: isStacked ? 3 : 4,
                    })
                  : { lines: [], fontPt: printFontPt };
                const fontSize = printFontCqi(nameLayout.fontPt, availableMm);
                const letterSpacing = nameLayout.lines.length >= 3 ? '-0.02em' : undefined;

                return (
                  <div key={row.sequenceNumber} className="tc-trow">
                    {template.showRowSequenceNumber && <div className="tc-seq-cell">{stu && row.sequenceNumber}</div>}

                    {isStacked ? (
                      <div className={`tc-id-stacked ${isZoneEndIdentity ? 'is-zone-end' : ''}`.trim()}>
                        <div className="tc-photo-stack-wrap">
                          {stu && (
                            <div className="tc-photo-3x4">
                              {photo && (
                                <StudioPhotoImage
                                  photo={photo}
                                  loading="lazy"
                                  decoding="async"
                                  alt={stu.firstName}
                                  style={photoAdjustmentStyle(photo.adjustments)}
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="tc-horiz-name" style={{ fontSize, letterSpacing }}>
                          {nameLayout.lines.map((line, i) => (
                            <span key={i} className="tc-vert-line">{line}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={`tc-id-side ${isSok ? 'is-sok' : ''} ${isZoneEndIdentity ? 'is-zone-end' : ''}`.trim()}>
                        <div className="tc-photo-side-wrap">
                          {stu && (
                            <div className="tc-photo-3x4">
                              {photo && (
                                <StudioPhotoImage
                                  photo={photo}
                                  loading="lazy"
                                  decoding="async"
                                  alt={stu.firstName}
                                  style={photoAdjustmentStyle(photo.adjustments)}
                                />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="tc-vert-name">
                          <div className="tc-vert-rotator" style={{ fontSize, letterSpacing }}>
                            {nameLayout.lines.map((line, i) => (
                              <span key={i} className="tc-vert-line">{line}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {template.subRowScheme === 'two-terms' && (
                      <div className="tc-subtag-col is-terms" aria-hidden="true">
                        <div className="tc-subtag-cell is-term1"><em className="tc-subtag-rot">1.D</em></div>
                        <div className="tc-subtag-cell is-term2"><em className="tc-subtag-rot">2.D</em></div>
                      </div>
                    )}
                    {template.subRowScheme === 'quad-numbered' && (
                      <div className="tc-subtag-col is-quad" aria-hidden="true">
                        <div className="tc-subtag-cell">1</div>
                        <div className="tc-subtag-cell">2</div>
                        <div className="tc-subtag-cell">3</div>
                        <div className="tc-subtag-cell">4</div>
                      </div>
                    )}

                    <div className="tc-cells-area" style={{ gridTemplateColumns: gridColsCss }} aria-hidden="true">
                      {flatCols.map((col, cIdx) => (
                        <div
                          key={cIdx}
                          className={`tc-cell-col rows-${subRowCount} ${col.isGroupEnd ? 'is-group-end' : ''}`.trim()}
                          style={col.tintBg ? { background: col.tintBg } : undefined}
                        >
                          {Array.from({ length: subRowCount }, (_, sr) => (
                            <div
                              key={sr}
                              className={`tc-cell-box ${template.subRowScheme === 'two-terms' && sr === 0 && !col.tintBg ? 'tint-term1' : ''}`.trim()}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <footer className="tc-doc-foot">
        {!isSok ? (
          <div className="tc-sig-block">
            <strong>{showTeacherBadge && cleanTeacher ? `Rehber Öğrt.: ${cleanTeacher}` : 'Öğretmenin Adı Soyadı'}</strong>
            <span>Ders / Sınıf Öğretmeni · İmza</span>
          </div>
        ) : (
          <span />
        )}
        <div className="tc-sig-block">
          <span>....../....../20....</span>
          {principalSigUrl && <img src={principalSigUrl} alt="Müdür imzası" className="tc-sig-img" />}
          <strong>Okul Müdürü</strong>
        </div>
      </footer>
    </PaperScaleFrame>
  );
});
