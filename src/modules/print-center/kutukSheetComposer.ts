import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { PRINT_DPI, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { canvasToJpegBytes } from '../../system/storage/portraitPrintRenderer';
import { decodeImageUrlToCanvas } from '../../system/storage/printImageDecode';
import { resolveTeacherChartConfig } from '../../system/storage/teacher-charts/paginationMath';
import { paintKutukCoverSheet } from '../../system/storage/yearbook-kutuk/drawKutukCoverCanvas';
import { paintKutukClassSheet } from '../../system/storage/yearbook-kutuk/drawKutukSheetCanvas';
import type { ImpositionPage } from './printSpecs';
import { drawCalibrationRuler } from './sheetComposer';

/**
 * İZOLE MODÜL 04 KÜTÜK DOSYASI 300 DPI TUVAL BESTECİSİ:
 * Müdür Yardımcısı Kütük Sayfalarını ve Ön Kapak Sayfasını 300 DPI JPEG/PDF katmanına işler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

import type { PvcStudioBrandInfo } from '../../system/storage/pvc-cards/types';

export interface SchoolPrintVisualUrls {
  logoUrl?: string;
  studioLogoUrl?: string;
  principalSigUrl?: string;
  deputySigUrl?: string;
  coverUrl?: string;
  schoolAddress?: string;
  institutionCode?: string;
  studio?: PvcStudioBrandInfo;
}

export interface DecodedSchoolPrintVisuals {
  logoBitmap: HTMLCanvasElement | null;
  studioLogoBitmap?: HTMLCanvasElement | null;
  principalSigBitmap: HTMLCanvasElement | null;
  deputySigBitmap: HTMLCanvasElement | null;
  coverBitmap: HTMLCanvasElement | null;
  customCoverBitmap: HTMLCanvasElement | null;
  pvcFrontBgBitmap?: HTMLCanvasElement | null;
  pvcBackBgBitmap?: HTMLCanvasElement | null;
  pvcElementBitmaps?: Map<string, HTMLCanvasElement>;
}

export async function prepareDecodedSchoolVisuals(
  schoolVisuals: SchoolPrintVisualUrls | undefined,
  customCoverDataUrl: string | undefined,
  pvcFrontBgUrl?: string,
  pvcBackBgUrl?: string,
  pvcElementImageEntries?: ReadonlyArray<{ id: string; url: string }>,
): Promise<DecodedSchoolPrintVisuals> {
  const [
    logoBitmap,
    studioLogoBitmap,
    principalSigBitmap,
    deputySigBitmap,
    coverBitmap,
    customCoverBitmap,
    pvcFrontBgBitmap,
    pvcBackBgBitmap,
  ] = await Promise.all([
    decodeImageUrlToCanvas(schoolVisuals?.logoUrl),
    decodeImageUrlToCanvas(schoolVisuals?.studioLogoUrl),
    decodeImageUrlToCanvas(schoolVisuals?.principalSigUrl),
    decodeImageUrlToCanvas(schoolVisuals?.deputySigUrl),
    decodeImageUrlToCanvas(schoolVisuals?.coverUrl),
    decodeImageUrlToCanvas(customCoverDataUrl),
    decodeImageUrlToCanvas(pvcFrontBgUrl),
    decodeImageUrlToCanvas(pvcBackBgUrl),
  ]);
  const pvcElementBitmaps = new Map<string, HTMLCanvasElement>();
  if (pvcElementImageEntries && pvcElementImageEntries.length > 0) {
    const decoded = await Promise.all(
      pvcElementImageEntries.map(async (item) => ({
        id: item.id,
        bmp: await decodeImageUrlToCanvas(item.url),
      })),
    );
    for (const item of decoded) {
      if (item.bmp) pvcElementBitmaps.set(item.id, item.bmp);
    }
  }
  return {
    logoBitmap,
    studioLogoBitmap,
    principalSigBitmap,
    deputySigBitmap,
    coverBitmap,
    customCoverBitmap,
    pvcFrontBgBitmap,
    pvcBackBgBitmap,
    pvcElementBitmaps,
  };
}

export async function renderKutukPageToPdfRaster(options: {
  page: ImpositionPage;
  totalPages: number;
  schoolName: string;
  albumConfig: AlbumTemplateConfig;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  decodedVisuals: DecodedSchoolPrintVisuals;
  showCropMarks?: boolean;
  sheetCanvas?: HTMLCanvasElement;
}): Promise<PdfRasterPage> {
  const {
    page,
    totalPages,
    schoolName,
    albumConfig,
    renderedPortraits,
    decodedVisuals,
    showCropMarks = false,
    sheetCanvas,
  } = options;
  const kutukPage = page.kutukPage;
  if (!kutukPage) {
    throw new Error('Kütük sayfa planı bulunamadı.');
  }

  const canvas = sheetCanvas ?? document.createElement('canvas');
  if (canvas.width !== page.widthPx || canvas.height !== page.heightPx) {
    canvas.width = page.widthPx;
    canvas.height = page.heightPx;
  }
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Kütük sayfası tuvali başlatılamadı.');

  const { palette } = resolveTeacherChartConfig(albumConfig, kutukPage.className);
  const { logoBitmap, principalSigBitmap, deputySigBitmap, coverBitmap, customCoverBitmap } =
    decodedVisuals;

  if (kutukPage.pageKind === 'cover') {
    const isCustomHero = Boolean(customCoverBitmap);
    const heroBitmap = customCoverBitmap ?? coverBitmap;
    paintKutukCoverSheet({
      ctx,
      widthPx: canvas.width,
      heightPx: canvas.height,
      page: kutukPage,
      palette,
      schoolName,
      coverTitle: albumConfig.coverTitle,
      coverSubtitle: albumConfig.coverSubtitle,
      customCoverMode: albumConfig.customCoverMode,
      isCustomHero,
      logoBitmap,
      heroBitmap,
      principalSigBitmap,
      deputySigBitmap,
    });
  } else {
    paintKutukClassSheet({
      ctx,
      widthPx: canvas.width,
      heightPx: canvas.height,
      page: kutukPage,
      palette,
      schoolName,
      headerTitle: albumConfig.headerTitle,
      nameBoxStyle: albumConfig.kutukNameBoxStyle,
      photoFrame: albumConfig.kutukPhotoFrame,
      frameColor: albumConfig.kutukFrameColor,
      showStudentNumbers: albumConfig.showStudentNumbers,
      showTeacherBadge: albumConfig.showTeacherBadge,
      showHeader: albumConfig.kutukShowHeader ?? true,
      showSubtitle: albumConfig.kutukShowSubtitle ?? true,
      showStaffPortraits: albumConfig.kutukShowStaffPortraits ?? true,
      showTeacherSig: albumConfig.kutukShowTeacherSig ?? true,
      showDeputySig: albumConfig.kutukShowDeputySig ?? true,
      showPrincipalSig: albumConfig.kutukShowPrincipalSig ?? true,
      showPageNumber: albumConfig.kutukShowPageNumber ?? true,
      printFontPt: albumConfig.printFontPt,
      pageNumber: page.pageIndex + 1,
      totalPages,
      renderedPortraits,
      logoBitmap,
      principalSigBitmap,
      deputySigBitmap,
    });
  }

  if (showCropMarks) {
    drawCalibrationRuler(ctx, canvas.width, canvas.height, page.rulerLengthMm, false);
  }
  const jpegBytes = await canvasToJpegBytes(canvas, 0.95, PRINT_DPI);
  return {
    jpegBytes,
    pixelWidth: page.widthPx,
    pixelHeight: page.heightPx,
    widthMm: page.widthMm,
    heightMm: page.heightMm,
  };
}
