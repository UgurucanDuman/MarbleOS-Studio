import { strToU8, zipSync, type Zippable } from 'fflate';
import { usesDesktopStorage } from '../../system/desktop/desktopStorage';
import {
  sanitizeExportFileStem,
  saveStudioExportFile,
  saveStudioExportFolder,
  type ExportFolderFileEntry,
  type StudioExportWriteResult,
} from '../../system/desktop/exportFileWriter';
import { sha256HexBytes } from '../../system/storage/binaryPrintFormats';
import { renderPortraitAtPhysicalSpec } from '../../system/storage/portraitPrintRenderer';
import { escapeCsvCell } from './printManifest';
import { PRINT_PRODUCTS, type PrintableStudentEntry, type PrintProductId } from './printSpecs';

/**
 * İZOLE MODÜL 04 ZIP ARŞİV ÜRETİCİSİ: MEB e-Okul (.zip) ve Tekil 300 DPI Kesilmiş Kare (.zip)
 * Tek çalışma tuvalini ardışık kullanarak yüzlerce portreyi SHA-256 manifest ile paketler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PrintExportProgress {
  completed: number;
  total: number;
  label: string;
}

export interface LowDpiPortraitWarning {
  studentNumber: string;
  fullName: string;
  className: string;
  effectiveDpi: number;
}

export interface PrintExportSummary {
  writeResult: StudioExportWriteResult;
  exportedStudents: number;
  pageCount: number;
  minEffectiveDpi: number | null;
  lowDpiWarnings: LowDpiPortraitWarning[];
}

export function throwIfPrintJobAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Çıktı hazırlama işlemi kullanıcı tarafından durduruldu.');
  }
}

function buildEntriesCsv(
  entries: readonly PrintableStudentEntry[],
  dpiByPhotoId: ReadonlyMap<string, number>,
): string {
  const header = 'Sinif;OkulNo;Ad;Soyad;KaynakDosya;OnayDurumu;EtkinDPI';
  const rows = entries.map(({ student, photo, className }) =>
    [
      className || '-',
      student.studentNumber,
      student.firstName,
      student.lastName,
      photo.fileName,
      student.printReady ? 'ONAYLI' : 'BEKLEMEDE',
      String(dpiByPhotoId.get(photo.id) ?? '-'),
    ]
      .map(escapeCsvCell)
      .join(';'),
  );
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

export async function runZipPortraitExport(options: {
  schoolName: string;
  scopeLabel: string;
  singleBranchScope: boolean;
  entries: readonly PrintableStudentEntry[];
  productId: PrintProductId;
  signal?: AbortSignal;
  onProgress?: (progress: PrintExportProgress) => void;
}): Promise<PrintExportSummary> {
  const { schoolName, scopeLabel, singleBranchScope, entries, productId, signal, onProgress } = options;
  const product = PRINT_PRODUCTS[productId];
  const schoolSlug = sanitizeExportFileStem(schoolName, 'okul');
  const scopeSlug = sanitizeExportFileStem(scopeLabel, 'tum_okul');
  const folderFiles: ExportFolderFileEntry[] = [];
  const lowDpiWarnings: LowDpiPortraitWarning[] = [];
  const dpiByPhotoId = new Map<string, number>();
  let minEffectiveDpi: number | null = null;

  const manifestItems: Array<{
    className: string;
    studentNumber: string;
    name: string;
    archivePath: string;
    byteLength: number;
    sha256: string;
    effectiveDpi: number;
  }> = [];

  const workCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : undefined;
  const usedPaths = new Set<string>();

  for (let idx = 0; idx < entries.length; idx += 1) {
    throwIfPrintJobAborted(signal);
    const item = entries[idx]!;
    onProgress?.({
      completed: idx,
      total: entries.length,
      label: `${item.className} · ${item.student.studentNumber} ${item.student.firstName} işleniyor…`,
    });

    const rendered = await renderPortraitAtPhysicalSpec({
      photo: item.photo,
      targetWidthPx: product.widthPx,
      targetHeightPx: product.heightPx,
      physicalWidthMm: product.portraitWidthMm,
      dpi: product.dpi,
      maxFileBytes: product.maxFileBytes,
      workCanvas,
      biometricIcao: productId === 'biometric-50x60',
    });

    dpiByPhotoId.set(item.photo.id, rendered.effectiveDpi);
    if (minEffectiveDpi === null || rendered.effectiveDpi < minEffectiveDpi) {
      minEffectiveDpi = rendered.effectiveDpi;
    }
    if (productId !== 'e-okul-zip' && rendered.effectiveDpi < 240) {
      lowDpiWarnings.push({
        studentNumber: item.student.studentNumber,
        fullName: `${item.student.firstName} ${item.student.lastName}`,
        className: item.className,
        effectiveDpi: rendered.effectiveDpi,
      });
    }

    const branchDir = sanitizeExportFileStem(item.className || 'Sube', 'Sube');
    const numSlug = sanitizeExportFileStem(item.student.studentNumber, String(idx + 1));
    const baseStem =
      productId === 'e-okul-zip'
        ? numSlug
        : `${numSlug}_${sanitizeExportFileStem(`${item.student.firstName}_${item.student.lastName}`, 'ogrenci')}`;
    const prefix = singleBranchScope ? '' : `${branchDir}/`;
    let relPath = `${prefix}${baseStem}.jpg`;
    let dup = 2;
    while (usedPaths.has(relPath.toLowerCase())) {
      relPath = `${prefix}${baseStem}_${dup}.jpg`;
      dup += 1;
    }
    usedPaths.add(relPath.toLowerCase());

    folderFiles.push({ relativePath: relPath, bytes: rendered.jpegBytes });
    manifestItems.push({
      className: item.className,
      studentNumber: item.student.studentNumber,
      name: `${item.student.firstName} ${item.student.lastName}`,
      archivePath: relPath,
      byteLength: rendered.jpegBytes.byteLength,
      sha256: await sha256HexBytes(rendered.jpegBytes),
      effectiveDpi: rendered.effectiveDpi,
    });
  }

  throwIfPrintJobAborted(signal);
  const manifestJson = JSON.stringify(
    {
      generator: 'MarbleOS Studio Local Print Engine',
      createdAt: new Date().toISOString(),
      schoolName,
      scope: scopeLabel,
      product: product.id,
      pixelSize: `${product.widthPx}x${product.heightPx}`,
      dpi: product.dpi,
      count: manifestItems.length,
      items: manifestItems,
    },
    null,
    2,
  );
  folderFiles.push({ relativePath: '_rapor/manifest.json', bytes: strToU8(manifestJson) });
  folderFiles.push({ relativePath: '_rapor/kontrol_listesi.csv', bytes: strToU8(buildEntriesCsv(entries, dpiByPhotoId)) });

  const tag = productId === 'e-okul-zip' ? 'eokul_fotograflari' : `${product.id}_300dpi_kareler`;
  const folderName = `${schoolSlug}_${scopeSlug}_${tag}`;
  const preferFolder = usesDesktopStorage || productId !== 'e-okul-zip';

  if (preferFolder) {
    onProgress?.({ completed: 0, total: folderFiles.length, label: 'JPG klasörü diske yazılıyor…' });
    const folderResult = await saveStudioExportFolder({
      subfolder: product.subfolder,
      folderName,
      files: folderFiles,
      openAfterSave: true,
      onFileProgress: (done, total) =>
        onProgress?.({ completed: done, total, label: `JPG klasöre yazılıyor (${done}/${total})…` }),
    });
    if (folderResult) {
      return { writeResult: folderResult, exportedStudents: entries.length, pageCount: 0, minEffectiveDpi, lowDpiWarnings };
    }
  }

  onProgress?.({ completed: entries.length, total: entries.length, label: 'ZIP paketi diske yazılıyor…' });
  const zipEntries: Zippable = {};
  for (const item of folderFiles) {
    zipEntries[item.relativePath] = [item.bytes, { level: item.relativePath.endsWith('.jpg') ? 0 : 6 }];
  }
  const zipBytes = zipSync(zipEntries);
  const zipTag = productId === 'e-okul-zip' ? 'eokul_paketi' : `${product.id}_300dpi_kareler`;
  const writeResult = await saveStudioExportFile({
    subfolder: product.subfolder,
    fileName: `${schoolSlug}_${scopeSlug}_${zipTag}.zip`,
    bytes: zipBytes,
    mimeType: 'application/zip',
  });
  return { writeResult, exportedStudents: entries.length, pageCount: 0, minEffectiveDpi, lowDpiWarnings };
}
