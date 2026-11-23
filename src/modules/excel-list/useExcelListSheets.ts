import { useOriginSheet } from '../../window-system/sheet/useOriginSheet';

/**
 * Okul & Sınıf modülündeki form ve önizleme kartlarının OriginSheet kontrolcülerini
 * tek izole kancada toplar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function useExcelListSheets() {
  const newSchoolSheet = useOriginSheet();
  const editSchoolSheet = useOriginSheet();
  const schoolPasteSheet = useOriginSheet();
  const schoolXlsxSheet = useOriginSheet();
  const schoolRosterXlsxSheet = useOriginSheet();
  const classSheet = useOriginSheet();
  const editClassSheet = useOriginSheet();
  const deleteClassSheet = useOriginSheet();
  const studentSheet = useOriginSheet();
  const editStudentSheet = useOriginSheet();
  const deleteStudentSheet = useOriginSheet();
  const pasteSheet = useOriginSheet();
  const xlsxSheet = useOriginSheet();
  const photoMatcherSheet = useOriginSheet();
  const portraitPreviewSheet = useOriginSheet();

  return {
    newSchoolSheet,
    editSchoolSheet,
    schoolPasteSheet,
    schoolXlsxSheet,
    schoolRosterXlsxSheet,
    classSheet,
    editClassSheet,
    deleteClassSheet,
    studentSheet,
    editStudentSheet,
    deleteStudentSheet,
    pasteSheet,
    xlsxSheet,
    photoMatcherSheet,
    portraitPreviewSheet,
  };
}
