import type { StudioDatabaseSnapshot } from './types';

/**
 * Yapısal paylaşım (structural sharing): diske yazılıp doğrulanan yeni snapshot içinde
 * içeriği değişmemiş kayıtlar için önceki nesne referansları korunur.
 *
 * Neden: Her commit sonrası doğrulayıcı (Zod) ve JSON dönüşü TÜM kayıtları yeni nesne olarak
 * üretir. Yalnız `activeSchoolId` değişse bile her `useMemo` / `React.memo` geçersizleşir ve
 * açık tüm pencereler baştan render edilir; okul/sınıf sayfa geçişlerinde kasma bundan doğar.
 * Burada yalnız derin eşit (JSON eşdeğeri) kayıtlar paylaşılır; veri asla değiştirilmez.
 */

type Json = unknown;

function definedKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}

export function sameJsonValue(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!sameJsonValue(a[index], b[index])) return false;
    }
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = definedKeys(left);
  if (leftKeys.length !== definedKeys(right).length) return false;
  for (const key of leftKeys) {
    if (!sameJsonValue(left[key], right[key])) return false;
  }
  return true;
}

function shareRecords<T extends { id: string }>(previous: T[], next: T[]): T[] {
  if (previous === next) return previous;
  const byId = new Map(previous.map((item) => [item.id, item]));
  let unchanged = previous.length === next.length;
  const shared = next.map((item, index) => {
    const old = byId.get(item.id);
    const kept = old !== undefined && sameJsonValue(old, item) ? old : item;
    if (kept !== previous[index]) unchanged = false;
    return kept;
  });
  return unchanged ? previous : shared;
}

export function shareUnchangedSnapshot(
  previous: StudioDatabaseSnapshot,
  next: StudioDatabaseSnapshot,
): StudioDatabaseSnapshot {
  if (previous === next) return previous;
  const shared: StudioDatabaseSnapshot = {
    ...next,
    schools: shareRecords(previous.schools, next.schools),
    classes: shareRecords(previous.classes, next.classes),
    students: shareRecords(previous.students, next.students),
    photos: shareRecords(previous.photos, next.photos),
    syncQueue: shareRecords(previous.syncQueue, next.syncQueue),
    albumConfig: sameJsonValue(previous.albumConfig, next.albumConfig) ? previous.albumConfig : next.albumConfig,
  };
  const keys = Object.keys(shared) as Array<keyof StudioDatabaseSnapshot>;
  const identical = keys.length === Object.keys(previous).length &&
    keys.every((key) => shared[key] === previous[key]);
  return identical ? previous : shared;
}
