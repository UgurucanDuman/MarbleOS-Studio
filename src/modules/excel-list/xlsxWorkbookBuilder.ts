import { strToU8, zipSync, type Zippable } from 'fflate';
import { rosterColumnLabel } from './rosterColumns';

/**
 * İZOLE MODÜL 01 OPENXML ÇEKİRDEĞİ:
 * Metin biçimli (`numFmtId="49"` `@`), formül enjeksiyon korumalı ve `readXlsxRoster`
 * ile birebir uyumlu ECMA-376 `.xlsx` ZIP arşivi üretir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_OFFICE_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_PKG_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';

function escapeXmlText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function neutralizeExcelFormulaCell(raw: string): string {
  const cleaned = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ').trim();
  if (!cleaned) return '';
  if (/^[\s\uFEFF]*[=+\-@|%]/u.test(cleaned) || /^[\t\r\n]/u.test(cleaned)) {
    return `'${cleaned}`;
  }
  return cleaned;
}

function sanitizeSheetName(raw: string, usedLower: Set<string>, fallbackIdx: number): string {
  const base =
    raw
      .replace(/[:\\/?*[\]]+/g, '-')
      .replace(/^'+|'+$/g, '')
      .trim()
      .slice(0, 28) || `Sayfa_${fallbackIdx}`;
  let candidate = base;
  let n = 2;
  while (usedLower.has(candidate.toLocaleLowerCase('tr-TR'))) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  usedLower.add(candidate.toLocaleLowerCase('tr-TR'));
  return candidate;
}

export interface XlsxSheetInput {
  name: string;
  rows: ReadonlyArray<readonly string[]>;
}

export function buildXlsxWorkbookBytes(sheets: readonly XlsxSheetInput[]): Uint8Array {
  if (sheets.length === 0) {
    throw new Error('Excel çalışma kitabı için en az 1 sayfa gereklidir.');
  }

  const sharedIndex = new Map<string, number>();
  const sharedStrings: string[] = [];
  let totalStringRefs = 0;

  const internString = (text: string): number => {
    totalStringRefs += 1;
    const existing = sharedIndex.get(text);
    if (existing !== undefined) return existing;
    const idx = sharedStrings.length;
    sharedStrings.push(text);
    sharedIndex.set(text, idx);
    return idx;
  };

  const usedNames = new Set<string>();
  const archive: Zippable = {};
  const sheetEntries: Array<{ sheetName: string; relId: string; fileName: string }> = [];

  sheets.slice(0, 20).forEach((sheet, idx) => {
    const sheetNum = idx + 1;
    const relId = `rId${sheetNum}`;
    const fileName = `sheet${sheetNum}.xml`;
    const sheetName = sanitizeSheetName(sheet.name, usedNames, sheetNum);
    sheetEntries.push({ sheetName, relId, fileName });

    const rowXmlParts: string[] = [];
    sheet.rows.forEach((cells, rowIdx) => {
      const rNum = rowIdx + 1;
      const styleAttr = rowIdx === 0 ? ' s="1"' : ' s="0"';
      const cellParts: string[] = [];
      cells.forEach((rawVal, colIdx) => {
        const safeVal = rowIdx === 0 ? rawVal.trim() : neutralizeExcelFormulaCell(rawVal);
        if (!safeVal) return;
        const ref = `${rosterColumnLabel(colIdx)}${rNum}`;
        cellParts.push(`<c r="${ref}" t="s"${styleAttr}><v>${internString(safeVal)}</v></c>`);
      });
      if (cellParts.length > 0) {
        rowXmlParts.push(`<row r="${rNum}">${cellParts.join('')}</row>`);
      }
    });

    archive[`xl/worksheets/${fileName}`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<worksheet xmlns="${MAIN_NS}"><sheetData>${rowXmlParts.join('')}</sheetData></worksheet>`,
    );
  });

  archive['[Content_Types].xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="${CT_NS}">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      sheetEntries
        .map((s) => `<Override PartName="/xl/worksheets/${s.fileName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('') +
      `</Types>`,
  );

  archive['_rels/.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${REL_PKG_NS}">` +
      `<Relationship Id="rId1" Type="${REL_OFFICE_NS}/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  );

  archive['xl/workbook.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_OFFICE_NS}"><sheets>` +
      sheetEntries
        .map((s, i) => `<sheet name="${escapeXmlText(s.sheetName)}" sheetId="${i + 1}" r:id="${s.relId}"/>`)
        .join('') +
      `</sheets></workbook>`,
  );

  archive['xl/_rels/workbook.xml.rels'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${REL_PKG_NS}">` +
      sheetEntries
        .map((s) => `<Relationship Id="${s.relId}" Type="${REL_OFFICE_NS}/worksheet" Target="worksheets/${s.fileName}"/>`)
        .join('') +
      `<Relationship Id="rIdStyles" Type="${REL_OFFICE_NS}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rIdStrings" Type="${REL_OFFICE_NS}/sharedStrings" Target="sharedStrings.xml"/>` +
      `</Relationships>`,
  );

  archive['xl/styles.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<styleSheet xmlns="${MAIN_NS}">` +
      `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
      `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="2">` +
      `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
      `<xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>` +
      `</cellXfs></styleSheet>`,
  );

  archive['xl/sharedStrings.xml'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<sst xmlns="${MAIN_NS}" count="${totalStringRefs}" uniqueCount="${sharedStrings.length}">` +
      sharedStrings.map((s) => `<si><t xml:space="preserve">${escapeXmlText(s)}</t></si>`).join('') +
      `</sst>`,
  );

  return zipSync(archive, { level: 6 });
}

