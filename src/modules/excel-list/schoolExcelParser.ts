import { schoolInputSchema, type SchoolInput } from '../../system/schemas/schoolSchemas';
import { splitDelimitedLine, TEXT_LIST_FILE_LIMIT } from './spreadsheetShared';

/**
 * İZOLE MODÜL 01 YARDIMCISI: Excel / CSV Okul Listesi Ayrıştırıcı
 * Boş hücreler filtrelenmez (sütun kayması önlenir); formül önekleri (=, +, -, @) ve Bidi karakterleri temizlenir.
 */

function isHeaderRow(parts: string[]): boolean {
  const first = parts[0]?.toLocaleLowerCase('tr-TR') ?? '';
  const second = parts[1]?.toLocaleLowerCase('tr-TR') ?? '';
  return (
    /^(kurum\s*kodu|kod|okul\s*kodu|okul\s*adı|okul\s*adi|okul)$/.test(first) ||
    /^(okul\s*adı|okul\s*adi|okul)$/.test(second)
  );
}

export function parseSchoolExcelOrCsvText(rawText: string): SchoolInput[] {
  if (rawText.length > TEXT_LIST_FILE_LIMIT) throw new Error('Okul listesi metni en fazla 1 MB olabilir.');
  const lines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error('Aktarılacak en az 1 okul satırı girin.');
  if (lines.length > 501) throw new Error('Tek aktarımda en fazla 500 okul olabilir.');

  const results: SchoolInput[] = [];
  for (const [index, line] of lines.entries()) {
    const parts = splitDelimitedLine(line, index + 1);
    if (index === 0 && isHeaderRow(parts)) continue;
    if (parts.length > 4) {
      throw new Error(`${index + 1}. satır: en fazla 4 sütun (Kurum Kodu, Okul Adı, Adres, Notlar) olabilir.`);
    }

    let institutionCode = '';
    let name = '';
    let address = '';
    let notes = '';

    if (parts.length === 1) {
      [name] = parts;
    } else if (/^\d*$/.test(parts[0] ?? '')) {
      [institutionCode = '', name = '', address = '', notes = ''] = parts;
    } else {
      [name = '', address = '', notes = ''] = parts;
    }

    if (!name || name.length < 2) {
      throw new Error(`${index + 1}. satır: okul adı en az 2 karakter olmalıdır.`);
    }
    if (institutionCode && !/^\d{1,12}$/.test(institutionCode)) {
      throw new Error(`${index + 1}. satır: kurum kodu yalnızca rakam (en fazla 12 hane) olabilir.`);
    }

    const parsed = schoolInputSchema.safeParse({
      name,
      institutionCode,
      address,
      notes,
      makeBiometric: false,
      makeVesikalik: true,
    });
    if (!parsed.success) {
      throw new Error(`${index + 1}. satır: ${parsed.error.issues[0]?.message ?? 'Geçersiz okul verisi.'}`);
    }
    results.push({
      name: parsed.data.name,
      institutionCode: parsed.data.institutionCode,
      address: parsed.data.address,
      notes: parsed.data.notes,
      makeBiometric: parsed.data.makeBiometric,
      makeVesikalik: parsed.data.makeVesikalik,
    });
  }

  if (results.length === 0) throw new Error('Başlık dışında geçerli okul satırı bulunamadı.');
  return results;
}
