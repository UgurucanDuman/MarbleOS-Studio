import { expect, test, vi } from 'vitest';
import { albumConfigPatchSchema } from '../../schemas/studioSchemas';
import { backupAlbumConfigSchema } from '../../sqlite/backupShared';
import { healPrototypeSnapshotObject } from '../../sqlite/healPrototypeSnapshot';
import type { ClassRecord } from '../../sqlite/types';
import { TEACHER_PALETTE_LIST } from '../teacher-charts/catalog';
import { resolveKutukTemplate } from './catalog';
import { paintKutukCoverSheet } from './drawKutukCoverCanvas';
import { paintKutukClassSheet } from './drawKutukSheetCanvas';
import {
  buildKutukDossierPages,
  compareBranchNamesTr,
  extractDeputyPrincipalOptions,
  parseTurkishClassBranch,
  summarizeTurkishClassBranches,
  type KutukStudentLike,
} from './paginationMath';

function makeClass(
  id: string,
  name: string,
  teacherName = '',
  deputyPrincipalName = '',
): ClassRecord {
  return {
    id,
    schoolId: 'sch-1',
    academicYear: '2026-2027',
    name,
    teacherName,
    deputyPrincipalName,
    createdAt: '2026-11-17T00:00:00Z',
  };
}

function makeStudent(
  id: string,
  classId: string,
  studentNumber: string,
  firstName: string,
  lastName: string,
  extra?: Partial<KutukStudentLike>,
): KutukStudentLike {
  return {
    id,
    classId,
    studentNumber,
    firstName,
    lastName,
    matchedPhotoId: `ph-${id}`,
    ...extra,
  };
}

test('sorts Turkish branches naturally, paginates each class on fresh pages, resolves staff badges, and validates schemas', () => {
  expect(parseTurkishClassBranch('1-A')).toMatchObject({
    gradeLabel: '1. Sınıf',
    branchLabel: 'A Şubesi',
    fullLabel: '1. Sınıf · A Şubesi',
  });
  expect(summarizeTurkishClassBranches(['1-A'])).toEqual({
    scopeLine: '1. Sınıf · A Şubesi',
    statValue: '1. Sınıf · A Şubesi',
  });
  expect(summarizeTurkishClassBranches(['9-A', '9-B'])).toEqual({
    scopeLine: '9. Sınıf · A, B Şubeleri',
    statValue: '9. Sınıf (A, B Şb.)',
  });

  const names = ['10-B', '9-A', '11-A', '9-B', '2-C'];
  expect([...names].sort(compareBranchNamesTr)).toEqual(['2-C', '9-A', '9-B', '10-B', '11-A']);

  const classes: ClassRecord[] = [
    makeClass('c-staff', 'ÖĞRETMEN'),
    makeClass('c-10a', '10-A', 'Kemal Arslan', 'İsmail Çelik'),
    makeClass('c-9a', '9-A', 'Derya Yılmaz', 'Ahmet Demir'),
  ];

  const staff: KutukStudentLike[] = [
    makeStudent('st-p', 'c-staff', '0', 'Selim', 'Korkmaz', { role: 'MDR.', isPrincipal: true }),
    makeStudent('st-d', 'c-staff', '0-2', 'Ahmet', 'Demir', { role: 'MD.YRD.' }),
    makeStudent('st-t', 'c-staff', '0-3', 'Derya', 'Yılmaz', { role: 'REHBER' }),
  ];

  const students9A = Array.from({ length: 32 }, (_, idx) =>
    makeStudent(`s9-${idx}`, 'c-9a', String(100 + idx), `Öğrenci${idx}`, 'Kaya'),
  );
  const students10A = [makeStudent('s10-1', 'c-10a', '501', 'Zeynep', 'Ak')];
  const all = [...staff, ...students9A, ...students10A];

  const deputies = extractDeputyPrincipalOptions(classes, all);
  expect(deputies.map((d) => d.deputyName)).toEqual(['Ahmet Demir', 'İsmail Çelik']);

  const allPages = buildKutukDossierPages({
    classes,
    students: all,
    allStaffAndStudents: all,
    template: resolveKutukTemplate('kutuk-portrait-30'),
    scopeMode: 'all-classes',
    includeCover: true,
    showStaffPortraits: true,
  });

  // 1 Ön Kapak + 9-A (2 sayfa: 30 + 2) + 10-A (1 sayfa: 1) = 4 sayfa; ÖĞRETMEN şubesi öğrenci kütük sayfası olarak karışmaz
  expect(allPages).toHaveLength(4);
  expect(allPages[0]!.pageKind).toBe('cover');
  expect(allPages[1]!.className).toBe('9-A');
  expect(allPages[1]!.branchPageIndex).toBe(0);
  expect(allPages[1]!.branchTotalPages).toBe(2);
  expect(allPages[1]!.items).toHaveLength(30);
  expect(allPages[1]!.staffBadges.map((b) => b.roleLabel)).toEqual([
    'Okul Müdürü',
    'Müdür Yardımcısı',
    'Sınıf Öğretmeni',
  ]);
  expect(allPages[2]!.className).toBe('9-A');
  expect(allPages[2]!.items).toHaveLength(2);
  expect(allPages[3]!.className).toBe('10-A');
  expect(allPages[3]!.items).toHaveLength(1);

  // Türkçe İ/i duyarsız Md. Yrd. süzmesi
  const deputyPages = buildKutukDossierPages({
    classes,
    students: all,
    allStaffAndStudents: all,
    template: resolveKutukTemplate('kutuk-landscape-24'),
    scopeMode: 'deputy',
    selectedDeputyName: 'ismail çelik',
    includeCover: false,
  });
  expect(deputyPages).toHaveLength(1);
  expect(deputyPages[0]!.className).toBe('10-A');
  expect(deputyPages[0]!.landscape).toBe(true);

  // 300 DPI tuval boyayıcıları hatasız çalışır
  const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
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

  paintKutukCoverSheet({
    ctx: mockCtx,
    widthPx: 2480,
    heightPx: 3508,
    page: allPages[0]!,
    palette: TEACHER_PALETTE_LIST[0]!,
    schoolName: 'Atatürk Lisesi',
  });
  paintKutukClassSheet({
    ctx: mockCtx,
    widthPx: 2480,
    heightPx: 3508,
    page: allPages[1]!,
    palette: TEACHER_PALETTE_LIST[0]!,
    schoolName: 'Atatürk Lisesi',
    nameBoxStyle: 'filled-band',
    photoFrame: 'double-frame',
    frameColor: '#6b1d2f',
    showStudentNumbers: true,
    showTeacherBadge: true,
    showStaffPortraits: true,
    pageNumber: 2,
    totalPages: 4,
    renderedPortraits: new Map(),
  });
  expect(mockCtx.fillText).toHaveBeenCalled();

  // Şema & Yedek doğrulaması
  expect(
    albumConfigPatchSchema.safeParse({
      kutukTemplateId: 'kutuk-portrait-35',
      kutukScopeMode: 'deputy',
      kutukDeputyName: 'Ahmet Demir',
      kutukIncludeCover: true,
      kutukShowStaffPortraits: true,
      kutukNameBoxStyle: 'filled-band',
      kutukPhotoFrame: 'double-frame',
      kutukFrameColor: '#6b1d2f',
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
      columns: 5,
      showStudentNumbers: true,
      showTeacherBadge: true,
      kutukTemplateId: 'kutuk-portrait-30',
      kutukScopeMode: 'all-classes',
      kutukIncludeCover: true,
      kutukShowStaffPortraits: false,
    },
  }) as { albumConfig: unknown };
  expect(backupAlbumConfigSchema.safeParse(healed.albumConfig).success).toBe(true);
});
