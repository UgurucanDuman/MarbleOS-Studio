import type { ClassRecord } from '../../sqlite/types';
import type { DeputyScopeOption, KutukStaffBadge } from './types';

/**
 * İZOLE SİSTEM YARDIMCISI: Kütük Dosyası İdareci, Müdür Yardımcısı ve Sınıf Öğretmeni Dizin Eşlemesi
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const TR_BRANCH_COLLATOR = new Intl.Collator('tr-TR', { numeric: true, sensitivity: 'base' });

export interface KutukStudentLike {
  id: string;
  classId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  role?: string;
  isPrincipal?: boolean;
  showInAlbum?: boolean;
  matchedPhotoId: string | null;
}

export interface KutukStaffDirectory {
  principal: { fullName: string; photoId: string | null } | null;
  byNormalizedName: Map<string, { fullName: string; photoId: string | null }>;
}

export function normalizeTrText(val: string | undefined | null): string {
  return (val ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}

export function isKutukStaffBranchName(name: string): boolean {
  const lower = normalizeTrText(name);
  return (
    lower.startsWith('öğretmen') ||
    lower.startsWith('ogretmen') ||
    lower.startsWith('idare') ||
    lower.startsWith('kadro')
  );
}

export function compareBranchNamesTr(a: string, b: string): number {
  return TR_BRANCH_COLLATOR.compare(a.trim(), b.trim());
}

export function extractDeputyPrincipalOptions(
  classes: readonly ClassRecord[],
  allStudents: readonly KutukStudentLike[],
): DeputyScopeOption[] {
  const studentBranches = classes.filter((c) => !isKutukStaffBranchName(c.name));
  const byNorm = new Map<string, { deputyName: string; branches: string[] }>();

  for (const cls of studentBranches) {
    const raw = (cls.deputyPrincipalName ?? '').trim();
    if (!raw) continue;
    const key = normalizeTrText(raw);
    const entry = byNorm.get(key) ?? { deputyName: raw, branches: [] };
    entry.branches.push(cls.name);
    byNorm.set(key, entry);
  }

  const staffClassIds = new Set(classes.filter((c) => isKutukStaffBranchName(c.name)).map((c) => c.id));
  for (const stu of allStudents) {
    if (!staffClassIds.has(stu.classId) || stu.showInAlbum === false) continue;
    const roleUpper = (stu.role ?? '').trim().toUpperCase();
    if (!roleUpper.startsWith('MD.YRD')) continue;
    const fullName = `${stu.firstName} ${stu.lastName}`.trim();
    const key = normalizeTrText(fullName);
    if (key && !byNorm.has(key)) {
      byNorm.set(key, { deputyName: fullName, branches: [] });
    }
  }

  return [...byNorm.values()]
    .map((item) => ({
      deputyName: item.deputyName,
      branchCount: item.branches.length,
      branchNames: [...item.branches].sort(compareBranchNamesTr),
    }))
    .sort((a, b) => compareBranchNamesTr(a.deputyName, b.deputyName));
}

export function buildKutukStaffDirectory(
  classes: readonly ClassRecord[],
  allStudents: readonly KutukStudentLike[],
): KutukStaffDirectory {
  const staffClassIds = new Set(classes.filter((c) => isKutukStaffBranchName(c.name)).map((c) => c.id));
  let principal: { fullName: string; photoId: string | null } | null = null;
  const byNormalizedName = new Map<string, { fullName: string; photoId: string | null }>();

  for (const stu of allStudents) {
    if (!staffClassIds.has(stu.classId) || stu.showInAlbum === false) continue;
    const fullName = `${stu.firstName} ${stu.lastName}`.trim();
    const norm = normalizeTrText(fullName);
    if (!norm) continue;
    if (!byNormalizedName.has(norm) || stu.matchedPhotoId) {
      byNormalizedName.set(norm, { fullName, photoId: stu.matchedPhotoId });
    }
    const roleUpper = (stu.role ?? '').trim().toUpperCase();
    if ((stu.isPrincipal || roleUpper === 'MDR.' || roleUpper === 'MÜDÜR') && (!principal || stu.matchedPhotoId)) {
      principal = { fullName, photoId: stu.matchedPhotoId };
    }
  }
  return { principal, byNormalizedName };
}

export function resolveClassStaffBadges(
  staffDir: KutukStaffDirectory,
  teacherName: string,
  deputyName: string,
  includePortraits: boolean,
): KutukStaffBadge<string | null>[] {
  const badges: KutukStaffBadge<string | null>[] = [];
  if (staffDir.principal) {
    badges.push({
      roleLabel: 'Okul Müdürü',
      fullName: staffDir.principal.fullName,
      photoRef: includePortraits ? staffDir.principal.photoId : null,
    });
  }
  const cleanDeputy = deputyName.trim();
  if (cleanDeputy) {
    const matched = staffDir.byNormalizedName.get(normalizeTrText(cleanDeputy));
    badges.push({
      roleLabel: 'Müdür Yardımcısı',
      fullName: matched?.fullName ?? cleanDeputy,
      photoRef: includePortraits ? (matched?.photoId ?? null) : null,
    });
  }
  const cleanTeacher = teacherName.trim();
  if (cleanTeacher) {
    const matched = staffDir.byNormalizedName.get(normalizeTrText(cleanTeacher));
    badges.push({
      roleLabel: 'Sınıf Öğretmeni',
      fullName: matched?.fullName ?? cleanTeacher,
      photoRef: includePortraits ? (matched?.photoId ?? null) : null,
    });
  }
  return badges;
}
