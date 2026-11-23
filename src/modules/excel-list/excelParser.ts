import { splitDelimitedLine, TEXT_LIST_FILE_LIMIT } from './spreadsheetShared';

/**
 * İZOLE MODÜL 01 YARDIMCISI: Excel / CSV / e-Okul Liste Ayrıştırıcı (src/modules/excel-list/excelParser.ts)
 * Dosya Sınırı Kuralı: .ts dosyaları <= 240 satır.
 */

export interface ParsedStudentRow {
  studentNumber: string;
  firstName: string;
  lastName: string;
  role?: string;
}

/**
 * Excel'den kopyalanan (Tab ayracı) veya CSV (; / , ayracı) metinlerini ayrıştırır.
 * - Öğrenci şubesinde: 124;Zeynep;Korkmaz veya 128\tAhmet Can\tYıldırım
 * - Öğretmen kadrosunda (isStaff): Kemal;Demir;Matematik Öğretmeni veya Kemal;Demir
 */
export function parseExcelOrCsvText(
  rawText: string,
  options?: { isStaff?: boolean },
): ParsedStudentRow[] {
  if (rawText.length > TEXT_LIST_FILE_LIMIT) throw new Error('Liste metni en fazla 1 MB olabilir.');
  const lines = rawText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length > 5001) throw new Error('Tek aktarımda en fazla 5000 kayıt olabilir.');
  const isStaff = Boolean(options?.isStaff);
  const results: ParsedStudentRow[] = [];

  for (const [index, line] of lines.entries()) {
    const parts = splitDelimitedLine(line, index + 1);

    if (
      index === 0 &&
      /^(okul\s*no|no|numara|öğrenci(?:\s*(?:no|numarası))?|ad|adı|öğretmen(?:\s*adı)?)$/i.test(parts[0] ?? '')
    ) {
      continue;
    }
    if (!parts[0] || parts.length < 2 || parts.length > 3 || parts.some((part) => !part)) {
      throw new Error(
        isStaff
          ? `${index + 1}. satır: öğretmen adı, soyadı (ve isteğe bağlı görevi) sütunlarını kontrol edin.`
          : `${index + 1}. satır: okul numarası, ad ve soyad sütunlarını kontrol edin.`,
      );
    }

    if (isStaff && !/^\d+$/.test(parts[0])) {
      results.push({
        studentNumber: '0',
        firstName: parts[0],
        lastName: parts[1]!,
        ...(parts[2] ? { role: parts[2] } : {}),
      });
      continue;
    }

    if (parts.length === 3) {
      results.push({
        studentNumber: parts[0],
        firstName: parts[1]!,
        lastName: parts[2]!,
      });
    } else if (parts.length === 2) {
      const nameTokens = parts[1]!.split(/\s+/);
      const lastName = nameTokens.length > 1 ? nameTokens.pop()! : '';
      const firstName = nameTokens.join(' ') || parts[1]!;
      results.push({
        studentNumber: parts[0],
        firstName,
        lastName,
      });
    }
  }

  return results;
}
