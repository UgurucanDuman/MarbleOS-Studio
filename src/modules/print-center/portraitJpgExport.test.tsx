import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';
import { injectJfif300Dpi } from '../../system/storage/binaryPrintFormats';
import { exportRasterPagesAsJpg } from './jpgSheetExporter';
import { planImpositionPages, type PrintableStudentEntry } from './printSpecs';

MotionGlobalConfig.skipAnimations = true;

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeFakeEntry(idx: number, className: string, number: string, first: string, last: string): PrintableStudentEntry {
  return {
    className,
    classRecord: undefined,
    student: {
      id: `stu-${idx}`,
      classId: `cls-${className}`,
      studentNumber: number,
      firstName: first,
      lastName: last,
      matchedPhotoId: `ph-${idx}`,
      printReady: true,
      updatedAt: '2026-11-22T00:00:00Z',
    },
    photo: {
      id: `ph-${idx}`,
      fileName: `${number}.jpg`,
      dataUrl: TINY_PNG,
      studentId: `stu-${idx}`,
      classId: `cls-${className}`,
      approvedForPrint: true,
      adjustments: { zoom: 1, brightness: 100, contrast: 100, warmth: 0 },
      createdAt: '2026-11-22T00:00:00Z',
    },
  };
}

describe('Vesikalık & Biyometrik 300 DPI PDF / JPG çıktısı', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('exports a single 10x15 biometric sheet directly as a 300 DPI .jpg file', async () => {
    const capturedBlobs: Blob[] = [];
    const origCreateUrl = URL.createObjectURL;
    const origRevokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) capturedBlobs.push(obj);
      return 'blob:jpg-single';
    });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();

    try {
      const entries = [makeFakeEntry(1, '1-A', '702', 'Zeynep', 'Güneş')];
      const pages = planImpositionPages(entries, 'biometric-50x60', '10x15-4up-student');
      const jpeg300 = injectJfif300Dpi(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 300);

      const writeRes = await exportRasterPagesAsJpg({
        schoolName: 'Atatürk İlkokulu',
        scopeLabel: '1-A',
        singleBranchScope: true,
        productId: 'biometric-50x60',
        sheetMode: '10x15-4up-student',
        sheetSlug: '10x15_kisi_karti',
        pages,
        pdfPages: [{ jpegBytes: jpeg300, pixelWidth: 1181, pixelHeight: 1772, widthMm: 100, heightMm: 150 }],
      });

      expect(writeRes.displayPath).toMatch(/702_Zeynep_Güneş_biometric-50x60_10x15_300dpi\.jpg$/i);
      const jpgBlob = capturedBlobs.find((b) => b.type === 'image/jpeg');
      expect(jpgBlob).toBeDefined();
      const raw = new Uint8Array(await jpgBlob!.arrayBuffer());
      expect(raw[0]).toBe(0xff);
      expect(raw[1]).toBe(0xd8);
      expect((raw[14]! << 8) | raw[15]!).toBe(300);
    } finally {
      URL.createObjectURL = origCreateUrl;
      URL.revokeObjectURL = origRevokeUrl;
    }
  });

  it('packs multi-page 10x15 biometric and A4 vesikalik JPG sheets into a 300 DPI .zip with SHA-256 manifest', async () => {
    const capturedBlobs: Blob[] = [];
    const origCreateUrl = URL.createObjectURL;
    const origRevokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) capturedBlobs.push(obj);
      return 'blob:jpg-zip';
    });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();

    try {
      const entries = [
        makeFakeEntry(1, '1-A', '702', 'Zeynep', 'Güneş'),
        makeFakeEntry(2, '1-B', '711', 'Duru', 'Kablanoğlu'),
      ];
      const bioPages = planImpositionPages(entries, 'biometric-50x60', '10x15-4up-student');
      const jpeg300 = injectJfif300Dpi(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 300);

      const bioRes = await exportRasterPagesAsJpg({
        schoolName: 'Atatürk İlkokulu',
        scopeLabel: 'Tüm Okul',
        singleBranchScope: false,
        productId: 'biometric-50x60',
        sheetMode: '10x15-4up-student',
        sheetSlug: '10x15_kisi_karti',
        pages: bioPages,
        pdfPages: bioPages.map(() => ({
          jpegBytes: jpeg300,
          pixelWidth: 1181,
          pixelHeight: 1772,
          widthMm: 100,
          heightMm: 150,
        })),
      });
      expect(bioRes.displayPath).toMatch(/_biometric-50x60_10x15_kisi_karti_300dpi_jpg\.zip$/i);
      const bioArchive = unzipSync(new Uint8Array(await capturedBlobs[0]!.arrayBuffer()));
      expect(bioArchive['1-A/702_Zeynep_Güneş_10x15.jpg']).toBeDefined();
      expect(bioArchive['1-B/711_Duru_Kablanoğlu_10x15.jpg']).toBeDefined();
      const manifest = JSON.parse(new TextDecoder().decode(bioArchive['_rapor/manifest.json']));
      expect(manifest.dpi).toBe(300);
      expect(manifest.pageCount).toBe(2);
      expect(manifest.pages[0].sha256).toMatch(/^[0-9a-f]{64}$/);

      // A4 Vesikalık çoklu sayfa JPG arşivi sayfa_01.jpg / sayfa_02.jpg üretir
      const a4Pages = [bioPages[0]!, bioPages[1]!];
      await exportRasterPagesAsJpg({
        schoolName: 'Atatürk İlkokulu',
        scopeLabel: '1-A',
        singleBranchScope: true,
        productId: 'vesikalik-45x60',
        sheetMode: 'a4-grid',
        sheetSlug: 'A4_dizgi',
        pages: a4Pages,
        pdfPages: a4Pages.map(() => ({
          jpegBytes: jpeg300,
          pixelWidth: 2480,
          pixelHeight: 3508,
          widthMm: 210,
          heightMm: 297,
        })),
      });
      const a4Archive = unzipSync(new Uint8Array(await capturedBlobs[1]!.arrayBuffer()));
      expect(a4Archive['sayfa_01.jpg']).toBeDefined();
      expect(a4Archive['sayfa_02.jpg']).toBeDefined();
    } finally {
      URL.createObjectURL = origCreateUrl;
      URL.revokeObjectURL = origRevokeUrl;
    }
  });

  it('toggles PDF and JPG output formats in PrintCenterWindow for both Vesikalık and Biyometrik', async () => {
    const capturedBlobs: Blob[] = [];
    const origCreateUrl = URL.createObjectURL;
    const origRevokeUrl = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) capturedBlobs.push(obj);
      return 'blob:ui-jpg';
    });
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      fillStyle: '#fff',
      strokeStyle: '#000',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => {
      cb(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
    });
    const origCreateBitmap = globalThis.createImageBitmap;
    globalThis.createImageBitmap = vi.fn(async () => ({
      width: 1200,
      height: 1600,
      close: vi.fn(),
    })) as unknown as typeof createImageBitmap;

    try {
      const { PrintCenterWindow } = await import('./PrintCenterWindow');
      const db = await import('../../system/sqlite/studioDatabase');

      await act(async () => {
        const schoolId = db.studioDbActions.createSchool({
          name: 'Örnek İlkokulu',
          institutionCode: '123456',
          address: 'Merkez',
          notes: '',
          makeBiometric: true,
          makeVesikalik: true,
        });
        const classId = db.studioDbActions.addClass('1-A', 'Ayşe Öğretmen', schoolId, '2026-2027');
        db.studioDbActions.addStudentsBatch(classId, [
          { studentNumber: '702', firstName: 'Zeynep', lastName: 'Güneş' },
        ]);
        db.studioDbActions.uploadPhotos([{ fileName: '702.png', dataUrl: TINY_PNG }], classId, 'number');
        for (const p of db.getStudioDatabaseSnapshot().photos) {
          db.studioDbActions.updatePhotoStudioSettings(p.id, p.adjustments, true);
        }
      });

      render(
        <StudioQueryProvider>
          <PrintCenterWindow />
        </StudioQueryProvider>,
      );

      // Varsayılan PDF Belge, JPG (300 DPI) seçeneğine geçince üst buton güncellenir
      expect(screen.getByRole('button', { name: /300 DPI PDF \(1 Sayfa\)/i })).toBeTruthy();
      fireEvent.click(screen.getByRole('tab', { name: /JPG \(300 DPI\)/i }));
      expect(screen.getByRole('button', { name: /300 DPI JPG \(1 Görsel\)/i })).toBeTruthy();

      // Biyometrik 50×60 altında da JPG seçimi korunur ve doğrudan image/jpeg üretir
      fireEvent.click(screen.getByRole('tab', { name: /Biyometrik 50×60/i }));
      const jpgBtn = screen.getByRole('button', { name: /300 DPI JPG \(1 Görsel\)/i });
      fireEvent.click(jpgBtn);
      await waitFor(() => {
        expect(screen.getByText(/Son çıktı:/i)).toBeTruthy();
      });
      expect(capturedBlobs.some((b) => b.type === 'image/jpeg')).toBe(true);

      // PVC Kimlik Kartı'na geçince PDF çıktı moduna döner
      fireEvent.click(screen.getByRole('tab', { name: /PVC Kimlik Kartı/i }));
      expect(screen.getByRole('button', { name: /300 DPI PDF/i })).toBeTruthy();
      expect(screen.queryByRole('tab', { name: /JPG \(300 DPI\)/i })).toBeNull();
    } finally {
      URL.createObjectURL = origCreateUrl;
      URL.revokeObjectURL = origRevokeUrl;
      HTMLCanvasElement.prototype.getContext = origGetContext;
      globalThis.createImageBitmap = origCreateBitmap;
    }
  }, 15_000);

  it('writes multi-page 300 DPI JPG sheets directly as a ready folder (no .zip) when directory writer is available', async () => {
    const written = new Map<string, Uint8Array>();
    const makeDirHandle = (prefix: string) => ({
      name: prefix,
      async getDirectoryHandle(name: string) {
        return makeDirHandle(`${prefix}/${name}`);
      },
      async getFileHandle(name: string) {
        return {
          async createWritable() {
            return {
              async write(data: Uint8Array) { written.set(`${prefix}/${name}`, new Uint8Array(data)); },
              async close() {},
            };
          },
        };
      },
    });
    (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = vi.fn(async () => makeDirHandle('Cikti'));

    try {
      const entries = [
        makeFakeEntry(1, '1-A', '702', 'Zeynep', 'Güneş'),
        makeFakeEntry(2, '1-B', '711', 'Duru', 'Kablanoğlu'),
      ];
      const bioPages = planImpositionPages(entries, 'biometric-50x60', '10x15-4up-student');
      const jpeg300 = injectJfif300Dpi(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 300);

      const res = await exportRasterPagesAsJpg({
        schoolName: 'Atatürk İlkokulu',
        scopeLabel: 'Tüm Okul',
        singleBranchScope: false,
        productId: 'biometric-50x60',
        sheetMode: '10x15-4up-student',
        sheetSlug: '10x15_kisi_karti',
        pages: bioPages,
        pdfPages: bioPages.map(() => ({
          jpegBytes: jpeg300, pixelWidth: 1181, pixelHeight: 1772, widthMm: 100, heightMm: 150,
        })),
      });

      expect(res.displayPath).not.toMatch(/\.zip$/i);
      const keys = Array.from(written.keys());
      expect(keys.some((k) => k.endsWith('/1-A/702_Zeynep_Güneş_10x15.jpg'))).toBe(true);
      expect(keys.some((k) => k.endsWith('/1-B/711_Duru_Kablanoğlu_10x15.jpg'))).toBe(true);
      expect(keys.some((k) => k.endsWith('/_rapor/manifest.json'))).toBe(true);
    } finally {
      delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
    }
  });
});
