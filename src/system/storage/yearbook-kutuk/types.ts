/**
 * İZOLE SİSTEM KATMANI: İdareci / Müdür Yardımcısı Kütük & Sınıf Albümü Veri Tipleri
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const KUTUK_TEMPLATE_IDS = [
  'kutuk-portrait-25',
  'kutuk-portrait-30',
  'kutuk-portrait-35',
  'kutuk-portrait-49',
  'kutuk-landscape-24',
  'kutuk-landscape-30',
  'kutuk-landscape-35',
  'kutuk-landscape-40',
  'kutuk-landscape-50',
  'kutuk-cover-portrait',
  'kutuk-cover-landscape',
] as const;

export type KutukTemplateId = (typeof KUTUK_TEMPLATE_IDS)[number];

export const KUTUK_SCOPE_MODES = ['all-classes', 'deputy', 'single-class'] as const;
export type KutukScopeMode = (typeof KUTUK_SCOPE_MODES)[number];

export const KUTUK_NAME_BOX_STYLES = [
  'apple-soft',
  'filled-band',
  'minimal-clean',
  'classic-grid',
] as const;
export type KutukNameBoxStyle = (typeof KUTUK_NAME_BOX_STYLES)[number];

export const KUTUK_PHOTO_FRAMES = [
  'rounded',
  'sharp',
  'double-frame',
  'frameless',
] as const;
export type KutukPhotoFrame = (typeof KUTUK_PHOTO_FRAMES)[number];

export type KutukTemplateGroupId = 'portrait' | 'landscape' | 'cover';

export interface KutukTemplateGroupMeta {
  id: KutukTemplateGroupId;
  label: string;
  description: string;
}

export interface KutukTemplateSpec {
  id: KutukTemplateId;
  group: KutukTemplateGroupId;
  name: string;
  shortBadge: string;
  subtitle: string;
  officialTitle: string;
  landscape: boolean;
  isCover: boolean;
  cols: number;
  rows: number;
  studentsPerPage: number;
}

export interface KutukStaffBadge<TPhotoRef = string | null> {
  roleLabel: 'Okul Müdürü' | 'Müdür Yardımcısı' | 'Sınıf Öğretmeni';
  fullName: string;
  photoRef: TPhotoRef;
}

export interface KutukNumberedStudent<TStudent> {
  sequenceNumber: number;
  student: TStudent;
}

export interface KutukResolvedPage<TStudent, TPhotoRef = string | null> {
  pageKind: 'cover' | 'class-grid';
  template: KutukTemplateSpec;
  landscape: boolean;
  classId: string;
  className: string;
  classGradeLabel: string;
  classBranchLabel: string;
  classFullLabel: string;
  coverClassSummary: string;
  academicYear: string;
  teacherName: string;
  deputyPrincipalName: string;
  branchPageIndex: number;
  branchTotalPages: number;
  branchStudentCount: number;
  totalClassCount: number;
  totalStudentCount: number;
  scopeTitle: string;
  scopeSubtitle: string;
  staffBadges: readonly KutukStaffBadge<TPhotoRef>[];
  items: readonly KutukNumberedStudent<TStudent>[];
}

export interface DeputyScopeOption {
  deputyName: string;
  branchCount: number;
  branchNames: readonly string[];
}
