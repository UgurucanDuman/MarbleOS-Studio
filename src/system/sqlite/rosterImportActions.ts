import { sanitizeSpreadsheetText } from '../schemas/textSecurity';
import { addStudentsBatchSchema, type AddStudentsBatchInput } from '../schemas/studioSchemas';
import type { StudentIdCardDetails, StudioDatabaseSnapshot } from './types';

export const rosterNameKey = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');

export function isStaffBranch(className?: string): boolean {
  const lower = (className ?? '').trim().toLocaleLowerCase('tr-TR');
  return (
    lower.startsWith('öğretmen') ||
    lower.startsWith('ogretmen') ||
    lower.startsWith('idare') ||
    lower.startsWith('kadro')
  );
}

export function cleanStudentIdCard(raw?: StudentIdCardDetails): StudentIdCardDetails | undefined {
  if (!raw) return undefined;
  const out: StudentIdCardDetails = {};
  for (const [k, v] of Object.entries(raw) as Array<[keyof StudentIdCardDetails, string | undefined]>) {
    const trimmed = v?.trim();
    if (trimmed) out[k] = trimmed;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * "1A", "09/b", "10 / Fen", "9. Sınıf A", "Hazırlık/A" gibi şube yazımlarını
 * standart ve temiz üst harf gösterimine ("1-A", "9-B", "10-FEN", "HAZIRLIK-A") dönüştürür.
 */
export function normalizeBranchClassName(raw: string): string {
  const stripped = sanitizeSpreadsheetText(raw).replace(/\s+/g, ' ');
  if (!stripped) return '';

  const gradeMatch = stripped.match(
    /^0*([1-9]|1[0-2])\s*(?:[-/. ]|\.\s*s[ıiİI]n[ıiİI]f\s*)?\s*([A-Za-zÇĞİÖŞÜçğıöşü]{1,6})(?:\s*şubesi|\s*subesi)?$/iu,
  );
  if (gradeMatch) {
    return `${gradeMatch[1]}-${gradeMatch[2]!.toLocaleUpperCase('tr-TR')}`;
  }

  const prepMatch = stripped.match(
    /^(haz[ıiİI]rl[ıiİI]k|anas[ıiİI]n[ıiİI]f[ıiİI]?)\s*[-/. ]\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9]{1,4})$/iu,
  );
  if (prepMatch) {
    return `${prepMatch[1]!.toLocaleUpperCase('tr-TR')}-${prepMatch[2]!.toLocaleUpperCase('tr-TR')}`;
  }

  return stripped.toLocaleUpperCase('tr-TR');
}

export function planRosterImport(state: StudioDatabaseSnapshot, rawInput: AddStudentsBatchInput) {
  const { classId, rows } = addStudentsBatchSchema.parse(rawInput);
  const targetClass = state.classes.find((item) => item.id === classId);
  if (!targetClass) throw new Error('Sınıf bulunamadı.');
  const isStaffList = isStaffBranch(targetClass.name);

  const existingByNumber = new Map(
    state.students.filter((student) => student.classId === classId).map((student) => [student.studentNumber, student]),
  );
  const existingStaffNames = new Set(
    state.students
      .filter((student) => student.classId === classId)
      .map((student) => `${rosterNameKey(student.firstName)}::${rosterNameKey(student.lastName)}`),
  );

  const unique = new Map<string, (typeof rows)[number]>();
  let skipped = 0;
  for (const row of rows) {
    if (isStaffList && row.studentNumber === '0') {
      const fullKey = `${rosterNameKey(row.firstName)}::${rosterNameKey(row.lastName)}`;
      if (existingStaffNames.has(fullKey) || unique.has(fullKey)) {
        skipped++;
      } else {
        unique.set(fullKey, row);
      }
      continue;
    }

    const previous = existingByNumber.get(row.studentNumber) ?? unique.get(row.studentNumber);
    if (previous) {
      if (
        rosterNameKey(previous.firstName) !== rosterNameKey(row.firstName) ||
        rosterNameKey(previous.lastName) !== rosterNameKey(row.lastName)
      ) {
        throw new Error(`${row.studentNumber} numarası farklı bir ad/soyadla kayıtlı. Liste değiştirilmedi, bu kaydı kontrol edin.`);
      }
      skipped++;
    } else unique.set(row.studentNumber, row);
  }
  return { classId, rows: [...unique.values()], skipped };
}

export function rosterImportNotice(result: { added: number; skipped: number }) {
  return `${result.added} yeni kayıt eklendi. ${result.skipped} mevcut kayıt atlandı.`;
}
