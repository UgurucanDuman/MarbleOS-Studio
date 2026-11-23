import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';

/**
 * İZOLE MASAÜSTÜ ÇIKTI IPC KÖPRÜSÜ:
 * PDF, CSV, XLSX tekil dosya kaydı ile `.zip` olmadan doğrudan klasör bazlı JPG çıktı yazımını yönetir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const exportSubfolderSchema = z.enum([
  'print-ready',
  'vesikalik',
  'biyometrik',
  'kimlik',
  'album',
  'e-okul',
  'excel',
  'manifest',
]);
export type ExportSubfolder = z.infer<typeof exportSubfolderSchema>;

export const exportFileNameSchema = z
  .string()
  .trim()
  .min(3, 'Çıktı dosya adı geçersiz.')
  .max(160, 'Çıktı dosya adı çok uzun.')
  .refine(
    (name) =>
      !name.startsWith('.') &&
      !name.endsWith('.') &&
      !name.includes('..') &&
      !/[/\\:*?"<>|\u0000-\u001f]/.test(name) &&
      /\.(?:pdf|jpe?g|zip|xlsx|csv|json)$/i.test(name) &&
      !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name),
    'Çıktı dosya adı veya uzantısı geçersiz.',
  );

export const exportFolderNameSchema = z
  .string()
  .trim()
  .min(1, 'Çıktı klasör adı geçersiz.')
  .max(110, 'Çıktı klasör adı çok uzun.')
  .refine(
    (name) =>
      !name.startsWith('.') &&
      !name.endsWith('.') &&
      !name.includes('..') &&
      !/[/\\:*?"<>|\u0000-\u001f]/.test(name) &&
      !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name),
    'Çıktı klasör adı geçersiz.',
  );

const exportFolderRelPathSchema = z
  .string()
  .trim()
  .min(3)
  .max(220)
  .refine((rel) => {
    const parts = rel.split('/');
    if (parts.length < 1 || parts.length > 2) return false;
    const file = parts[parts.length - 1]!;
    if (!/\.(?:jpe?g|json|csv)$/i.test(file)) return false;
    return parts.every((seg) => exportFolderNameSchema.safeParse(seg).success);
  }, 'Klasör içi dosya yolu geçersiz.');

const savedExportInfoSchema = z
  .object({
    relativePath: z.string().min(1).max(220),
    byteLength: z.number().int().positive().max(96 * 1024 * 1024),
  })
  .strict();

export type SavedExportInfo = z.infer<typeof savedExportInfoSchema>;

export const managedDirTargetSchema = z.enum(['root', 'exports']);
export type ManagedDirTarget = z.infer<typeof managedDirTargetSchema>;

export async function saveDesktopExportBase64(
  subfolder: ExportSubfolder,
  fileName: string,
  bytesBase64: string,
): Promise<SavedExportInfo> {
  const folder = exportSubfolderSchema.parse(subfolder);
  const cleanName = exportFileNameSchema.parse(fileName);
  const encoded = z.string().min(4).max(129_000_000).parse(bytesBase64);
  return savedExportInfoSchema.parse(
    await invoke('studio_save_export', {
      subfolder: folder,
      fileName: cleanName,
      bytesBase64: encoded,
    }),
  );
}

export async function saveDesktopExportInFolder(
  subfolder: ExportSubfolder,
  folderName: string,
  relativePath: string,
  bytesBase64: string,
): Promise<SavedExportInfo> {
  const folder = exportSubfolderSchema.parse(subfolder);
  const cleanFolder = exportFolderNameSchema.parse(folderName);
  const cleanRel = exportFolderRelPathSchema.parse(relativePath);
  const encoded = z.string().min(4).max(129_000_000).parse(bytesBase64);
  return savedExportInfoSchema.parse(
    await invoke('studio_save_export_in_folder', {
      subfolder: folder,
      folderName: cleanFolder,
      relativePath: cleanRel,
      bytesBase64: encoded,
    }),
  );
}

export async function openDesktopExportFolder(
  subfolder: ExportSubfolder,
  folderName: string,
): Promise<void> {
  await invoke('studio_open_export_folder', {
    subfolder: exportSubfolderSchema.parse(subfolder),
    folderName: exportFolderNameSchema.parse(folderName),
  });
}

export async function openDesktopManagedDir(target: ManagedDirTarget): Promise<void> {
  const validated = managedDirTargetSchema.parse(target);
  await invoke('studio_open_managed_dir', { target: validated });
}
