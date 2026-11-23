import { mmToPt, type PdfRasterPage } from './binaryPrintFormats';

/**
 * İZOLE SİSTEM KATMANI: Fiziksel 300 DPI PDF 1.4 Belge Derleyici
 * `/ViewerPreferences` (Baskı Ölçeği & Çift Yüz), güvenli kenar sığdırma ve
 * XObject paylaşımıyla boyut şişirmeden çoklu kopya üretir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface PdfBuildOptions {
  title?: string;
  scaleMode?: 'actual-100' | 'fit-page';
  duplex?: 'simplex' | 'vertical' | 'horizontal';
  copies?: number;
}

function sanitizePdfAscii(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]+/g, '')
    .replace(/[()\\]/g, '')
    .trim()
    .slice(0, 80);
}

export function buildPhysicalPdfFromJpegs(
  pages: readonly PdfRasterPage[],
  options?: PdfBuildOptions,
): Uint8Array {
  if (pages.length === 0) {
    throw new Error('PDF oluşturmak için en az 1 dizgi sayfası gereklidir.');
  }

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = 0;

  const pushBytes = (buf: Uint8Array) => {
    chunks.push(buf);
    cursor += buf.byteLength;
  };
  const pushAscii = (text: string) => pushBytes(enc.encode(text));

  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const copies = Math.min(99, Math.max(1, Math.round(options?.copies ?? 1)));
  const fitPage = options?.scaleMode === 'fit-page';
  const duplex = options?.duplex ?? 'simplex';
  const padDuplexBlank = duplex !== 'simplex' && pages.length % 2 === 1 && copies > 1;
  const pagePlan: Array<{ srcIdx: number | null; wPt: string; hPt: string }> = [];
  for (let c = 0; c < copies; c += 1) {
    pages.forEach((p, idx) => {
      pagePlan.push({ srcIdx: idx, wPt: mmToPt(p.widthMm).toFixed(2), hPt: mmToPt(p.heightMm).toFixed(2) });
    });
    if (padDuplexBlank && c + 1 < copies) {
      const last = pages[pages.length - 1]!;
      pagePlan.push({ srcIdx: null, wPt: mmToPt(last.widthMm).toFixed(2), hPt: mmToPt(last.heightMm).toFixed(2) });
    }
  }

  // 1: Catalog, 2: Pages, 3: Info, 4..3+N: benzersiz JPEG XObject nesneleri, ardından her plan sayfası için (Page, Content)
  const imgObjBase = 4;
  const pageObjBase = imgObjBase + pages.length;
  const totalObjects = pageObjBase - 1 + pagePlan.length * 2;
  const pageRefs = pagePlan.map((_, idx) => `${pageObjBase + idx * 2} 0 R`).join(' ');

  const startObj = (objNum: number) => {
    offsets[objNum] = cursor;
    pushAscii(`${objNum} 0 obj\n`);
  };
  const endObj = () => pushAscii('\nendobj\n');

  const printScaling = fitPage ? '/AppDefault' : '/None';
  const pdfDuplex =
    duplex === 'horizontal' ? '/DuplexFlipShortEdge' : duplex === 'vertical' ? '/DuplexFlipLongEdge' : '/Simplex';
  startObj(1);
  pushAscii(
    `<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /PrintScaling ${printScaling} /Duplex ${pdfDuplex} /NumCopies 1 >> >>`,
  );
  endObj();

  startObj(2);
  pushAscii(`<< /Type /Pages /Count ${pagePlan.length} /Kids [ ${pageRefs} ] >>`);
  endObj();

  const safeTitle = sanitizePdfAscii(options?.title || 'MarbleOS Studio 300 DPI Print');
  startObj(3);
  pushAscii(`<< /Title (${safeTitle}) /Creator (MarbleOS Studio) /Producer (MarbleOS Studio Local Print Engine) >>`);
  endObj();

  pages.forEach((page, idx) => {
    if (page.jpegBytes.length < 4 || page.jpegBytes[0] !== 0xff || page.jpegBytes[1] !== 0xd8) {
      throw new Error(`${idx + 1}. sayfanın JPEG verisi geçersiz.`);
    }
    startObj(imgObjBase + idx);
    pushAscii(
      `<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(page.pixelWidth))} ` +
        `/Height ${Math.max(1, Math.round(page.pixelHeight))} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Interpolate true /Filter /DCTDecode /Length ${page.jpegBytes.byteLength} >>\nstream\n`,
    );
    pushBytes(page.jpegBytes);
    pushAscii('\nendstream');
    endObj();
  });

  const safeInsetPt = mmToPt(4);
  pagePlan.forEach((slot, idx) => {
    const pageObj = pageObjBase + idx * 2;
    const contentObj = pageObj + 1;
    let contentStream = '';
    let resources = '<< /ProcSet [ /PDF /ImageC ] >>';
    if (slot.srcIdx !== null) {
      const imgObj = imgObjBase + slot.srcIdx;
      resources = `<< /ProcSet [ /PDF /ImageC ] /XObject << /Im0 ${imgObj} 0 R >> >>`;
      if (fitPage) {
        const w = Number(slot.wPt);
        const h = Number(slot.hPt);
        const scale = Math.min((w - safeInsetPt * 2) / w, (h - safeInsetPt * 2) / h);
        const dw = (w * scale).toFixed(2);
        const dh = (h * scale).toFixed(2);
        const ox = ((w - w * scale) / 2).toFixed(2);
        const oy = ((h - h * scale) / 2).toFixed(2);
        contentStream = `q\n${dw} 0 0 ${dh} ${ox} ${oy} cm\n/Im0 Do\nQ\n`;
      } else {
        contentStream = `q\n${slot.wPt} 0 0 ${slot.hPt} 0 0 cm\n/Im0 Do\nQ\n`;
      }
    }
    const contentBytes = enc.encode(contentStream);
    startObj(pageObj);
    pushAscii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${slot.wPt} ${slot.hPt} ] ` +
        `/CropBox [ 0 0 ${slot.wPt} ${slot.hPt} ] /Resources ${resources} /Contents ${contentObj} 0 R >>`,
    );
    endObj();
    startObj(contentObj);
    pushAscii(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushAscii('endstream');
    endObj();
  });

  const xrefOffset = cursor;
  pushAscii(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjects; id += 1) {
    const off = String(offsets[id] ?? 0).padStart(10, '0');
    pushAscii(`${off} 00000 n \n`);
  }
  pushAscii(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const output = new Uint8Array(cursor);
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return output;
}
