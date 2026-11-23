import {
  sanitizeExportFileStem,
  saveStudioExportFile,
  type StudioExportWriteResult,
} from '../../system/desktop/exportFileWriter';
import type { ClassRecord, PhotoRecord, SchoolRecord, StudentRecord } from '../../system/sqlite/types';
import { buildXlsxWorkbookBytes } from './xlsxWorkbookBuilder';

/**
 * İZOLE MODÜL 01 ŞUBE & OKUL EXCEL (.XLSX) DIŞA AKTARICISI:
 * Kimlik ve kütük sütunlarını da içerecek şekilde şube veya tüm okul listesini `.xlsx` olarak kaydeder.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const EXPORT_HEADERS = [
  'Sıra',
  'Şube',
  'Okul No',
  'Ad',
  'Soyad',
  'Görevi',
  'Grup',
  'Bölümü / Alanı',
  'T.C. Kimlik No',
  'Doğum Tarihi',
  'Doğum Yeri',
  'Kan Grubu',
  'Baba Adı',
  'Anne Adı',
  'Resim Dosyası',
  'Baskı Durumu',
] as const;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function studentToExportRow(
  index: number,
  className: string,
  student: StudentRecord,
  photoById: ReadonlyMap<string, PhotoRecord>,
): string[] {
  const photo = student.matchedPhotoId ? photoById.get(student.matchedPhotoId) : undefined;
  const idCard = student.idCard;
  return [
    String(index + 1),
    className,
    student.studentNumber,
    student.firstName,
    student.lastName,
    student.role ?? '',
    student.groupCode ?? '',
    idCard?.department ?? '',
    idCard?.nationalId ?? '',
    idCard?.birthDate ?? '',
    idCard?.birthPlace ?? '',
    idCard?.bloodType ?? '',
    idCard?.fatherName ?? '',
    idCard?.motherName ?? '',
    photo?.fileName ?? '',
    student.printReady ? 'ONAYLI' : 'BEKLEMEDE',
  ];
}

export function buildClassRosterXlsxBytes(
  activeClass: ClassRecord,
  students: readonly StudentRecord[],
  photos: readonly PhotoRecord[],
): Uint8Array {
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const rows = [
    [...EXPORT_HEADERS],
    ...students.map((stu, idx) => studentToExportRow(idx, activeClass.name, stu, photoById)),
  ];
  return buildXlsxWorkbookBytes([{ name: activeClass.name, rows }]);
}

export async function exportClassToXlsxFile(
  activeClass: ClassRecord,
  students: readonly StudentRecord[],
  photos: readonly PhotoRecord[],
  school?: SchoolRecord | null,
): Promise<StudioExportWriteResult> {
  const bytes = buildClassRosterXlsxBytes(activeClass, students, photos);
  const prefix = school ? `${sanitizeExportFileStem(school.name, 'okul')}_` : '';
  const clsSlug = sanitizeExportFileStem(activeClass.name, 'sube');
  return saveStudioExportFile({
    subfolder: 'excel',
    fileName: `${prefix}${clsSlug}_liste.xlsx`,
    bytes,
    mimeType: XLSX_MIME,
  });
}
