import type { GeneratedRecoveryKey, VaultStatus } from '../schemas/backupSchemas';
import { loadDesktopWorkspace, saveDesktopWorkspace, usesDesktopStorage } from '../desktop/desktopStorage';
import { BrowserWorkspaceConflict, loadBrowserWorkspace, saveBrowserWorkspace } from '../storage/browserWorkspace';
import type { StudioDatabaseSnapshot } from './types';

export const usesBrowserStorage = !usesDesktopStorage && typeof globalThis.indexedDB !== 'undefined';
export const hasAsyncStorage = usesDesktopStorage || usesBrowserStorage;
export const loadWorkspace = usesDesktopStorage ? loadDesktopWorkspace : loadBrowserWorkspace;
export const saveWorkspace = usesDesktopStorage ? saveDesktopWorkspace : saveBrowserWorkspace;

export function sameVaultStatus(a: VaultStatus, b: VaultStatus): boolean {
  return (
    a.locked === b.locked &&
    a.hasRecoveryKey === b.hasRecoveryKey &&
    a.recoveryFingerprint === b.recoveryFingerprint &&
    a.recoveryConfiguredAt === b.recoveryConfiguredAt
  );
}

export function isUnchangedEmptyBoot(
  wasInitialBoot: boolean,
  vaultChanged: boolean,
  persistenceError: string | null,
  current: StudioDatabaseSnapshot,
  incoming: StudioDatabaseSnapshot,
): boolean {
  return (
    wasInitialBoot &&
    !vaultChanged &&
    persistenceError === null &&
    current.schools.length === 0 &&
    incoming.schools.length === 0 &&
    current.photos.length === 0 &&
    incoming.photos.length === 0 &&
    JSON.stringify(current) === JSON.stringify(incoming)
  );
}

export function workspaceWriteError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof BrowserWorkspaceConflict) return error.message;
  if (usesBrowserStorage && error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Tarayıcı depolama alanı dolu. Değişiklik kaydedilmedi.';
  }
  return 'Yerel kayıt doğrulanamadı. Görünümü kontrol edin.';
}

export function withRecoveryKeyStatus(current: VaultStatus, generated: GeneratedRecoveryKey): VaultStatus {
  return {
    ...current,
    hasRecoveryKey: true,
    recoveryFingerprint: generated.recoveryFingerprint,
    recoveryConfiguredAt: generated.recoveryConfiguredAt,
  };
}

export function normalizeNativeError(err: unknown): unknown {
  return typeof err === 'string' ? new Error(err) : err;
}
