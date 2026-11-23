import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  PrintDuplexMode,
  PrintOrientation,
  PrintScaleMode,
} from '../../system/desktop/desktopPrinter';
import { notifyStudio } from '../../system/desktop/studioToast';
import { useStudioSnapshotQuery } from '../../system/query/useStudioQueries';
import { resolvePvcCardDesign } from '../../system/storage/pvc-cards/catalog';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import type { SchoolPrintVisualUrls } from './kutukSheetComposer';
import {
  runDirectPrinterJob,
  runPrintCenterExport,
  type LowDpiPortraitWarning,
  type PortraitExportFormat,
  type PrintExportProgress,
} from './printJobRunner';
import { savePrintManifestCsv } from './printManifest';
import { derivePrintScopeData } from './printScopeSelector';
import {
  defaultSheetModeForProduct,
  normalizeSheetModeForProduct,
  planImpositionPages,
  type PrintApprovalFilter,
  type PrintProductId,
  type PrintSheetMode,
} from './printSpecs';
import { planStudentListPages } from './studentListPages';
import { useStudioPrinters } from './useStudioPrinters';

/**
 * İZOLE MODÜL 04 DENETÇİ HOOK'U:
 * Yazıcı keşfi, kapsam seçimi, 300 DPI PDF/ZIP kaydı ve doğrudan yazıcı iş kuyruğunu yönetir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface LastJobBanner {
  headline: string;
  detail: string;
  lowDpiWarnings: LowDpiPortraitWarning[];
}

export function usePrintCenterController() {
  const { data: db } = useStudioSnapshotQuery();
  const initialSchool = db.schools.find((s) => s.id === db.activeSchoolId) ?? db.schools[0] ?? null;
  const initialPortrait: 'vesikalik-45x60' | 'biometric-50x60' =
    initialSchool?.makeBiometric && !initialSchool?.makeVesikalik ? 'biometric-50x60' : 'vesikalik-45x60';

  const [scopeClassId, setScopeClassId] = useState<string>('ALL');
  const [portraitVariant, setPortraitVariant] = useState<'vesikalik-45x60' | 'biometric-50x60'>(initialPortrait);
  const [productId, setProductId] = useState<PrintProductId>(initialPortrait);
  const [sheetMode, setSheetMode] = useState<PrintSheetMode>('a4-grid');
  const [approvalFilter, setApprovalFilter] = useState<PrintApprovalFilter>('approved-only');

  const { printers, selectedPrinter, setSelectedPrinter, loadingPrinters, refreshPrinters } = useStudioPrinters();
  const [copies, setCopies] = useState(1);
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [duplex, setDuplex] = useState<PrintDuplexMode>('simplex');
  const [scaleMode, setScaleMode] = useState<PrintScaleMode>('actual-100');
  const [exportFormat, setExportFormat] = useState<PortraitExportFormat>('pdf');

  const [jobProgress, setJobProgress] = useState<PrintExportProgress | null>(null);
  const [lastBanner, setLastBanner] = useState<LastJobBanner | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastPortraitAlbumModeRef = useRef<'a4-album-portrait' | 'a4-kutuk-portrait'>('a4-album-portrait');

  useEffect(() => () => abortRef.current?.abort(), []);

  const scopeData = useMemo(
    () => derivePrintScopeData(db, scopeClassId, productId),
    [db, scopeClassId, productId],
  );
  const normalizedMode = normalizeSheetModeForProduct(productId, sheetMode);
  const isZipMode = productId === 'e-okul-zip' || normalizedMode === 'single-zip';
  const effectiveExportFormat: PortraitExportFormat =
    (productId === 'vesikalik-45x60' || productId === 'biometric-50x60') && !isZipMode
      ? exportFormat
      : 'pdf';
  const activeEntries =
    approvalFilter === 'approved-only' ? scopeData.approvedEntries : scopeData.allMatchedEntries;
  const pages = useMemo(() => {
    if (isZipMode) return [];
    if (normalizedMode === 'a4-student-list') {
      return planStudentListPages(scopeData.scopedStudents, scopeData.scopedClasses, scopeData.effectiveScopeId, orientation);
    }
    return planImpositionPages(
      activeEntries,
      productId,
      normalizedMode,
      db.albumConfig.columns,
      db.albumConfig,
      scopeData,
      orientation,
      duplex,
    );
  }, [activeEntries, isZipMode, productId, normalizedMode, db.albumConfig, scopeData, orientation, duplex]);

  const scopeLabel = scopeData.validScopeClass
    ? scopeData.validScopeClass.name
    : scopeData.deputyScopeName
      ? `Md. Yrd. ${scopeData.deputyScopeName}`
      : 'Tüm Okul';
  const schoolName = scopeData.activeSchool?.name ?? 'MarbleOS Stüdyo';
  const busy = jobProgress !== null;

  const applySheetMode = (mode: PrintSheetMode) => {
    setSheetMode(mode);
    if (mode === 'a4-album-portrait' || mode === 'a4-kutuk-portrait') {
      lastPortraitAlbumModeRef.current = mode;
    }
    const isPortraitCr80 =
      mode === 'cr80-single' && resolvePvcCardDesign(db.albumConfig).orientation === 'portrait';
    setOrientation(
      mode === 'a4-album-landscape' || (mode === 'cr80-single' && !isPortraitCr80)
        ? 'landscape'
        : 'portrait',
    );
  };

  const changeOrientation = (next: PrintOrientation) => {
    setOrientation(next);
    if (productId === 'album-chart' && normalizedMode !== 'a4-student-list') {
      if (next === 'landscape' && normalizedMode !== 'a4-album-landscape') {
        if (normalizedMode === 'a4-album-portrait' || normalizedMode === 'a4-kutuk-portrait') {
          lastPortraitAlbumModeRef.current = normalizedMode;
        }
        setSheetMode('a4-album-landscape');
      } else if (next === 'portrait' && normalizedMode === 'a4-album-landscape') {
        setSheetMode(lastPortraitAlbumModeRef.current);
      }
    }
  };

  const handleRunExport = async (showCropMarks: boolean, schoolVisuals?: SchoolPrintVisualUrls) => {
    if (busy || (isZipMode ? activeEntries.length === 0 : pages.length === 0)) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setJobProgress({ completed: 0, total: Math.max(1, activeEntries.length), label: 'Çıktı motoru hazırlanıyor…' });
    try {
      const summary = await runPrintCenterExport({
        schoolName,
        scopeLabel,
        singleBranchScope: Boolean(scopeData.validScopeClass),
        entries: activeEntries,
        pages,
        productId,
        sheetMode: normalizedMode,
        albumConfig: db.albumConfig,
        schoolVisuals,
        showCropMarks,
        copies,
        duplex,
        scaleMode,
        exportFormat: effectiveExportFormat,
        signal: controller.signal,
        onProgress: setJobProgress,
      });
      const outPages = effectiveExportFormat === 'jpg' ? summary.pageCount : summary.pageCount * copies;
      const pageUnit = effectiveExportFormat === 'jpg' ? (outPages === 1 ? 'JPG' : 'JPG sayfa') : 'sayfa';
      setLastBanner({
        headline: `Son çıktı: ${summary.writeResult.displayPath}`,
        detail: `${summary.exportedStudents} kayıt${summary.pageCount > 0 ? ` · ${outPages} ${pageUnit}` : ''}${summary.minEffectiveDpi !== null ? ` · Min ${summary.minEffectiveDpi} DPI` : ''}`,
        lowDpiWarnings: summary.lowDpiWarnings,
      });
      notifyStudio(`${summary.exportedStudents} kayıt hazırlandı: ${summary.writeResult.displayPath}`, 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    } finally {
      abortRef.current = null;
      setJobProgress(null);
    }
  };

  const handleDirectPrint = async (showCropMarks: boolean, schoolVisuals?: SchoolPrintVisualUrls) => {
    if (busy || isZipMode || pages.length === 0 || !selectedPrinter) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setJobProgress({ completed: 0, total: Math.max(1, activeEntries.length), label: 'Yazıcı kuyruğu hazırlanıyor…' });
    try {
      const summary = await runDirectPrinterJob({
        printerName: selectedPrinter,
        copies,
        orientation,
        duplex,
        scaleMode,
        schoolName,
        scopeLabel,
        pages,
        productId,
        sheetMode: normalizedMode,
        albumConfig: db.albumConfig,
        schoolVisuals,
        showCropMarks,
        signal: controller.signal,
        onProgress: setJobProgress,
      });
      setLastBanner({
        headline: `Yazıcıya iletildi: ${summary.dispatchResult.printerName}`,
        detail: `${summary.dispatchResult.spooledPages} toplam sayfa (${summary.pageCount} kalıp × ${summary.dispatchResult.copies} kopya)`,
        lowDpiWarnings: summary.lowDpiWarnings,
      });
      notifyStudio(
        `${summary.dispatchResult.printerName} kuyruğuna ${summary.dispatchResult.spooledPages} sayfa gönderildi.`,
        'success',
      );
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    } finally {
      abortRef.current = null;
      setJobProgress(null);
    }
  };

  return {
    db, scopeData, productId, portraitVariant, normalizedMode, isZipMode,
    approvalFilter, activeEntries, pages, scopeLabel, schoolName,
    printers, selectedPrinter, loadingPrinters,
    copies, orientation, duplex, scaleMode, exportFormat, effectiveExportFormat,
    jobProgress, lastBanner, busy,
    setScopeClassId, setPortraitVariant, setProductId, setApprovalFilter,
    setSelectedPrinter, setCopies, setOrientation: changeOrientation, setDuplex, setScaleMode, setExportFormat,
    applySheetMode,
    selectProduct: (next: PrintProductId) => {
      setProductId(next);
      applySheetMode(defaultSheetModeForProduct(next));
      if (next === 'pvc-id-card') {
        setDuplex(db.albumConfig.pvcPrintSides === 'front-and-back' ? 'vertical' : 'simplex');
      }
    },
    refreshPrinters,
    abortActiveJob: () => abortRef.current?.abort(),
    handleExportCsv: () => savePrintManifestCsv(db, schoolName),
    handleRunExport,
    handleDirectPrint,
  };
}
