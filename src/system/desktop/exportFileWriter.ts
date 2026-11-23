import { z } from 'zod';
import {
  exportFileNameSchema,
  exportFolderNameSchema,
  exportSubfolderSchema,
  managedDirTargetSchema,
  openDesktopExportFolder,
  openDesktopManagedDir,
  saveDesktopExportBase64,
  saveDesktopExportInFolder,
  usesDesktopStorage,
  type ExportSubfolder,
  type ManagedDirTarget,
} from './desktopStorage';

/**
 * İZOLE MASAÜSTÜ ÇIKTI YAZICISI:
 * Tauri masaüstünde dar kapsamlı `studio_save_export` komutuyla `%LOCALAPPDATA%\MarbleOS-Studio\exports\`
 * altına atomik yazar; tarayıcı önizlemesinde güvenli `Blob` indirme akışına düşer.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface StudioExportWriteResult {
  mode: 'desktop' | 'browser';
  displayPath: string;
  byteLength: number;
}

const ALLOWED_EXPORT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'application/zip',
  'text/csv;charset=utf-8;',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

const saveStudioExportInputSchema = z
  .object({
    subfolder: exportSubfolderSchema,
    fileName: exportFileNameSchema,
    bytes: z
      .custom<Uint8Array>((v): v is Uint8Array => v instanceof Uint8Array)
      .refine((b) => b.byteLength > 0 && b.byteLength <= 90_000_000, {
        message: 'Çıktı dosyası boş olamaz ve 90 MB sınırını aşamaz.',
      }),
    mimeType: z.enum(ALLOWED_EXPORT_MIMES),
  })
  .strict();

export function encodeBytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
    let chunk = '';
    for (let i = 0; i < slice.length; i += 1) {
      chunk += String.fromCharCode(slice[i]!);
    }
    parts.push(chunk);
  }
  return btoa(parts.join(''));
}

export function sanitizeExportFileStem(raw: string, fallback = 'cikti'): string {
  const normalized = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, '')
    .replace(/[/\\:*?"<>|]+/g, '-')
    .replace(/[^A-Za-z0-9._\-\u00C0-\u024F\s]+/gu, '-')
    .replace(/\.\.+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  if (!normalized) return fallback;
  const clipped = normalized.slice(0, 72).replace(/[-_.]+$/g, '') || fallback;
  return /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(clipped) ? `_${clipped}` : clipped;
}

export async function saveStudioExportFile(options: {
  subfolder: ExportSubfolder;
  fileName: string;
  bytes: Uint8Array;
  mimeType: (typeof ALLOWED_EXPORT_MIMES)[number];
}): Promise<StudioExportWriteResult> {
  const { subfolder, fileName, bytes, mimeType } = saveStudioExportInputSchema.parse(options);

  if (usesDesktopStorage) {
    const saved = await saveDesktopExportBase64(
      subfolder,
      fileName,
      encodeBytesToBase64(bytes),
    );
    return {
      mode: 'desktop',
      displayPath: saved.relativePath,
      byteLength: saved.byteLength,
    };
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    mode: 'browser',
    displayPath: fileName,
    byteLength: bytes.byteLength,
  };
}

export interface ExportFolderFileEntry {
  relativePath: string;
  bytes: Uint8Array;
}

interface WritableFileHandle {
  write: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}

interface DirectoryHandleLike {
  name?: string;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{ createWritable: () => Promise<WritableFileHandle> }>;
}

interface WindowWithWriteDirPicker {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandleLike>;
}

/**
 * Çoklu JPG çıktılarını `.zip` yerine doğrudan hazır Windows/tarayıcı klasörü olarak yazar.
 * Desteklenmeyen tarayıcı ortamlarında `null` döner (çağıran güvenli ZIP yedeğine düşer).
 */
export async function saveStudioExportFolder(options: {
  subfolder: ExportSubfolder;
  folderName: string;
  files: readonly ExportFolderFileEntry[];
  openAfterSave?: boolean;
  onFileProgress?: (completed: number, total: number) => void;
}): Promise<StudioExportWriteResult | null> {
  const subfolder = exportSubfolderSchema.parse(options.subfolder);
  const folderName = exportFolderNameSchema.parse(options.folderName);
  if (!options.files.length) throw new Error('Klasöre yazılacak dosya bulunamadı.');

  if (usesDesktopStorage) {
    let totalBytes = 0;
    for (let i = 0; i < options.files.length; i += 1) {
      const entry = options.files[i]!;
      const saved = await saveDesktopExportInFolder(
        subfolder,
        folderName,
        entry.relativePath,
        encodeBytesToBase64(entry.bytes),
      );
      totalBytes += saved.byteLength;
      options.onFileProgress?.(i + 1, options.files.length);
    }
    if (options.openAfterSave !== false) {
      await openDesktopExportFolder(subfolder, folderName).catch(() => {});
    }
    return {
      mode: 'desktop',
      displayPath: `exports/${subfolder}/${folderName}`,
      byteLength: totalBytes,
    };
  }

  const picker = typeof window !== 'undefined'
    ? (window as unknown as WindowWithWriteDirPicker).showDirectoryPicker
    : undefined;
  if (typeof picker !== 'function') return null;

  let rootHandle: DirectoryHandleLike;
  try {
    rootHandle = await picker({ mode: 'readwrite' });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Klasör seçimi iptal edildi.');
    }
    return null;
  }

  const targetDir = await rootHandle.getDirectoryHandle(folderName, { create: true });
  const subCache = new Map<string, DirectoryHandleLike>();
  let totalBytes = 0;

  for (let i = 0; i < options.files.length; i += 1) {
    const entry = options.files[i]!;
    const parts = entry.relativePath.split('/');
    let dir = targetDir;
    if (parts.length === 2) {
      const subName = parts[0]!;
      let sub = subCache.get(subName);
      if (!sub) {
        sub = await targetDir.getDirectoryHandle(subName, { create: true });
        subCache.set(subName, sub);
      }
      dir = sub;
    }
    const fileName = parts[parts.length - 1]!;
    const fh = await dir.getFileHandle(fileName, { create: true });
    const writable = await fh.createWritable();
    const copy = new Uint8Array(entry.bytes.byteLength);
    copy.set(entry.bytes);
    await writable.write(copy);
    await writable.close();
    totalBytes += entry.bytes.byteLength;
    options.onFileProgress?.(i + 1, options.files.length);
  }

  return {
    mode: 'browser',
    displayPath: rootHandle.name ? `${rootHandle.name}/${folderName}` : folderName,
    byteLength: totalBytes,
  };
}

export async function openStudioManagedDirectory(rawTarget: ManagedDirTarget): Promise<void> {
  const target = managedDirTargetSchema.parse(rawTarget);
  if (!usesDesktopStorage) {
    throw new Error('Yerel klasör açma yalnızca Windows masaüstü uygulamasında kullanılabilir.');
  }
  await openDesktopManagedDir(target);
}
