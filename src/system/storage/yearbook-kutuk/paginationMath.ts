import type { ClassRecord } from '../../sqlite/types';
import { DEFAULT_KUTUK_SCOPE_MODE, resolveKutukTemplate } from './catalog';
import {
  parseTurkishClassBranch,
  summarizeTurkishClassBranches,
} from './classBranchFormat';
import {
  buildKutukStaffDirectory,
  compareBranchNamesTr,
  extractDeputyPrincipalOptions,
  isKutukStaffBranchName,
  normalizeTrText,
  resolveClassStaffBadges,
  type KutukStudentLike,
} from './staffDirectory';
import type {
  KutukNumberedStudent,
  KutukResolvedPage,
  KutukScopeMode,
  KutukTemplateSpec,
} from './types';

export {
  compareBranchNamesTr,
  extractDeputyPrincipalOptions,
  isKutukStaffBranchName,
  normalizeTrText,
  parseTurkishClassBranch,
  summarizeTurkishClassBranches,
  type KutukStudentLike,
};

/**
 * İZOLE SİSTEM MATEMATİĞİ: Müdür Yardımcısı Kütük Dosyası Kapsam ve Sayfalama Motoru
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function buildKutukDossierPages<TStudent extends KutukStudentLike>(options: {
  classes: readonly ClassRecord[];
  students: readonly TStudent[];
  allStaffAndStudents?: readonly KutukStudentLike[];
  template?: KutukTemplateSpec;
  templateId?: string;
  scopeMode?: KutukScopeMode;
  selectedClassId?: string;
  selectedDeputyName?: string;
  includeCover?: boolean;
  showStaffPortraits?: boolean;
  allowEmptyClasses?: boolean;
}): KutukResolvedPage<TStudent, string | null>[] {
  const {
    classes,
    students,
    allStaffAndStudents = students,
    scopeMode = DEFAULT_KUTUK_SCOPE_MODE,
    selectedClassId = '',
    selectedDeputyName = '',
    includeCover = false,
    showStaffPortraits = true,
    allowEmptyClasses = true,
  } = options;
  const template = options.template ?? resolveKutukTemplate(options.templateId);
  const staffDir = buildKutukStaffDirectory(classes, allStaffAndStudents);
  const studentBranches = [...classes]
    .filter((c) => !isKutukStaffBranchName(c.name))
    .sort((a, b) => compareBranchNamesTr(a.name, b.name));

  let targetClasses: ClassRecord[] = [];
  if (scopeMode === 'single-class') {
    const picked = classes.find((c) => c.id === selectedClassId) ?? studentBranches[0] ?? classes[0];
    if (picked) targetClasses = [picked];
  } else if (scopeMode === 'deputy') {
    const normDep = normalizeTrText(selectedDeputyName);
    targetClasses = normDep
      ? studentBranches.filter((c) => normalizeTrText(c.deputyPrincipalName) === normDep)
      : [];
  } else {
    targetClasses = studentBranches.length > 0 ? studentBranches : [...classes];
  }

  const byClassId = new Map<string, TStudent[]>();
  for (const stu of students) {
    if (stu.showInAlbum === false) continue;
    const list = byClassId.get(stu.classId) ?? [];
    list.push(stu);
    byClassId.set(stu.classId, list);
  }

  const effectiveClasses = allowEmptyClasses
    ? targetClasses
    : targetClasses.filter((c) => (byClassId.get(c.id)?.length ?? 0) > 0);

  const totalClassCount = effectiveClasses.length;
  const totalStudentCount = effectiveClasses.reduce((sum, c) => sum + (byClassId.get(c.id)?.length ?? 0), 0);
  const academicYear = effectiveClasses[0]?.academicYear ?? classes[0]?.academicYear ?? '2026-2027';
  const classSummary = summarizeTurkishClassBranches(effectiveClasses.map((c) => c.name));
  const scopeTitle =
    scopeMode === 'deputy' && selectedDeputyName.trim()
      ? `Md. Yrd. ${selectedDeputyName.trim()} · ${classSummary.scopeLine}`
      : classSummary.scopeLine;
  const scopeSubtitle = `${classSummary.statValue} · ${totalStudentCount} Öğrenci`;

  const pages: KutukResolvedPage<TStudent, string | null>[] = [];
  if (template.isCover || (includeCover && effectiveClasses.length > 0)) {
    const coverDeputy =
      scopeMode === 'deputy'
        ? selectedDeputyName.trim()
        : effectiveClasses.length === 1
          ? (effectiveClasses[0]?.deputyPrincipalName ?? '')
          : '';
    const firstParsed = effectiveClasses[0]
      ? parseTurkishClassBranch(effectiveClasses[0].name)
      : parseTurkishClassBranch('');
    pages.push({
      pageKind: 'cover',
      template,
      landscape: template.landscape,
      classId: effectiveClasses[0]?.id ?? '',
      className: scopeMode === 'single-class' ? (effectiveClasses[0]?.name ?? '') : 'TÜM SINIFLAR',
      classGradeLabel: firstParsed.gradeLabel,
      classBranchLabel: firstParsed.branchLabel,
      classFullLabel: classSummary.scopeLine,
      coverClassSummary: classSummary.statValue,
      academicYear,
      teacherName: scopeMode === 'single-class' ? (effectiveClasses[0]?.teacherName ?? '') : '',
      deputyPrincipalName: coverDeputy,
      branchPageIndex: 0,
      branchTotalPages: 1,
      branchStudentCount: totalStudentCount,
      totalClassCount,
      totalStudentCount,
      scopeTitle,
      scopeSubtitle,
      staffBadges: resolveClassStaffBadges(staffDir, '', coverDeputy, showStaffPortraits),
      items: [],
    });
    if (template.isCover) return pages;
  }

  const perPage = Math.max(1, template.studentsPerPage);
  for (const cls of effectiveClasses) {
    const roster = byClassId.get(cls.id) ?? [];
    if (!allowEmptyClasses && roster.length === 0) continue;
    const parsedCls = parseTurkishClassBranch(cls.name);
    const deputyName =
      (cls.deputyPrincipalName ?? '').trim() || (scopeMode === 'deputy' ? selectedDeputyName.trim() : '');
    const badges = resolveClassStaffBadges(staffDir, cls.teacherName, deputyName, showStaffPortraits);
    const branchTotalPages = Math.max(1, Math.ceil(roster.length / perPage));
    for (let bIdx = 0; bIdx < branchTotalPages; bIdx += 1) {
      const slice = roster.slice(bIdx * perPage, (bIdx + 1) * perPage);
      const items: KutukNumberedStudent<TStudent>[] = slice.map((student, sIdx) => ({
        sequenceNumber: bIdx * perPage + sIdx + 1,
        student,
      }));
      pages.push({
        pageKind: 'class-grid',
        template,
        landscape: template.landscape,
        classId: cls.id,
        className: cls.name,
        classGradeLabel: parsedCls.gradeLabel,
        classBranchLabel: parsedCls.branchLabel,
        classFullLabel: parsedCls.fullLabel,
        coverClassSummary: classSummary.statValue,
        academicYear: cls.academicYear || academicYear,
        teacherName: cls.teacherName,
        deputyPrincipalName: deputyName,
        branchPageIndex: bIdx,
        branchTotalPages,
        branchStudentCount: roster.length,
        totalClassCount,
        totalStudentCount,
        scopeTitle,
        scopeSubtitle,
        staffBadges: badges,
        items,
      });
    }
  }
  return pages;
}
