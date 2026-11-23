import React, { useMemo } from 'react';
import {
  useCompanyLogoUrl,
  useCompanyProfile,
} from '../../system/desktop/desktopPersonalization';
import type { PrintScaleMode } from '../../system/desktop/desktopPrinter';
import type { AlbumTemplateConfig, PhotoRecord } from '../../system/sqlite/types';
import type { BiometricIcaoPlan } from '../../system/storage/biometricFraming';
import { resolvePvcCardDesign } from '../../system/storage/pvc-cards/catalog';
import { PvcCardLiveView } from '../../system/storage/pvc-cards/PvcCardLiveView';
import { photoAdjustmentStyle, StudioPhotoImage } from '../../system/storage/StudioPhotoImage';
import { resolveTeacherChartConfig } from '../../system/storage/teacher-charts/paginationMath';
import type { PaperStudentItem } from '../../system/storage/teacher-charts/TeacherTabularPaper';
import type { StageZoomValue } from '../../window-system/StageZoomBar';
import type { ImpositionPage, PrintProductId } from './printSpecs';
import { PrintTeacherAndKutukCanvas } from './PrintTeacherAndKutukCanvas';
import { isStaffStudentNumber } from './sheetComposer';
import { StudentListPaper } from './StudentListPaper';
import { useBiometricPreviewPlans } from './useBiometricPreviewPlans';
import './print-paper-canvas.css';

/**
 * İZOLE MODÜL 04 FİZİKSEL KÂĞIT VE KART TUVALİ:
 * A4 Dikey Öğretmen Çizelgesi/Cep Defteri/ŞÖK/Kütük, A4 Yatay Kütük/Albüm, Portre ve CR80 Kimliği 5x zuma kadar yansıtır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export type PrintStageZoom = StageZoomValue;

function buildBioLayerTransform(plan: BiometricIcaoPlan): string {
  const parts: string[] = [];
  if (plan.zoom !== 1) parts.push(`scale3d(${plan.zoom}, ${plan.zoom}, 1)`);
  if (plan.tilt !== 0) parts.push(`rotate(${plan.tilt}deg)`);
  if (plan.panX !== 0 || plan.panY !== 0) parts.push(`translate3d(${plan.panX}%, ${plan.panY}%, 0)`);
  return parts.join(' ');
}

export const PrintPaperCanvas: React.FC<{
  page: ImpositionPage;
  pageNumber: number;
  totalPages: number;
  productId?: PrintProductId;
  schoolName: string;
  scopeLabel: string;
  albumConfig: AlbumTemplateConfig;
  showCropMarks: boolean;
  scaleMode?: PrintScaleMode;
  stageZoom: PrintStageZoom;
  logoUrl?: string;
  watermarkOpacity?: number;
  principalSigUrl?: string;
  deputySigUrl?: string;
  coverUrl?: string;
  coverZoom?: number;
  schoolAddress?: string;
  institutionCode?: string;
}> = React.memo(({
  page, pageNumber, totalPages, productId, schoolName, scopeLabel, albumConfig,
  showCropMarks, scaleMode = 'actual-100', stageZoom, logoUrl = '', watermarkOpacity = 0.08,
  principalSigUrl = '', deputySigUrl = '', coverUrl = '', coverZoom = 1,
  schoolAddress = '', institutionCode = '',
}) => {
  const company = useCompanyProfile();
  const studioLogoUrl = useCompanyLogoUrl() ?? '';
  const isSingleIdCard = page.kind === 'id-card-sheet' && Math.max(page.widthMm, page.heightMm) < 180;
  const isPortraitSingleCard = isSingleIdCard && page.heightMm > page.widthMm;
  const isLandscapePaper = page.widthMm > page.heightMm && !isSingleIdCard;
  const studioBioCard = page.footerStudioStrip === true;
  const tightPortraitEdge =
    studioBioCard ||
    (page.kind === 'portrait-sheet' && (page.slots[0]?.yMm ?? 10) < 7) ||
    (page.kind === 'id-card-sheet' && !isSingleIdCard && (page.slots[0]?.yMm ?? 12) < 11);
  const isVectorDocSheet =
    page.kind === 'kutuk-sheet' || (page.kind === 'album-sheet' && !isLandscapePaper);
  const isBiometricSheet = page.kind === 'portrait-sheet' && productId === 'biometric-50x60';

  const slotPhotos = useMemo(() => page.slots.map((s) => s.entry.photo), [page.slots]);
  const bioPlans = useBiometricPreviewPlans(isBiometricSheet, slotPhotos);
  const resolvedPvcDesign = useMemo(
    () => (page.kind === 'id-card-sheet' ? resolvePvcCardDesign(albumConfig) : null),
    [page.kind, albumConfig],
  );

  const rosterSource = page.rosterEntries ?? page.slots.map((s) => s.entry);
  const { paperStudents, photoMap } = useMemo(() => {
    const map = new Map<string, PhotoRecord>();
    const list: PaperStudentItem[] = [];
    for (const item of rosterSource) {
      map.set(item.photo.id, item.photo);
      list.push({
        id: item.student.id,
        studentNumber: item.student.studentNumber,
        firstName: item.student.firstName,
        lastName: item.student.lastName,
        matchedPhotoId: item.photo.id,
      });
    }
    return { paperStudents: list, photoMap: map };
  }, [rosterSource]);

  const baseMaxW = isPortraitSingleCard ? 320 : isSingleIdCard ? 460 : isLandscapePaper ? 650 : 480;
  const zoomWidthPx = stageZoom === 'fit' ? undefined : Math.round(baseMaxW * stageZoom);
  const fitCssWidth = isPortraitSingleCard
    ? 'min(320px, 50vh, 80vw)'
    : isSingleIdCard
      ? 'min(450px, 56vh, 84vw)'
      : isLandscapePaper
        ? 'min(650px, 66vh, 86vw)'
        : 'min(480px, 50vh, 86vw)';

  if (page.kind === 'student-list') {
    return (
      <StudentListPaper
        page={page}
        schoolName={schoolName}
        palette={resolveTeacherChartConfig(albumConfig).palette}
        printFontPt={albumConfig.printFontPt}
        width={zoomWidthPx ? `${zoomWidthPx}px` : fitCssWidth}
        zoomWidthPx={zoomWidthPx}
      />
    );
  }

  if (isVectorDocSheet) {
    return (
      <PrintTeacherAndKutukCanvas
        page={page}
        pageNumber={pageNumber}
        totalPages={totalPages}
        schoolName={schoolName}
        scopeLabel={scopeLabel}
        albumConfig={albumConfig}
        showCropMarks={showCropMarks}
        zoomWidthPx={zoomWidthPx}
        paperStudents={paperStudents}
        photoMap={photoMap}
        logoUrl={logoUrl}
        watermarkOpacity={watermarkOpacity}
        principalSigUrl={principalSigUrl}
        deputySigUrl={deputySigUrl}
        coverUrl={coverUrl}
        coverZoom={coverZoom}
      />
    );
  }

  const resolvedPalette = resolveTeacherChartConfig(albumConfig).palette;

  return (
    <div
      className={`pc-paper-sheet is-${page.kind} ${isSingleIdCard ? 'is-cr80-single' : ''} ${studioBioCard ? 'is-studio-bio-card' : ''} ${showCropMarks ? 'has-crops' : ''} ${scaleMode === 'fit-page' ? 'is-fit-scale' : ''}`.trim()}
      style={{
        aspectRatio: `${page.widthMm} / ${page.heightMm}`,
        width: zoomWidthPx ? `${zoomWidthPx}px` : fitCssWidth,
        maxWidth: 'none',
        margin: '0 auto',
      }}
    >
      {!isSingleIdCard && !tightPortraitEdge && (
        <div className="pc-paper-header">
          <span>
            {schoolName} ·{' '}
            {page.kind === 'id-card-sheet'
              ? (page.titleLabel || 'CR80 PVC Kimlik Tabakası')
              : scopeLabel}
          </span>
          <span>Sayfa {pageNumber}/{totalPages}</span>
        </div>
      )}

      {page.slots.map((slot, idx) => {
        const leftPct = (slot.xMm / page.widthMm) * 100;
        const topPct = (slot.yMm / page.heightMm) * 100;
        const widthPct = (slot.widthMm / page.widthMm) * 100;
        const heightPct = (slot.heightMm / page.heightMm) * 100;
        const { student, photo, className, classRecord } = slot.entry;
        const isStaff = isStaffStudentNumber(student.studentNumber);

        if (page.kind === 'id-card-sheet' && resolvedPvcDesign) {
          return (
            <div
              key={`${student.id}-${idx}`}
              className={`pc-idcard-slot pc-idcard-live-host ${!isSingleIdCard && showCropMarks ? 'has-crop-outline' : ''}`.trim()}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
              }}
            >
              <PvcCardLiveView
                design={resolvedPvcDesign}
                side={page.cardSide ?? 'front'}
                palette={resolvedPalette}
                data={{
                  schoolName,
                  schoolAddress,
                  institutionCode,
                  academicYear: classRecord?.academicYear,
                  className,
                  isStaffCard: isStaff,
                  student,
                  studio: {
                    companyName: company.companyName,
                    ownerName: company.ownerName,
                    phone: company.phone,
                    address: company.address,
                  },
                  backNote: albumConfig.pvcBackNote,
                }}
                photo={photo}
                logoUrl={logoUrl}
                studioLogoUrl={studioLogoUrl}
                principalSigUrl={principalSigUrl}
                deputySigUrl={deputySigUrl}
                printFontPt={albumConfig.printFontPt}
                squareCorners={false}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          );
        }

        const captionMain = isStaff
          ? `${student.firstName} ${student.lastName}`
          : `${student.studentNumber} ${student.firstName}`;
        const bioPlan = isBiometricSheet ? bioPlans.get(photo.id) : undefined;
        const adjStyle = photoAdjustmentStyle(photo.adjustments);
        const bioHostStyle = bioPlan
          ? { background: bioPlan.backdropCss, filter: adjStyle?.filter }
          : undefined;
        const renderPhotoNode = () =>
          bioPlan ? (
            <div
              className="pc-bio-transform-layer"
              style={{ transform: buildBioLayerTransform(bioPlan) || undefined }}
            >
              <StudioPhotoImage
                photo={photo}
                alt={student.firstName}
                loading="lazy"
                decoding="async"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: `${bioPlan.rawWidthFrac * 100}%`,
                  height: `${bioPlan.rawHeightFrac * 100}%`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  objectFit: 'fill',
                  transform: `translate(-50%, -50%)${bioPlan.rotation ? ` rotate(${bioPlan.rotation}deg)` : ''}`,
                  backfaceVisibility: 'hidden',
                }}
              />
            </div>
          ) : (
            <StudioPhotoImage
              photo={photo}
              alt={student.firstName}
              loading="lazy"
              decoding="async"
              style={adjStyle}
            />
          );

        return (
          <div
            key={`${student.id}-${idx}`}
            className={`pc-paper-slot ${showCropMarks && !studioBioCard && page.kind === 'portrait-sheet' ? 'has-crop-outline' : ''}`.trim()}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
            }}
          >
            <div className="pc-paper-photo" style={!slot.rotated90 ? bioHostStyle : undefined}>
              {slot.rotated90 ? (
                <div
                  className="pc-rotated-portrait-inner"
                  style={{
                    width: `${(slot.heightMm / slot.widthMm) * 100}%`,
                    height: `${(slot.widthMm / slot.heightMm) * 100}%`,
                    ...bioHostStyle,
                  }}
                >
                  {renderPhotoNode()}
                </div>
              ) : (
                renderPhotoNode()
              )}
            </div>
            {!tightPortraitEdge && <span className="pc-paper-caption">{captionMain}</span>}
          </div>
        );
      })}

      {studioBioCard && (
        <div className="pc-bio-studio-footer">
          <strong>{schoolName.toLocaleUpperCase('tr-TR')}</strong>
          <span>
            {(page.slots[0]?.entry.className ||
              (page.slots[0]?.entry
                ? `${page.slots[0].entry.student.studentNumber} ${page.slots[0].entry.student.firstName}`
                : '')
            ).toLocaleUpperCase('tr-TR')}
          </span>
        </div>
      )}

      {showCropMarks && page.rulerLengthMm > 0 && (
        <div
          className="pc-paper-ruler"
          style={{ width: `${(page.rulerLengthMm / page.widthMm) * 100}%` }}
          title="Baskıda %100 Gerçek Ölçek kontrol cetveli"
        >
          <div className="pc-paper-ruler-line" />
          <span>%100 ÖLÇEK · {page.rulerLengthMm} mm</span>
        </div>
      )}
    </div>
  );
});
