import React from 'react';
import type { ClassRecord, PhotoRecord, SchoolRecord, StudentRecord } from '../../system/sqlite/types';
import { notifyStudio } from '../../system/desktop/studioToast';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import { exportClassToCsvFile } from './classPhotoHelpers';
import { CrossClassStudentSearch } from './CrossClassStudentSearch';
import { QuickStudentCapsule } from './QuickStudentCapsule';
import { formErrorMessage, isTeacherClassName } from './sheets/formHelpers';
import { AppleSearchField } from './TableActionIcons';
import { exportClassToXlsxFile } from './xlsxExport';

export const ExcelClassActions: React.FC<{
  activeSchool: SchoolRecord;
  activeClass: ClassRecord;
  classStudents: StudentRecord[];
  photos: PhotoRecord[];
  xlsxSheet: OriginSheetController;
  pasteSheet: OriginSheetController;
  studentSheet: OriginSheetController;
  onTriggerCsvUpload: () => void;
}> = React.memo(({
  activeSchool,
  activeClass,
  classStudents,
  photos,
  xlsxSheet,
  pasteSheet,
  studentSheet,
  onTriggerCsvUpload,
}) => {
  const isStaff = isTeacherClassName(activeClass.name);
  return (
    <div className="xl-actions">
      <button type="button" className="xl-btn" aria-label="CSV / TSV" onClick={onTriggerCsvUpload}>
        <SheetAutoIcon text="CSV / TSV" />
        CSV
      </button>
      <button type="button" className="xl-btn" aria-label="Excel Dosyası (.xlsx)" {...xlsxSheet.trigger('xlsx')}>
        <SheetAutoIcon text="Excel" />
        Excel (.xlsx)
      </button>
      <button type="button" className="xl-btn" aria-label="Excel'den Yapıştır" {...pasteSheet.trigger('paste')}>
        <SheetAutoIcon text="Excel'den Yapıştır" />
        Yapıştır
      </button>
      <button
        type="button"
        className="xl-btn"
        aria-label="Excel İndir (.xlsx)"
        onClick={() =>
          void exportClassToXlsxFile(activeClass, classStudents, photos, activeSchool)
            .then((r) =>
              notifyStudio(
                r.mode === 'desktop' ? `Excel kaydedildi (${r.displayPath}).` : 'Excel (.xlsx) indirildi.',
                'success',
              ),
            )
            .catch((err) => notifyStudio(formErrorMessage(err), 'error'))
        }
      >
        <SheetAutoIcon text="Excel" />
        .xlsx İndir
      </button>
      <button
        type="button"
        className="xl-btn"
        aria-label="e-Okul Liste"
        onClick={() =>
          void exportClassToCsvFile(activeClass, classStudents, photos)
            .catch((err) => notifyStudio(formErrorMessage(err), 'error'))
        }
      >
        <SheetAutoIcon text="e-Okul" />
        e-Okul
      </button>
      <button type="button" className="xl-btn xl-btn-primary" {...studentSheet.trigger('stu')}>
        <SheetAutoIcon text={isStaff ? 'Öğretmen' : 'Yeni Öğrenci'} />
        {isStaff ? 'Yeni Öğretmen' : 'Yeni Öğrenci'}
      </button>
    </div>
  );
});

export const ExcelClassToolbar: React.FC<{
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeSchool: SchoolRecord;
  activeClass: ClassRecord;
  schoolClasses: ClassRecord[];
  schoolStudents: StudentRecord[];
  classStudents: StudentRecord[];
  photos: PhotoRecord[];
  xlsxSheet: OriginSheetController;
  pasteSheet: OriginSheetController;
  studentSheet: OriginSheetController;
  onTriggerCsvUpload: () => void;
  onJumpToStudent: (classId: string, studentId: string) => void;
}> = React.memo(({
  searchQuery,
  onSearchChange,
  activeSchool,
  activeClass,
  schoolClasses,
  schoolStudents,
  classStudents,
  photos,
  xlsxSheet,
  pasteSheet,
  studentSheet,
  onTriggerCsvUpload,
  onJumpToStudent,
}) => (
  <div className="xl-class-toolbar">
    <div className="xl-class-search-quick">
      <AppleSearchField
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="No veya ad soyad ara…"
        ariaLabel="Öğrenci ara"
      />
      <QuickStudentCapsule activeClass={activeClass} onNotice={notifyStudio} />
      <CrossClassStudentSearch
        classes={schoolClasses}
        students={schoolStudents}
        activeClassId={activeClass.id}
        onSelectResult={onJumpToStudent}
      />
    </div>
    <ExcelClassActions
      activeSchool={activeSchool}
      activeClass={activeClass}
      classStudents={classStudents}
      photos={photos}
      xlsxSheet={xlsxSheet}
      pasteSheet={pasteSheet}
      studentSheet={studentSheet}
      onTriggerCsvUpload={onTriggerCsvUpload}
    />
  </div>
));
