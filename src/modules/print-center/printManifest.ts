import {
  sanitizeExportFileStem,
  saveStudioExportFile,
} from '../../system/desktop/exportFileWriter';
import { notifyStudio } from '../../system/desktop/studioToast';
import type { StudioDatabaseSnapshot } from '../../system/sqlite/types';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';

export function escapeCsvCell(value: string): string {
  // Quoting alone does not stop Excel formula evaluation, including leading whitespace or DDE prefixes.
  const safe = /^[\s\uFEFF]*[=+\-@|%]/u.test(value) || /^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildPrintManifest(state: StudioDatabaseSnapshot): string {
  const scopedClasses = state.activeSchoolId
    ? state.classes.filter((item) => item.schoolId === state.activeSchoolId)
    : state.classes;
  const classMap = new Map(scopedClasses.map((item) => [item.id, item.name]));
  const scopedStudents = state.activeSchoolId
    ? state.students.filter((student) => classMap.has(student.classId))
    : state.students;
  const rows = scopedStudents.map((student) =>
    [
      classMap.get(student.classId) ?? '-',
      student.studentNumber,
      student.firstName,
      student.lastName,
      state.photos.find((photo) => photo.id === student.matchedPhotoId)?.fileName ?? 'EKSIK',
      student.printReady ? 'KULLANICI_ONAYLI' : 'BEKLEMEDE',
    ]
      .map(escapeCsvCell)
      .join(';'),
  );
  return ['Sinif;OkulNo;Ad;Soyad;FotografDosyasi;BaskiDurumu', ...rows].join('\r\n');
}

export async function savePrintManifestCsv(
  db: StudioDatabaseSnapshot,
  schoolName: string,
): Promise<void> {
  try {
    const slug = sanitizeExportFileStem(schoolName, 'okul');
    const bytes = new TextEncoder().encode(`\uFEFF${buildPrintManifest(db)}`);
    const res = await saveStudioExportFile({
      subfolder: 'manifest',
      fileName: `${slug}_baski_kontrol_listesi.csv`,
      bytes,
      mimeType: 'text/csv;charset=utf-8;',
    });
    notifyStudio(
      res.mode === 'desktop'
        ? `Kontrol listesi kaydedildi (${res.displayPath}).`
        : 'Kontrol listesi (.csv) indirildi.',
      'success',
    );
  } catch (err) {
    notifyStudio(formErrorMessage(err), 'error');
  }
}
