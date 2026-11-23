import { sanitizeSpreadsheetText } from '../../system/schemas/textSecurity';
import type { RosterSheet } from './rosterColumns';

export const TEXT_LIST_FILE_LIMIT = 1_000_000;

/** Tablo başlıklarını Türkçe aksan ve noktalama farklarından bağımsız karşılaştırma anahtarına çevirir. */
export function normalizeSpreadsheetHeader(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function sanitizeSpreadsheetCell(value?: string | null): string {
  return sanitizeSpreadsheetText(value);
}

/**
 * Tırnak kurallarına uyan CSV / TSV / noktalı virgül satır ayrıştırıcısı.
 * Boş hücreleri silmez (sütun kaymasını önler); her hücrede formül/Bidi hijyeni uygular.
 */
export function splitDelimitedLine(line: string, lineNumber: number): string[] {
  const parts: string[] = [];
  let cell = '';
  let quoted = false;
  for (let pos = 0; pos < line.length; pos++) {
    const char = line[pos];
    if (char === '"') {
      if (quoted && line[pos + 1] === '"') {
        cell += '"';
        pos++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && /[\t;,]/.test(char!)) {
      parts.push(sanitizeSpreadsheetCell(cell));
      cell = '';
    } else {
      cell += char;
    }
  }
  if (quoted) {
    throw new Error(`${lineNumber}. satır: kapanmamış tırnak veya çok satırlı hücre desteklenmiyor.`);
  }
  parts.push(sanitizeSpreadsheetCell(cell));
  return parts;
}

function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error('Excel dosyası okunamadı.'));
    reader.onerror = reader.onabort = fail;
    reader.onload = () =>
      reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : fail();
    reader.readAsArrayBuffer(file);
  });
}

/** Tüm .xlsx pencerelerinin kullandığı tek doğrulanmış çalışma kitabı yükleyicisi. */
export async function loadValidatedXlsxWorkbook(file: File): Promise<RosterSheet[]> {
  try {
    const { readXlsxRoster, XLSX_FILE_LIMIT } = await import('./xlsxRoster');
    if (!/\.xlsx$/i.test(file.name) || file.size <= 0 || file.size > XLSX_FILE_LIMIT) {
      throw new Error('8 MB veya daha küçük geçerli bir .xlsx dosyası seçin.');
    }
    return readXlsxRoster(await readFileAsArrayBuffer(file));
  } catch (cause) {
    if (cause instanceof Error && !/zip|compression|utf-?8|arraybuffer/i.test(cause.message)) {
      throw cause;
    }
    throw new Error('Excel dosyası okunamadı. Dosyanın .xlsx biçiminde ve sağlam olduğunu kontrol edin.');
  }
}

/** CSV / TSV metin dosyalarını boyut ve ikili dosya (ZIP/NUL) sızıntısına karşı doğrulayarak okur. */
export function readValidatedTextListFile(file: File, maxLabel = 'Liste dosyası'): Promise<string> {
  if (file.size <= 0) {
    return Promise.reject(new Error(`${maxLabel} boş olamaz.`));
  }
  if (file.size > TEXT_LIST_FILE_LIMIT) {
    return Promise.reject(new Error(`${maxLabel} en fazla 1 MB olabilir.`));
  }
  if (/\.xlsx?$/i.test(file.name)) {
    return Promise.reject(new Error('Excel (.xlsx) dosyaları için "Excel Dosyası (.xlsx)" düğmesini kullanın.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error('Dosya okunamadı; kayıtlar değiştirilmedi.'));
    reader.onerror = reader.onabort = fail;
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (text.startsWith('PK\u0003\u0004') || text.includes('\u0000')) {
        reject(new Error('Seçilen dosya metin biçiminde değil. .xlsx için "Excel Dosyası (.xlsx)" seçeneğini kullanın.'));
        return;
      }
      resolve(text);
    };
    reader.readAsText(file, 'utf-8');
  });
}

