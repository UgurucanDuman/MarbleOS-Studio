import React from 'react';
import type { TeacherDocEngineKind } from './types';

/**
 * İZOLE SİSTEM KATMANI · KES-KATLA ÖN KAPAK (KURUMSAL / ÖZEL GÖRSEL) VE DERS PROGRAMI ARKA KAPAK ŞERİTLERİ:
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const SCHEDULE_DAYS = ['Pzt', 'Salı', 'Çarş', 'Perş', 'Cuma'] as const;

export const BookletFrontCoverStrip: React.FC<{
  engine: TeacherDocEngineKind;
  schoolName: string;
  yearLabel: string;
  branchLabel: string;
  courseName: string;
  cleanTeacher: string;
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverDataUrl?: string;
  customCoverMode?: 'full-bleed' | 'emblem';
  logoUrl?: string;
}> = React.memo(({
  engine,
  schoolName,
  yearLabel,
  branchLabel,
  courseName,
  cleanTeacher,
  coverTitle,
  coverSubtitle,
  customCoverDataUrl,
  customCoverMode = 'full-bleed',
  logoUrl = '',
}) => {
  const isFullBleed = Boolean(customCoverDataUrl) && customCoverMode === 'full-bleed';
  const bandLabel = (coverSubtitle ?? '').trim() || `${yearLabel} Eğitim-Öğretim Yılı`;
  const mainTitle =
    (coverTitle ?? '').trim() ||
    (engine === 'booklet-album-cover' ? 'Öğretmen Fotoğraf Albümü' : `${branchLabel} Sınıfı`);

  return (
    <div className="tc-booklet-strip">
      <div />
      <div className="tc-spine-gutter" aria-hidden="true" />
      <div className={`tc-cover-half ${isFullBleed ? 'is-plain' : ''}`.trim()}>
        {isFullBleed ? (
          <img src={customCoverDataUrl} alt="Özel kapak tasarımı" className="tc-cover-fullbleed" />
        ) : (
          <>
            <strong className="tc-cover-school">
              {(schoolName || 'OKUL ADI').toLocaleUpperCase('tr-TR')}
            </strong>
            {customCoverDataUrl ? (
              <img src={customCoverDataUrl} alt="Kapak görseli" className="tc-cover-emblem" />
            ) : (
              logoUrl && <img src={logoUrl} alt="" className="tc-head-logo" />
            )}
            <div className="tc-cover-band">{bandLabel}</div>
            <strong className="tc-cover-title">{mainTitle}</strong>
            {engine !== 'booklet-album-cover' && (
              <>
                <span className="tc-cover-line">
                  Ders: {courseName || '........................................'}
                </span>
                <span className="tc-cover-line">
                  Öğretmen: {cleanTeacher || '....................................'}
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

export const BookletScheduleBackStrip: React.FC = React.memo(() => (
  <div className="tc-booklet-strip">
    <div className="tc-mini-page">
      <div className="tc-sched-title">HAFTALIK DERS PROGRAMI</div>
      <div className="tc-sched-grid" role="grid" aria-label="Haftalık ders programı">
        <div className="tc-sched-cell is-head" style={{ gridColumn: '1 / 3' }}>Saat</div>
        {SCHEDULE_DAYS.map((day) => (
          <div key={day} className="tc-sched-cell is-head">{day}</div>
        ))}
        <div className="tc-sched-cell is-period" style={{ gridColumn: 1, gridRow: '2 / 8' }}>
          SABAH
        </div>
        <div className="tc-sched-cell is-period" style={{ gridColumn: 1, gridRow: '8 / 14' }}>
          ÖĞLEN
        </div>
        {Array.from({ length: 12 }, (_, hr) => {
          const rowIdx = hr + 2;
          const isDiv = hr === 5;
          return (
            <React.Fragment key={hr}>
              <div
                className={`tc-sched-cell ${isDiv ? 'is-divider' : ''}`.trim()}
                style={{ gridColumn: 2, gridRow: rowIdx, fontWeight: 700 }}
              >
                {hr < 6 ? hr + 1 : hr - 5}
              </div>
              {SCHEDULE_DAYS.map((_, dIdx) => (
                <div
                  key={dIdx}
                  className={`tc-sched-cell ${isDiv ? 'is-divider' : ''}`.trim()}
                  style={{ gridColumn: dIdx + 3, gridRow: rowIdx }}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
    <div className="tc-spine-gutter" aria-hidden="true" />
    <div className="tc-cover-half is-plain">
      <span className="tc-cover-line">Bu &ldquo;Not Defteri&rdquo; ........ sayfadır.</span>
      <span className="tc-cover-line" style={{ marginTop: '2.4cqi' }}>Tasdik Olunur</span>
      <strong className="tc-cover-title">Okul Müdürü</strong>
    </div>
  </div>
));

