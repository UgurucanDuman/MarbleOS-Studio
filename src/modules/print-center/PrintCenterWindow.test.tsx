import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { unzipSync } from 'fflate';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';
import { planImpositionPages, type PrintableStudentEntry } from './printSpecs';

MotionGlobalConfig.skipAnimations = true;

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('plans exact non-overlapping portrait, CR80 PVC ID card, and A4 class chart sheets', () => {
  const fakeEntries: PrintableStudentEntry[] = Array.from({ length: 18 }, (_, i) => ({
    className: i < 10 ? '4-A' : '4-B',
    classRecord: undefined,
    student: {
      id: `stu-${i}`,
      classId: i < 10 ? 'cls-1' : 'cls-2',
      studentNumber: String(100 + i),
      firstName: `Öğrenci${i}`,
      lastName: 'Yılmaz',
      matchedPhotoId: `ph-${i}`,
      printReady: true,
      updatedAt: '2026-11-10T00:00:00Z',
    },
    photo: {
      id: `ph-${i}`,
      fileName: `${100 + i}.jpg`,
      dataUrl: TINY_PNG,
      studentId: `stu-${i}`,
      classId: i < 10 ? 'cls-1' : 'cls-2',
      approvedForPrint: true,
      adjustments: { zoom: 1, brightness: 100, contrast: 100, warmth: 0 },
      createdAt: '2026-11-10T00:00:00Z',
    },
  }));

  const a4Vesikalik = planImpositionPages(fakeEntries, 'vesikalik-45x60', 'a4-grid');
  expect(a4Vesikalik).toHaveLength(2);
  expect(a4Vesikalik[0]!.slots).toHaveLength(16);
  expect(a4Vesikalik[1]!.slots).toHaveLength(2);
  expect(a4Vesikalik[0]!.rulerLengthMm).toBe(50);

  const maxBottomMm = Math.max(...a4Vesikalik[0]!.slots.map((s) => s.yMm + s.heightMm));
  expect(maxBottomMm).toBeLessThan(282);

  const a4Biometric = planImpositionPages(fakeEntries, 'biometric-50x60', 'a4-grid');
  expect(a4Biometric).toHaveLength(2);
  expect(a4Biometric[0]!.slots).toHaveLength(12);
  expect(a4Biometric[1]!.slots).toHaveLength(6);

  const card4Up = planImpositionPages(fakeEntries.slice(0, 3), 'vesikalik-45x60', '10x15-4up-student');
  expect(card4Up).toHaveLength(3);
  expect(card4Up[0]!.slots).toHaveLength(4);
  expect(new Set(card4Up[0]!.slots.map((s) => s.entry.student.id)).size).toBe(1);

  // Biyometrik 50×60 mm 10×15 cm kâğıtta ortada 1.0 mm kesim boşluğuyla 4 adet yerleşir
  const bio10x15Portrait = planImpositionPages(fakeEntries.slice(0, 2), 'biometric-50x60', '10x15-4up-student', 4, undefined, undefined, 'portrait');
  expect(bio10x15Portrait).toHaveLength(2);
  expect(bio10x15Portrait[0]!.slots).toHaveLength(4);
  expect(bio10x15Portrait[0]!.widthMm).toBe(100);
  expect(bio10x15Portrait[0]!.heightMm).toBe(150);
  expect(bio10x15Portrait[0]!.footerStudioStrip).toBe(true);
  expect(bio10x15Portrait[0]!.slots[0]!.widthMm).toBe(49.5);
  expect(bio10x15Portrait[0]!.slots[0]!.heightMm).toBe(59.4);
  expect(Number((bio10x15Portrait[0]!.slots[1]!.xMm - (bio10x15Portrait[0]!.slots[0]!.xMm + bio10x15Portrait[0]!.slots[0]!.widthMm)).toFixed(1))).toBe(1);

  const bio10x15Landscape = planImpositionPages(fakeEntries.slice(0, 2), 'biometric-50x60', '10x15-4up-student', 4, undefined, undefined, 'landscape');
  expect(bio10x15Landscape).toHaveLength(2);
  expect(bio10x15Landscape[0]!.widthMm).toBe(150);
  expect(bio10x15Landscape[0]!.heightMm).toBe(100);
  expect(bio10x15Landscape[0]!.slots).toHaveLength(4);
  expect(bio10x15Landscape[0]!.slots[0]!.rotated90).toBe(true);
  expect(bio10x15Landscape[0]!.slots[0]!.widthMm).toBe(59.4);
  expect(bio10x15Landscape[0]!.slots[0]!.heightMm).toBe(49.5);

  const a4BioLandscape = planImpositionPages(fakeEntries, 'biometric-50x60', 'a4-grid', 4, undefined, undefined, 'landscape');
  expect(a4BioLandscape[0]!.widthMm).toBe(297);
  expect(a4BioLandscape[0]!.heightMm).toBe(210);
  expect(a4BioLandscape[0]!.slots).toHaveLength(15);

  const idLandscapeDuplex = planImpositionPages(fakeEntries.slice(0, 10), 'pvc-id-card', 'a4-id-8up', 4, undefined, undefined, 'landscape', 'vertical');
  expect(idLandscapeDuplex).toHaveLength(4);
  expect(idLandscapeDuplex[0]!.widthMm).toBe(297);
  expect(idLandscapeDuplex[0]!.slots).toHaveLength(9);
  expect(idLandscapeDuplex[1]!.cardSide).toBe('back');

  const id8Up = planImpositionPages(fakeEntries.slice(0, 10), 'pvc-id-card', 'a4-id-8up');
  expect(id8Up).toHaveLength(2);
  expect(id8Up[0]!.slots).toHaveLength(8);
  expect(id8Up[0]!.slots[0]!.widthMm).toBe(85.6);
  expect(id8Up[0]!.slots[0]!.heightMm).toBe(54);

  const idSingle = planImpositionPages(fakeEntries.slice(0, 3), 'pvc-id-card', 'cr80-single');
  expect(idSingle).toHaveLength(3);
  expect(idSingle[0]!.widthMm).toBe(85.6);
  expect(idSingle[0]!.heightMm).toBe(54);

  const idPortrait9Up = planImpositionPages(fakeEntries.slice(0, 10), 'pvc-id-card', 'a4-id-8up', 4, {
    pvcTemplateId: 'vertical-lanyard',
    pvcPrintSides: 'front-and-back',
  });
  expect(idPortrait9Up).toHaveLength(4);
  expect(idPortrait9Up[0]!.cardSide).toBe('front');
  expect(idPortrait9Up[0]!.slots).toHaveLength(9);
  expect(idPortrait9Up[0]!.slots[0]!.widthMm).toBe(54);
  expect(idPortrait9Up[0]!.slots[0]!.heightMm).toBe(85.6);
  expect(idPortrait9Up[1]!.cardSide).toBe('back');
  expect(idPortrait9Up[1]!.slots[0]!.xMm).toBeGreaterThan(idPortrait9Up[0]!.slots[0]!.xMm);

  const albumPages = planImpositionPages(fakeEntries, 'album-chart', 'a4-album-portrait', 4);
  expect(albumPages).toHaveLength(2);
  expect(albumPages[0]!.titleLabel).toBe('4-A');
  expect(albumPages[1]!.titleLabel).toBe('4-B');

  // 33 öğrencili şubede 21..30 arası portrelerin kesilmeden eksiksiz sayfa slotlarına girdiği doğrulanır
  const entries33: PrintableStudentEntry[] = Array.from({ length: 33 }, (_, i) => ({
    ...fakeEntries[0]!,
    className: '1-A',
    student: { ...fakeEntries[0]!.student, id: `s33-${i}`, classId: 'cls-33', studentNumber: String(700 + i) },
    photo: { ...fakeEntries[0]!.photo, id: `p33-${i}`, studentId: `s33-${i}`, classId: 'cls-33' },
  }));
  const pages33 = planImpositionPages(entries33, 'album-chart', 'a4-album-portrait', 4, {
    chartTemplateId: 'high-30',
  });
  expect(pages33).toHaveLength(2);
  expect(pages33[0]!.slots).toHaveLength(30);
  expect(pages33[1]!.slots).toHaveLength(3);

  const sokPages = planImpositionPages(fakeEntries.slice(0, 15), 'album-chart', 'a4-album-portrait', 4, {
    chartTemplateId: 'sok-12',
  });
  expect(sokPages).toHaveLength(2);

  const bookletPages = planImpositionPages(fakeEntries.slice(0, 10), 'album-chart', 'a4-album-portrait', 4, {
    chartTemplateId: 'notebook-inner',
  });
  expect(bookletPages).toHaveLength(2);

  // İdareci Kütük Dosyası: A4 Dikey (her sınıf ayrı sayfa + isteğe bağlı ön kapak) ve A4 Yatay
  const kutukPortrait = planImpositionPages(fakeEntries, 'album-chart', 'a4-kutuk-portrait', 5, {
    kutukTemplateId: 'kutuk-portrait-30',
    kutukIncludeCover: true,
  });
  expect(kutukPortrait).toHaveLength(3);
  expect(kutukPortrait[0]!.kind).toBe('kutuk-sheet');
  expect(kutukPortrait[0]!.titleLabel).toBe('Ön Kapak');
  expect(kutukPortrait[0]!.widthMm).toBe(210);
  expect(kutukPortrait[0]!.heightMm).toBe(297);
  expect(kutukPortrait[1]!.titleLabel).toBe('4-A');
  expect(kutukPortrait[1]!.slots).toHaveLength(10);
  expect(kutukPortrait[2]!.titleLabel).toBe('4-B');
  expect(kutukPortrait[2]!.slots).toHaveLength(8);

  const kutukLandscape = planImpositionPages(fakeEntries, 'album-chart', 'a4-album-landscape', 6, {
    kutukTemplateId: 'kutuk-landscape-24',
  });
  expect(kutukLandscape).toHaveLength(2);
  expect(kutukLandscape[0]!.widthMm).toBe(297);
  expect(kutukLandscape[0]!.heightMm).toBe(210);
});

test('PrintCenterWindow renders #-free numbers, Kayıt Yok on empty branch, ID/Album previews, direct print, and e-Okul .zip', async () => {
  const capturedBlobs: Blob[] = [];
  const origCreateUrl = URL.createObjectURL;
  const origRevokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn((obj: Blob | MediaSource) => {
    if (obj instanceof Blob) capturedBlobs.push(obj);
    return 'blob:test-export';
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();

  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
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
    width: 1800,
    height: 2400,
    close: vi.fn(),
  })) as unknown as typeof createImageBitmap;

  try {
    const { PrintCenterWindow } = await import('./PrintCenterWindow');
    const db = await import('../../system/sqlite/studioDatabase');

    await act(async () => {
      const schoolId = db.studioDbActions.createSchool({
        name: 'Cumhuriyet Mesleki Lisesi',
        institutionCode: '700200',
        address: 'Merkez',
        notes: '',
        makeBiometric: true,
        makeVesikalik: true,
      });
      const classId = db.studioDbActions.addClass('9-A', 'Derya Yılmaz', schoolId, '2026-2027');
      db.studioDbActions.addClass('ÖĞRETMEN', '', schoolId, '2026-2027');
      db.studioDbActions.addStudentsBatch(classId, [
        {
          studentNumber: '711',
          firstName: 'Duru',
          lastName: 'Kablanoğlu',
          idCard: { department: 'Bilişim Teknolojileri', bloodType: 'A Rh+' },
        },
        {
          studentNumber: '712',
          firstName: 'Atlas',
          lastName: 'Çevik',
        },
      ]);
      db.studioDbActions.uploadPhotos(
        [
          { fileName: '711.png', dataUrl: TINY_PNG },
          { fileName: '712.png', dataUrl: TINY_PNG },
        ],
        classId,
        'number',
      );
      const snap = db.getStudioDatabaseSnapshot();
      for (const photo of snap.photos) {
        db.studioDbActions.updatePhotoStudioSettings(photo.id, photo.adjustments, true);
      }
    });

    render(
      <StudioQueryProvider>
        <PrintCenterWindow />
      </StudioQueryProvider>,
    );

    expect(screen.getByText(/%100 ÖLÇEK · 50 mm/i)).toBeTruthy();
    expect(screen.getByText('711 Duru')).toBeTruthy();
    expect(screen.queryByText(/#711/)).toBeNull();
    expect(screen.getByText('Kayıt Yok')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /PVC Kimlik Kartı/i }));
    expect(screen.getAllByText('ÖĞRENCİ KİMLİK KARTI').length).toBeGreaterThan(0);
    expect(screen.getByText('Bölümü: Bilişim Teknolojileri')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Albüm & Sınıf Panosu/i }));
    expect(screen.getAllByText(/Rehber Öğrt\.: Derya Yılmaz/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ÖĞRETMEN NOT ÇİZELGESİ/i)).toBeTruthy();
    expect(document.querySelector('.pc-stage-viewport > .pc-sheet-stage')).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: /Yazı rengi:/i })).toHaveLength(12);

    const rotBefore = (document.querySelector('.tc-vert-rotator') as HTMLElement | null)?.style.fontSize;
    fireEvent.click(screen.getByRole('button', { name: 'Baskı yazı puntosu' }));
    fireEvent.click(screen.getByRole('option', { name: '10 pt' }));
    await waitFor(() => {
      const rotAfter = (document.querySelector('.tc-vert-rotator') as HTMLElement | null)?.style.fontSize;
      expect(rotAfter).not.toBe(rotBefore);
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Yazı rengi: Anadolu Bordosu' }));
    await waitFor(() => {
      expect((document.querySelector('.tc-a4-paper') as HTMLElement | null)?.style.getPropertyValue('--tc-ink')).toBe('#3b101d');
    });

    fireEvent.click(screen.getByRole('button', { name: '5x yakınlaştır' }));
    expect(screen.getByText('%500')).toBeTruthy();
    expect((document.querySelector('.tc-a4-paper') as HTMLElement | null)?.style.width).toBe('2400px');
    fireEvent.click(screen.getByRole('button', { name: 'Sığdır' }));
    expect((document.querySelector('.tc-scale-frame') as HTMLElement | null)?.style.width).toContain('min(480px');
    expect((document.querySelector('.tc-a4-paper') as HTMLElement | null)?.style.width).toBe('1040px');

    const printBtn = await screen.findByRole('button', { name: /Yazdır \(1 Sayfa\)/i });
    fireEvent.click(printBtn);
    await waitFor(() => {
      expect(screen.getByText(/Yazıcıya iletildi:/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: /e-Okul \(\.zip\)/i }));
    const exportBtn = screen.getByRole('button', { name: /e-Okul Paketi \(\.ZIP\)/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText(/Son çıktı:/i)).toBeTruthy();
    });

    const zipBlob = capturedBlobs.find((b) => b.type === 'application/zip');
    expect(zipBlob).toBeDefined();
    const unzipped = unzipSync(new Uint8Array(await zipBlob!.arrayBuffer()));
    expect(unzipped['9-A/711.jpg']).toBeDefined();
    expect(unzipped['9-A/712.jpg']).toBeDefined();
    expect(unzipped['_rapor/manifest.json']).toBeDefined();
    const manifest = JSON.parse(new TextDecoder().decode(unzipped['_rapor/manifest.json']));
    expect(manifest.count).toBe(2);
    expect(manifest.items[0].sha256).toMatch(/^[0-9a-f]{64}$/);
  } finally {
    URL.createObjectURL = origCreateUrl;
    URL.revokeObjectURL = origRevokeUrl;
    HTMLCanvasElement.prototype.getContext = origGetContext;
    globalThis.createImageBitmap = origCreateBitmap;
  }
}, 15_000);
