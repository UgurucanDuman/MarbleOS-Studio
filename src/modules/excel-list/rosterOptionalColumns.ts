import type { StudentInput } from '../../system/schemas/studioSchemas';
import type { StudentIdCardDetails } from '../../system/sqlite/types';
import { normalizeSpreadsheetHeader, sanitizeSpreadsheetCell } from './spreadsheetShared';

/**
 * İZOLE MODÜL 01 YARDIMCISI: İsteğe Bağlı Kimlik & Kütük Sütun Eşleme ve Doğrulama
 * Okul Excel listelerindeki T.C. Kimlik No, Doğum Tarihi/Yeri, Kan Grubu, Anne/Baba Adı,
 * Görevi ve Grup Kodu sütunlarını otomatik algılar ve güvenli biçimde `StudentInput`'a aktarır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export type OptionalRosterField =
  | 'nationalId'
  | 'department'
  | 'birthDate'
  | 'birthPlace'
  | 'bloodType'
  | 'fatherName'
  | 'motherName'
  | 'role'
  | 'groupCode';

export const OPTIONAL_ROSTER_FIELDS: ReadonlyArray<readonly [OptionalRosterField, string]> = [
  ['nationalId', 'T.C. Kimlik No'],
  ['department', 'Bölümü / Alanı'],
  ['birthDate', 'Doğum Tarihi'],
  ['birthPlace', 'Doğum Yeri'],
  ['bloodType', 'Kan Grubu'],
  ['fatherName', 'Baba Adı'],
  ['motherName', 'Anne Adı'],
  ['role', 'Görevi / Unvan'],
  ['groupCode', 'Grup Kodu'],
];

const OPTIONAL_HEADERS: Record<OptionalRosterField, readonly string[]> = {
  nationalId: [
    'tc',
    'tc no',
    'tc kimlik',
    'tc kimlik no',
    'tc kimlik numarasi',
    'kimlik no',
    'kimlik numarasi',
    't c kimlik no',
  ],
  department: ['bolum', 'bolumu', 'alan', 'alani', 'dal', 'dali', 'bolumu alani', 'alan dal'],
  birthDate: ['dogum tarihi', 'd tarihi', 'dtarihi', 'dogum gunu'],
  birthPlace: ['dogum yeri', 'd yeri', 'dyeri', 'memleket'],
  bloodType: ['kan grubu', 'kan', 'kangrubu', 'kan gr'],
  fatherName: ['baba adi', 'baba', 'veli baba', 'baba ad'],
  motherName: ['anne adi', 'anne', 'ana adi', 'anne ad'],
  role: ['gorevi', 'gorev', 'unvan', 'unvani', 'brans', 'bransi', 'gorevi unvan'],
  groupCode: ['grup', 'grup kodu', 'cekim grubu', 'oturum'],
};

export function detectOptionalHeaderColumns(
  cells: Record<number, string | null>,
  reservedCols: ReadonlySet<number>,
): Partial<Record<OptionalRosterField, number>> {
  const detected: Partial<Record<OptionalRosterField, number>> = {};
  const used = new Set<number>(reservedCols);
  for (const [field] of OPTIONAL_ROSTER_FIELDS) {
    const aliases = OPTIONAL_HEADERS[field];
    const matches = Object.entries(cells).filter(([colStr, val]) => {
      const col = Number(colStr);
      return !used.has(col) && Boolean(val) && aliases.includes(normalizeSpreadsheetHeader(val!));
    });
    if (matches.length === 1) {
      const col = Number(matches[0]![0]);
      detected[field] = col;
      used.add(col);
    }
  }
  return detected;
}

function normalizeOptionalCell(raw: string | undefined): string {
  const cleaned = sanitizeSpreadsheetCell(raw);
  if (!cleaned || cleaned === '-' || cleaned === '—' || cleaned === '--') {
    return '';
  }
  return cleaned;
}

export function normalizeSpreadsheetDateText(raw: string): string {
  const trimmed = raw.trim();
  // Excel 1900 seri tarih tamsayısı (1970..2050 aralığı: 25569..55153)
  if (/^\d{5}$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial >= 20_000 && serial <= 60_000) {
      const utcMs = (serial - 25_569) * 86_400_000;
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${day}.${month}.${d.getUTCFullYear()}`;
      }
    }
  }
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }
  return trimmed;
}

export function ensureNoDuplicateOptionalColumns(
  requiredCols: readonly number[],
  optional: Partial<Record<OptionalRosterField, number>>,
): void {
  const seen = new Set<number>(requiredCols);
  for (const [field, label] of OPTIONAL_ROSTER_FIELDS) {
    const col = optional[field];
    if (col === undefined) continue;
    if (seen.has(col)) {
      throw new Error(`"${label}" alanı başka bir alanla aynı sütuna bağlanmış; farklı sütun seçin.`);
    }
    seen.add(col);
  }
}

export function extractOptionalRowFields(
  rowNumber: number,
  cells: Record<number, string | null>,
  optional: Partial<Record<OptionalRosterField, number>>,
): Partial<Pick<StudentInput, 'role' | 'groupCode' | 'idCard'>> {
  for (const [field, label] of OPTIONAL_ROSTER_FIELDS) {
    const col = optional[field];
    if (col !== undefined && cells[col] === null) {
      throw new Error(`${rowNumber}. satır (${label}): formül içeren hücreyi önce Excel'de değer olarak kaydedin.`);
    }
  }

  const idCard: StudentIdCardDetails = {};
  if (optional.nationalId !== undefined) {
    const tc = normalizeOptionalCell(cells[optional.nationalId] ?? undefined).replace(/\s+/g, '');
    if (tc) {
      if (!/^\d{1,11}$/.test(tc)) {
        throw new Error(`${rowNumber}. satır: T.C. Kimlik No yalnızca rakam (en fazla 11 hane) içerebilir.`);
      }
      idCard.nationalId = tc;
    }
  }
  if (optional.department !== undefined) {
    const dept = normalizeOptionalCell(cells[optional.department] ?? undefined);
    if (dept) idCard.department = dept.slice(0, 60);
  }
  if (optional.birthDate !== undefined) {
    const bd = normalizeOptionalCell(cells[optional.birthDate] ?? undefined);
    if (bd) idCard.birthDate = normalizeSpreadsheetDateText(bd).slice(0, 24);
  }
  if (optional.birthPlace !== undefined) {
    const bp = normalizeOptionalCell(cells[optional.birthPlace] ?? undefined);
    if (bp) idCard.birthPlace = bp.slice(0, 50);
  }
  if (optional.bloodType !== undefined) {
    const bt = normalizeOptionalCell(cells[optional.bloodType] ?? undefined);
    if (bt) idCard.bloodType = bt.slice(0, 16);
  }
  if (optional.fatherName !== undefined) {
    const fn = normalizeOptionalCell(cells[optional.fatherName] ?? undefined);
    if (fn) idCard.fatherName = fn.slice(0, 50);
  }
  if (optional.motherName !== undefined) {
    const mn = normalizeOptionalCell(cells[optional.motherName] ?? undefined);
    if (mn) idCard.motherName = mn.slice(0, 50);
  }

  const role = optional.role !== undefined ? normalizeOptionalCell(cells[optional.role] ?? undefined).slice(0, 40) : '';
  const groupCode =
    optional.groupCode !== undefined ? normalizeOptionalCell(cells[optional.groupCode] ?? undefined).slice(0, 24) : '';

  return {
    ...(role ? { role } : {}),
    ...(groupCode ? { groupCode } : {}),
    ...(Object.keys(idCard).length > 0 ? { idCard } : {}),
  };
}
