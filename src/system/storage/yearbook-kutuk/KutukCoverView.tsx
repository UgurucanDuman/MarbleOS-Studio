import React from 'react';
import { PaperScaleFrame } from '../teacher-charts/PaperScaleFrame';
import type { TeacherChartPalette } from '../teacher-charts/types';
import type { KutukStudentLike } from './staffDirectory';
import type { KutukResolvedPage } from './types';

/**
 * İZOLE SİSTEM KATMANI · İDARECİ KÜTÜK DOSYASI ÖN KAPAK KAĞIDI:
 * Hem çerçeveli amblem hem tam kapak (full-bleed) yerleşimini 0.5x–5x vektör keskinliğinde çizer.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const KutukCoverView: React.FC<{
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  palette: TeacherChartPalette;
  paperVars: React.CSSProperties;
  schoolName: string;
  coverTitle: string;
  coverSubtitle: string;
  customCoverDataUrl: string;
  customCoverMode: 'full-bleed' | 'emblem';
  resolvedFitW: number;
  zoomWidthPx?: number;
  logoUrl: string;
  watermarkOpacity: number;
  principalSigUrl: string;
  deputySigUrl: string;
  coverUrl: string;
  coverZoom: number;
}> = React.memo(({
  page,
  palette,
  paperVars,
  schoolName,
  coverTitle,
  coverSubtitle,
  customCoverDataUrl,
  customCoverMode,
  resolvedFitW,
  zoomWidthPx,
  logoUrl,
  watermarkOpacity,
  principalSigUrl,
  deputySigUrl,
  coverUrl,
  coverZoom,
}) => {
  const isLandscape = page.landscape;
  const heroImage = customCoverDataUrl || coverUrl;
  const isFullBleed = Boolean(customCoverDataUrl && customCoverMode === 'full-bleed');
  const mainCoverTitle = coverTitle.trim() || 'İDARECİ ÖĞRENCİ KÜTÜK VE SINIF ALBÜM DOSYASI';
  const subCoverText = coverSubtitle.trim() || page.scopeTitle;
  const principalBadge = page.staffBadges.find((b) => b.roleLabel === 'Okul Müdürü');

  return (
    <PaperScaleFrame
      fitMaxWidthPx={resolvedFitW}
      zoomWidthPx={zoomWidthPx}
      landscape={isLandscape}
      paperVars={paperVars}
      paperClassName="kt-paper is-cover"
    >
      {!isLandscape && <div className="kt-binder-guide" aria-hidden="true" />}
      {logoUrl && !isFullBleed && (
        <img src={logoUrl} alt="" className="tc-watermark" style={{ opacity: watermarkOpacity * 0.18 }} />
      )}

      <div className="kt-cover-frame">
        {isFullBleed && customCoverDataUrl ? (
          <>
            <img src={customCoverDataUrl} alt="Tam kapak görseli" className="kt-cover-bleed-img" />
            <div className="kt-cover-bleed-plate">
              <div style={{ fontSize: isLandscape ? '1.5cqi' : '1.8cqi', fontWeight: 800, color: palette.inkPrimary }}>
                {schoolName.toLocaleUpperCase('tr-TR')} · {page.academicYear}
              </div>
              <div style={{ fontSize: isLandscape ? '1.8cqi' : '2.1cqi', fontWeight: 900, color: palette.headingInk }}>
                {mainCoverTitle}
              </div>
              <div style={{ fontSize: isLandscape ? '1.05cqi' : '1.22cqi', fontWeight: 700, color: palette.inkSecondary }}>
                {subCoverText} · {page.totalStudentCount} Öğrenci
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8cqi' }}>
              <div className="kt-accent-rule" aria-hidden="true" />
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Okul logosu"
                  style={{ width: isLandscape ? '6cqi' : '8.2cqi', height: isLandscape ? '6cqi' : '8.2cqi', objectFit: 'contain' }}
                />
              )}
              <div style={{ fontSize: isLandscape ? '1.8cqi' : '2.15cqi', fontWeight: 800, color: palette.inkPrimary, letterSpacing: '0.02em' }}>
                {schoolName.toLocaleUpperCase('tr-TR')}
              </div>
              <div style={{ fontSize: isLandscape ? '1.05cqi' : '1.28cqi', fontWeight: 700, color: palette.inkSecondary }}>
                {page.academicYear} EĞİTİM VE ÖĞRETİM YILI
              </div>
            </div>

            {heroImage && (
              <div className="kt-cover-photo-frame">
                <img
                  src={heroImage}
                  alt="Okul kapak görseli"
                  style={!customCoverDataUrl && coverZoom > 1 ? { transform: `scale(${coverZoom})` } : undefined}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5cqi', maxWidth: '88%' }}>
              <div style={{ fontSize: isLandscape ? '1.95cqi' : '2.35cqi', fontWeight: 900, color: palette.headingInk, letterSpacing: '0.025em' }}>
                {mainCoverTitle}
              </div>
              <div style={{ fontSize: isLandscape ? '1.12cqi' : '1.35cqi', fontWeight: 700, color: palette.inkSecondary }}>
                {subCoverText}
              </div>
            </div>

            <div className="kt-cover-stats">
              <div className="kt-cover-stat-cell">
                <span>TESLİM BİRİMİ</span>
                <strong>
                  {page.deputyPrincipalName ? `Md. Yrd. ${page.deputyPrincipalName}` : 'Müdür Yardımcılığı'}
                </strong>
              </div>
              <div className="kt-cover-stat-cell">
                <span>SINIF VE ŞUBE</span>
                <strong>{page.coverClassSummary}</strong>
              </div>
              <div className="kt-cover-stat-cell">
                <span>TOPLAM ÖĞRENCİ</span>
                <strong>{page.totalStudentCount} Öğrenci</strong>
              </div>
            </div>

            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-around', paddingTop: '0.6cqi' }}>
              <div className="tc-sig-block">
                {deputySigUrl && <img src={deputySigUrl} alt="Müdür yardımcısı imzası" className="kt-sig-img" />}
                <strong>{page.deputyPrincipalName || 'Müdür Yardımcısı'}</strong>
                <span>Sorumlu Müdür Yardımcısı</span>
              </div>
              <div className="tc-sig-block">
                {principalSigUrl && <img src={principalSigUrl} alt="Okul müdürü imzası" className="kt-sig-img" />}
                <strong>{principalBadge?.fullName || 'Okul Müdürü'}</strong>
                <span>Okul Müdürü</span>
              </div>
            </div>
          </>
        )}
      </div>
    </PaperScaleFrame>
  );
});
