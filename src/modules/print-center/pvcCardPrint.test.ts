import { describe, expect, test, vi } from 'vitest';
import { buildPhysicalPdfFromJpegs } from '../../system/storage/pdfDocumentBuilder';
import { resolvePvcCardDesign } from '../../system/storage/pvc-cards/catalog';
import { paintPvcCardToCanvas } from '../../system/storage/pvc-cards/drawPvcCardCanvas';
import { scalePvcSideToSize } from '../../system/storage/pvc-cards/elementFactory';
import { resolveTeacherChartConfig } from '../../system/storage/teacher-charts/paginationMath';
import { planImpositionPages, type PrintableStudentEntry } from './printSpecs';

function makeEntries(count: number): PrintableStudentEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    className: '1-A',
    classRecord: undefined,
    student: {
      id: `s-${i}`,
      classId: 'c-1',
      studentNumber: String(700 + i),
      firstName: `Öğrenci${i}`,
      lastName: 'Deneme',
      matchedPhotoId: `p-${i}`,
      printReady: true,
      updatedAt: '2026-11-21T00:00:00Z',
    },
    photo: {
      id: `p-${i}`,
      fileName: `${700 + i}.jpg`,
      dataUrl: '',
      studentId: `s-${i}`,
      classId: 'c-1',
      approvedForPrint: true,
      adjustments: { zoom: 1, brightness: 100, contrast: 100, warmth: 0 },
      createdAt: '2026-11-21T00:00:00Z',
    },
  }));
}

describe('PVC Kart Özel Boyut, Oval Baskı Köşeleri & PDF /Interpolate', () => {
  test('hazır şablon özel ölçüde (100×70 mm) öğeleri orantılı ölçekler ve A4 dizgisini dinamik hesaplar', () => {
    const resolved = resolvePvcCardDesign({
      pvcTemplateId: 'primary-geometric',
      pvcCardWidthMm: 100,
      pvcCardHeightMm: 70,
      pvcCardRadiusMm: 5,
    });
    expect(resolved.widthMm).toBe(100);
    expect(resolved.heightMm).toBe(70);
    expect(resolved.cardRadiusMm).toBe(5);
    expect(resolved.front.elements.every((el) => el.xMm + el.wMm <= 108)).toBe(true);

    const a4Pages = planImpositionPages(makeEntries(10), 'pvc-id-card', 'a4-id-8up', 4, {
      pvcTemplateId: 'primary-geometric',
      pvcCardWidthMm: 100,
      pvcCardHeightMm: 70,
    });
    expect(a4Pages[0]!.slots[0]!.widthMm).toBe(100);
    expect(a4Pages[0]!.slots[0]!.heightMm).toBe(70);
    expect(a4Pages[0]!.slots.length).toBeGreaterThanOrEqual(3);
    expect(a4Pages[0]!.slots.every((s) => s.xMm + s.widthMm <= a4Pages[0]!.widthMm)).toBe(true);
    expect(a4Pages[0]!.slots.every((s) => s.yMm + s.heightMm <= a4Pages[0]!.heightMm)).toBe(true);

    const scaled = scalePvcSideToSize(resolved.front, 100, 70, 50, 70);
    expect(scaled.elements[0]!.wMm).toBeCloseTo(resolved.front.elements[0]!.wMm * 0.5, 1);

    const singleCustom = planImpositionPages(makeEntries(2), 'pvc-id-card', 'cr80-single', 4, {
      pvcTemplateId: 'primary-geometric',
      pvcCardWidthMm: 100,
      pvcCardHeightMm: 70,
    });
    expect(singleCustom).toHaveLength(2);
    expect(singleCustom[0]!.widthMm).toBe(100);
    expect(singleCustom[0]!.heightMm).toBe(70);
    expect(singleCustom[0]!.slots).toHaveLength(1);
  });

  test('paintPvcCardToCanvas oval cardRadiusMm köşelerini yuvarlatılmış path ile kırpar ve çizer', () => {
    const calls: string[] = [];
    const ctx = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      beginPath: () => calls.push('beginPath'),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      rect: vi.fn(),
      ellipse: vi.fn(),
      arcTo: () => calls.push('arcTo'),
      quadraticCurveTo: () => calls.push('quadraticCurveTo'),
      closePath: () => calls.push('closePath'),
      clip: () => calls.push('clip'),
      stroke: () => calls.push('stroke'),
      strokeRect: () => calls.push('strokeRect'),
      fillRect: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      measureText: () => ({ width: 20 }),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    const design = resolvePvcCardDesign({
      pvcTemplateId: 'primary-geometric',
      pvcCardRadiusMm: 5.5,
    });
    paintPvcCardToCanvas({
      ctx,
      design,
      side: 'front',
      xPx: 100,
      yPx: 100,
      widthPx: 1011,
      heightPx: 638,
      palette: resolveTeacherChartConfig({}).palette,
      data: {
        schoolName: 'Deneme İlkokulu',
        className: '1-A',
        isStaffCard: false,
        student: makeEntries(1)[0]!.student,
      },
      bitmaps: {},
      drawOuterBorder: true,
    });

    expect(calls.filter((c) => c === 'arcTo').length).toBeGreaterThanOrEqual(8);
    expect(calls).not.toContain('strokeRect');
  });

  test('A4 PVC tabakasında 10-lu (2×5), 8-li (2×4) ve 5-li dizgiler %100 CR80 ölçekle taşmadan yerleşir', () => {
    const entries = makeEntries(12);

    // 10'lu yatay kart (2×5 = 10 kart / A4 Dikey) + çift yüz aynalama
    const tenUp = planImpositionPages(entries, 'pvc-id-card', 'a4-id-8up', 4, {
      pvcTemplateId: 'primary-geometric',
      pvcCardsPerPage: 10,
    }, undefined, 'portrait', 'vertical');
    expect(tenUp).toHaveLength(4); // 10 ön + 10 arka + 2 ön + 2 arka
    expect(tenUp[0]!.cols).toBe(2);
    expect(tenUp[0]!.rows).toBe(5);
    expect(tenUp[0]!.slots).toHaveLength(10);
    expect(tenUp[0]!.slots.every((s) => s.widthMm === 85.6 && s.heightMm === 54)).toBe(true);
    expect(tenUp[0]!.slots.every((s) => s.xMm >= 6.5 && s.xMm + s.widthMm <= 203.5)).toBe(true);
    expect(tenUp[0]!.slots.every((s) => s.yMm >= 6.5 && s.yMm + s.heightMm <= 290.5)).toBe(true);
    expect(tenUp[1]!.cardSide).toBe('back');
    expect(tenUp[1]!.slots[0]!.xMm).toBeGreaterThan(tenUp[0]!.slots[0]!.xMm);

    // 8'li yatay kart (2×4 = 8 kart / A4 Dikey)
    const eightUp = planImpositionPages(entries, 'pvc-id-card', 'a4-id-8up', 4, {
      pvcTemplateId: 'primary-geometric',
      pvcCardsPerPage: 8,
    }, undefined, 'portrait');
    expect(eightUp).toHaveLength(2);
    expect(eightUp[0]!.slots).toHaveLength(8);
    expect(eightUp[1]!.slots).toHaveLength(4);

    // 5'li yatay kart (1×5 = 5 kart / A4 Dikey)
    const fiveUp = planImpositionPages(entries, 'pvc-id-card', 'a4-id-8up', 4, {
      pvcTemplateId: 'primary-geometric',
      pvcCardsPerPage: 5,
    }, undefined, 'portrait');
    expect(fiveUp).toHaveLength(3); // 5 + 5 + 2
    expect(fiveUp[0]!.slots).toHaveLength(5);
    expect(fiveUp[2]!.slots).toHaveLength(2);

    // Dikey kart 10'lu A4 Yatay (5×2 = 10 kart / A4 Yatay)
    const portraitTenUp = planImpositionPages(entries, 'pvc-id-card', 'a4-id-8up', 4, {
      pvcTemplateId: 'vertical-lanyard',
      pvcCardsPerPage: 10,
    }, undefined, 'landscape');
    expect(portraitTenUp).toHaveLength(2);
    expect(portraitTenUp[0]!.cols).toBe(5);
    expect(portraitTenUp[0]!.rows).toBe(2);
    expect(portraitTenUp[0]!.slots).toHaveLength(10);
    expect(portraitTenUp[0]!.slots.every((s) => s.xMm >= 6.5 && s.xMm + s.widthMm <= 290.5)).toBe(true);
  });

  test('PDF belge derleyici yumuşak tarayıcı ölçeklemesi için /Interpolate true içerir', () => {
    const pdf = buildPhysicalPdfFromJpegs([
      {
        jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]),
        pixelWidth: 1181,
        pixelHeight: 1772,
        widthMm: 100,
        heightMm: 150,
      },
    ]);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text).toContain('/Interpolate true');
  });
});
