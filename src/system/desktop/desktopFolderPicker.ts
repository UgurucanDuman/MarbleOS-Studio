import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { PHOTO_IMPORT_LIMITS } from '../storage/photoImport';
import { usesDesktopStorage } from './desktopStorage';

/**
 * İZOLE SİSTEM KATMANI: Yerel Windows Klasör Seçici & Tarayıcı Directory Picker Köprüsü
 * Masaüstü uygulamasında Edge WebView2'nin "Bu sitedeki tüm dosyalar karşıya yüklensin mi?"
 * tarayıcı uyarısını tamamen atlayarak doğrudan yerel Windows klasör seçicisini açar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const pickedPhotoFileSchema = z.object({
  fileName: z.string().min(1).max(260),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().positive().max(PHOTO_IMPORT_LIMITS.fileBytes),
  bytesBase64: z.string().min(4),
}).strict();

const pickedPhotoFolderSchema = z.object({
  folderName: z.string().min(1).max(260),
  totalBytes: z.number().int().positive(),
  files: z.array(pickedPhotoFileSchema).min(1).max(PHOTO_IMPORT_LIMITS.count),
}).strict();

export type FolderPickOutcome =
  | { kind: 'picked'; folderName: string; files: File[] }
  | { kind: 'cancelled' }
  | { kind: 'fallback-input' };

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function isPhotoFileName(name: string): boolean {
  return /\.(?:jpe?g|png|webp)$/i.test(name);
}

interface DirHandleEntry {
  kind: 'file' | 'directory';
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterable<DirHandleEntry>;
}

interface WindowWithDirPicker {
  showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<DirHandleEntry>;
}

async function pickWithBrowserDirectoryApi(): Promise<FolderPickOutcome> {
  const picker = (window as unknown as WindowWithDirPicker).showDirectoryPicker;
  if (typeof picker !== 'function') return { kind: 'fallback-input' };
  try {
    const dirHandle = await picker({ mode: 'read' });
    const files: File[] = [];
    if (dirHandle.values) {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory' && entry.values) {
          for await (const nested of entry.values()) {
            if (nested.kind === 'file' && isPhotoFileName(nested.name)) {
              throw new Error('Alt klasörlerde fotoğraf bulundu. Yalnızca seçili sınıfın fotoğraf klasörünü açın.');
            }
          }
          continue;
        }
        if (entry.kind === 'file' && entry.getFile && isPhotoFileName(entry.name)) {
          files.push(await entry.getFile());
        }
      }
    }
    return { kind: 'picked', folderName: dirHandle.name || 'Fotoğraf Klasörü', files };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { kind: 'cancelled' };
    }
    if (err instanceof Error && err.message.includes('Alt klasörlerde')) {
      throw err;
    }
    return { kind: 'fallback-input' };
  }
}

/**
 * Windows Tauri uygulamasında yerel Windows Explorer klasör seçicisini, tarayıcıda modern
 * File System Access API'yi açar; desteklenmeyen ortamlarda kontrollü input yedeğine düşer.
 */
export async function pickStudioPhotoFolder(): Promise<FolderPickOutcome> {
  if (usesDesktopStorage) {
    const raw = await invoke<unknown>('studio_pick_photo_folder');
    if (raw === null || raw === undefined) return { kind: 'cancelled' };
    const parsed = pickedPhotoFolderSchema.parse(raw);
    const files = parsed.files.map(
      (item) => new File([base64ToArrayBuffer(item.bytesBase64)], item.fileName, { type: item.mimeType }),
    );
    return { kind: 'picked', folderName: parsed.folderName, files };
  }
  return pickWithBrowserDirectoryApi();
}
