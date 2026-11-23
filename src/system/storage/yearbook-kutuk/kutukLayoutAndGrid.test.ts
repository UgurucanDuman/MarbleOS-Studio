import { expect, test, vi } from 'vitest';
import { albumConfigPatchSchema } from '../../schemas/studioSchemas';
import { backupAlbumConfigSchema } from '../../sqlite/backupShared';
import { healPrototypeSnapshotObject } from '../../sqlite/healPrototypeSnapshot';
import type { ClassRecord } from '../../sqlite/types';
import { TEACHER_PALETTE_LIST } from '../teacher-charts/catalog';
import { resolveKutukTemplate } from './catalog';
import { kutukCardNameScale, kutukMinimalNameScale } from './drawKutukPrimitives';
import { paintKutukClassSheet } from './drawKutukSheetCanvas';
import { computeKutukGridMetrics } from './kutukGridMetrics';
import { buildKutukDossierPages, type KutukStudentLike } from './paginationMath';

function makeMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillStyle: '#fff',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  } as unknown as CanvasRenderingContext2D;
}

test('resolves flexible portrait (4–7 × 4–7) and compact 40/50-up landscape (6–10 × 3–6) Kütük grids', () => {
  expect(resolveKutukTemplate('kutuk-portrait-35')).toMatchObject({
    cols: 7,
    rows: 5,
    studentsPerPage: 35,
    landscape: false,
  });
  expect(resolveKutukTemplate('kutuk-portrait-49')).toMatchObject({
    cols: 7,
    rows: 7,
    studentsPerPage: 49,
    landscape: false,
  });
  expect(resolveKutukTemplate('kutuk-landscape-40')).toMatchObject({
    cols: 10,
    rows: 4,
    studentsPerPage: 40,
    landscape: true,
  });
  expect(resolveKutukTemplate('kutuk-landscape-50')).toMatchObject({
    cols: 10,
    rows: 5,
    studentsPerPage: 50,
    landscape: true,
  });

  // Özel sütun × satır geçersiz kılmaları (5×4, 5×7, 7×6, 8×5 yatay)
  expect(resolveKutukTemplate('kutuk-portrait-30', 'portrait', 5, 4)).toMatchObject({
    cols: 5,
    rows: 4,
    studentsPerPage: 20,
    shortBadge: '5×4 · Dikey',
  });
  expect(resolveKutukTemplate('kutuk-portrait-30', 'portrait', 5, 7)).toMatchObject({
    cols: 5,
    rows: 7,
    studentsPerPage: 35,
    shortBadge: '5×7 · Dikey',
  });
  // Yatay 10 sütundan dikeye geçildiğinde dikey güvenli üst sınır 7'ye çekilir
  expect(resolveKutukTemplate('kutuk-landscape-40', 'portrait', 10, 5)).toMatchObject({
    cols: 7,
    rows: 5,
    studentsPerPage: 35,
    landscape: false,
  });
  expect(resolveKutukTemplate('kutuk-landscape-24', 'landscape', 8, 5)).toMatchObject({
    cols: 8,
    rows: 5,
    studentsPerPage: 40,
    shortBadge: '8×5 · Yatay',
  });
});

test('computes compact non-stretched portrait cards, zero wasted horizontal gaps on 40-up landscape, and safe name scaling', () => {
  const portrait7x5 = computeKutukGridMetrics({
    landscape: false,
    cols: 7,
    rows: 5,
    hasHeader: true,
    hasSubtitle: true,
    hasFooter: true,
  });
  // Fotoğraf aşağıya uzatılmadan kompakt 3:4 oranına kilitlenir
  const p75Ratio = portrait7x5.cardWMm / portrait7x5.photoHMm;
  expect(p75Ratio).toBeGreaterThanOrEqual(0.73);
  expect(p75Ratio).toBeLessThanOrEqual(0.91);

  const landscape10x4 = computeKutukGridMetrics({
    landscape: true,
    cols: 10,
    rows: 4,
    hasHeader: true,
    hasSubtitle: true,
    hasFooter: true,
  });
  const totalWidth10x4 = 10 * landscape10x4.cardWMm + 9 * landscape10x4.gapXMm;
  const usableLandscapeW = 297 - landscape10x4.leftMm - landscape10x4.rightMm;
  expect(totalWidth10x4).toBeGreaterThan(usableLandscapeW * 0.96);
  expect(landscape10x4.gapXMm).toBeLessThanOrEqual(1.3);

  // Üst başlık gizlendiğinde portreler daha geniş yükseklik kazanır
  const noHead = computeKutukGridMetrics({
    landscape: true,
    cols: 10,
    rows: 4,
    hasHeader: false,
    hasSubtitle: false,
    hasFooter: true,
  });
  expect(noHead.headHMm).toBe(0);
  expect(noHead.photoHMm).toBeGreaterThan(landscape10x4.photoHMm);

  // Uzun isimler kısa isimlerden daha küçük ölçek alır ve tek kelimeyi ortadan bölmez
  expect(kutukCardNameScale('MUSTAFA URAS ERGEN', 26, 2.0)).toBeLessThan(
    kutukCardNameScale('ATLAS ÇEVİK', 26, 2.0),
  );
  expect(kutukCardNameScale('DURU KABLANOĞLU', 24, 2.0)).toBeLessThan(1);
  expect(kutukMinimalNameScale('711 DURU KABLANOĞLU', 10)).toBeLessThan(
    kutukMinimalNameScale('712 ATLAS ÇEVİK', 5),
  );
});

test('paints all 4 single-frame card styles cleanly at 300 DPI and validates new schema fields', () => {
  const cls: ClassRecord = {
    id: 'c-1a',
    schoolId: 'sch-1',
    academicYear: '2026-2027',
    name: '1-A',
    teacherName: 'Ayşe Yılmaz',
    createdAt: '2026-11-23T00:00:00Z',
  };
  const students: KutukStudentLike[] = Array.from({ length: 40 }, (_, idx) => ({
    id: `s-${idx}`,
    classId: 'c-1a',
    studentNumber: String(700 + idx),
    firstName: idx % 2 === 0 ? 'MUSTAFA URAS' : 'DURU',
    lastName: idx % 2 === 0 ? 'ERGEN' : 'KABLANOĞLU',
    matchedPhotoId: null,
  }));

  const pages = buildKutukDossierPages({
    classes: [cls],
    students,
    template: resolveKutukTemplate('kutuk-landscape-40'),
    scopeMode: 'all-classes',
  });
  expect(pages).toHaveLength(1);
  expect(pages[0]!.items).toHaveLength(40);

  for (const style of ['apple-soft', 'filled-band', 'minimal-clean', 'classic-grid'] as const) {
    const ctx = makeMockCtx();
    paintKutukClassSheet({
      ctx,
      widthPx: 3508,
      heightPx: 2480,
      page: pages[0]!,
      palette: TEACHER_PALETTE_LIST[0]!,
      schoolName: 'OKUL',
      nameBoxStyle: style,
      photoFrame: 'rounded',
      frameColor: '#6b1d2f',
      showStudentNumbers: true,
      showTeacherBadge: true,
      showHeader: true,
      showSubtitle: false,
      showStaffPortraits: false,
      pageNumber: 1,
      totalPages: 1,
      renderedPortraits: new Map(),
    });
    expect(ctx.fillText).toHaveBeenCalled();
  }

  expect(
    albumConfigPatchSchema.safeParse({
      columns: 10,
      kutukTemplateId: 'kutuk-landscape-40',
      kutukCols: 10,
      kutukRows: 4,
      kutukShowHeader: true,
      kutukShowSubtitle: false,
    }).success,
  ).toBe(true);

  const healed = healPrototypeSnapshotObject({
    schools: [],
    classes: [],
    students: [],
    photos: [],
    albumConfig: {
      selectedClassId: '',
      layoutKind: 'yearbook-spread',
      headerTitle: 'Kütük',
      accentColor: '#1b365d',
      columns: 10,
      showStudentNumbers: true,
      showTeacherBadge: true,
      kutukTemplateId: 'kutuk-landscape-50',
      kutukCols: 10,
      kutukRows: 5,
      kutukShowHeader: false,
      kutukShowSubtitle: false,
    },
  }) as { albumConfig: unknown };
  expect(backupAlbumConfigSchema.safeParse(healed.albumConfig).success).toBe(true);
});
