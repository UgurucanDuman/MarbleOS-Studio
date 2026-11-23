import { expect, test } from 'vitest';
import { parseSchoolExcelOrCsvText } from './schoolExcelParser';

test('parses single-column and multi-column Excel/CSV school lists without shifting empty cells', () => {
  const raw = [
    'Kurum Kodu;Okul Adı;Adres;Notlar',
    '000123;Atatürk İlkokulu;Merkez Mah.;Pazartesi çekim',
    ';Cumhuriyet Ortaokulu;Yeni Mah.;',
    'İnönü Anadolu Lisesi',
  ].join('\n');

  const rows = parseSchoolExcelOrCsvText(raw);
  expect(rows).toEqual([
    {
      name: 'Atatürk İlkokulu',
      institutionCode: '000123',
      address: 'Merkez Mah.',
      notes: 'Pazartesi çekim',
      makeBiometric: false,
      makeVesikalik: true,
    },
    {
      name: 'Cumhuriyet Ortaokulu',
      institutionCode: '',
      address: 'Yeni Mah.',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    },
    {
      name: 'İnönü Anadolu Lisesi',
      institutionCode: '',
      address: '',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    },
  ]);
});

test('strips spreadsheet formula prefixes from imported cells', () => {
  const rows = parseSchoolExcelOrCsvText('000999\t= Cumhuriyet Lisesi\t@Merkez');
  expect(rows[0].name).toBe('Cumhuriyet Lisesi');
  expect(rows[0].address).toBe('Merkez');
});

