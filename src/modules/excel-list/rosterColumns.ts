import { bulkStudentRowSchema } from '../../system/schemas/studioSchemas';
import {
  detectOptionalHeaderColumns,
  ensureNoDuplicateOptionalColumns,
  extractOptionalRowFields,
  type OptionalRosterField,
} from './rosterOptionalColumns';
import { normalizeSpreadsheetHeader, sanitizeSpreadsheetCell } from './spreadsheetShared';

export type RosterRow = { number: number; cells: Record<number, string | null> };
export type RosterSheet = { name: string; rows: RosterRow[] };
export type RosterColumns = {
  studentNumber: number;
  firstName: number;
  lastName: number;
} & Partial<Record<OptionalRosterField, number>>;
export type RosterMapping = { columns: Partial<RosterColumns>; startRow: number };
const fields = ['studentNumber', 'firstName', 'lastName'] as const;

const headers: Record<(typeof fields)[number], string[]> = {
  studentNumber: ['no', 'numara', 'okul no', 'okul numarasi', 'ogrenci no', 'ogrenci numarasi', 'ogrenci kodu'],
  firstName: ['ad', 'adi', 'isim', 'ogrenci adi'],
  lastName: ['soyad', 'soyadi', 'soy isim', 'ogrenci soyadi'],
};

export function rosterColumnLabel(index: number) {
  let result = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

export function usedRosterColumns(rows: RosterRow[]) {
  const used = new Set<number>();
  for (const { cells } of rows) {
    for (const column of Object.keys(cells)) used.add(Number(column));
  }
  return [...used].sort((a, b) => a - b);
}

export function suggestRosterMapping(rows: RosterRow[]): RosterMapping {
  for (const row of rows.slice(0, 12)) {
    const columns: Partial<RosterColumns> = {};
    for (const field of fields) {
      const matches = Object.entries(row.cells).filter(
        ([, value]) => value && headers[field].includes(normalizeSpreadsheetHeader(value)),
      );
      if (matches.length === 1) columns[field] = Number(matches[0]![0]);
    }
    if (fields.every((field) => columns[field] !== undefined)) {
      const reserved = new Set<number>([columns.studentNumber!, columns.firstName!, columns.lastName!]);
      Object.assign(columns, detectOptionalHeaderColumns(row.cells, reserved));
      return { columns, startRow: row.number + 1 };
    }
  }

  const numeric: number[] = [];
  const names: number[] = [];
  for (const column of usedRosterColumns(rows)) {
    const values = rows.flatMap(({ cells }) => (typeof cells[column] === 'string' ? [cells[column]!] : []));
    if (values.length < Math.ceil(rows.length * 0.75)) continue;
    if (values.every((value) => /^\d{1,15}$/.test(value))) numeric.push(column);
    else if (values.every((value) => /^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(value))) names.push(column);
  }
  const columns: Partial<RosterColumns> = {};
  if (numeric.length === 1) columns.studentNumber = numeric[0];
  if (numeric.length === 1 && names.length === 2) {
    [columns.firstName, columns.lastName] = names;
  }
  return { columns, startRow: rows[0]?.number ?? 1 };
}

export function readMappedRoster(rows: RosterRow[], mapping: RosterMapping) {
  const { studentNumber, firstName, lastName, ...optionalCols } = mapping.columns;
  if (
    studentNumber === undefined ||
    firstName === undefined ||
    lastName === undefined ||
    new Set([studentNumber, firstName, lastName]).size !== 3
  ) {
    throw new Error('Okul numarası, ad ve soyad için üç farklı sütun seçin.');
  }
  ensureNoDuplicateOptionalColumns([studentNumber, firstName, lastName], optionalCols);
  if (!Number.isInteger(mapping.startRow) || mapping.startRow < 1) {
    throw new Error('Geçerli bir başlangıç satırı yazın.');
  }
  const result = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.number < mapping.startRow) continue;
    const values = [row.cells[studentNumber], row.cells[firstName], row.cells[lastName]];
    if (values.every((value) => value === undefined)) continue;
    if (values.includes(null)) {
      throw new Error(`${row.number}. satır: formül içeren hücreyi önce Excel'de değer olarak kaydedin.`);
    }
    const extra = extractOptionalRowFields(row.number, row.cells, optionalCols);
    const parsed = bulkStudentRowSchema.safeParse({
      studentNumber: sanitizeSpreadsheetCell(values[0]),
      firstName: sanitizeSpreadsheetCell(values[1]),
      lastName: sanitizeSpreadsheetCell(values[2]),
      ...extra,
    });
    if (!parsed.success) {
      throw new Error(`${row.number}. satır: okul numarası, ad ve soyad sütunlarını kontrol edin.`);
    }
    if (seen.has(parsed.data.studentNumber)) {
      throw new Error(`${row.number}. satır: okul numarası listede yineleniyor.`);
    }
    seen.add(parsed.data.studentNumber);
    result.push(parsed.data);
  }
  if (result.length === 0) throw new Error('Seçilen sütunlarda aktarılacak öğrenci bulunamadı.');
  return result;
}
