import { parseExcelOrCsvText } from './excelParser';

/**
 * İZOLE MODÜL 01 TESTİ: Excel / CSV / e-Okul Ayrıştırıcı Doğrulama Testi
 * Dosya Sınırı Kuralı: .ts <= 250 satır.
 */
export function runExcelParserUnitTests(): boolean {
  const sample = [
    'Okul No;Öğrenci Adı;Soyadı',
    '104;Elif;Aksoy',
    '108\tCaner Efe\tÖztürk',
    '112,Defne,Yılmaz',
  ].join('\n');

  const rows = parseExcelOrCsvText(sample);
  if (rows.length !== 3) {
    throw new Error(`Beklenen satır sayısı 3, gelen: ${rows.length}`);
  }
  if (rows[0].studentNumber !== '104' || rows[0].firstName !== 'Elif') {
    throw new Error('İlk öğrenci ayrıştırması hatalı');
  }
  if (rows[1].firstName !== 'Caner Efe' || rows[1].lastName !== 'Öztürk') {
    throw new Error('Tab ayraçlı öğrenci ayrıştırması hatalı');
  }
  return true;
}

test('existing CSV and pasted Excel cases', runExcelParserUnitTests);
test.each([';Ali;Yılmaz', '123;;Yılmaz', '123;Ali;', '123;Ali;Yılmaz;fazla', '123;"Ali;Yılmaz'])('rejects malformed rows without shifting columns: %s', (input) => {
  expect(() => parseExcelOrCsvText(input)).toThrow();
});
test('preserves leading zeros and quoted delimiters', () => {
  expect(parseExcelOrCsvText('001;"Ali, Can";"Yıl""maz"')).toEqual([
    { studentNumber: '001', firstName: 'Ali, Can', lastName: 'Yıl"maz' },
  ]);
});
test('bounds import size before parsing', () => {
  expect(() => parseExcelOrCsvText('a'.repeat(1_000_001))).toThrow();
});
test('parses teacher rows without requiring student numbers when isStaff is true', () => {
  const rows = parseExcelOrCsvText('Ad;Soyad;Görevi\nKemal;Demir;Matematik Öğretmeni\nAyşe;Kaya', { isStaff: true });
  expect(rows).toEqual([
    { studentNumber: '0', firstName: 'Kemal', lastName: 'Demir', role: 'Matematik Öğretmeni' },
    { studentNumber: '0', firstName: 'Ayşe', lastName: 'Kaya' },
  ]);
});

import { expect, test } from 'vitest';
