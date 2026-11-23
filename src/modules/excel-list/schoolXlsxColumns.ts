import {
  SCHOOL_LIMITS,
  schoolInputSchema,
  schoolNameKey,
  type SchoolInput,
} from '../../system/schemas/schoolSchemas';
import { usedRosterColumns, type RosterRow } from './rosterColumns';
import { normalizeSpreadsheetHeader, sanitizeSpreadsheetCell } from './spreadsheetShared';

export type SchoolXlsxColumns = {
  name: number;
  institutionCode: number;
  address: number;
  notes: number;
};

export type SchoolXlsxMapping = {
  columns: Partial<SchoolXlsxColumns>;
  startRow: number;
};

const HEADER_ALIASES: Record<keyof SchoolXlsxColumns, string[]> = {
  name: ['okul', 'okul adi', 'kurum adi', 'okul ismi', 'kurum'],
  institutionCode: ['kurum kodu', 'okul kodu', 'meb kodu', 'kod', 'kurum no'],
  address: ['adres', 'okul adresi', 'konum', 'ilce', 'mahalle'],
  notes: ['not', 'notlar', 'aciklama', 'detay'],
};

export function suggestSchoolXlsxMapping(rows: RosterRow[]): SchoolXlsxMapping {
  for (const row of rows.slice(0, 12)) {
    const columns: Partial<SchoolXlsxColumns> = {};
    for (const field of Object.keys(HEADER_ALIASES) as Array<keyof SchoolXlsxColumns>) {
      const matches = Object.entries(row.cells).filter(
        ([, val]) => val && HEADER_ALIASES[field].includes(normalizeSpreadsheetHeader(val)),
      );
      if (matches.length === 1) columns[field] = Number(matches[0]![0]);
    }
    if (columns.name !== undefined) {
      return { columns, startRow: row.number + 1 };
    }
  }

  const cols = usedRosterColumns(rows);
  const columns: Partial<SchoolXlsxColumns> = {};
  if (cols.length === 1) {
    columns.name = cols[0];
  } else if (cols.length >= 2) {
    const firstValues = rows
      .flatMap(({ cells }) => (typeof cells[cols[0]!] === 'string' ? [cells[cols[0]!]!] : []))
      .filter(Boolean);
    const firstIsCode =
      firstValues.length > 0 && firstValues.every((v) => /^\d{1,12}$/.test(v.trim()));
    if (firstIsCode) {
      columns.institutionCode = cols[0];
      columns.name = cols[1];
      if (cols[2] !== undefined) columns.address = cols[2];
      if (cols[3] !== undefined) columns.notes = cols[3];
    } else {
      columns.name = cols[0];
      columns.address = cols[1];
      if (cols[2] !== undefined) columns.notes = cols[2];
    }
  }
  return { columns, startRow: rows[0]?.number ?? 1 };
}

export function readMappedSchools(rows: RosterRow[], mapping: SchoolXlsxMapping): SchoolInput[] {
  const { name, institutionCode, address, notes } = mapping.columns;
  if (name === undefined) {
    throw new Error('Okul adı için bir Excel sütunu seçin.');
  }
  const chosen = [name, institutionCode, address, notes].filter((c): c is number => c !== undefined);
  if (new Set(chosen).size !== chosen.length) {
    throw new Error('Her okul alanı için farklı bir sütun seçin.');
  }
  if (!Number.isInteger(mapping.startRow) || mapping.startRow < 1) {
    throw new Error('Geçerli bir başlangıç satırı yazın.');
  }

  const results: SchoolInput[] = [];
  const seenNames = new Set<string>();
  const seenCodes = new Set<string>();

  for (const row of rows) {
    if (row.number < mapping.startRow) continue;
    const rawValues = chosen.map((col) => row.cells[col]);
    if (rawValues.every((v) => v === undefined)) continue;
    if (rawValues.includes(null)) {
      throw new Error(`${row.number}. satır: formül içeren hücreyi önce Excel'de değer olarak kaydedin.`);
    }

    const cleanName = sanitizeSpreadsheetCell(row.cells[name]);
    const cleanCode = institutionCode !== undefined ? sanitizeSpreadsheetCell(row.cells[institutionCode]) : '';
    const cleanAddr = address !== undefined ? sanitizeSpreadsheetCell(row.cells[address]) : '';
    const cleanNotes = notes !== undefined ? sanitizeSpreadsheetCell(row.cells[notes]) : '';

    if (!cleanName && !cleanCode && !cleanAddr && !cleanNotes) continue;

    const parsed = schoolInputSchema.safeParse({
      name: cleanName,
      institutionCode: cleanCode,
      address: cleanAddr,
      notes: cleanNotes,
      makeBiometric: false,
      makeVesikalik: true,
    });
    if (!parsed.success) {
      throw new Error(`${row.number}. satır: ${parsed.error.issues[0]?.message ?? 'Okul satırı geçersiz.'}`);
    }

    const nKey = schoolNameKey(parsed.data.name);
    if (seenNames.has(nKey)) {
      throw new Error(`${row.number}. satır: "${parsed.data.name}" okul adı listede yineleniyor.`);
    }
    seenNames.add(nKey);

    if (parsed.data.institutionCode) {
      if (seenCodes.has(parsed.data.institutionCode)) {
        throw new Error(`${row.number}. satır: "${parsed.data.institutionCode}" kurum kodu listede yineleniyor.`);
      }
      seenCodes.add(parsed.data.institutionCode);
    }

    results.push({
      name: parsed.data.name,
      institutionCode: parsed.data.institutionCode,
      address: parsed.data.address,
      notes: parsed.data.notes,
      makeBiometric: parsed.data.makeBiometric,
      makeVesikalik: parsed.data.makeVesikalik,
    });
    if (results.length > SCHOOL_LIMITS.maxSchools) {
      throw new Error(`Tek aktarımda en fazla ${SCHOOL_LIMITS.maxSchools} okul bulunabilir.`);
    }
  }

  if (results.length === 0) {
    throw new Error('Seçilen sütunlarda aktarılacak geçerli okul bulunamadı.');
  }
  return results;
}
