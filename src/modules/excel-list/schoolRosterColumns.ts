import { bulkStudentRowSchema, type StudentInput } from '../../system/schemas/studioSchemas';
import { normalizeBranchClassName } from '../../system/sqlite/rosterImportActions';
import {
  suggestRosterMapping,
  usedRosterColumns,
  type RosterRow,
  type RosterSheet,
} from './rosterColumns';
import {
  detectOptionalHeaderColumns,
  ensureNoDuplicateOptionalColumns,
  extractOptionalRowFields,
  type OptionalRosterField,
} from './rosterOptionalColumns';
import { normalizeSpreadsheetHeader, sanitizeSpreadsheetCell } from './spreadsheetShared';

export type SchoolRosterMode = 'branch-column' | 'multi-sheet';

export type SchoolBranchColumns = {
  className: number;
  studentNumber: number;
  firstName: number;
  lastName: number;
} & Partial<Record<OptionalRosterField, number>>;

export type SchoolBranchMapping = {
  columns: Partial<SchoolBranchColumns>;
  startRow: number;
};

export type SchoolRosterPreviewItem = {
  className: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
};

export type ParsedSchoolRoster = {
  groups: Array<{ className: string; rows: StudentInput[] }>;
  previewRows: SchoolRosterPreviewItem[];
};

const REQUIRED_BRANCH_FIELDS = ['className', 'studentNumber', 'firstName', 'lastName'] as const;

const BRANCH_HEADERS: Record<(typeof REQUIRED_BRANCH_FIELDS)[number], string[]> = {
  className: ['sinif', 'sube', 'sinif sube', 'sinifi', 'subesi', 'sinif adi', 'sube adi'],
  studentNumber: ['no', 'numara', 'okul no', 'okul numarasi', 'ogrenci no', 'ogrenci numarasi', 'ogrenci kodu'],
  firstName: ['ad', 'adi', 'isim', 'ogrenci adi'],
  lastName: ['soyad', 'soyadi', 'soy isim', 'ogrenci soyadi'],
};

export function suggestSchoolBranchMapping(rows: RosterRow[]): SchoolBranchMapping {
  for (const row of rows.slice(0, 12)) {
    const columns: Partial<SchoolBranchColumns> = {};
    for (const field of REQUIRED_BRANCH_FIELDS) {
      const matches = Object.entries(row.cells).filter(
        ([, val]) => val && BRANCH_HEADERS[field].includes(normalizeSpreadsheetHeader(val)),
      );
      if (matches.length === 1) columns[field] = Number(matches[0]![0]);
    }
    if (
      columns.className !== undefined &&
      columns.studentNumber !== undefined &&
      columns.firstName !== undefined &&
      columns.lastName !== undefined
    ) {
      const reserved = new Set<number>([
        columns.className,
        columns.studentNumber,
        columns.firstName,
        columns.lastName,
      ]);
      Object.assign(columns, detectOptionalHeaderColumns(row.cells, reserved));
      return { columns, startRow: row.number + 1 };
    }
  }

  const base = suggestRosterMapping(rows);
  const used = usedRosterColumns(rows);
  const taken = new Set(
    [base.columns.studentNumber, base.columns.firstName, base.columns.lastName].filter(
      (v): v is number => v !== undefined,
    ),
  );
  let branchCol: number | undefined;
  for (const col of used) {
    if (taken.has(col)) continue;
    const sample = rows
      .filter((r) => r.number >= base.startRow)
      .flatMap((r) => (typeof r.cells[col] === 'string' ? [r.cells[col]!] : []));
    if (
      sample.length >= Math.max(1, Math.floor(rows.length * 0.5)) &&
      sample.every((v) => /^(?:0*(?:[1-9]|1[0-2])\s*[-/. ]?\s*[A-Za-zÇĞİÖŞÜçğıöşü]{1,5}|öğretmen.*|ogretmen.*)$/iu.test(v.trim()))
    ) {
      branchCol = col;
      break;
    }
  }

  return {
    columns: {
      ...base.columns,
      ...(branchCol !== undefined ? { className: branchCol } : {}),
    },
    startRow: base.startRow,
  };
}

export function detectDefaultSchoolRosterMode(sheets: RosterSheet[]): {
  mode: SchoolRosterMode;
  mapping: SchoolBranchMapping;
} {
  const first = sheets[0];
  if (!first) return { mode: 'branch-column', mapping: { columns: {}, startRow: 1 } };
  const mapping = suggestSchoolBranchMapping(first.rows);
  if (mapping.columns.className !== undefined) {
    return { mode: 'branch-column', mapping };
  }
  if (sheets.length > 1) {
    return { mode: 'multi-sheet', mapping };
  }
  const base = suggestRosterMapping(first.rows);
  const sheetLooksLikeBranch = /^(?:0*(?:[1-9]|1[0-2])\s*[-/. ]?\s*[A-Za-zÇĞİÖŞÜçğıöşü]{1,5}|haz[ıiİI]rl[ıiİI]k.*|öğretmen.*|ogretmen.*)$/iu.test(
    first.name.trim(),
  );
  if (sheetLooksLikeBranch && base.columns.studentNumber !== undefined) {
    return { mode: 'multi-sheet', mapping };
  }
  return { mode: 'branch-column', mapping };
}

export function readBranchColumnRoster(rows: RosterRow[], mapping: SchoolBranchMapping): ParsedSchoolRoster {
  const { className, studentNumber, firstName, lastName, ...optionalCols } = mapping.columns;
  if (
    className === undefined ||
    studentNumber === undefined ||
    firstName === undefined ||
    lastName === undefined ||
    new Set([className, studentNumber, firstName, lastName]).size !== 4
  ) {
    throw new Error('Şube, okul numarası, ad ve soyad için dört farklı sütun seçin.');
  }
  ensureNoDuplicateOptionalColumns([className, studentNumber, firstName, lastName], optionalCols);
  if (!Number.isInteger(mapping.startRow) || mapping.startRow < 1) {
    throw new Error('Geçerli bir başlangıç satırı yazın.');
  }

  const byBranch = new Map<string, StudentInput[]>();
  const seenInBranch = new Map<string, Map<string, string>>();
  const previewRows: SchoolRosterPreviewItem[] = [];

  for (const row of rows) {
    if (row.number < mapping.startRow) continue;
    const vals = [row.cells[className], row.cells[studentNumber], row.cells[firstName], row.cells[lastName]];
    if (vals.every((v) => v === undefined)) continue;
    if (vals.includes(null)) {
      throw new Error(`${row.number}. satır: formül içeren hücreyi önce Excel'de değer olarak kaydedin.`);
    }

    const branch = normalizeBranchClassName(vals[0] ?? '');
    if (branch.length < 2 || branch.length > 20) {
      throw new Error(`${row.number}. satır: geçerli bir sınıf/şube adı (Örn: 9-A) bulunamadı.`);
    }

    const extra = extractOptionalRowFields(row.number, row.cells, optionalCols);
    const parsed = bulkStudentRowSchema.safeParse({
      studentNumber: sanitizeSpreadsheetCell(vals[1]),
      firstName: sanitizeSpreadsheetCell(vals[2]),
      lastName: sanitizeSpreadsheetCell(vals[3]),
      ...extra,
    });
    if (!parsed.success) {
      throw new Error(`${row.number}. satır: okul numarası, ad ve soyad sütunlarını kontrol edin.`);
    }

    const branchSeen = seenInBranch.get(branch) ?? new Map<string, string>();
    const fullIdentity = `${parsed.data.firstName.toLocaleUpperCase('tr-TR')}::${parsed.data.lastName.toLocaleUpperCase('tr-TR')}`;
    const prevIdentity = branchSeen.get(parsed.data.studentNumber);
    if (prevIdentity !== undefined) {
      if (prevIdentity !== fullIdentity) {
        throw new Error(`${row.number}. satır: ${branch} şubesinde ${parsed.data.studentNumber} numarası farklı adla yineleniyor.`);
      }
      continue;
    }
    branchSeen.set(parsed.data.studentNumber, fullIdentity);
    seenInBranch.set(branch, branchSeen);

    const list = byBranch.get(branch) ?? [];
    list.push(parsed.data);
    byBranch.set(branch, list);
    previewRows.push({
      className: branch,
      studentNumber: parsed.data.studentNumber,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });
  }

  if (previewRows.length === 0) {
    throw new Error('Seçilen sütunlarda aktarılacak şube ve öğrenci bulunamadı.');
  }
  return {
    groups: Array.from(byBranch.entries()).map(([name, branchRows]) => ({ className: name, rows: branchRows })),
    previewRows,
  };
}
