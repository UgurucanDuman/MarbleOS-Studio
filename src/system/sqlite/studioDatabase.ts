import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { GeneratedRecoveryKey, VaultStatus } from '../schemas/backupSchemas';
import { selectSchoolSchema } from '../schemas/schoolSchemas';
import { loadPrototypeSnapshot, persistPrototypeSnapshot, validatePrototypeSnapshot } from './prototypePersistence';
import { createStudioActions, type StudioActions } from './studioActions';
import { createEmptyStudioSnapshot } from './emptySnapshot';
import { shareUnchangedSnapshot } from './snapshotSharing';
import {
  DEFAULT_VAULT_STATUS,
  generateDesktopRecoveryKey,
  selectDesktopSchool,
  unlockDesktopWithRecoveryKey,
  usesDesktopStorage,
} from '../desktop/desktopStorage';
import { evictDesktopPhotoPreviews } from '../desktop/desktopPhotoPreview';
import { evictBrowserPhotoPreviews } from '../storage/browserPhotoPreview';
import {
  hasAsyncStorage,
  isUnchangedEmptyBoot,
  loadWorkspace,
  normalizeNativeError,
  sameVaultStatus,
  saveWorkspace,
  withRecoveryKeyStatus,
  workspaceWriteError,
} from './workspaceAdapter';
import type { StudioDatabaseSnapshot } from './types';

const initial = hasAsyncStorage
  ? { snapshot: createEmptyStudioSnapshot(), error: null }
  : loadPrototypeSnapshot();
let snapshotState: StudioDatabaseSnapshot = initial.snapshot;
let persistenceError: string | null = initial.error;
let vaultStatus: VaultStatus = DEFAULT_VAULT_STATUS;
const listeners = new Set<() => void>();
let workspaceRevision: number | null = null;
let workspaceStartup: Promise<void> | undefined;
let workspaceQueue = Promise.resolve();

function publish() {
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function subscribeWhilePaused() {
  return () => { };
}

function applyWorkspaceState(result: { revision: number; snapshot: StudioDatabaseSnapshot; vault?: VaultStatus }) {
  const vaultChanged = result.vault ? !sameVaultStatus(vaultStatus, result.vault) : false;
  if (result.vault) {
    vaultStatus = result.vault;
    if (result.vault.locked) {
      workspaceRevision = null;
      snapshotState = createEmptyStudioSnapshot();
      persistenceError = null;
      publish();
      return;
    }
  }
  const wasInitialBoot = workspaceRevision === null;
  workspaceRevision = result.revision;
  if (isUnchangedEmptyBoot(wasInitialBoot, vaultChanged, persistenceError, snapshotState, result.snapshot)) {
    return;
  }
  snapshotState = shareUnchangedSnapshot(snapshotState, result.snapshot);
  persistenceError = null;
  publish();
}

export function startDesktopWorkspace(): Promise<void> {
  if (!hasAsyncStorage) return Promise.resolve();
  workspaceStartup ??= loadWorkspace().then(applyWorkspaceState, () => {
    persistenceError = 'Yerel veri deposu açılamadı. Var olan kayıtlar korundu.';
    publish();
  });
  return workspaceStartup;
}

// Browser prototype only: publish success after storage accepts the write.
function commitSnapshot(next: StudioDatabaseSnapshot) {
  if (hasAsyncStorage) throw new Error('Çalışma alanının kayıt işlemi kullanılmalıdır.');
  if (initial.error) throw new Error(initial.error);
  const validated = validatePrototypeSnapshot(next);
  try {
    persistPrototypeSnapshot(validated);
  } catch {
    persistenceError = 'Yerel kayıt yazılamadı. Değişiklik kaydedilmedi; alan ve tarayıcı izinlerini kontrol edin.';
    publish();
    throw new Error(persistenceError);
  }
  snapshotState = shareUnchangedSnapshot(snapshotState, validated);
  persistenceError = null;
  publish();
}

export const studioDbActions = createStudioActions(() => snapshotState, commitSnapshot);

function enqueueWorkspace<T>(task: () => Promise<T>): Promise<T> {
  const operation = workspaceQueue.then(task);
  workspaceQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function recoverWorkspaceWrite(error: unknown): Promise<never> {
  try {
    applyWorkspaceState(await loadWorkspace());
  } catch {
    workspaceRevision = null;
  }
  persistenceError = workspaceWriteError(error);
  publish();
  throw new Error(persistenceError);
}

async function requireOpenWorkspace(): Promise<number> {
  await startDesktopWorkspace();
  if (vaultStatus.locked) {
    throw new Error('Veri kasası kilitli. Devam etmek için Kurtarma Anahtarınızı girin.');
  }
  if (workspaceRevision === null) throw new Error(persistenceError ?? 'Yerel veri deposu açılamadı.');
  return workspaceRevision;
}

export function runStudioMutation<TResult>(execute: (actions: StudioActions) => TResult) {
  if (!hasAsyncStorage) return execute(studioDbActions);

  return enqueueWorkspace(async () => {
    const expectedRevision = await requireOpenWorkspace();
    let pending: StudioDatabaseSnapshot | undefined;
    let deletedPhotoIds: string[] | undefined;
    const actions = createStudioActions(() => snapshotState, (next, removedIds) => {
      pending = validatePrototypeSnapshot(usesDesktopStorage ? { ...next, syncQueue: [], lastSyncedAt: null } : next);
      deletedPhotoIds = removedIds;
    });
    const result = execute(actions);
    if (pending) {
      try {
        applyWorkspaceState(await saveWorkspace(expectedRevision, pending, deletedPhotoIds));
        if (deletedPhotoIds?.length) {
          evictBrowserPhotoPreviews(deletedPhotoIds);
          evictDesktopPhotoPreviews(deletedPhotoIds);
        }
      } catch (error) {
        await recoverWorkspaceWrite(error);
      }
    }
    return result;
  });
}

export async function selectStudioSchool(rawId: string | null): Promise<void> {
  const id = selectSchoolSchema.parse(rawId);
  if (!usesDesktopStorage) {
    await runStudioMutation((actions) => actions.selectSchool(id));
    return;
  }
  return enqueueWorkspace(async () => {
    const expectedRevision = await requireOpenWorkspace();
    if (id !== null && !snapshotState.schools.some((school) => school.id === id)) {
      throw new Error('Okul bulunamadı.');
    }
    if (snapshotState.activeSchoolId === id) return;
    try {
      const saved = await selectDesktopSchool(expectedRevision, id);
      applyWorkspaceState({
        revision: saved.revision,
        snapshot: { ...snapshotState, activeSchoolId: saved.activeSchoolId },
        vault: saved.vault,
      });
    } catch (error) {
      await recoverWorkspaceWrite(error);
    }
  });
}

export function generateStudioRecoveryKey(confirmRotate = false): Promise<GeneratedRecoveryKey> {
  if (!usesDesktopStorage) return Promise.reject(new Error('Kurtarma anahtarı yalnız Windows masaüstü uygulamasında üretilir.'));
  return enqueueWorkspace(async () => {
    await startDesktopWorkspace();
    if (vaultStatus.locked) throw new Error('Veri kasası kilitliyken yeni kurtarma anahtarı üretilemez.');
    try {
      const generated = await generateDesktopRecoveryKey(confirmRotate);
      vaultStatus = withRecoveryKeyStatus(vaultStatus, generated);
      publish();
      return generated;
    } catch (err) {
      throw normalizeNativeError(err);
    }
  });
}

export function unlockStudioVault(rawRecoveryKey: string): Promise<void> {
  if (!usesDesktopStorage) return Promise.reject(new Error('Kurtarma anahtarı yalnız Windows masaüstü uygulamasında kullanılır.'));
  return enqueueWorkspace(async () => {
    await startDesktopWorkspace();
    try {
      applyWorkspaceState(await unlockDesktopWithRecoveryKey(rawRecoveryKey));
    } catch (err) {
      throw normalizeNativeError(err);
    }
  });
}

export function getStudioDatabaseSnapshot(): StudioDatabaseSnapshot {
  return snapshotState;
}

export function useStudioDatabase(enabled = true): StudioDatabaseSnapshot {
  const lastVisible = useRef(snapshotState);
  const read = useCallback(() => enabled ? snapshotState : lastVisible.current, [enabled]);
  const current = useSyncExternalStore(enabled ? subscribe : subscribeWhilePaused, read);
  useLayoutEffect(() => {
    if (enabled) lastVisible.current = current;
  }, [current, enabled]);
  return current;
}

export function useActiveSchoolName(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => snapshotState.schools.find((s) => s.id === snapshotState.activeSchoolId)?.name ?? null,
  );
}

export function useStudioPersistenceError(): string | null {
  return useSyncExternalStore(subscribe, () => persistenceError);
}

export function useStudioVaultStatus(): VaultStatus {
  return useSyncExternalStore(subscribe, () => vaultStatus);
}
