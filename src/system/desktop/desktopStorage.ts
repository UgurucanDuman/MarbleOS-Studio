import { invoke, isTauri } from '@tauri-apps/api/core';
import { z } from 'zod';
import {
  generatedRecoveryKeySchema,
  recoveryKeyInputSchema,
  vaultStatusSchema,
  type GeneratedRecoveryKey,
  type VaultStatus,
} from '../schemas/backupSchemas';
import { createEmptyStudioSnapshot } from '../sqlite/emptySnapshot';
import { validatePrototypeSnapshot } from '../sqlite/prototypePersistence';
import type { StudioDatabaseSnapshot } from '../sqlite/types';
import { PHOTO_DATA_URL_LIMIT } from '../storage/photoImport';

export const usesDesktopStorage = isTauri();

export const DEFAULT_VAULT_STATUS: VaultStatus = {
  locked: false,
  hasRecoveryKey: false,
  recoveryFingerprint: null,
  recoveryConfiguredAt: null,
};

const photoIdSchema = z.string().uuid('Geçersiz fotoğraf kimliği.');
const contentHashSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Geçersiz fotoğraf özeti.').optional();
const originalDataUrlSchema = z.string()
  .max(PHOTO_DATA_URL_LIMIT)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);

const workspaceSchema = z
  .object({
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    snapshotJson: z.string().nullable(),
    vault: vaultStatusSchema.optional().default(DEFAULT_VAULT_STATUS),
  })
  .strict();

const schoolSelectionSchema = z
  .object({
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    activeSchoolId: z.string().uuid().nullable(),
    vault: vaultStatusSchema.optional().default(DEFAULT_VAULT_STATUS),
  })
  .strict();

async function readWorkspace(
  command: 'studio_load' | 'studio_commit' | 'studio_unlock_with_recovery_key',
  args?: Record<string, unknown>,
) {
  const result = workspaceSchema.parse(await invoke(command, args));
  if (result.vault.locked) {
    if (result.revision !== 0 || result.snapshotJson !== null) {
      throw new Error('Kilitli kasa yanıtı geçersiz.');
    }
    return { revision: 0, snapshot: createEmptyStudioSnapshot(), vault: result.vault };
  }
  if ((result.revision === 0) !== (result.snapshotJson === null)) {
    throw new Error('Yerel kayıt yanıtı geçersiz.');
  }
  const snapshot = result.snapshotJson === null
    ? createEmptyStudioSnapshot()
    : validatePrototypeSnapshot(JSON.parse(result.snapshotJson));
  if (snapshot.photos.some((photo) => photo.dataUrl !== '')) {
    throw new Error('Yerel fotoğraf kaydı geçersiz.');
  }
  if (snapshot.schools.some((s) =>
    [s.logoDataUrl, s.principalSignatureDataUrl, s.deputySignatureDataUrl, s.schoolPhotoDataUrl]
      .some((v) => v.startsWith('data:')),
  )) {
    throw new Error('Yerel okul görseli kaydı geçersiz.');
  }
  return { revision: result.revision, snapshot, vault: result.vault };
}

export function loadDesktopWorkspace() {
  return readWorkspace('studio_load');
}

export function saveDesktopWorkspace(expectedRevision: number, snapshot: StudioDatabaseSnapshot, deletedPhotoIds?: string[]) {
  return readWorkspace('studio_commit', {
    expectedRevision,
    snapshotJson: JSON.stringify(snapshot),
    ...(deletedPhotoIds?.length ? { deletedPhotoIds } : {}),
  });
}

export async function selectDesktopSchool(expectedRevision: number, schoolId: string | null) {
  const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(expectedRevision);
  const id = schoolId === null ? null : z.string().uuid('Geçersiz okul kimliği.').parse(schoolId);
  const result = schoolSelectionSchema.parse(
    await invoke('studio_select_school', { expectedRevision: revision, schoolId: id }),
  );
  if (result.vault.locked) {
    throw new Error('Veri kasası kilitli. Devam etmek için Kurtarma Anahtarınızı girin.');
  }
  if (result.activeSchoolId !== id) {
    throw new Error('Yerel kayıt yanıtı geçersiz.');
  }
  return result;
}

export async function generateDesktopRecoveryKey(confirmRotate = false): Promise<GeneratedRecoveryKey> {
  const confirmed = z.boolean().parse(confirmRotate);
  return generatedRecoveryKeySchema.parse(
    await invoke('studio_generate_recovery_key', { confirmRotate: confirmed }),
  );
}

export async function unlockDesktopWithRecoveryKey(rawKey: string) {
  const recoveryKey = recoveryKeyInputSchema.parse(rawKey);
  const unlocked = await readWorkspace('studio_unlock_with_recovery_key', { recoveryKey });
  if (unlocked.vault.locked) {
    throw new Error('Veri kasası kilidi açılamadı.');
  }
  return unlocked;
}

export async function loadDesktopPhotoPreview(photoId: string) {
  return z.string().max(2_700_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
    .parse(await invoke('studio_photo_preview', { photoId: photoIdSchema.parse(photoId) }));
}

export async function loadDesktopPhotoOriginal(photoId: string, expectedHash?: string) {
  const id = photoIdSchema.parse(photoId);
  const hash = contentHashSchema.parse(expectedHash);
  return originalDataUrlSchema.parse(await invoke('studio_photo_original', {
    photoId: id,
    ...(hash ? { expectedHash: hash } : {}),
  }));
}

export {
  exportFileNameSchema,
  exportFolderNameSchema,
  exportSubfolderSchema,
  managedDirTargetSchema,
  openDesktopExportFolder,
  openDesktopManagedDir,
  saveDesktopExportBase64,
  saveDesktopExportInFolder,
  type ExportSubfolder,
  type ManagedDirTarget,
  type SavedExportInfo,
} from './desktopExportApi';
