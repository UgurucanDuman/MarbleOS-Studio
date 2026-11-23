import React from 'react';
import { notifyStudio } from '../../system/desktop/studioToast';
import type {
  ClassRecord,
  PhotoRecord,
  SchoolRecord,
  StudentRecord,
} from '../../system/sqlite/types';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import { ClassSheet } from './sheets/ClassSheet';
import { DeleteClassSheet, DeleteStudentSheet } from './sheets/DeleteEntitySheets';
import { isTeacherClassName } from './sheets/formHelpers';
import { PasteImportSheet } from './sheets/PasteImportSheet';
import { PhotoMatcherSheet } from './sheets/PhotoMatcherSheet';
import { PortraitPreviewSheet } from './sheets/PortraitPreviewSheet';
import { SchoolPasteImportSheet } from './sheets/SchoolPasteImportSheet';
import { SchoolRosterXlsxSheet } from './sheets/SchoolRosterXlsxSheet';
import { SchoolSheet } from './sheets/SchoolSheet';
import { SchoolXlsxImportSheet } from './sheets/SchoolXlsxImportSheet';
import { StudentSheet } from './sheets/StudentSheet';
import { XlsxImportSheet } from './sheets/XlsxImportSheet';

export interface ExcelListModalsProps {
  activeSchool: SchoolRecord | null;
  editingSchool: SchoolRecord | null;
  rosterTargetSchool: SchoolRecord | null;
  defaultYear: string;
  activeClass: ClassRecord | undefined;
  editingClass: ClassRecord | null;
  editingStudent: StudentRecord | null;
  deletingStudent: StudentRecord | null;
  selectedStudent: StudentRecord | null;
  selectedStudentId?: string | null;
  activeClassStudents: StudentRecord[];
  photos: PhotoRecord[];
  photoMap: ReadonlyMap<string, PhotoRecord>;
  newSchoolSheet: OriginSheetController;
  editSchoolSheet: OriginSheetController;
  schoolPasteSheet: OriginSheetController;
  schoolXlsxSheet: OriginSheetController;
  schoolRosterXlsxSheet: OriginSheetController;
  classSheet: OriginSheetController;
  editClassSheet: OriginSheetController;
  deleteClassSheet: OriginSheetController;
  studentSheet: OriginSheetController;
  editStudentSheet: OriginSheetController;
  deleteStudentSheet: OriginSheetController;
  pasteSheet: OriginSheetController;
  xlsxSheet: OriginSheetController;
  photoMatcherSheet: OriginSheetController;
  portraitPreviewSheet: OriginSheetController;
  onSelectCreatedClass: (classId: string) => void;
  onSelectStudent?: (studentId: string) => void;
  onEditPhotos?: (classId: string, photoId?: string) => void;
}

export const ExcelListModals: React.FC<ExcelListModalsProps> = React.memo(({
  activeSchool,
  editingSchool,
  rosterTargetSchool,
  defaultYear,
  activeClass,
  editingClass,
  editingStudent,
  deletingStudent,
  selectedStudent,
  selectedStudentId,
  activeClassStudents,
  photos,
  photoMap,
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
  onSelectCreatedClass,
  onSelectStudent,
  onEditPhotos,
}) => (
  <>
    {newSchoolSheet.phase !== 'closed' && (
      <SchoolSheet controller={newSchoolSheet} school={null} />
    )}
    {editSchoolSheet.phase !== 'closed' && (
      <SchoolSheet controller={editSchoolSheet} school={editingSchool} />
    )}
    {schoolPasteSheet.phase !== 'closed' && (
      <SchoolPasteImportSheet controller={schoolPasteSheet} />
    )}
    {schoolXlsxSheet.phase !== 'closed' && (
      <SchoolXlsxImportSheet controller={schoolXlsxSheet} />
    )}
    {schoolRosterXlsxSheet.phase !== 'closed' && (
      <SchoolRosterXlsxSheet
        controller={schoolRosterXlsxSheet}
        school={rosterTargetSchool}
        defaultYear={defaultYear}
        onImportedClass={onSelectCreatedClass}
      />
    )}
    {activeSchool && classSheet.phase !== 'closed' && (
      <ClassSheet
        controller={classSheet}
        schoolId={activeSchool.id}
        schoolName={activeSchool.name}
        defaultYear={defaultYear}
        onCreated={onSelectCreatedClass}
      />
    )}
    {activeSchool && editClassSheet.phase !== 'closed' && (
      <ClassSheet
        controller={editClassSheet}
        schoolId={activeSchool.id}
        schoolName={activeSchool.name}
        defaultYear={defaultYear}
        classRecord={editingClass ?? activeClass ?? null}
      />
    )}
    {activeSchool && deleteClassSheet.phase !== 'closed' && (
      <DeleteClassSheet
        controller={deleteClassSheet}
        schoolName={activeSchool.name}
        classRecord={activeClass ?? null}
        studentCount={activeClassStudents.length}
      />
    )}
    {studentSheet.phase !== 'closed' && (
      <StudentSheet controller={studentSheet} activeClass={activeClass} student={null} />
    )}
    {editStudentSheet.phase !== 'closed' && (
      <StudentSheet
        controller={editStudentSheet}
        activeClass={activeClass}
        student={editingStudent}
        existingPhoto={
          editingStudent?.matchedPhotoId
            ? photoMap.get(editingStudent.matchedPhotoId)
            : undefined
        }
      />
    )}
    {deleteStudentSheet.phase !== 'closed' && (
      <DeleteStudentSheet
        controller={deleteStudentSheet}
        className={activeClass?.name ?? ''}
        isStaff={isTeacherClassName(activeClass?.name ?? '')}
        student={deletingStudent}
      />
    )}
    {pasteSheet.phase !== 'closed' && (
      <PasteImportSheet controller={pasteSheet} activeClass={activeClass} />
    )}
    {xlsxSheet.phase !== 'closed' && (
      <XlsxImportSheet controller={xlsxSheet} activeClass={activeClass} />
    )}
    {activeClass && photoMatcherSheet.phase !== 'closed' && (
      <PhotoMatcherSheet
        key={activeClass.id}
        controller={photoMatcherSheet}
        studentSheet={studentSheet}
        activeClass={activeClass}
        students={activeClassStudents}
        photos={photos}
        selectedStudentId={selectedStudentId}
        onSelectStudent={onSelectStudent}
        onNotice={notifyStudio}
      />
    )}
    {portraitPreviewSheet.phase !== 'closed' && (
      <PortraitPreviewSheet
        controller={portraitPreviewSheet}
        activeClass={activeClass}
        student={selectedStudent}
        photo={
          selectedStudent?.matchedPhotoId
            ? photoMap.get(selectedStudent.matchedPhotoId)
            : undefined
        }
        onEditPhotos={onEditPhotos}
      />
    )}
  </>
));

