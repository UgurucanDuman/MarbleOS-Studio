/** İZOLE SİSTEM YARDIMCISI: Tarayıcı Prototipi Alan Temizleme ve Albüm Şeması İyileştirici (.ts <= 240 satır) */

import { healPvcAlbumFields } from '../storage/pvc-cards/healPvcConfig';
import { isPrintFontPoint } from '../storage/printTypography';
import {
  isValidTeacherChartInkId,
  isValidTeacherChartPaletteId,
  isValidTeacherChartTemplateId,
} from '../storage/teacher-charts/paginationMath';
import {
  isValidKutukNameBoxStyle,
  isValidKutukPhotoFrame,
  isValidKutukScopeMode,
  isValidKutukTemplateId,
} from '../storage/yearbook-kutuk/catalog';

export type AnyRec = Record<string, unknown>;

const SINGLE_LINE_CTRL = /[\u0000-\u001f\u007f-\u009f]+/g;
const MULTI_LINE_CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]+/g;
const DATA_URL_RE = /^(?:|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2})$/;

export function asCleanSingle(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.replace(SINGLE_LINE_CTRL, ' ').trim() : fallback;
}
export function asCleanMulti(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.replace(MULTI_LINE_CTRL, ' ').trim() : fallback;
}
export function asDataUrl(val: unknown, maxLen: number): string {
  if (typeof val !== 'string' || val.length > maxLen) return '';
  return DATA_URL_RE.test(val) ? val : '';
}
export function asBool(val: unknown, fallback = false): boolean {
  return typeof val === 'boolean' ? val : fallback;
}
export function asNum(val: unknown, fallback: number, min: number, max: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.min(max, Math.max(min, n));
}

export function asIdCard(val: unknown): AnyRec | undefined {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
  const v = val as AnyRec;
  const out: AnyRec = {};
  const nat = asCleanSingle(v.nationalId).replace(/\D+/g, '').slice(0, 11);
  if (nat) out.nationalId = nat;
  for (const [k, max] of [
    ['department', 60], ['bloodType', 16], ['fatherName', 50], ['motherName', 50],
    ['birthPlace', 50], ['birthDate', 24], ['province', 40], ['district', 40],
    ['neighborhood', 60], ['volumeNo', 20], ['familySerialNo', 20], ['serialNo', 20],
    ['documentNo', 30], ['registryNo', 30],
  ] as const) {
    const str = asCleanSingle(v[k]).slice(0, max);
    if (str) out[k] = str;
  }
  return Object.keys(out).length ? out : undefined;
}

export function healAlbumConfigObject(raw: unknown): AnyRec {
  const ac = (raw && typeof raw === 'object' ? raw : {}) as AnyRec;
  const layoutKind =
    ac.layoutKind === 'yearbook-spread' || ac.layoutKind === 'id-card' ? ac.layoutKind : 'class-chart';
  const coverUrl = asDataUrl(ac.customCoverDataUrl, 4_500_000);
  return {
    selectedClassId: asCleanSingle(ac.selectedClassId),
    layoutKind,
    headerTitle: asCleanSingle(ac.headerTitle, '2025 – 2026 Eğitim Öğretim Yılı Panosu').slice(0, 120),
    accentColor: asCleanSingle(ac.accentColor, '#3b82f6') || '#3b82f6',
    columns: Math.round(asNum(ac.columns, 4, 2, 10)),
    showStudentNumbers: asBool(ac.showStudentNumbers, true),
    showTeacherBadge: asBool(ac.showTeacherBadge, true),
    ...(isValidTeacherChartTemplateId(ac.chartTemplateId) ? { chartTemplateId: ac.chartTemplateId } : {}),
    ...(isValidTeacherChartPaletteId(ac.chartPaletteId) ? { chartPaletteId: ac.chartPaletteId } : {}),
    ...(isValidTeacherChartInkId(ac.chartInkId) ? { chartInkId: ac.chartInkId } : {}),
    ...(isPrintFontPoint(ac.printFontPt) ? { printFontPt: ac.printFontPt } : {}),
    ...(typeof ac.courseName === 'string' ? { courseName: asCleanSingle(ac.courseName).slice(0, 60) } : {}),
    ...(typeof ac.coverTitle === 'string' ? { coverTitle: asCleanSingle(ac.coverTitle).slice(0, 80) } : {}),
    ...(typeof ac.coverSubtitle === 'string' ? { coverSubtitle: asCleanSingle(ac.coverSubtitle).slice(0, 80) } : {}),
    ...(coverUrl ? { customCoverDataUrl: coverUrl } : {}),
    ...(ac.customCoverMode === 'full-bleed' || ac.customCoverMode === 'emblem'
      ? { customCoverMode: ac.customCoverMode }
      : {}),
    ...(isValidKutukTemplateId(ac.kutukTemplateId) ? { kutukTemplateId: ac.kutukTemplateId } : {}),
    ...(typeof ac.kutukCols === 'number' && Number.isFinite(ac.kutukCols)
      ? { kutukCols: Math.round(asNum(ac.kutukCols, 5, 3, 10)) }
      : {}),
    ...(typeof ac.kutukRows === 'number' && Number.isFinite(ac.kutukRows)
      ? { kutukRows: Math.round(asNum(ac.kutukRows, 6, 3, 7)) }
      : {}),
    ...(isValidKutukScopeMode(ac.kutukScopeMode) ? { kutukScopeMode: ac.kutukScopeMode } : {}),
    ...(typeof ac.kutukDeputyName === 'string'
      ? { kutukDeputyName: asCleanSingle(ac.kutukDeputyName).slice(0, 60) }
      : {}),
    ...(typeof ac.kutukIncludeCover === 'boolean' ? { kutukIncludeCover: ac.kutukIncludeCover } : {}),
    ...(typeof ac.kutukShowHeader === 'boolean' ? { kutukShowHeader: ac.kutukShowHeader } : {}),
    ...(typeof ac.kutukShowSubtitle === 'boolean' ? { kutukShowSubtitle: ac.kutukShowSubtitle } : {}),
    ...(typeof ac.kutukShowStaffPortraits === 'boolean'
      ? { kutukShowStaffPortraits: ac.kutukShowStaffPortraits }
      : {}),
    ...(typeof ac.kutukShowTeacherSig === 'boolean' ? { kutukShowTeacherSig: ac.kutukShowTeacherSig } : {}),
    ...(typeof ac.kutukShowDeputySig === 'boolean' ? { kutukShowDeputySig: ac.kutukShowDeputySig } : {}),
    ...(typeof ac.kutukShowPrincipalSig === 'boolean' ? { kutukShowPrincipalSig: ac.kutukShowPrincipalSig } : {}),
    ...(typeof ac.kutukShowPageNumber === 'boolean' ? { kutukShowPageNumber: ac.kutukShowPageNumber } : {}),
    ...(isValidKutukNameBoxStyle(ac.kutukNameBoxStyle)
      ? { kutukNameBoxStyle: ac.kutukNameBoxStyle }
      : {}),
    ...(isValidKutukPhotoFrame(ac.kutukPhotoFrame)
      ? { kutukPhotoFrame: ac.kutukPhotoFrame }
      : {}),
    ...(typeof ac.kutukFrameColor === 'string' && /^(?:|#[0-9a-fA-F]{6})$/.test(ac.kutukFrameColor)
      ? { kutukFrameColor: ac.kutukFrameColor }
      : {}),
    ...healPvcAlbumFields(ac),
  };
}
