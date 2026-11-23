import { isStaffBranch } from './rosterImportActions';
import type { ClassRecord } from './types';

/**
 * İZOLE SİSTEM KATMANI: Akıllı Türkçe Sınıf ve Şube Sıralayıcısı
 * - Silinip yeniden eklenen veya yeniden adlandırılan şubeleri (örn. C, D, E, F içine A veya 1-A)
 *   sona atmak yerine sınıf düzeyi + Türkçe alfabe sırasına göre doğru yerine yerleştirir.
 * - Okul Öncesi/Anasınıfı → Hazırlık → 1..12. Sınıflar (doğal sayısal + A..Z) → Harf/Özel Şubeler → Öğretmen/Kadro
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const TR_NATURAL = new Intl.Collator('tr-TR', { numeric: true, sensitivity: 'base' });

interface ParsedBranchSortKey {
  bucket: number;
  grade: number;
  suffix: string;
}

function parseBranchSortKey(rawName: string): ParsedBranchSortKey {
  const clean = rawName.trim().replace(/\s+/g, ' ');
  const lower = clean.toLocaleLowerCase('tr-TR');

  if (isStaffBranch(clean)) {
    return { bucket: 4, grade: 0, suffix: clean };
  }
  if (
    lower.startsWith('anasınıf') ||
    lower.startsWith('anasinif') ||
    lower.startsWith('ana sınıf') ||
    lower.startsWith('ana sinif') ||
    lower.startsWith('okul öncesi') ||
    lower.startsWith('okul oncesi') ||
    lower.startsWith('kreş') ||
    lower.startsWith('kres')
  ) {
    return { bucket: 0, grade: 0, suffix: clean };
  }
  if (lower.startsWith('hazırlık') || lower.startsWith('hazirlik')) {
    return { bucket: 1, grade: 0, suffix: clean };
  }

  const numbered = clean.match(/^0*(\d{1,2})(?:\s*[-/. ]\s*|\s*)(.*)$/);
  if (numbered) {
    const grade = Number(numbered[1]);
    if (grade >= 1 && grade <= 12) {
      return { bucket: 2, grade, suffix: (numbered[2] ?? '').trim() };
    }
  }

  return { bucket: 3, grade: 0, suffix: clean };
}

export function compareClassBranchNames(a: string, b: string): number {
  const ka = parseBranchSortKey(a);
  const kb = parseBranchSortKey(b);
  if (ka.bucket !== kb.bucket) return ka.bucket - kb.bucket;
  if (ka.grade !== kb.grade) return ka.grade - kb.grade;
  const suffixDiff = TR_NATURAL.compare(ka.suffix, kb.suffix);
  if (suffixDiff !== 0) return suffixDiff;
  return TR_NATURAL.compare(a.trim(), b.trim());
}

/**
 * Şube listesini her okulun kendi sırasını bozmadan dönem + akıllı Türkçe sınıf/şube sırasına dizer.
 */
export function sortClassRecords(classes: readonly ClassRecord[]): ClassRecord[] {
  if (classes.length < 2) return [...classes];
  const schoolOrder = new Map<string, number>();
  classes.forEach((cls) => {
    if (!schoolOrder.has(cls.schoolId)) schoolOrder.set(cls.schoolId, schoolOrder.size);
  });
  return [...classes].sort((a, b) => {
    const sDiff = (schoolOrder.get(a.schoolId) ?? 0) - (schoolOrder.get(b.schoolId) ?? 0);
    if (sDiff !== 0) return sDiff;
    const yDiff = TR_NATURAL.compare(a.academicYear.trim(), b.academicYear.trim());
    if (yDiff !== 0) return yDiff;
    return compareClassBranchNames(a.name, b.name);
  });
}
