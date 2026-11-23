import React from 'react';
import type { PhotoRecord } from '../../sqlite/types';
import { photoAdjustmentStyle, StudioPhotoImage } from '../StudioPhotoImage';
import type { KutukStudentLike } from './staffDirectory';
import type { KutukResolvedPage, KutukStaffBadge } from './types';

/**
 * İZOLE SİSTEM KATMANI: Kütük Sayfası Üst Başlık ve Alt İmza Şeridi Bileşenleri
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const KutukSheetHeader: React.FC<{
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  schoolName: string;
  docHeading: string;
  showSubtitle: boolean;
  showTeacherBadge: boolean;
  logoUrl: string;
  portraitBadges: readonly KutukStaffBadge[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
}> = ({
  page,
  schoolName,
  docHeading,
  showSubtitle,
  showTeacherBadge,
  logoUrl,
  portraitBadges,
  photoMap,
}) => {
  const cleanTeacher = page.teacherName.trim();
  const cleanDeputy = page.deputyPrincipalName.trim();
  const gradeUpper = page.classGradeLabel.toLocaleUpperCase('tr-TR');
  const branchUpper = page.classBranchLabel
    ? `${page.classBranchLabel.toLocaleUpperCase('tr-TR')}${page.branchTotalPages > 1 ? ` (${page.branchPageIndex + 1}/${page.branchTotalPages})` : ''}`
    : page.branchTotalPages > 1
      ? `SAYFA ${page.branchPageIndex + 1}/${page.branchTotalPages}`
      : '';
  const extraMetaParts: string[] = [`Mevcut: ${page.branchStudentCount} Öğrenci`];
  if (showTeacherBadge && cleanTeacher) extraMetaParts.push(`Sınıf Öğrt.: ${cleanTeacher}`);
  if (cleanDeputy) extraMetaParts.push(`Sorumlu Md. Yrd.: ${cleanDeputy}`);

  return (
    <header className={`kt-head ${showSubtitle ? '' : 'is-compact-head'}`.trim()}>
      <div className="kt-accent-rule" aria-hidden="true" />
      <div className="kt-head-row kt-head-centered">
        <div className="kt-head-side is-left">
          {logoUrl && <img src={logoUrl} alt="Okul logosu" className="kt-logo" />}
        </div>

        <div className="kt-brand-titles is-centered">
          <div className="kt-school-title">
            {schoolName.toLocaleUpperCase('tr-TR')} ({page.academicYear})
          </div>
          {showSubtitle && <div className="kt-doc-subtitle">{docHeading}</div>}
          <div className="kt-admin-meta-line kt-meta-centered">
            <strong className="kt-meta-grade">{gradeUpper}</strong>
            {branchUpper && (
              <>
                <span aria-hidden="true">·</span>
                <strong className="kt-meta-branch">{branchUpper}</strong>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{extraMetaParts.join(' · ')}</span>
          </div>
        </div>

        <div className="kt-head-side is-right">
          {portraitBadges.length > 0 && (
            <div className="kt-staff-strip" aria-label="Sınıf idareci ve öğretmen portreleri">
              {portraitBadges.map((badge) => {
                const staffPhoto = badge.photoRef ? photoMap.get(badge.photoRef) : undefined;
                if (!staffPhoto) return null;
                return (
                  <div key={`${badge.roleLabel}-${badge.fullName}`} className="kt-staff-mini">
                    <div className="kt-staff-mini-photo">
                      <StudioPhotoImage
                        photo={staffPhoto}
                        alt={badge.fullName}
                        loading="lazy"
                        decoding="async"
                        style={photoAdjustmentStyle(staffPhoto.adjustments)}
                      />
                    </div>
                    <div className="kt-staff-mini-copy">
                      <small>{badge.roleLabel}</small>
                      <strong>{badge.fullName}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export const KutukSheetFooter: React.FC<{
  showTeacherSig: boolean;
  showDeputySig: boolean;
  showPrincipalSig: boolean;
  showPageNumber: boolean;
  showTeacherBadge: boolean;
  cleanTeacher: string;
  cleanDeputy: string;
  principalName: string;
  deputySigUrl: string;
  principalSigUrl: string;
  pageNumber: number;
  totalPages: number;
}> = ({
  showTeacherSig,
  showDeputySig,
  showPrincipalSig,
  showPageNumber,
  showTeacherBadge,
  cleanTeacher,
  cleanDeputy,
  principalName,
  deputySigUrl,
  principalSigUrl,
  pageNumber,
  totalPages,
}) => (
  <footer className="kt-foot">
    {showTeacherSig && (
      <div className="kt-sig-col">
        <span>Sınıf / Rehber Öğretmeni</span>
        <strong>{showTeacherBadge && cleanTeacher ? cleanTeacher : '................................'}</strong>
      </div>
    )}
    {showDeputySig && (
      <div className="kt-sig-col">
        {deputySigUrl && <img src={deputySigUrl} alt="Müdür yardımcısı imzası" className="kt-sig-img" />}
        <span>Sorumlu Müdür Yardımcısı</span>
        <strong>{cleanDeputy || '................................'}</strong>
      </div>
    )}
    {showPrincipalSig && (
      <div className="kt-sig-col">
        {principalSigUrl && <img src={principalSigUrl} alt="Okul müdürü imzası" className="kt-sig-img" />}
        <span>Okul Müdürü</span>
        <strong>{principalName || '................................'}</strong>
      </div>
    )}
    {showPageNumber && (
      <div className="kt-page-stamp">
        Sayfa {pageNumber} / {totalPages}
      </div>
    )}
  </footer>
);
