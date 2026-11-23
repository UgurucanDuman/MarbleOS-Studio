import React from 'react';
import type { PhotoRecord } from '../../sqlite/types';
import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';
import { photoAdjustmentStyle, StudioPhotoImage } from '../StudioPhotoImage';
import { BookletFrontCoverStrip, BookletScheduleBackStrip } from './BookletCoverAndScheduleStrips';
import { splitBalancedStudentLines } from './canvasPrimitives';
import { PaperScaleFrame } from './PaperScaleFrame';
import type { PaperStudentItem } from './TeacherTabularPaper';
import type { BookletMiniPage, BookletSpreadStrip, TeacherChartPalette, TeacherDocTemplateSpec } from './types';
import './teacher-charts-sheet.css';
import './teacher-charts-tabular.css';
import './teacher-charts-booklet.css';

/**
 * İZOLE SİSTEM KATMANI · MODÜL 03 & MODÜL 04 ORTAK KES-KATLA CEP DEFTERİ & CEP ALBÜMÜ KAĞIDI:
 * Kanonik 1040px süper-örnekleme ile Sığdır'dan 5x (%500) zuma kadar net mizanpaj sağlar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const MiniGradebookHalf: React.FC<{
  miniPage: BookletMiniPage<PaperStudentItem | null>;
  isLeft: boolean;
  template: TeacherDocTemplateSpec;
  palette: TeacherChartPalette;
  schoolName: string;
  academicYear: string;
  className: string;
  showStudentNumbers: boolean;
  fontScale: number;
  photoMap: ReadonlyMap<string, PhotoRecord>;
}> = ({ miniPage, isLeft, template, palette, schoolName, academicYear, className, showStudentNumbers, fontScale, photoMap }) => {
  const flatCols = template.columnGroups.flatMap((g, gIdx) => {
    const isLastGroup = gIdx === template.columnGroups.length - 1;
    return g.subHeaders.map((sub, sIdx) => ({
      sub,
      bg: g.tintKind === 'final' ? palette.finalTint : sub === 'Ort' ? palette.summaryTint : undefined,
      isGroupEnd: !isLastGroup && sIdx === g.subHeaders.length - 1,
    }));
  });
  const gridColsCss = flatCols.map(() => 'minmax(0, 1fr)').join(' ');

  return (
    <div className="tc-mini-page">
      <div className="tc-table-panel" style={{ flex: 1 }}>
        <div className="tc-thead">
          <div className="tc-th-id" style={{ width: '10.7cqi' }}>{className}</div>
          <div className="tc-th-groups" style={{ gridTemplateColumns: gridColsCss }}>
            {template.columnGroups.map((grp, gi) => (
              <div
                key={gi}
                className={`tc-th-group-title ${gi === template.columnGroups.length - 1 ? 'is-last-group' : ''}`.trim()}
                style={{ gridColumn: `span ${grp.subHeaders.length}`, background: grp.tintKind === 'final' ? palette.finalTint : undefined }}
              >
                {grp.title}
              </div>
            ))}
            {flatCols.map((c, ci) => (
              <span
                key={ci}
                className={`tc-th-sub-cell ${c.isGroupEnd ? 'is-group-end' : ''} ${ci === flatCols.length - 1 ? 'is-last-col' : ''}`.trim()}
                style={c.bg ? { background: c.bg } : undefined}
              >
                {c.sub}
              </span>
            ))}
          </div>
        </div>
        <div className="tc-tbody" style={{ gridTemplateRows: 'repeat(5, minmax(0, 1fr))' }}>
          {Array.from({ length: 5 }, (_, idx) => {
            const stu = miniPage.slots[idx] ?? null;
            const photo = stu?.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) : undefined;
            const [line1, line2] = stu
              ? splitBalancedStudentLines(stu.studentNumber, stu.firstName, stu.lastName, showStudentNumbers)
              : ['', ''];
            return (
              <div key={idx} className="tc-trow">
                <div className="tc-id-side is-mini">
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
                    <div className="tc-vert-rotator" style={{ fontSize: `${(0.72 * fontScale).toFixed(3)}cqi` }}>
                      {line1 && <span className={`tc-vert-line ${line1.length >= 13 ? 'is-long' : ''}`.trim()}>{line1}</span>}
                      {line2 && <span className={`tc-vert-line ${line2.length >= 13 ? 'is-long' : ''}`.trim()}>{line2}</span>}
                    </div>
                  </div>
                </div>
                <div className="tc-subtag-col is-quad" aria-hidden="true">
                  <div className="tc-subtag-cell">1</div>
                  <div className="tc-subtag-cell">2</div>
                  <div className="tc-subtag-cell">3</div>
                  <div className="tc-subtag-cell">4</div>
                </div>
                <div className="tc-cells-area" style={{ gridTemplateColumns: gridColsCss }} aria-hidden="true">
                  {flatCols.map((c, ci) => (
                    <div
                      key={ci}
                      className={`tc-cell-col rows-4 ${c.isGroupEnd ? 'is-group-end' : ''}`.trim()}
                      style={c.bg ? { background: c.bg } : undefined}
                    >
                      <div className="tc-cell-box" /><div className="tc-cell-box" />
                      <div className="tc-cell-box" /><div className="tc-cell-box" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="tc-mini-foot">
        <strong>{isLeft ? miniPage.pageNumber : ''}</strong>
        <span>{schoolName || 'Okul'} ({academicYear})</span>
        <strong>{!isLeft ? miniPage.pageNumber : ''}</strong>
      </div>
    </div>
  );
};

export const TeacherBookletPaper: React.FC<{
  template: TeacherDocTemplateSpec;
  palette: TeacherChartPalette;
  schoolName: string;
  className: string;
  academicYear: string;
  teacherName: string;
  courseName: string;
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverDataUrl?: string;
  customCoverMode?: 'full-bleed' | 'emblem';
  showStudentNumbers: boolean;
  printFontPt?: PrintFontPoint;
  fitMaxWidthPx?: number;
  zoomWidthPx?: number;
  strips: readonly BookletSpreadStrip<PaperStudentItem | null>[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  logoUrl?: string;
}> = React.memo(({
  template, palette, schoolName, className, academicYear, teacherName, courseName,
  coverTitle, coverSubtitle, customCoverDataUrl, customCoverMode = 'full-bleed',
  showStudentNumbers, printFontPt = DEFAULT_PRINT_FONT_PT,
  fitMaxWidthPx = 510, zoomWidthPx, strips, photoMap, logoUrl = '',
}) => {
  const fontScale = printFontPt / DEFAULT_PRINT_FONT_PT;
  const isTwoStrip = template.engine === 'booklet-album-inner' || template.engine === 'booklet-album-cover';
  const stripCount = isTwoStrip ? 2 : 3;
  const yearLabel = academicYear || '2026-2027';
  const branchLabel = className || 'ŞUBE';
  const cleanTeacher = teacherName.trim();

  const paperVars = {
    '--tc-ink': palette.inkPrimary,
    '--tc-ink-sub': palette.inkSecondary,
    '--tc-heading-ink': palette.headingInk,
    '--tc-accent': palette.accent,
    '--tc-head-tint': palette.headerTint,
    '--tc-summary-tint': palette.summaryTint,
    '--tc-border': palette.gridBorder,
    '--tc-hairline': palette.gridHairline,
  } as React.CSSProperties;

  return (
    <PaperScaleFrame fitMaxWidthPx={fitMaxWidthPx} zoomWidthPx={zoomWidthPx} paperVars={paperVars}>
      <div className={`tc-booklet-stack strips-${stripCount}`}>
        {Array.from({ length: stripCount }, (_, sIdx) => {
          const spread = strips[sIdx];

          if (template.engine === 'booklet-gradebook-inner' && spread) {
            return (
              <div key={sIdx} className="tc-booklet-strip">
                <MiniGradebookHalf
                  miniPage={spread.leftPage}
                  isLeft
                  template={template}
                  palette={palette}
                  schoolName={schoolName}
                  academicYear={yearLabel}
                  className={branchLabel}
                  showStudentNumbers={showStudentNumbers}
                  fontScale={fontScale}
                  photoMap={photoMap}
                />
                <div className="tc-spine-gutter" aria-hidden="true" />
                <MiniGradebookHalf
                  miniPage={spread.rightPage}
                  isLeft={false}
                  template={template}
                  palette={palette}
                  schoolName={schoolName}
                  academicYear={yearLabel}
                  className={branchLabel}
                  showStudentNumbers={showStudentNumbers}
                  fontScale={fontScale}
                  photoMap={photoMap}
                />
              </div>
            );
          }

          if (template.engine === 'booklet-gradebook-front' || template.engine === 'booklet-album-cover') {
            return (
              <BookletFrontCoverStrip
                key={sIdx}
                engine={template.engine}
                schoolName={schoolName}
                yearLabel={yearLabel}
                branchLabel={branchLabel}
                courseName={courseName}
                cleanTeacher={cleanTeacher}
                coverTitle={coverTitle}
                coverSubtitle={coverSubtitle}
                customCoverDataUrl={customCoverDataUrl}
                customCoverMode={customCoverMode}
                logoUrl={logoUrl}
              />
            );
          }

          if (template.engine === 'booklet-gradebook-back') {
            return <BookletScheduleBackStrip key={sIdx} />;
          }

          return (
            <div key={sIdx} className="tc-booklet-strip">
              {[
                { mp: spread?.leftPage, isLeft: true },
                { mp: spread?.rightPage, isLeft: false },
              ].map(({ mp, isLeft }, sideIdx) => (
                <React.Fragment key={sideIdx}>
                  {sideIdx === 1 && <div className="tc-spine-gutter">{schoolName || 'Okul'} ({yearLabel})</div>}
                  <div className="tc-mini-page">
                    <div className="tc-pocket-head">
                      <span>{isLeft ? mp?.pageNumber : ''}</span>
                      <span>{mp?.slots.some(Boolean) ? branchLabel : ''}</span>
                      <span>{!isLeft ? mp?.pageNumber : ''}</span>
                    </div>
                    <div className="tc-pocket-grid">
                      {(mp?.slots ?? []).slice(0, 12).map((stu, idx) => {
                        if (!stu) return <div key={idx} />;
                        const photo = stu.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) : undefined;
                        const [l1, l2] = splitBalancedStudentLines(stu.studentNumber, stu.firstName, stu.lastName, showStudentNumbers);
                        return (
                          <div key={stu.id} className="tc-pocket-item">
                            <div className="tc-pocket-photo">
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
                            <span className="tc-pocket-caption" style={{ fontSize: `${(0.86 * fontScale).toFixed(3)}cqi` }}>
                              {l1 && <span>{l1}</span>}
                              {l2 && <span>{l2}</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </PaperScaleFrame>
  );
});
