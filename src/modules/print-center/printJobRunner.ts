import {
  submitStudioPrintJob,
  type PrintDuplexMode,
  type PrintOrientation,
  type PrintScaleMode,
  type StudioPrintDispatchResult,
} from '../../system/desktop/desktopPrinter';
import { sanitizeExportFileStem, saveStudioExportFile } from '../../system/desktop/exportFileWriter';
import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { buildPhysicalPdfFromJpegs } from '../../system/storage/binaryPrintFormats';
import { exportRasterPagesAsJpg, type PortraitExportFormat } from './jpgSheetExporter';
import type { SchoolPrintVisualUrls } from './kutukSheetComposer';
import {
  normalizeSheetModeForProduct,
  PRINT_PRODUCTS,
  type ImpositionPage,
  type PrintableStudentEntry,
  type PrintProductId,
  type PrintSheetMode,
} from './printSpecs';
import { buildPrintCenterRasterPages } from './rasterPageBuilder';
import {
  runZipPortraitExport,
  throwIfPrintJobAborted,
  type LowDpiPortraitWarning,
  type PrintExportProgress,
  type PrintExportSummary,
} from './zipPortraitExporter';

export type { PortraitExportFormat } from './jpgSheetExporter';
export type { LowDpiPortraitWarning, PrintExportProgress, PrintExportSummary } from './zipPortraitExporter';

/**
 * İZOLE MODÜL 04 ÇIKTI VE YAZICI KOORDİNATÖRÜ:
 * 300 DPI PDF/ZIP Kayıt ve Doğrudan Windows Yazıcı Kuyruğu İş Yöneticisi
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PrintDirectSummary {
  dispatchResult: StudioPrintDispatchResult;
  exportedStudents: number;
  pageCount: number;
  minEffectiveDpi: number | null;
  lowDpiWarnings: LowDpiPortraitWarning[];
}

function sheetModeFileSlug(sheetMode: Exclude<PrintSheetMode, 'single-zip'>): string {
  switch (sheetMode) {
    case 'a4-grid':
      return 'A4_dizgi';
    case '10x15-4up-student':
      return '10x15_kisi_karti';
    case '10x15-grid':
      return '10x15_dizgi';
    case 'cr80-single':
      return 'CR80_tekli_kart';
    case 'a4-id-8up':
      return 'A4_kimlik_tabakasi';
    case 'a4-album-portrait':
      return 'A4_dikey_pano';
    case 'a4-kutuk-portrait':
      return 'A4_dikey_kutuk';
    case 'a4-album-landscape':
      return 'A4_yatay_kutuk';
    case 'a4-student-list':
      return 'A4_ogrenci_sira_listesi';
  }
}

export async function runPrintCenterExport(options: {
  schoolName: string;
  scopeLabel: string;
  singleBranchScope: boolean;
  entries: readonly PrintableStudentEntry[];
  pages: readonly ImpositionPage[];
  productId: PrintProductId;
  sheetMode: PrintSheetMode;
  albumConfig: AlbumTemplateConfig;
  schoolVisuals?: SchoolPrintVisualUrls;
  showCropMarks?: boolean;
  copies?: number;
  duplex?: PrintDuplexMode;
  scaleMode?: PrintScaleMode;
  exportFormat?: PortraitExportFormat;
  signal?: AbortSignal;
  onProgress?: (progress: PrintExportProgress) => void;
}): Promise<PrintExportSummary> {
  const {
    schoolName, scopeLabel, singleBranchScope, entries, pages, productId,
    sheetMode: rawMode, albumConfig, schoolVisuals, showCropMarks = true,
    copies = 1, duplex = 'simplex', scaleMode = 'actual-100',
    exportFormat = 'pdf', signal, onProgress,
  } = options;
  const sheetMode = normalizeSheetModeForProduct(productId, rawMode);
  if (productId === 'e-okul-zip' || sheetMode === 'single-zip') {
    return runZipPortraitExport({
      schoolName, scopeLabel, singleBranchScope, entries, productId, signal, onProgress,
    });
  }
  if (!pages.length) throw new Error('Çıktı alınacak sayfa bulunamadı.');

  const product = PRINT_PRODUCTS[productId];
  const { pdfPages, pageCount, minEffectiveDpi, lowDpiWarnings } = await buildPrintCenterRasterPages({
    schoolName, scopeLabel, pages, productId, albumConfig, schoolVisuals, showCropMarks, signal, onProgress,
  });

  throwIfPrintJobAborted(signal);
  const isPortraitJpg =
    exportFormat === 'jpg' && (productId === 'vesikalik-45x60' || productId === 'biometric-50x60');
  const writeResult = isPortraitJpg
    ? await exportRasterPagesAsJpg({
        schoolName, scopeLabel, singleBranchScope, productId, sheetMode,
        sheetSlug: sheetModeFileSlug(sheetMode), pages, pdfPages, onProgress,
      })
    : await (async () => {
        onProgress?.({ completed: 1, total: 1, label: '300 DPI PDF kaydediliyor…' });
        const pdfBytes = buildPhysicalPdfFromJpegs(pdfPages, {
          title: `${schoolName} ${scopeLabel} ${product.shortLabel}`,
          scaleMode, duplex, copies,
        });
        return saveStudioExportFile({
          subfolder: product.subfolder,
          fileName: `${sanitizeExportFileStem(schoolName, 'okul')}_${sanitizeExportFileStem(scopeLabel, 'tum_okul')}_${product.id}_${sheetModeFileSlug(sheetMode)}_300dpi.pdf`,
          bytes: pdfBytes,
          mimeType: 'application/pdf',
        });
      })();
  const exportedStudents = sheetMode === 'a4-student-list'
    ? pages.reduce((count, page) => count + (page.studentListRows?.length ?? 0), 0)
    : entries.length;
  return { writeResult, exportedStudents, pageCount, minEffectiveDpi, lowDpiWarnings };
}

export async function runDirectPrinterJob(options: {
  printerName: string;
  copies: number;
  orientation: PrintOrientation;
  duplex: PrintDuplexMode;
  scaleMode: PrintScaleMode;
  schoolName: string;
  scopeLabel: string;
  pages: readonly ImpositionPage[];
  productId: PrintProductId;
  sheetMode: PrintSheetMode;
  albumConfig: AlbumTemplateConfig;
  schoolVisuals?: SchoolPrintVisualUrls;
  showCropMarks?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: PrintExportProgress) => void;
}): Promise<PrintDirectSummary> {
  const {
    printerName,
    copies,
    orientation,
    duplex,
    scaleMode,
    schoolName,
    scopeLabel,
    pages,
    productId,
    sheetMode: rawMode,
    albumConfig,
    schoolVisuals,
    showCropMarks = true,
    signal,
    onProgress,
  } = options;
  const sheetMode = normalizeSheetModeForProduct(productId, rawMode);
  if (!pages.length) throw new Error('Yazdırılacak sayfa bulunamadı.');
  if (productId === 'e-okul-zip' || sheetMode === 'single-zip') {
    throw new Error('ZIP arşiv paketleri doğrudan yazıcıya gönderilemez; kâğıt dizgisi seçin veya ZIP olarak kaydedin.');
  }

  const product = PRINT_PRODUCTS[productId];
  const { pdfPages, pageCount, minEffectiveDpi, lowDpiWarnings } = await buildPrintCenterRasterPages({
    schoolName,
    scopeLabel,
    pages,
    productId,
    albumConfig,
    schoolVisuals,
    showCropMarks,
    signal,
    onProgress,
  });

  throwIfPrintJobAborted(signal);
  onProgress?.({ completed: 1, total: 1, label: `Yazıcıya gönderiliyor: ${printerName}…` });
  const dispatchResult = await submitStudioPrintJob({
    printerName,
    jobTitle: `${schoolName} - ${scopeLabel} - ${product.shortLabel}`,
    copies,
    orientation,
    duplex,
    scaleMode,
    pages: pdfPages.map((p) => ({
      jpegBytes: p.jpegBytes,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
    })),
  });

  return { dispatchResult, exportedStudents: minEffectiveDpi === null
    ? pages.reduce((count, page) => count + (page.studentListRows?.length ?? 0), 0)
    : new Set(pages.flatMap((page) => page.slots.map(({ entry }) => entry.student.id))).size,
    pageCount, minEffectiveDpi, lowDpiWarnings };
}
