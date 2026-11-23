import { expect, test, vi } from 'vitest';
import {
  BROWSER_PREVIEW_PRINTER,
  listStudioPrinters,
  submitStudioPrintJob,
} from './desktopPrinter';
import { saveStudioExportFile } from './exportFileWriter';

test('lists preview printer in browser mode and validates print job bounds strictly', async () => {
  const printers = await listStudioPrinters();
  expect(printers).toEqual([
    {
      name: BROWSER_PREVIEW_PRINTER,
      isDefault: true,
      isOffline: false,
      isNetwork: false,
    },
  ]);

  // Geçersiz JPEG imzası reddedilir
  await expect(
    submitStudioPrintJob({
      printerName: BROWSER_PREVIEW_PRINTER,
      jobTitle: 'Test',
      copies: 1,
      orientation: 'portrait',
      duplex: 'simplex',
      scaleMode: 'actual-100',
      pages: [{ jpegBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), widthMm: 210, heightMm: 297 }],
    }),
  ).rejects.toThrow(/JPEG/);

  // Aşırı kopya sayısı reddedilir
  await expect(
    submitStudioPrintJob({
      printerName: BROWSER_PREVIEW_PRINTER,
      jobTitle: 'Test',
      copies: 150,
      orientation: 'portrait',
      duplex: 'simplex',
      scaleMode: 'actual-100',
      pages: [{ jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xd9]), widthMm: 210, heightMm: 297 }],
    }),
  ).rejects.toThrow(/99/);

  // Kontrol karakteri içeren yazıcı adı veya iş başlığı reddedilir
  await expect(
    submitStudioPrintJob({
      printerName: 'Canon\u0000Injected',
      jobTitle: 'Test',
      copies: 1,
      orientation: 'portrait',
      duplex: 'simplex',
      scaleMode: 'actual-100',
      pages: [{ jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xd9]), widthMm: 210, heightMm: 297 }],
    }),
  ).rejects.toThrow(/kontrol karakteri/);

  // Yol kaçışı (path traversal) içeren çıktı dosya adı Zod sınırında reddedilir
  await expect(
    saveStudioExportFile({
      subfolder: 'vesikalik',
      fileName: '../gizli_cikti.pdf',
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      mimeType: 'application/pdf',
    }),
  ).rejects.toThrow(/dosya adı/);

  const createObjSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:print-sheet');
  const revokeObjSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  const result = await submitStudioPrintJob({
    printerName: BROWSER_PREVIEW_PRINTER,
    jobTitle: `${'Çağdaş Eğitim Kurumu '.repeat(4)}- 2026-2027 Anadolu - Vesikalık 45×60`,
    copies: 2,
    orientation: 'portrait',
    duplex: 'simplex',
    scaleMode: 'actual-100',
    pages: [{ jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]), widthMm: 210, heightMm: 297 }],
  });

  expect(result).toEqual({
    mode: 'browser',
    printerName: BROWSER_PREVIEW_PRINTER,
    spooledPages: 2,
    copies: 2,
  });

  createObjSpy.mockRestore();
  revokeObjSpy.mockRestore();
});
