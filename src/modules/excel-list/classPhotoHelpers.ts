import {
  sanitizeExportFileStem,
  saveStudioExportFile,
} from '../../system/desktop/exportFileWriter';
import type { ClassRecord, PhotoRecord, StudentRecord } from '../../system/sqlite/types';

/**
 * İZOLE MODÜL 01 YARDIMCISI: Fotoğraf Okuma ve CSV Dışa Aktarım Yardımcıları
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

function sanitizeCsvCell(val: string): string {
  const trimmed = val.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim();
  const safe = /^[=+\-@|%]/.test(trimmed) ? `'${trimmed}` : trimmed;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function exportClassToCsvFile(
  activeClass: ClassRecord,
  students: StudentRecord[],
  photos: PhotoRecord[],
) {
  const header = '"Sıra";"Kayıt No";"Ad";"Soyad";"Unvan";"Dosya";"Albüm";"Grup"';
  const lines = students.map((s, idx) => {
    const p = photos.find((ph) => ph.id === s.matchedPhotoId);
    return [
      sanitizeCsvCell(String(idx + 1)),
      sanitizeCsvCell(s.studentNumber),
      sanitizeCsvCell(s.firstName),
      sanitizeCsvCell(s.lastName),
      sanitizeCsvCell(s.role ?? ''),
      sanitizeCsvCell(p?.fileName ?? ''),
      sanitizeCsvCell(s.showInAlbum !== false ? '1' : '0'),
      sanitizeCsvCell(s.groupCode ?? ''),
    ].join(';');
  });
  const bytes = new TextEncoder().encode(`\uFEFF${[header, ...lines].join('\r\n')}`);
  const clsSlug = sanitizeExportFileStem(activeClass.name, 'sube');
  return saveStudioExportFile({
    subfolder: 'excel',
    fileName: `${clsSlug}_marbleos_liste.csv`,
    bytes,
    mimeType: 'text/csv;charset=utf-8;',
  });
}

export function filterNewClassPhotoFiles(
  fileList: File[],
  classId: string,
  classStudents: StudentRecord[],
  photos: PhotoRecord[],
): { freshFiles: File[]; skippedCount: number } {
  const classStudentIds = new Set(classStudents.map((s) => s.id));
  const existingNames = new Set(
    photos
      .filter((p) => p.classId === classId || (p.studentId && classStudentIds.has(p.studentId)))
      .map((p) => p.fileName.trim().toLocaleLowerCase('tr-TR')),
  );
  const freshFiles = fileList.filter((file) => {
    const baseName = (file.name.split(/[\\/]/).pop() || file.name).trim().toLocaleLowerCase('tr-TR');
    return !existingNames.has(baseName);
  });
  if (freshFiles.length === 0) {
    throw new Error('Seçilen klasördeki fotoğraflar bu şubede zaten yüklü; aynı klasör ikinci kez eklenmedi.');
  }
  return { freshFiles, skippedCount: fileList.length - freshFiles.length };
}
