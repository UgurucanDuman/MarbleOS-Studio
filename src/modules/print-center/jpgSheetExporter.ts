import { strToU8, zipSync, type Zippable } from 'fflate';
import { usesDesktopStorage } from '../../system/desktop/desktopStorage';
import {
  sanitizeExportFileStem,
  saveStudioExportFile,
  saveStudioExportFolder,
  type ExportFolderFileEntry,
  type StudioExportWriteResult,
} from '../../system/desktop/exportFileWriter';
import { PRINT_DPI, sha256HexBytes, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { PRINT_PRODUCTS, type ImpositionPage, type PrintProductId, type PrintSheetMode } from './printSpecs';
import type { PrintExportProgress } from './zipPortraitExporter';

/**
 * İZOLE MODÜL 04 SAYFA JPG ÇIKTI MOTORU:
 * Vesikalık (45×60) ve Biyometrik (50×60) A4 / 10×15 cm baskı kalıplarını 300 DPI JFIF JPG olarak yazar.
 * Masaüstünde ve modern tarayıcıda doğrudan hazır klasör (ZIP olmadan) + SHA-256 manifest olarak kaydeder.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export type PortraitExportFormat = 'pdf' | 'jpg';

export async function exportRasterPagesAsJpg(options: {
  schoolName: string;
  scopeLabel: string;
  singleBranchScope: boolean;
  productId: Exclude<PrintProductId, 'e-okul-zip'>;
  sheetMode: Exclude<PrintSheetMode, 'single-zip'>;
  sheetSlug: string;
  pages: readonly ImpositionPage[];
  pdfPages: readonly PdfRasterPage[];
  onProgress?: (progress: PrintExportProgress) => void;
}): Promise<StudioExportWriteResult> {
  const {
    schoolName,
    scopeLabel,
    singleBranchScope,
    productId,
    sheetMode,
    sheetSlug,
    pages,
    pdfPages,
    onProgress,
  } = options;
  if (pdfPages.length === 0) {
    throw new Error('JPG çıktısı oluşturmak için en az 1 dizgi sayfası gereklidir.');
  }
  const product = PRINT_PRODUCTS[productId];
  const schoolSlug = sanitizeExportFileStem(schoolName, 'okul').slice(0, 36);
  const scopeSlug = sanitizeExportFileStem(scopeLabel, 'tum_okul').slice(0, 28);

  if (pdfPages.length === 1 && !usesDesktopStorage) {
    const firstPage = pages[0];
    const firstEntry = sheetMode === '10x15-4up-student' ? firstPage?.slots[0]?.entry : undefined;
    const singleFileName = firstEntry
      ? `${schoolSlug}_${sanitizeExportFileStem(firstEntry.student.studentNumber, '1').slice(0, 16)}_${sanitizeExportFileStem(`${firstEntry.student.firstName}_${firstEntry.student.lastName}`, 'ogrenci').slice(0, 32)}_${product.id}_10x15_300dpi.jpg`
      : `${schoolSlug}_${scopeSlug}_${product.id}_${sheetSlug}_300dpi.jpg`;
    onProgress?.({ completed: 1, total: 1, label: '300 DPI JPG kaydediliyor…' });
    return saveStudioExportFile({
      subfolder: product.subfolder,
      fileName: singleFileName,
      bytes: pdfPages[0]!.jpegBytes,
      mimeType: 'image/jpeg',
    });
  }

  const folderFiles: ExportFolderFileEntry[] = [];
  const usedPaths = new Set<string>();
  const manifestItems: Array<{
    pageNumber: number;
    archivePath: string;
    widthMm: number;
    heightMm: number;
    pixelSize: string;
    byteLength: number;
    sha256: string;
  }> = [];

  for (let idx = 0; idx < pdfPages.length; idx += 1) {
    const raster = pdfPages[idx]!;
    const srcPage = pages[idx];
    let relPath: string;

    if (sheetMode === '10x15-4up-student' && srcPage?.slots[0]?.entry) {
      const item = srcPage.slots[0].entry;
      const branchDir = sanitizeExportFileStem(item.className || 'Sube', 'Sube').slice(0, 28);
      const numSlug = sanitizeExportFileStem(item.student.studentNumber, String(idx + 1)).slice(0, 16);
      const nameSlug = sanitizeExportFileStem(`${item.student.firstName}_${item.student.lastName}`, 'ogrenci').slice(0, 36);
      const prefix = singleBranchScope ? '' : `${branchDir}/`;
      const stem = `${numSlug}_${nameSlug}_10x15`;
      relPath = `${prefix}${stem}.jpg`;
      let dup = 2;
      while (usedPaths.has(relPath.toLowerCase())) {
        relPath = `${prefix}${stem}_${dup}.jpg`;
        dup += 1;
      }
    } else {
      relPath = `sayfa_${String(idx + 1).padStart(2, '0')}.jpg`;
    }

    usedPaths.add(relPath.toLowerCase());
    folderFiles.push({ relativePath: relPath, bytes: raster.jpegBytes });
    manifestItems.push({
      pageNumber: idx + 1,
      archivePath: relPath,
      widthMm: raster.widthMm,
      heightMm: raster.heightMm,
      pixelSize: `${raster.pixelWidth}x${raster.pixelHeight}`,
      byteLength: raster.jpegBytes.byteLength,
      sha256: await sha256HexBytes(raster.jpegBytes),
    });
  }

  const manifestJson = JSON.stringify(
    {
      generator: 'MarbleOS Studio Local Print Engine',
      createdAt: new Date().toISOString(),
      format: 'image/jpeg',
      dpi: PRINT_DPI,
      schoolName,
      scope: scopeLabel,
      product: product.id,
      sheetMode,
      pageCount: manifestItems.length,
      pages: manifestItems,
    },
    null,
    2,
  );
  folderFiles.push({ relativePath: '_rapor/manifest.json', bytes: strToU8(manifestJson) });
  const folderName = `${schoolSlug}_${scopeSlug}_${product.id}_${sheetSlug}_300dpi_jpg`;

  onProgress?.({ completed: 0, total: folderFiles.length, label: '300 DPI JPG klasörü hazırlanıyor…' });
  const folderSaved = await saveStudioExportFolder({
    subfolder: product.subfolder,
    folderName,
    files: folderFiles,
    openAfterSave: true,
    onFileProgress: (done, total) =>
      onProgress?.({ completed: done, total, label: `JPG klasöre yazılıyor (${done}/${total})…` }),
  });
  if (folderSaved) return folderSaved;

  onProgress?.({ completed: 1, total: 1, label: '300 DPI JPG paketi kaydediliyor…' });
  const zipEntries: Zippable = {};
  for (const item of folderFiles) {
    zipEntries[item.relativePath] = [item.bytes, { level: item.relativePath.endsWith('.jpg') ? 0 : 6 }];
  }
  const zipBytes = zipSync(zipEntries);
  return saveStudioExportFile({
    subfolder: product.subfolder,
    fileName: `${folderName}.zip`,
    bytes: zipBytes,
    mimeType: 'application/zip',
  });
}
