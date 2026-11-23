import type { SyncQueueRecord } from './types';

/** Yerel işlem günlüğüne yeni satır ekler. Sunucu onayı olmadan durum her zaman PENDING kalır. */
export function appendSyncLog(
  entityType: SyncQueueRecord['entityType'],
  entityId: string,
  operation: SyncQueueRecord['operation'],
  summary: string,
  currentQueue: SyncQueueRecord[],
): SyncQueueRecord[] {
  const entry: SyncQueueRecord = {
    id: crypto.randomUUID(),
    entityType,
    entityId,
    operation,
    summary,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  return [entry, ...currentQueue];
}

