import { unzipSync } from 'fflate';
import type { RosterRow, RosterSheet } from './rosterColumns';

export const XLSX_FILE_LIMIT = 8_000_000;
const MAX_SHARED_STRINGS = 100_000;
const MAX_CELL_TEXT_LENGTH = 4_000;
const MAX_WORKBOOK_CELLS = 150_000;
const MAX_WORKBOOK_ROWS = 25_000;
const WORKSHEET = /^xl\/worksheets\/[a-zA-Z0-9_.-]+\.xml$/;
const METADATA = new Set(['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml', 'xl/styles.xml']);

function unpackWorkbook(bytes: Uint8Array) {
  if (bytes.length < 22 || bytes.length > XLSX_FILE_LIMIT || bytes[0] !== 80 || bytes[1] !== 75) {
    throw new Error('Geçerli bir .xlsx dosyası seçin. Dosya sınırı 8 MB.');
  }
  const declared = new Map<string, number>();
  let entries = 0;
  let totalSize = 0;
  const files = unzipSync(bytes, {
    filter: ({ name, originalSize, size, compression }) => {
      if (++entries > 512) throw new Error('Excel dosyası çok fazla parça içeriyor.');
      if (name.includes('..')) throw new Error('Excel dosyasında geçersiz arşiv yolu var.');
      if (/vbaProject\.bin$/i.test(name)) throw new Error('Makro içeren Excel dosyaları desteklenmiyor.');
      if (!METADATA.has(name) && !WORKSHEET.test(name)) return false;
      totalSize += originalSize;
      if (
        declared.has(name) ||
        originalSize <= 0 ||
        originalSize > 8_000_000 ||
        totalSize > 24_000_000 ||
        size > bytes.length ||
        (compression === 0 && size !== originalSize)
      ) {
        throw new Error('Excel dosyasının boyutu veya yapısı geçersiz.');
      }
      declared.set(name, originalSize);
      return true;
    },
  });
  for (const [name, size] of declared) {
    if (files[name]?.length !== size) throw new Error('Excel dosyası eksik veya bozuk.');
  }
  return files;
}

function xml(data: Uint8Array | undefined, root: string) {
  if (!data) throw new Error('Excel dosyasındaki gerekli tablo bilgisi eksik.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(text)) throw new Error('Excel dosyasında desteklenmeyen XML tanımı var.');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.documentElement.localName !== root || document.getElementsByTagName('parsererror').length) {
    throw new Error('Excel dosyasındaki bir tablo bölümü okunamadı.');
  }
  return document.documentElement;
}

const children = (node: Element | undefined, name: string) =>
  Array.from(node?.children ?? []).filter((child) => child.localName === name);

function cellText(node: Element | undefined) {
  const joined = [
    ...children(node, 't'),
    ...children(node, 'r').flatMap((run) => children(run, 't')),
  ]
    .map((part) => part.textContent ?? '')
    .join('');
  if (joined.length > MAX_CELL_TEXT_LENGTH) {
    throw new Error('Excel hücresindeki metin uzunluk sınırını aşıyor.');
  }
  return joined;
}

function zeroFormats(styles: Uint8Array | undefined) {
  if (!styles) return [];
  const root = xml(styles, 'styleSheet');
  const custom = new Map(
    children(children(root, 'numFmts')[0], 'numFmt').flatMap((format) => {
      const code = format.getAttribute('formatCode') ?? '';
      return /^0{2,15}$/.test(code) ? [[format.getAttribute('numFmtId'), code.length] as const] : [];
    }),
  );
  return children(children(root, 'cellXfs')[0], 'xf').map((style) => custom.get(style.getAttribute('numFmtId')) ?? 0);
}

function readSheet(
  data: Uint8Array | undefined,
  shared: string[],
  zeros: number[],
  budget: { cells: number; rows: number },
) {
  const dataNode = children(xml(data, 'worksheet'), 'sheetData')[0];
  const rows: RosterRow[] = [];
  let sheetCells = 0;
  let previous = 0;
  for (const row of children(dataNode, 'row')) {
    const number = Number(row.getAttribute('r') ?? previous + 1);
    if (!Number.isInteger(number) || number <= previous || number > 1_048_576) {
      throw new Error('Excel satır adresi geçersiz.');
    }
    previous = number;
    const cells = Object.create(null) as RosterRow['cells'];
    let previousColumn = -1;
    let hasEntry = false;
    for (const cell of children(row, 'c')) {
      if (++sheetCells > 80_000 || ++budget.cells > MAX_WORKBOOK_CELLS) {
        throw new Error('Excel çalışma kitabında çok fazla hücre var.');
      }
      const reference = cell.getAttribute('r');
      const match = reference?.match(/^([A-Z]{1,3})([1-9]\d*)$/);
      const column = match
        ? [...match[1]!].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
        : previousColumn + 1;
      if ((reference && (!match || Number(match[2]) !== number)) || column <= previousColumn || column >= 16_384) {
        throw new Error(`${number}. satırın Excel sütun adresi geçersiz.`);
      }
      previousColumn = column;
      const type = cell.getAttribute('t');
      if (children(cell, 'f').length || type === 'e' || type === 'b') {
        cells[column] = null;
        hasEntry = true;
        continue;
      }
      let value = children(cell, 'v')[0]?.textContent ?? '';
      if (type === 'inlineStr') value = cellText(children(cell, 'is')[0]);
      if (type === 's') {
        const index = /^\d+$/.test(value) ? Number(value) : -1;
        if (shared[index] === undefined) throw new Error('Excel metin tablosundaki hücre bulunamadı.');
        value = shared[index]!;
      }
      if (value.length > MAX_CELL_TEXT_LENGTH) {
        throw new Error(`${number}. satır: hücre metni çok uzun.`);
      }
      if ((!type || type === 'n') && /^\d+$/.test(value)) {
        value = value.padStart(zeros[Number(cell.getAttribute('s'))] ?? 0, '0');
      }
      value = value.trim();
      if (value) {
        cells[column] = value;
        hasEntry = true;
      }
    }
    if (hasEntry) {
      rows.push({ number, cells });
      if (rows.length > 5_012 || ++budget.rows > MAX_WORKBOOK_ROWS) {
        throw new Error('Bir Excel aktarımındaki azami satır sınırı aşıldı.');
      }
    }
  }
  return rows;
}

export function readXlsxRoster(bytes: Uint8Array): RosterSheet[] {
  const files = unpackWorkbook(bytes);
  const workbook = xml(files['xl/workbook.xml'], 'workbook');
  const relations = xml(files['xl/_rels/workbook.xml.rels'], 'Relationships');
  const paths = new Map(
    children(relations, 'Relationship').flatMap((relation) => {
      if (relation.getAttribute('TargetMode') === 'External' || !relation.getAttribute('Type')?.endsWith('/worksheet')) {
        return [];
      }
      const target = relation.getAttribute('Target') ?? '';
      if (target.includes('..')) return [];
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      const id = relation.getAttribute('Id');
      return id && WORKSHEET.test(path) ? [[id, path] as const] : [];
    }),
  );
  const sharedItems = files['xl/sharedStrings.xml'] ? children(xml(files['xl/sharedStrings.xml'], 'sst'), 'si') : [];
  if (sharedItems.length > MAX_SHARED_STRINGS) {
    throw new Error('Excel ortak metin tablosu çok büyük.');
  }
  const shared = sharedItems.map(cellText);
  const zeros = zeroFormats(files['xl/styles.xml']);
  const sheets = children(children(workbook, 'sheets')[0], 'sheet').filter((sheet) => {
    const state = sheet.getAttribute('state');
    return !state || state === 'visible';
  });
  if (sheets.length > 20) throw new Error('En fazla 20 görünür Excel sayfası destekleniyor.');
  const budget = { cells: 0, rows: 0 };
  const result = sheets.flatMap((sheet) => {
    const relation = Array.from(sheet.attributes).find(
      (attribute) => attribute.localName === 'id' && attribute.namespaceURI?.endsWith('/relationships'),
    );
    const path = relation && paths.get(relation.value);
    if (!path) return [];
    const rows = readSheet(files[path], shared, zeros, budget);
    return rows.length ? [{ name: sheet.getAttribute('name') || 'Excel Sayfası', rows }] : [];
  });
  if (result.length === 0) throw new Error('Dosyada veri içeren görünür bir Excel sayfası bulunamadı.');
  return result;
}
