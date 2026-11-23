import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { usesDesktopStorage } from './desktopStorage';
import { encodeBytesToBase64 } from './exportFileWriter';

/**
 * İZOLE MASAÜSTÜ YAZICI MOTORU KÖPRÜSÜ:
 * Windows EXE (Tauri) ortamında `studio_list_printers` ve `studio_print_pages` Win32 GDI kuyruk
 * komutlarını çalıştırır; tarayıcı önizlemesinde `@page` milimetre ölçülü yazdırma çerçevesine düşer.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const BROWSER_PREVIEW_PRINTER = 'Sistem Yazdırma Penceresi (Önizleme)';

export const printOrientationSchema = z.enum(['portrait', 'landscape']);
export type PrintOrientation = z.infer<typeof printOrientationSchema>;

export const printDuplexSchema = z.enum(['simplex', 'vertical', 'horizontal']);
export type PrintDuplexMode = z.infer<typeof printDuplexSchema>;

export const printScaleModeSchema = z.enum(['actual-100', 'fit-page']);
export type PrintScaleMode = z.infer<typeof printScaleModeSchema>;

const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]/u;

const safePrintLine = (maxLen: number, emptyMsg: string) =>
  z
    .string()
    .trim()
    .min(1, emptyMsg)
    .max(maxLen)
    .refine((val) => !CONTROL_CHARS_RE.test(val), {
      message: 'Yazdırma bilgisinde geçersiz kontrol karakteri bulunuyor.',
    });

const systemPrinterInfoSchema = z
  .object({
    name: safePrintLine(220, 'Yazıcı adı boş olamaz.'),
    isDefault: z.boolean(),
    isOffline: z.boolean(),
    isNetwork: z.boolean(),
  })
  .strict();

export type SystemPrinterInfo = z.infer<typeof systemPrinterInfoSchema>;

const printedJobReceiptSchema = z
  .object({
    printerName: safePrintLine(220, 'Yazıcı adı boş olamaz.'),
    spooledPages: z.number().int().positive().max(12_000),
    copies: z.number().int().min(1).max(99),
  })
  .strict();

const directPrintJobInputSchema = z
  .object({
    printerName: safePrintLine(220, 'Lütfen bir yazıcı seçin.'),
    jobTitle: safePrintLine(160, 'Baskı iş başlığı boş olamaz.'),
    copies: z.number().int().min(1, 'Kopya sayısı en az 1 olmalıdır.').max(99, 'En fazla 99 kopya gönderilebilir.'),
    orientation: printOrientationSchema,
    duplex: printDuplexSchema,
    scaleMode: printScaleModeSchema,
    pages: z
      .array(
        z
          .object({
            jpegBytes: z
              .custom<Uint8Array>((v): v is Uint8Array => v instanceof Uint8Array)
              .refine(
                (b) => b.byteLength >= 4 && b.byteLength <= 26_000_000 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
                { message: 'Baskı sayfası geçerli bir JPEG verisi olmalıdır.' },
              ),
            widthMm: z.number().finite().min(30).max(500),
            heightMm: z.number().finite().min(30).max(500),
          })
          .strict(),
      )
      .min(1, 'Yazdırılacak en az 1 sayfa olmalıdır.')
      .max(120, 'Tek işte en fazla 120 sayfa yazdırılabilir.'),
  })
  .strict();

export type DirectPrintJobInput = z.infer<typeof directPrintJobInputSchema>;

export interface StudioPrintDispatchResult {
  mode: 'desktop' | 'browser';
  printerName: string;
  spooledPages: number;
  copies: number;
}

export async function listStudioPrinters(): Promise<SystemPrinterInfo[]> {
  if (!usesDesktopStorage) {
    return [
      {
        name: BROWSER_PREVIEW_PRINTER,
        isDefault: true,
        isOffline: false,
        isNetwork: false,
      },
    ];
  }
  const raw = await invoke('studio_list_printers');
  return z.array(systemPrinterInfoSchema).max(200).parse(raw);
}

async function printPagesViaBrowserFrame(job: DirectPrintJobInput): Promise<void> {
  if (typeof document === 'undefined') return;
  const first = job.pages[0]!;
  const pageW = first.widthMm;
  const pageH = first.heightMm;

  const objectUrls = job.pages.map((page) => {
    const copy = new Uint8Array(page.jpegBytes.byteLength);
    copy.set(page.jpegBytes);
    return URL.createObjectURL(new Blob([copy], { type: 'image/jpeg' }));
  });

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const cleanup = () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    iframe.remove();
  };

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      cleanup();
      throw new Error('Tarayıcı yazdırma çerçevesi başlatılamadı.');
    }

    const sheetPad = job.scaleMode === 'fit-page' ? 'padding:4mm;box-sizing:border-box;' : '';
    const fitRule =
      job.scaleMode === 'fit-page'
        ? 'max-width:100%;max-height:100%;object-fit:contain;'
        : `width:${pageW}mm;height:${pageH}mm;`;

    const padDuplex = job.duplex !== 'simplex' && objectUrls.length % 2 === 1 && job.copies > 1;
    const imgTags: string[] = [];
    for (let c = 0; c < job.copies; c += 1) {
      for (const url of objectUrls) {
        imgTags.push(`<div class="sheet"><img src="${url}" alt="" /></div>`);
      }
      if (padDuplex && c + 1 < job.copies) {
        imgTags.push('<div class="sheet"></div>');
      }
    }

    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><title></title>` +
        `<style>@page{size:${pageW}mm ${pageH}mm;margin:0}html,body{margin:0;padding:0;background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}` +
        `.sheet{width:${pageW}mm;height:${pageH}mm;${sheetPad}page-break-after:always;display:flex;align-items:center;justify-content:center;overflow:hidden}` +
        `.sheet:last-child{page-break-after:auto}img{display:block;${fitRule}}</style></head>` +
        `<body>${imgTags.join('')}</body></html>`,
    );
    doc.close();
    doc.title = job.jobTitle;

    const images = Array.from(doc.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, 180);
                const done = () => {
                  clearTimeout(timer);
                  resolve();
                };
                img.onload = done;
                img.onerror = done;
              }),
      ),
    );
    win.focus();
    if (typeof win.print === 'function') {
      try {
        win.print();
      } catch {
        // Test / gömülü önizleme ortamlarında window.print uygulanmamış olabilir
      }
    }
    setTimeout(cleanup, 4000);
  } catch (err) {
    cleanup();
    throw err;
  }
}

export async function submitStudioPrintJob(rawInput: DirectPrintJobInput): Promise<StudioPrintDispatchResult> {
  const job = directPrintJobInputSchema.parse(rawInput);

  if (usesDesktopStorage) {
    const receipt = printedJobReceiptSchema.parse(
      await invoke('studio_print_pages', {
        request: {
          printerName: job.printerName,
          jobTitle: job.jobTitle,
          copies: job.copies,
          orientation: job.orientation,
          duplex: job.duplex,
          scaleMode: job.scaleMode,
          pages: job.pages.map((p) => ({
            jpegBase64: encodeBytesToBase64(p.jpegBytes),
            widthMm: p.widthMm,
            heightMm: p.heightMm,
          })),
        },
      }),
    );
    return {
      mode: 'desktop',
      printerName: receipt.printerName,
      spooledPages: receipt.spooledPages,
      copies: receipt.copies,
    };
  }

  await printPagesViaBrowserFrame(job);
  return {
    mode: 'browser',
    printerName: job.printerName,
    spooledPages: job.pages.length * job.copies,
    copies: job.copies,
  };
}
