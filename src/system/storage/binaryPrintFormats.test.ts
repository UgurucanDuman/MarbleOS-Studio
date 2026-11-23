import { describe, expect, it } from 'vitest';
import { openDesktopManagedDir, saveDesktopExportBase64 } from '../desktop/desktopStorage';
import { sanitizeExportFileStem } from '../desktop/exportFileWriter';
import {
  buildPhysicalPdfFromJpegs,
  injectJfif300Dpi,
  mmToPt,
  mmToPx,
} from './binaryPrintFormats';

describe('binaryPrintFormats & export security guards', () => {
  it('computes exact 300 DPI pixel and PDF point dimensions for Turkish school print standards', () => {
    expect(mmToPx(45, 300)).toBe(531);
    expect(mmToPx(50, 300)).toBe(591);
    expect(mmToPx(60, 300)).toBe(709);
    expect(mmToPx(100, 300)).toBe(1181);
    expect(mmToPx(150, 300)).toBe(1772);
    expect(mmToPx(210, 300)).toBe(2480);
    expect(mmToPx(297, 300)).toBe(3508);
    expect(mmToPx(85.6, 300)).toBe(1011);
    expect(mmToPx(54, 300)).toBe(638);

    expect(mmToPt(210)).toBe(595.28);
    expect(mmToPt(297)).toBe(841.89);
    expect(mmToPt(100)).toBe(283.46);
    expect(mmToPt(150)).toBe(425.2);
    expect(mmToPt(85.6)).toBe(242.65);
    expect(mmToPt(54)).toBe(153.07);
  });

  it('injects or updates JFIF APP0 density to 300 DPI without corrupting JPEG payload', () => {
    const bareJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x11, 0x22, 0xff, 0xd9]);
    const injected = injectJfif300Dpi(bareJpeg, 300);
    expect(injected[0]).toBe(0xff);
    expect(injected[1]).toBe(0xd8);
    expect(injected[2]).toBe(0xff);
    expect(injected[3]).toBe(0xe0);
    expect(injected[13]).toBe(1);
    expect((injected[14]! << 8) | injected[15]!).toBe(300);
    expect((injected[16]! << 8) | injected[17]!).toBe(300);
    expect(Array.from(injected.slice(20))).toEqual([0xff, 0xdb, 0x00, 0x04, 0x11, 0x22, 0xff, 0xd9]);

    const rewritten = injectJfif300Dpi(injected, 600);
    expect(rewritten.length).toBe(injected.length);
    expect((rewritten[14]! << 8) | rewritten[15]!).toBe(600);
    expect((rewritten[16]! << 8) | rewritten[17]!).toBe(600);
  });

  it('builds a valid PDF 1.4 file with exact physical MediaBox, DCTDecode streams, and verified xref offsets', () => {
    const sampleJpeg = injectJfif300Dpi(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 300);
    const pdf = buildPhysicalPdfFromJpegs(
      [
        { jpegBytes: sampleJpeg, pixelWidth: 2480, pixelHeight: 3508, widthMm: 210, heightMm: 297 },
        { jpegBytes: sampleJpeg, pixelWidth: 1181, pixelHeight: 1772, widthMm: 100, heightMm: 150 },
      ],
      { title: 'Atatürk İlkokulu 4-A Dizgi' },
    );

    const ascii = new TextDecoder('latin1').decode(pdf);
    expect(ascii.startsWith('%PDF-1.4\n')).toBe(true);
    expect(ascii.endsWith('%%EOF\n')).toBe(true);
    expect(ascii).toContain('/MediaBox [ 0 0 595.28 841.89 ]');
    expect(ascii).toContain('/CropBox [ 0 0 595.28 841.89 ]');
    expect(ascii).toContain('/MediaBox [ 0 0 283.46 425.20 ]');
    expect(ascii).toContain('/CropBox [ 0 0 283.46 425.20 ]');
    expect(ascii).toContain('/Filter /DCTDecode');
    expect(ascii).toContain('/PrintScaling /None');
    expect(ascii).toContain('/Duplex /Simplex');

    // Her xref kaydının bayt ofseti gerçek "<id> 0 obj" başlangıcını göstermelidir
    const xrefLines = ascii.split('xref\n')[1]!.split('trailer\n')[0]!.trim().split('\n').slice(2);
    expect(xrefLines).toHaveLength(9);
    xrefLines.forEach((line, index) => {
      const offset = Number(line.slice(0, 10));
      const objHeader = `${index + 1} 0 obj\n`;
      expect(ascii.slice(offset, offset + objHeader.length)).toBe(objHeader);
    });

    // Çoklu kopya + Çift Yüz + Sığdır seçenekleri aynı JPEG XObject'i paylaşarak geçerli PDF üretir
    const multiCopyPdf = buildPhysicalPdfFromJpegs(
      [{ jpegBytes: sampleJpeg, pixelWidth: 1181, pixelHeight: 1772, widthMm: 100, heightMm: 150 }],
      { title: 'Kopya Test', copies: 2, duplex: 'vertical', scaleMode: 'fit-page' },
    );
    const multiAscii = new TextDecoder('latin1').decode(multiCopyPdf);
    expect(multiAscii).toContain('/Count 3');
    expect(multiAscii).toContain('/PrintScaling /AppDefault');
    expect(multiAscii).toContain('/Duplex /DuplexFlipLongEdge');
  });

  it('blocks path traversal, Windows device stems, and dangerous extensions in desktop export schemas', async () => {
    await expect(saveDesktopExportBase64('vesikalik', '../escape.pdf', 'JVBERi0xLjQ=')).rejects.toThrow();
    await expect(saveDesktopExportBase64('vesikalik', 'CON.pdf', 'JVBERi0xLjQ=')).rejects.toThrow();
    await expect(saveDesktopExportBase64('vesikalik', 'script.exe', 'JVBERi0xLjQ=')).rejects.toThrow();
    await expect(openDesktopManagedDir('C:\\Windows' as never)).rejects.toThrow();

    expect(sanitizeExportFileStem('CON')).toBe('_CON');
    expect(sanitizeExportFileStem('../../4-A / Özel*Şube')).toBe('4-A_-_Özel-Şube');
  });
});

