import type { AlbumTemplateConfig, ClassRecord, StudentRecord } from '../../system/sqlite/types';
import { mmToPx, PRINT_DPI } from '../../system/storage/binaryPrintFormats';
import { resolveKutukTemplate } from '../../system/storage/yearbook-kutuk/catalog';
import {
  buildKutukDossierPages,
  isKutukStaffBranchName,
  type KutukStudentLike,
} from '../../system/storage/yearbook-kutuk/paginationMath';
import type { ImpositionPage, ImpositionSlot, PrintableStudentEntry } from './printSpecs';

/**
 * İZOLE MODÜL 04 KÜTÜK DOSYASI DİZGİ PLANLAYICISI:
 * A4 Dikey Klasör Kütüğü, A4 Yatay Sınıf Albümü ve Ön Kapak sayfalarını 300 DPI için planlar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface KutukPlanContext {
  scopedClasses?: readonly ClassRecord[];
  scopedStudents?: readonly StudentRecord[];
  schoolStaffEntries?: readonly PrintableStudentEntry[];
  effectiveScopeId?: string;
  deputyScopeName?: string | null;
}

export function planKutukImpositionPages(
  entries: readonly PrintableStudentEntry[],
  landscape: boolean,
  albumConfig?: Partial<AlbumTemplateConfig>,
  context?: KutukPlanContext,
): ImpositionPage[] {
  const template = resolveKutukTemplate(
    albumConfig?.kutukTemplateId,
    landscape ? 'landscape' : 'portrait',
    albumConfig?.kutukCols,
    albumConfig?.kutukRows,
  );
  const paperW = template.landscape ? 297 : 210;
  const paperH = template.landscape ? 210 : 297;
  const widthPx = mmToPx(paperW, PRINT_DPI);
  const heightPx = mmToPx(paperH, PRINT_DPI);

  if (entries.length === 0 && !template.isCover) {
    return [];
  }

  const classMap = new Map<string, ClassRecord>();
  for (const cls of context?.scopedClasses ?? []) {
    classMap.set(cls.id, cls);
  }
  for (const item of entries) {
    if (!classMap.has(item.student.classId)) {
      classMap.set(
        item.student.classId,
        item.classRecord ?? {
          id: item.student.classId,
          schoolId: 'local',
          academicYear: '2026-2027',
          name: item.className || 'ŞUBE',
          teacherName: '',
          createdAt: '',
        },
      );
    }
  }

  const entryByStudentId = new Map<string, PrintableStudentEntry>();
  const activeClassIds = new Set<string>();
  for (const item of entries) {
    entryByStudentId.set(item.student.id, item);
    activeClassIds.add(item.student.classId);
  }

  const studentList: KutukStudentLike[] = [];
  if (context?.scopedStudents && context.scopedStudents.length > 0) {
    for (const stu of context.scopedStudents) {
      if (!activeClassIds.has(stu.classId) || stu.showInAlbum === false) continue;
      if (entryByStudentId.has(stu.id) || stu.matchedPhotoId === null) {
        studentList.push(stu);
      }
    }
  } else {
    for (const item of entries) {
      studentList.push(item.student);
    }
  }

  const staffEntryByPhotoId = new Map<string, PrintableStudentEntry>();
  const allStaffAndStudents: KutukStudentLike[] = [...studentList];
  const seenIds = new Set(studentList.map((s) => s.id));
  for (const staffItem of context?.schoolStaffEntries ?? []) {
    staffEntryByPhotoId.set(staffItem.photo.id, staffItem);
    if (!seenIds.has(staffItem.student.id)) {
      seenIds.add(staffItem.student.id);
      allStaffAndStudents.push(staffItem.student);
    }
  }
  for (const item of entries) {
    if (isKutukStaffBranchName(item.className)) {
      staffEntryByPhotoId.set(item.photo.id, item);
    }
  }

  const effScope = context?.effectiveScopeId ?? 'ALL';
  const scopeMode =
    effScope !== 'ALL' && !effScope.startsWith('DEPUTY:')
      ? 'single-class'
      : context?.deputyScopeName
        ? 'deputy'
        : 'all-classes';

  const kutukPages = buildKutukDossierPages({
    classes: [...classMap.values()],
    students: studentList,
    allStaffAndStudents,
    template,
    scopeMode,
    selectedClassId: scopeMode === 'single-class' ? effScope : albumConfig?.selectedClassId,
    selectedDeputyName: context?.deputyScopeName ?? albumConfig?.kutukDeputyName ?? '',
    includeCover: Boolean(albumConfig?.kutukIncludeCover),
    showStaffPortraits: albumConfig?.kutukShowStaffPortraits ?? true,
    allowEmptyClasses: template.isCover,
  });

  return kutukPages.map((kPage, idx) => {
    const slots: ImpositionSlot[] = [];
    const rosterEntries: PrintableStudentEntry[] = [];
    const seenPhotos = new Set<string>();

    for (const row of kPage.items) {
      const ent = entryByStudentId.get(row.student.id);
      if (!ent) continue;
      slots.push({ entry: ent, xMm: 0, yMm: 0, widthMm: 24, heightMm: 32 });
      if (!seenPhotos.has(ent.photo.id)) {
        seenPhotos.add(ent.photo.id);
        rosterEntries.push(ent);
      }
    }
    for (const badge of kPage.staffBadges) {
      if (!badge.photoRef || seenPhotos.has(badge.photoRef)) continue;
      const staffEnt = staffEntryByPhotoId.get(badge.photoRef);
      if (staffEnt) {
        seenPhotos.add(badge.photoRef);
        rosterEntries.push(staffEnt);
      }
    }

    return {
      pageIndex: idx,
      kind: 'kutuk-sheet',
      titleLabel: kPage.pageKind === 'cover' ? 'Ön Kapak' : kPage.className,
      teacherLabel: kPage.teacherName,
      academicYear: kPage.academicYear,
      subPageIndex: kPage.branchPageIndex,
      subTotalPages: kPage.branchTotalPages,
      rosterEntries,
      kutukPage: kPage,
      widthMm: paperW,
      heightMm: paperH,
      widthPx,
      heightPx,
      cols: template.cols,
      rows: template.rows,
      rulerLengthMm: 50,
      slots,
    };
  });
}
