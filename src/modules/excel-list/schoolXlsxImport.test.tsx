import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readMultiSheetSchoolRoster } from './schoolRosterMultiSheet';
import { readXlsxRoster } from './xlsxRoster';

MotionGlobalConfig.skipAnimations = true;

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildXlsxFile(
  fileName: string,
  sheets: Array<{ name: string; rows: Array<Array<string | { num: number; zeroPad?: boolean }>> }>,
): File {
  const sheetXmlEntries: Record<string, Uint8Array> = {};
  const workbookSheets: string[] = [];
  const relEntries: string[] = [];

  sheets.forEach((sheet, idx) => {
    const rId = `rId${idx + 1}`;
    const target = `worksheets/sheet${idx + 1}.xml`;
    workbookSheets.push(`<sheet name="${escapeXml(sheet.name)}" sheetId="${idx + 1}" r:id="${rId}"/>`);
    relEntries.push(`<Relationship Id="${rId}" Type="${REL_NS}/worksheet" Target="${target}"/>`);

    const rowXml = sheet.rows
      .map((cells, rIdx) => {
        const rowNum = rIdx + 1;
        const cellXml = cells
          .map((cell, cIdx) => {
            const colLetter = String.fromCharCode(65 + cIdx);
            const ref = `${colLetter}${rowNum}`;
            if (typeof cell === 'object') {
              const sAttr = cell.zeroPad ? ' s="0"' : '';
              return `<c r="${ref}"${sAttr}><v>${cell.num}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rowNum}">${cellXml}</row>`;
      })
      .join('');

    sheetXmlEntries[`xl/${target}`] = strToU8(`<worksheet><sheetData>${rowXml}</sheetData></worksheet>`);
  });

  const bytes = zipSync({
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="${REL_NS}"><sheets>${workbookSheets.join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${relEntries.join('')}</Relationships>`),
    'xl/styles.xml': strToU8(
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="000000"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs></styleSheet>',
    ),
    ...sheetXmlEntries,
  });

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([buffer], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  cleanup();
});

async function renderExcelWindow() {
  const [{ ExcelListWindow }, { StudioQueryProvider }, db] = await Promise.all([
    import('./ExcelListWindow'),
    import('../../system/query/StudioQueryProvider'),
    import('../../system/sqlite/studioDatabase'),
  ]);
  render(
    <StudioQueryProvider>
      <ExcelListWindow />
    </StudioQueryProvider>,
  );
  return db;
}

test('imports schools from .xlsx with zero-padded institution codes and formula sanitization, then imports multi-branch roster into selected school', async () => {
  const db = await renderExcelWindow();

  fireEvent.click(screen.getByRole('button', { name: 'Excel Dosyası (.xlsx)' }));
  await screen.findByRole('dialog', { name: 'Excel Dosyasından Okul Aktar (.xlsx)' });

  const schoolsXlsx = buildXlsxFile('okullar.xlsx', [
    {
      name: 'Okullar',
      rows: [
        ['Kurum Kodu', 'Okul Adı', 'Adres', 'Notlar'],
        [{ num: 741, zeroPad: true }, '=Atatürk Anadolu Lisesi', 'Merkez Mah.', 'Pazartesi çekim'],
        [{ num: 852, zeroPad: true }, 'Cumhuriyet Fen Lisesi', 'Yenişehir', 'Salı çekim'],
      ],
    },
  ]);

  fireEvent.change(screen.getByLabelText('Okul Excel dosyası (.xlsx)'), {
    target: { files: [schoolsXlsx] },
  });

  const importSchoolsBtn = await screen.findByRole('button', { name: '2 Okulu Aktar' });
  fireEvent.click(importSchoolsBtn);
  await vi.waitFor(() => expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(2));

  const savedSchools = db.getStudioDatabaseSnapshot().schools;
  expect(savedSchools[0]?.name).toBe('Atatürk Anadolu Lisesi');
  expect(savedSchools[0]?.institutionCode).toBe('000741');
  expect(savedSchools[1]?.name).toBe('Cumhuriyet Fen Lisesi');
  expect(savedSchools[1]?.institutionCode).toBe('000852');

  // Seçili okul henüz şubesizdir; doğrudan okula çok şubeli Excel aktarılır (9A + 09/a -> 9-A, 10/B -> 10-B)
  fireEvent.click(screen.getByRole('button', { name: "Okula Excel'den Aktar (.xlsx)" }));
  await screen.findByRole('dialog', { name: "Okula Excel'den Sınıf & Öğrenci Aktar (.xlsx)" });

  const schoolRosterXlsx = buildXlsxFile('ataturk-kadro.xlsx', [
    {
      name: 'Tüm Öğrenciler',
      rows: [
        ['Sınıf', 'Okul No', 'Ad', 'Soyad'],
        ['9A', '0042', 'Elif', 'Kaya'],
        ['09/a', '105', 'Mert', 'Yıldız'],
        ['10/B', '210', 'Zehra', 'Aydın'],
      ],
    },
  ]);

  fireEvent.change(screen.getByLabelText('Okul şube ve öğrenci Excel dosyası (.xlsx)'), {
    target: { files: [schoolRosterXlsx] },
  });

  const importRosterBtn = await screen.findByRole('button', { name: '2 Şube · 3 Öğrenciyi Aktar' });
  fireEvent.click(importRosterBtn);

  await vi.waitFor(() => expect(db.getStudioDatabaseSnapshot().classes).toHaveLength(2));
  const snap = db.getStudioDatabaseSnapshot();
  expect(snap.classes.map((c) => c.name)).toEqual(['9-A', '10-B']);
  expect(snap.students.map((s) => `${s.studentNumber}:${s.firstName}`)).toEqual([
    '0042:Elif',
    '105:Mert',
    '210:Zehra',
  ]);
}, 20_000);

test('supports multi-sheet school .xlsx workbooks and aborts entire school import on student number conflict', async () => {
  const multiSheetFile = buildXlsxFile('coklu-sayfa.xlsx', [
    {
      name: '11A',
      rows: [
        ['Okul No', 'Ad', 'Soyad'],
        ['301', 'Kerem', 'Şahin'],
      ],
    },
    {
      name: '11/B',
      rows: [
        ['Okul No', 'Ad', 'Soyad'],
        ['401', 'Derya', 'Çelik'],
      ],
    },
  ]);

  const parsedSheets = readXlsxRoster(new Uint8Array(await multiSheetFile.arrayBuffer()));
  const multi = readMultiSheetSchoolRoster(parsedSheets);
  expect(multi.groups.map((g) => g.className)).toEqual(['11-A', '11-B']);
  expect(multi.previewRows).toHaveLength(2);

  const db = await import('../../system/sqlite/studioDatabase');
  let schoolId = '';
  act(() => {
    schoolId = db.studioDbActions.createSchool({
      name: 'Atomik Test Lisesi',
      institutionCode: '999111',
      address: '',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const clsId = db.studioDbActions.addClass('11-A', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(clsId, [
      { studentNumber: '301', firstName: 'Farklı İsim', lastName: 'Kayıtlı' },
    ]);
  });

  expect(() =>
    db.studioDbActions.importSchoolRoster({
      schoolId,
      academicYear: '2026-2027',
      classes: multi.groups,
    }),
  ).toThrow(/11-A şubesinde 301 numarası farklı bir ad\/soyadla kayıtlı/);

  // 11-B asla yarım oluşturulmaz; veritabanı atomik olarak korunur
  expect(db.getStudioDatabaseSnapshot().classes.map((c) => c.name)).toEqual(['11-A']);
  expect(db.getStudioDatabaseSnapshot().students).toHaveLength(1);
});

