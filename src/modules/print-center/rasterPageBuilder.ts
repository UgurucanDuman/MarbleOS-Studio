import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { PRINT_DPI, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { renderPortraitAtPhysicalSpec } from '../../system/storage/portraitPrintRenderer';
import { resolvePvcCardDesign } from '../../system/storage/pvc-cards/catalog';
import { resolveTeacherChartConfig } from '../../system/storage/teacher-charts/paginationMath';
import { renderAlbumChartPageToPdfRaster } from './albumSheetComposer';
import { renderIdCardPageToPdfRaster } from './idCardSheetComposer';
import {
  prepareDecodedSchoolVisuals,
  renderKutukPageToPdfRaster,
  type SchoolPrintVisualUrls,
} from './kutukSheetComposer';
import { renderStudentListPage } from './paintStudentList';
import {
  PRINT_PRODUCTS,
  type ImpositionPage,
  type PrintableStudentEntry,
  type PrintProductId,
} from './printSpecs';
import { renderImpositionPageToPdfRaster } from './sheetComposer';
import {
  throwIfPrintJobAborted,
  type LowDpiPortraitWarning,
  type PrintExportProgress,
} from './zipPortraitExporter';

/**
 * İZOLE MODÜL 04 RASTER SAYFA ÜRETİCİSİ:
 * 300 DPI benzersiz portreleri bir kez işler ve Portre / CR80 Kimlik / Albüm Panosu sayfalarını birleştirir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export async function buildPrintCenterRasterPages(options: {
  schoolName: string;
  scopeLabel: string;
  pages: readonly ImpositionPage[];
  productId: Exclude<PrintProductId, 'e-okul-zip'>;
  albumConfig: AlbumTemplateConfig;
  schoolVisuals?: SchoolPrintVisualUrls;
  showCropMarks: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: PrintExportProgress) => void;
}): Promise<{
  pdfPages: PdfRasterPage[];
  pageCount: number;
  minEffectiveDpi: number | null;
  lowDpiWarnings: LowDpiPortraitWarning[];
}> {
  const {
    schoolName,
    scopeLabel,
    pages,
    productId,
    albumConfig,
    schoolVisuals,
    showCropMarks,
    signal,
    onProgress,
  } = options;
  const product = PRINT_PRODUCTS[productId];
  const lowDpiWarnings: LowDpiPortraitWarning[] = [];
  let minEffectiveDpi: number | null = null;

  const uniqueEntries = new Map<string, PrintableStudentEntry>();
  for (const page of pages) {
    for (const { entry } of page.slots) {
      if (!uniqueEntries.has(entry.photo.id)) uniqueEntries.set(entry.photo.id, entry);
    }
    for (const entry of page.rosterEntries ?? []) {
      if (!uniqueEntries.has(entry.photo.id)) uniqueEntries.set(entry.photo.id, entry);
    }
  }
  const uniqueList = [...uniqueEntries.values()];
  const totalSteps = uniqueList.length + pages.length;

  const renderedPortraits = new Map<string, HTMLCanvasElement>();
  let step = 0;
  for (const item of uniqueList) {
    throwIfPrintJobAborted(signal);
    onProgress?.({
      completed: step,
      total: totalSteps,
      label: `300 DPI portre hazırlanıyor: ${item.student.studentNumber} ${item.student.firstName}`,
    });
    const portraitCanvas = document.createElement('canvas');
    const rendered = await renderPortraitAtPhysicalSpec({
      photo: item.photo,
      targetWidthPx: product.widthPx,
      targetHeightPx: product.heightPx,
      physicalWidthMm: product.portraitWidthMm,
      dpi: PRINT_DPI,
      workCanvas: portraitCanvas,
      biometricIcao: productId === 'biometric-50x60',
    });
    renderedPortraits.set(item.photo.id, portraitCanvas);
    if (minEffectiveDpi === null || rendered.effectiveDpi < minEffectiveDpi) {
      minEffectiveDpi = rendered.effectiveDpi;
    }
    if (rendered.effectiveDpi < 240) {
      lowDpiWarnings.push({
        studentNumber: item.student.studentNumber,
        fullName: `${item.student.firstName} ${item.student.lastName}`,
        className: item.className,
        effectiveDpi: rendered.effectiveDpi,
      });
    }
    step += 1;
  }

  const hasKutukPages = pages.some((p) => p.kind === 'kutuk-sheet');
  const hasIdCardPages = pages.some((p) => p.kind === 'id-card-sheet');
  const pvcDesignForDecode = hasIdCardPages ? resolvePvcCardDesign(albumConfig) : null;
  const pvcElementImages = pvcDesignForDecode
    ? [...pvcDesignForDecode.front.elements, ...pvcDesignForDecode.back.elements]
      .filter((el) => el.kind === 'image' && Boolean(el.imageDataUrl))
      .map((el) => ({ id: el.id, url: el.imageDataUrl! }))
    : undefined;
  const decodedVisuals =
    hasKutukPages || hasIdCardPages
      ? await prepareDecodedSchoolVisuals(
        schoolVisuals,
        hasKutukPages ? albumConfig.customCoverDataUrl : undefined,
        pvcDesignForDecode?.front.backgroundDataUrl,
        pvcDesignForDecode?.back.backgroundDataUrl,
        pvcElementImages,
      )
      : null;

  const sheetCanvas = document.createElement('canvas');
  const pdfPages: PdfRasterPage[] = [];
  for (const page of pages) {
    throwIfPrintJobAborted(signal);
    onProgress?.({
      completed: step,
      total: totalSteps,
      label: `Baskı sayfası hazırlanıyor (${page.pageIndex + 1} / ${pages.length})…`,
    });
    if (page.kind === 'student-list') {
      const { palette } = resolveTeacherChartConfig(albumConfig);
      pdfPages.push(await renderStudentListPage(sheetCanvas, page, schoolName, palette, albumConfig.printFontPt));
    } else if (page.kind === 'id-card-sheet') {
      pdfPages.push(
        await renderIdCardPageToPdfRaster({
          page,
          totalPages: pages.length,
          schoolName,
          albumConfig,
          schoolVisuals,
          decodedVisuals,
          renderedPortraits,
          showCropMarks,
          sheetCanvas,
        }),
      );
    } else if (page.kind === 'kutuk-sheet' && decodedVisuals) {
      pdfPages.push(
        await renderKutukPageToPdfRaster({
          page,
          totalPages: pages.length,
          schoolName,
          albumConfig,
          renderedPortraits,
          decodedVisuals,
          showCropMarks,
          sheetCanvas,
        }),
      );
    } else if (page.kind === 'album-sheet') {
      pdfPages.push(
        await renderAlbumChartPageToPdfRaster({
          page,
          totalPages: pages.length,
          schoolName,
          albumConfig,
          renderedPortraits,
          showCropMarks,
          sheetCanvas,
        }),
      );
    } else {
      pdfPages.push(
        await renderImpositionPageToPdfRaster({
          page,
          totalPages: pages.length,
          schoolName,
          specLabel: `${scopeLabel} · ${product.shortLabel}`,
          renderedPortraits,
          showCropMarks,
          sheetCanvas,
        }),
      );
    }
    step += 1;
  }

  renderedPortraits.clear();
  return { pdfPages, pageCount: pages.length, minEffectiveDpi, lowDpiWarnings };
}

