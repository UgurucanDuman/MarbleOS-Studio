import type { StudentInput } from '../../system/schemas/studioSchemas';
import { normalizeBranchClassName } from '../../system/sqlite/rosterImportActions';
import { readMappedRoster, suggestRosterMapping, type RosterSheet } from './rosterColumns';
import type { ParsedSchoolRoster, SchoolRosterPreviewItem } from './schoolRosterColumns';

/** Çok sayfalı bir .xlsx çalışma kitabındaki her görünür sayfayı ayrı şube olarak ayrıştırır. */
export function readMultiSheetSchoolRoster(sheets: RosterSheet[]): ParsedSchoolRoster {
  const byBranch = new Map<string, StudentInput[]>();
  const seenNumbers = new Map<string, Set<string>>();
  const previewRows: SchoolRosterPreviewItem[] = [];

  for (const sheet of sheets) {
    const branch = normalizeBranchClassName(sheet.name);
    if (branch.length < 2 || branch.length > 20) {
      throw new Error(`"${sheet.name}" sayfa adı geçerli bir şube adı (2–20 karakter) değil.`);
    }
    const mapping = suggestRosterMapping(sheet.rows);
    let parsedRows: StudentInput[];
    try {
      parsedRows = readMappedRoster(sheet.rows, mapping);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Sütunlar okunamadı.';
      throw new Error(`"${sheet.name}" sayfası: ${detail}`);
    }

    const numSet = seenNumbers.get(branch) ?? new Set<string>();
    const bucket = byBranch.get(branch) ?? [];
    for (const stu of parsedRows) {
      if (numSet.has(stu.studentNumber)) {
        throw new Error(`"${sheet.name}" sayfası: ${branch} şubesinde ${stu.studentNumber} numarası yineleniyor.`);
      }
      numSet.add(stu.studentNumber);
      bucket.push(stu);
      previewRows.push({
        className: branch,
        studentNumber: stu.studentNumber,
        firstName: stu.firstName,
        lastName: stu.lastName,
      });
    }
    seenNumbers.set(branch, numSet);
    byBranch.set(branch, bucket);
  }

  if (previewRows.length === 0) {
    throw new Error('Excel sayfalarında aktarılacak öğrenci bulunamadı.');
  }
  return {
    groups: Array.from(byBranch.entries()).map(([name, rows]) => ({ className: name, rows })),
    previewRows,
  };
}

