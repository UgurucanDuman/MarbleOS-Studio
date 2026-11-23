import React, { useEffect, useRef, useState } from 'react';
import {
  useCompanyLogoUrl,
  useCompanyProfile,
} from '../../system/desktop/desktopPersonalization';
import { usesDesktopStorage } from '../../system/desktop/desktopStorage';
import { openStudioManagedDirectory } from '../../system/desktop/exportFileWriter';
import { notifyStudio } from '../../system/desktop/studioToast';
import { resolveTeacherChartConfig } from '../../system/storage/teacher-charts/paginationMath';
import { useResolvedSchoolAssetUrl } from '../../system/storage/useSchoolAssetUrl';
import { resolveKutukTemplate } from '../../system/storage/yearbook-kutuk/catalog';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import type { PrintCenterHandoff } from '../../window-system/types';
import { PrintCommandDeck } from './PrintCommandDeck';
import type { PrintStageZoom } from './PrintPaperCanvas';
import { PrintScopePanel } from './PrintScopePanel';
import { PrintSheetPreview } from './PrintSheetPreview';
import { PrintStudioIcon } from './PrintStudioIcons';
import { PrintTypographyPanel } from './PrintTypographyPanel';
import { usePrintCenterController } from './usePrintCenterController';
import './print-center.css';

/**
 * İZOLE MODÜL 04: Apple Pro Baskı & Doğrudan Yazıcı Stüdyosu
 * 300 DPI Portre, CR80 PVC Kimlik, A4 Öğretmen Çizelgesi/Cep Defteri/Albüm, Doğrudan Yazıcı ve e-Okul ZIP
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PrintCenterWindow: React.FC<{
  handoff?: PrintCenterHandoff | null;
}> = React.memo(({ handoff }) => {
  const ctl = usePrintCenterController();
  const [previewPage, setPreviewPage] = useState(0);
  const [pageDir, setPageDir] = useState(1);
  const [stageZoom, setStageZoom] = useState<PrintStageZoom>('fit');
  const [showCropMarks, setShowCropMarks] = useState(true);
  const handledSeqRef = useRef<number>(0);

  const activeSchool = ctl.scopeData.activeSchool;
  const isRoster = ctl.normalizedMode === 'a4-student-list';
  const isKutukSheet =
    ctl.normalizedMode === 'a4-kutuk-portrait' || ctl.normalizedMode === 'a4-album-landscape';
  const company = useCompanyProfile();
  const studioLogoUrl = useCompanyLogoUrl() ?? '';
  const logoUrl = useResolvedSchoolAssetUrl(activeSchool?.logoDataUrl, 'original');
  const principalSigUrl = useResolvedSchoolAssetUrl(activeSchool?.principalSignatureDataUrl, 'original');
  const deputySigUrl = useResolvedSchoolAssetUrl(activeSchool?.deputySignatureDataUrl, 'original');
  const coverUrl = useResolvedSchoolAssetUrl(activeSchool?.schoolPhotoDataUrl, 'original');
  const coverZoom = activeSchool?.schoolPhotoZoom ?? 1;
  const watermarkOpacity = (activeSchool?.transparentLogoOpacity ?? 35) / 100;
  const schoolVisuals = {
    logoUrl,
    studioLogoUrl,
    principalSigUrl,
    deputySigUrl,
    coverUrl,
    schoolAddress: activeSchool?.address,
    institutionCode: activeSchool?.institutionCode,
    studio: {
      companyName: company.companyName,
      ownerName: company.ownerName,
      phone: company.phone,
      address: company.address,
    },
  };

  useEffect(() => {
    if (!handoff || handoff.seq === handledSeqRef.current) return;
    handledSeqRef.current = handoff.seq;
    ctl.setScopeClassId(handoff.classId);
    ctl.setApprovalFilter('approved-only');
    setPreviewPage(0);

    if (handoff.layoutKind === 'id-card') {
      ctl.setProductId('pvc-id-card');
      ctl.applySheetMode('a4-id-8up');
      if (ctl.db.albumConfig.pvcPrintSides === 'front-and-back') {
        ctl.setDuplex('vertical');
      }
      setShowCropMarks(true);
    } else if (handoff.layoutKind === 'yearbook-spread') {
      ctl.setProductId('album-chart');
      const kutukTpl = resolveKutukTemplate(
        ctl.db.albumConfig.kutukTemplateId,
        undefined,
        ctl.db.albumConfig.kutukCols,
        ctl.db.albumConfig.kutukRows,
      );
      ctl.applySheetMode(kutukTpl.landscape ? 'a4-album-landscape' : 'a4-kutuk-portrait');
      setShowCropMarks(false);
    } else {
      ctl.setProductId('album-chart');
      ctl.applySheetMode('a4-album-portrait');
      const { template } = resolveTeacherChartConfig(ctl.db.albumConfig);
      if (template.engine === 'booklet-gradebook-inner' || template.engine === 'booklet-album-inner') {
        ctl.setDuplex('vertical');
      }
      setShowCropMarks(false);
    }
  }, [handoff, ctl]);

  const totalStudents = ctl.scopeData.scopedStudents.length;
  const readyStudents = ctl.scopeData.readyStudents;
  const readyPercent = totalStudents > 0 ? Math.round((readyStudents / totalStudents) * 100) : 0;
  const progressPct =
    ctl.jobProgress && ctl.jobProgress.total > 0
      ? Math.min(100, Math.round((ctl.jobProgress.completed / ctl.jobProgress.total) * 100))
      : 0;

  return (
    <div className="mod-pane pc-studio-root">
      <div className="mod-header">
        <div>
          <span className="mod-eyebrow">
            300 DPI BASKI VE YAZICI STÜDYOSU ·{' '}
            {activeSchool ? activeSchool.name : 'YEREL ÇALIŞMA ALANI'}
          </span>
          <h3>Doğrudan Yazıcı Motoru, PVC Kimlik, Albüm &amp; Biyometrik Baskı</h3>
        </div>
        <div className="mod-btn-row">
          {usesDesktopStorage && (
            <button
              type="button"
              className="mod-secondary-btn"
              onClick={() =>
                void openStudioManagedDirectory('exports').catch((e) =>
                  notifyStudio(formErrorMessage(e), 'error'),
                )
              }
            >
              <PrintStudioIcon kind="folder" size={14} />
              <span>Çıktı Klasörü</span>
            </button>
          )}
          <button
            type="button"
            className="mod-secondary-btn"
            disabled={ctl.busy}
            onClick={() => void ctl.handleExportCsv()}
          >
            <PrintStudioIcon kind="csv" size={14} />
            <span>Kontrol Listesi (.CSV)</span>
          </button>
          {ctl.busy ? (
            <button type="button" className="mod-secondary-btn" onClick={ctl.abortActiveJob}>
              <PrintStudioIcon kind="stop" size={14} />
              <span>İşlemi Durdur</span>
            </button>
          ) : ctl.isZipMode ? (
            <button
              type="button"
              className="mod-action-btn"
              disabled={ctl.activeEntries.length === 0}
              onClick={() => void ctl.handleRunExport(showCropMarks)}
            >
              <PrintStudioIcon kind="zip" size={14} />
              <span>
                {ctl.productId === 'e-okul-zip'
                  ? (usesDesktopStorage ? `e-Okul JPG Klasörü · ${ctl.activeEntries.length}` : `e-Okul Paketi (.ZIP) · ${ctl.activeEntries.length}`)
                  : (usesDesktopStorage ? `300 DPI JPG Klasörü · ${ctl.activeEntries.length}` : `300 DPI Kareler (.ZIP) · ${ctl.activeEntries.length}`)}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="mod-secondary-btn pc-pdf-btn"
                disabled={ctl.pages.length === 0}
                onClick={() => void ctl.handleRunExport(showCropMarks, schoolVisuals)}
              >
                <PrintStudioIcon kind={ctl.effectiveExportFormat === 'jpg' ? 'jpg' : 'pdf'} size={14} />
                <span>
                  {ctl.effectiveExportFormat === 'jpg'
                    ? ctl.pages.length <= 1
                      ? '300 DPI JPG (1 Görsel)'
                      : `300 DPI JPG (${ctl.pages.length} Sayfa · .ZIP)`
                    : `300 DPI PDF (${ctl.pages.length * ctl.copies} Sayfa)`}
                </span>
              </button>
              <button
                type="button"
                className="mod-action-btn pc-print-primary-btn"
                disabled={ctl.pages.length === 0 || !ctl.selectedPrinter}
                onClick={() => void ctl.handleDirectPrint(showCropMarks, schoolVisuals)}
              >
                <PrintStudioIcon kind="printer" size={15} />
                <span>Yazdır ({ctl.pages.length * ctl.copies} Sayfa)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {ctl.jobProgress && (
        <div className="pc-progress-bar-row" role="status" aria-live="polite">
          <div className="pc-progress-track">
            <div className="pc-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="pc-progress-text">%{progressPct} · {ctl.jobProgress.label}</span>
        </div>
      )}

      {ctl.lastBanner && (
        <div className="pc-summary-banner" role="status">
          <span>
            <strong>{ctl.lastBanner.headline}</strong> · {ctl.lastBanner.detail}
          </span>
          {ctl.lastBanner.lowDpiWarnings.length > 0 && (
            <span className="pc-summary-warn">
              Uyarı: {ctl.lastBanner.lowDpiWarnings.length} karede düşük kaynak çözünürlüğü (&lt;240 DPI) algılandı
            </span>
          )}
        </div>
      )}

      <div className="pc-studio-layout">
        <aside className="pc-inspector-rail" aria-label="Baskı ve yazıcı denetçisi">
          <PrintCommandDeck
            productId={ctl.productId}
            portraitVariant={ctl.portraitVariant}
            sheetMode={ctl.normalizedMode}
            exportFormat={ctl.exportFormat}
            printers={ctl.printers}
            selectedPrinter={ctl.selectedPrinter}
            loadingPrinters={ctl.loadingPrinters}
            copies={ctl.copies}
            orientation={ctl.orientation}
            duplex={ctl.duplex}
            scaleMode={ctl.scaleMode}
            onSelectProduct={(next) => {
              ctl.selectProduct(next);
              setPreviewPage(0);
              setShowCropMarks(next !== 'album-chart');
            }}
            onSelectPortraitVariant={(variant) => {
              ctl.setPortraitVariant(variant);
              ctl.setProductId(variant);
              setPreviewPage(0);
            }}
            onChangeSheetMode={(mode) => {
              ctl.applySheetMode(mode);
              setPreviewPage(0);
            }}
            onChangeExportFormat={ctl.setExportFormat}
            onSelectPrinter={ctl.setSelectedPrinter}
            onRefreshPrinters={() => void ctl.refreshPrinters()}
            onChangeCopies={ctl.setCopies}
            onChangeOrientation={(next) => {
              ctl.setOrientation(next);
              setPreviewPage(0);
            }}
            onChangeDuplex={(next) => {
              ctl.setDuplex(next);
              setPreviewPage(0);
            }}
            onChangeScaleMode={ctl.setScaleMode}
          />

          {(ctl.productId === 'album-chart' || ctl.productId === 'pvc-id-card') && (
            <PrintTypographyPanel
              albumConfig={ctl.db.albumConfig}
              className={ctl.pages[previewPage]?.titleLabel}
              isRoster={isRoster}
              isTeacherSheet={ctl.normalizedMode === 'a4-album-portrait'}
              isKutukSheet={isKutukSheet}
              isPvcCard={ctl.productId === 'pvc-id-card'}
              isPvcA4Sheet={ctl.productId === 'pvc-id-card' && ctl.normalizedMode === 'a4-id-8up'}
              kutukLandscape={ctl.normalizedMode === 'a4-album-landscape'}
              onChangeSheetMode={(mode) => {
                ctl.applySheetMode(mode);
                setPreviewPage(0);
              }}
              onChangeOrientation={(next) => {
                ctl.setOrientation(next);
                setPreviewPage(0);
              }}
            />
          )}

          <PrintScopePanel
            isRoster={isRoster}
            schools={ctl.db.schools}
            allClasses={ctl.db.classes}
            activeSchoolId={activeSchool?.id ?? ''}
            scopedClasses={ctl.scopeData.scopedClasses}
            deputyOptions={ctl.scopeData.deputyOptions}
            classStatsMap={ctl.scopeData.classStatsMap}
            effectiveScopeId={ctl.scopeData.effectiveScopeId}
            scopeLabel={ctl.scopeLabel}
            approvalFilter={ctl.approvalFilter}
            approvedCount={ctl.scopeData.approvedEntries.length}
            allMatchedCount={ctl.scopeData.allMatchedEntries.length}
            readyStudents={readyStudents}
            totalStudents={totalStudents}
            readyPercent={readyPercent}
            missingPhotos={ctl.scopeData.missingPhotos}
            onChangeScope={(val) => {
              ctl.setScopeClassId(val);
              setPreviewPage(0);
            }}
            onChangeApprovalFilter={(val) => {
              ctl.setApprovalFilter(val);
              setPreviewPage(0);
            }}
          />
        </aside>

        <PrintSheetPreview
          schoolName={ctl.schoolName}
          scopeLabel={ctl.scopeLabel}
          productId={ctl.productId}
          sheetMode={ctl.normalizedMode}
          albumConfig={ctl.db.albumConfig}
          entries={ctl.activeEntries}
          pages={ctl.pages}
          pageIndex={previewPage}
          pageDir={pageDir}
          stageZoom={stageZoom}
          showCropMarks={showCropMarks}
          scaleMode={ctl.scaleMode}
          duplex={ctl.duplex}
          exportFormat={ctl.effectiveExportFormat}
          logoUrl={logoUrl}
          watermarkOpacity={watermarkOpacity}
          principalSigUrl={principalSigUrl}
          deputySigUrl={deputySigUrl}
          coverUrl={coverUrl}
          coverZoom={coverZoom}
          schoolAddress={activeSchool?.address}
          institutionCode={activeSchool?.institutionCode}
          onChangePage={(next, dir) => {
            setPageDir(dir);
            setPreviewPage(next);
          }}
          onChangeZoom={setStageZoom}
          onToggleCropMarks={() => setShowCropMarks((v) => !v)}
        />
      </div>
    </div>
  );
});
