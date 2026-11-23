import { strToU8, zipSync } from 'fflate';
import { expect, test } from 'vitest';
import { readMappedRoster, suggestRosterMapping, type RosterRow } from './rosterColumns';
import { readBranchColumnRoster, suggestSchoolBranchMapping } from './schoolRosterColumns';
import { readValidatedTextListFile } from './spreadsheetShared';
import { buildClassRosterXlsxBytes } from './xlsxExport';
import { readXlsxRoster } from './xlsxRoster';

const namespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function workbook(rows: string) {
  return zipSync({
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="${namespace}"><sheets><sheet name="1-A" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships><Relationship Id="rId1" Type="${namespace}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${rows}</sheetData></worksheet>`),
    'xl/sharedStrings.xml': strToU8('<sst><si><r><t>Örnek </t></r><r><t>İsim</t></r></si><si><t>Deneme</t></si></sst>'),
    'xl/styles.xml': strToU8('<styleSheet><numFmts><numFmt numFmtId="164" formatCode="0000"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs></styleSheet>'),
  });
}

test('detects A, D and H in a headerless 33-row Excel workbook and preserves names and zero padding', () => {
  const rows = Array.from({ length: 33 }, (_, index) => {
    const row = index + 1;
    return `<row r="${row}"><c r="A${row}"><v>${row + 100}</v></c><c r="D${row}" t="s"><v>0</v></c><c r="H${row}" t="s"><v>1</v></c></row>`;
  }).join('');
  const [sheet] = readXlsxRoster(workbook(rows));
  expect(sheet.name).toBe('1-A');
  const mapping = suggestRosterMapping(sheet.rows);
  expect(mapping).toEqual({ columns: { studentNumber: 0, firstName: 3, lastName: 7 }, startRow: 1 });
  const result = readMappedRoster(sheet.rows, mapping);
  expect(result).toHaveLength(33);
  expect(result[0]).toEqual({ studentNumber: '0101', firstName: 'Örnek İsim', lastName: 'Deneme' });
});

test('asks for explicit mapping when two numeric columns are plausible', () => {
  const rows: RosterRow[] = [{ number: 1, cells: { 0: '1', 1: '00702', 3: 'Deneme Ad', 7: 'Soyad' } }];
  const mapping = suggestRosterMapping(rows);
  expect(mapping.columns).toEqual({});
  expect(() => readMappedRoster(rows, mapping)).toThrow('üç farklı sütun');
  expect(readMappedRoster(rows, { columns: { studentNumber: 1, firstName: 3, lastName: 7 }, startRow: 1 }))
    .toEqual([{ studentNumber: '00702', firstName: 'Deneme Ad', lastName: 'Soyad' }]);
});

test('a formula in a mapped column blocks the roster before mutation', () => {
  const [sheet] = readXlsxRoster(workbook('<row r="1"><c r="A1"><f>100+1</f><v>101</v></c><c r="D1" t="s"><v>0</v></c><c r="H1" t="s"><v>1</v></c></row>'));
  expect(() => readMappedRoster(sheet.rows, { columns: { studentNumber: 0, firstName: 3, lastName: 7 }, startRow: 1 }))
    .toThrow('1. satır: formül');
});

test('rejects archives with oversized XML before extracting it', () => {
  const bytes = zipSync({ 'xl/workbook.xml': new Uint8Array(8_000_001) });
  expect(() => readXlsxRoster(bytes)).toThrow('boyutu veya yapısı');
});

test('blocks archive path traversal, oversized cell strings, and binary files uploaded as CSV', async () => {
  const traversal = zipSync({ 'xl/worksheets/../evil.xml': strToU8('<worksheet/>') });
  expect(() => readXlsxRoster(traversal)).toThrow('geçersiz arşiv yolu');

  const hugeCell = workbook(`<row r="1"><c r="A1" t="inlineStr"><is><t>${'A'.repeat(4_001)}</t></is></c></row>`);
  expect(() => readXlsxRoster(hugeCell)).toThrow('uzunluk sınırını');

  const disguisedZip = new File([traversal.buffer as ArrayBuffer], 'sahte.csv', { type: 'text/csv' });
  await expect(readValidatedTextListFile(disguisedZip)).rejects.toThrow(/metin biçiminde değil/);
});

test('round-trips exported .xlsx with optional ID-card columns, leading zeros, Excel dates, and formula protection', () => {
  const bytes = buildClassRosterXlsxBytes(
    {
      id: 'cls-1',
      schoolId: 'sch-1',
      academicYear: '2026-2027',
      name: '9-A',
      teacherName: 'Ayşe Kaya',
      createdAt: '2026-11-10T00:00:00Z',
    },
    [
      {
        id: 'stu-1',
        classId: 'cls-1',
        studentNumber: '00712',
        firstName: 'Atlas',
        lastName: 'Çevik',
        role: 'Sınıf Başkanı',
        groupCode: 'A',
        idCard: {
          nationalId: '10234567890',
          birthDate: '15.05.2014',
          birthPlace: 'Ankara',
          bloodType: 'A Rh+',
          fatherName: 'Murat',
          motherName: 'Selin',
        },
        matchedPhotoId: null,
        printReady: true,
        updatedAt: '2026-11-10T00:00:00Z',
      },
      {
        id: 'stu-2',
        classId: 'cls-1',
        studentNumber: '00715',
        firstName: '=SUM(1,2)',
        lastName: 'Uçar',
        matchedPhotoId: null,
        printReady: false,
        updatedAt: '2026-11-10T00:00:00Z',
      },
    ],
    [],
  );

  const sheets = readXlsxRoster(bytes);
  expect(sheets).toHaveLength(1);
  expect(sheets[0]!.name).toBe('9-A');

  // Formül karakteriyle başlayan hücre tek tırnakla etkisizleştirilmiş olmalıdır
  expect(sheets[0]!.rows[2]!.cells[3]).toBe("'=SUM(1,2)");

  // Sütundan şube + isteğe bağlı kimlik alanları otomatik algılanır
  const branchMap = suggestSchoolBranchMapping(sheets[0]!.rows);
  expect(branchMap.columns.department).toBe(7);
  expect(branchMap.columns.nationalId).toBe(8);
  expect(branchMap.columns.birthDate).toBe(9);
  expect(branchMap.columns.bloodType).toBe(11);

  // Excel seri tarih sayısı (41774 -> 15.05.2014) ve Bölümü alanı otomatik dönüştürülür
  const serialRows: RosterRow[] = [
    {
      number: 1,
      cells: { 0: 'Şube', 1: 'Okul No', 2: 'Ad', 3: 'Soyad', 4: 'T.C. Kimlik No', 5: 'Doğum Tarihi', 6: 'Bölümü' },
    },
    {
      number: 2,
      cells: { 0: '9/a', 1: '0042', 2: 'Duru', 3: 'SoyadTest', 4: '12345678901', 5: '41774', 6: 'Sayısal' },
    },
  ];
  const parsedSchool = readBranchColumnRoster(serialRows, suggestSchoolBranchMapping(serialRows));
  expect(parsedSchool.groups[0]!.className).toBe('9-A');
  expect(parsedSchool.groups[0]!.rows[0]).toEqual({
    studentNumber: '0042',
    firstName: 'Duru',
    lastName: 'SoyadTest',
    idCard: {
      nationalId: '12345678901',
      birthDate: '15.05.2014',
      department: 'Sayısal',
    },
  });
});
