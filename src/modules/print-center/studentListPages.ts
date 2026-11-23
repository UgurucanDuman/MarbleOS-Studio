import type { PrintOrientation } from '../../system/desktop/desktopPrinter';
import { isStaffBranch } from '../../system/sqlite/rosterImportActions';
import type { ClassRecord, StudentRecord } from '../../system/sqlite/types';
import { mmToPx } from '../../system/storage/binaryPrintFormats';
import type { ImpositionPage } from './printSpecs';

export function planStudentListPages(
  students: readonly StudentRecord[],
  classes: readonly ClassRecord[],
  scopeId: string,
  orientation: PrintOrientation = 'portrait',
): ImpositionPage[] {
  const isLandscape = orientation === 'landscape';
  const rowsPerPage = isLandscape ? 14 : 22;
  const widthMm = isLandscape ? 297 : 210;
  const heightMm = isLandscape ? 210 : 297;
  const rosterByClass = new Map<string, StudentRecord[]>();
  for (const student of students) {
    const list = rosterByClass.get(student.classId) ?? [];
    list.push(student);
    rosterByClass.set(student.classId, list);
  }

  const pages: ImpositionPage[] = [];
  for (const cls of classes) {
    if (isStaffBranch(cls.name) || (scopeId !== 'ALL' && cls.id !== scopeId)) continue;
    const roster = rosterByClass.get(cls.id);
    if (!roster?.length) continue;
    const subTotalPages = Math.ceil(roster.length / rowsPerPage);
    for (let offset = 0; offset < roster.length; offset += rowsPerPage) {
      pages.push({
        pageIndex: pages.length,
        kind: 'student-list',
        titleLabel: cls.name,
        teacherLabel: cls.teacherName,
        academicYear: cls.academicYear,
        subPageIndex: Math.floor(offset / rowsPerPage),
        subTotalPages,
        studentListRows: roster.slice(offset, offset + rowsPerPage).map((student, index) => ({
          sequence: offset + index + 1,
          student,
        })),
        widthMm,
        heightMm,
        widthPx: mmToPx(widthMm),
        heightPx: mmToPx(heightMm),
        cols: 1,
        rows: rowsPerPage,
        rulerLengthMm: 0,
        slots: [],
      });
    }
  }
  return pages;
}
