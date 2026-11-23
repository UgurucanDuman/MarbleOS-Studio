import type {
  AlbumTemplateConfig,
  ClassRecord,
  StudentRecord,
} from '../../system/sqlite/types';
import { DEFAULT_KUTUK_SCOPE_MODE } from '../../system/storage/yearbook-kutuk/catalog';
import {
  extractDeputyPrincipalOptions,
  isKutukStaffBranchName,
  normalizeTrText,
  parseTurkishClassBranch,
  summarizeTurkishClassBranches,
} from '../../system/storage/yearbook-kutuk/paginationMath';

/**
 * İZOLE MODÜL 03 KAPSAM YARDIMCISI:
 * Aktif şablon türüne (Sınıf Çizelgesi, Yıllık & Kütük, PVC Kimlik) göre telemetri ve baskı hedefini hesaplar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function resolveAlbumPrintTargetClassId(options: {
  albumConfig: AlbumTemplateConfig;
  scopedClasses: readonly ClassRecord[];
  activeClass: ClassRecord;
  allSchoolStudents: readonly StudentRecord[];
}): string {
  const { albumConfig, scopedClasses, activeClass, allSchoolStudents } = options;
  if (
    albumConfig.layoutKind === 'class-chart' &&
    albumConfig.chartTemplateId === 'notebook-inner-combined'
  ) {
    return 'ALL';
  }
  if (albumConfig.layoutKind === 'yearbook-spread') {
    const kutukScope = albumConfig.kutukScopeMode ?? DEFAULT_KUTUK_SCOPE_MODE;
    if (kutukScope === 'all-classes') return 'ALL';
    if (kutukScope === 'deputy') {
      const depOpts = extractDeputyPrincipalOptions(scopedClasses, allSchoolStudents);
      const depName = (albumConfig.kutukDeputyName || depOpts[0]?.deputyName || '').trim();
      return depName ? `DEPUTY:${depName}` : 'ALL';
    }
  }
  return activeClass.id;
}

export function resolveAlbumTelemetryScope(options: {
  albumConfig: AlbumTemplateConfig;
  scopedClasses: readonly ClassRecord[];
  activeClass: ClassRecord | undefined;
  classStudents: readonly StudentRecord[];
  allSchoolStudents: readonly StudentRecord[];
}): { label: string; students: readonly StudentRecord[] } {
  const { albumConfig, scopedClasses, activeClass, classStudents, allSchoolStudents } = options;
  const isKutuk = albumConfig.layoutKind === 'yearbook-spread';
  const kutukMode = albumConfig.kutukScopeMode ?? DEFAULT_KUTUK_SCOPE_MODE;
  if (!isKutuk || kutukMode === 'single-class') {
    return {
      label: activeClass
        ? isKutuk
          ? parseTurkishClassBranch(activeClass.name).fullLabel
          : activeClass.name
        : 'Şube Yok',
      students: classStudents,
    };
  }

  const studentBranches = scopedClasses.filter((c) => !isKutukStaffBranchName(c.name));
  if (kutukMode === 'deputy') {
    const depOpts = extractDeputyPrincipalOptions(scopedClasses, allSchoolStudents);
    const depName = (albumConfig.kutukDeputyName || depOpts[0]?.deputyName || '').trim();
    const normDep = normalizeTrText(depName);
    const depClasses = normDep
      ? studentBranches.filter((c) => normalizeTrText(c.deputyPrincipalName) === normDep)
      : [];
    const depIds = new Set(depClasses.map((c) => c.id));
    const depSummary = summarizeTurkishClassBranches(depClasses.map((c) => c.name));
    return {
      label: depName ? `Md. Yrd. ${depName} · ${depSummary.statValue}` : 'Md. Yrd. Kapsamı',
      students: allSchoolStudents.filter((s) => depIds.has(s.classId)),
    };
  }

  const targetBranches = studentBranches.length > 0 ? studentBranches : scopedClasses;
  const targetIds = new Set(targetBranches.map((c) => c.id));
  const summary = summarizeTurkishClassBranches(targetBranches.map((c) => c.name));
  return {
    label: targetBranches.length === 1 ? summary.scopeLine : `Tüm Okul · ${summary.statValue}`,
    students: allSchoolStudents.filter((s) => targetIds.has(s.classId)),
  };
}
