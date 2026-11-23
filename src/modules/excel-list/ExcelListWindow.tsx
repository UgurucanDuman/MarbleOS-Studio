import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  useImportClassRosterMutation, useDeleteStudentsBatchMutation,
  useSortClassStudentsMutation, useStudioSnapshotQuery, useUpdateStudentMutation,
} from '../../system/query/useStudioQueries';
import { useSelectSchoolMutation } from '../../system/query/useSchoolQueries';
import { notifyStudio } from '../../system/desktop/studioToast';
import { sortClassRecords } from '../../system/sqlite/classOrder';
import { rosterImportNotice } from '../../system/sqlite/rosterImportActions';
import type { ClassRecord, StudentRecord } from '../../system/sqlite/types';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import { AppleClassRibbon } from './AppleClassRibbon';
import { EmptyClassState, EmptySchoolState } from './ExcelEmptyStates';
import { ExcelClassToolbar } from './ExcelClassActions';
import { ExcelListModals } from './ExcelListModals';
import { parseExcelOrCsvText } from './excelParser';
import { ExcelStudentTable } from './ExcelStudentTable';
import { SchoolsView } from './SchoolsView';
import { readValidatedTextListFile } from './spreadsheetShared';
import { getVisibleCheckedStudentIds, toggleVisibleStudentIds } from './studentSelection';
import { StudioInspectorPanel } from './StudioInspectorPanel';
import { currentAcademicYear, formErrorMessage, isTeacherClassName } from './sheets/formHelpers';
import { AppleGlassSegment, AppleSchoolPicker } from './TableActionIcons';
import { useClassFocus } from './useClassFocus';
import { useExcelListSheets } from './useExcelListSheets';
import { useExcelWorkspaceView, type WorkspaceView } from './useExcelWorkspaceView';
import './excel-list.css';
import './apple-controls.css';
import './excel-schools.css';
import './excel-visuals.css';
import './excel-studio.css';
import './excel-inspector.css';

/**
 * İZOLE MODÜL 01: Okul & Sınıf Listesi
 * Tek pencerede hem Apple Pro Sınıf/Kadro Masası hem de tam Okullar ve Görseller yönetimi.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const ExcelListWindow: React.FC<{ onEditPhotos?: (classId: string, photoId?: string) => void }> = React.memo(({ onEditPhotos }) => {
  const { data: db } = useStudioSnapshotQuery();
  const { mutate: mutateSelectSchool } = useSelectSchoolMutation();
  const addStudentsMut = useImportClassRosterMutation();
  const deleteStudentsBatchMut = useDeleteStudentsBatchMutation();
  const updateStudentMut = useUpdateStudentMutation();
  const sortStudentsMut = useSortClassStudentsMutation();

  const sheets = useExcelListSheets();
  const {
    newSchoolSheet, editSchoolSheet, schoolPasteSheet, schoolXlsxSheet, schoolRosterXlsxSheet,
    classSheet, editClassSheet, deleteClassSheet, studentSheet, editStudentSheet, deleteStudentSheet,
    pasteSheet, xlsxSheet, photoMatcherSheet, portraitPreviewSheet,
  } = sheets;

  const {
    requestedView, view, viewDir, switchView, setPendingOpenSchoolId,
  } = useExcelWorkspaceView(db.activeSchoolId);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedStudentIds, setCheckedStudentIds] = useState<string[]>([]);
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [rosterSchoolId, setRosterSchoolId] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSchool = db.schools.find((s) => s.id === db.activeSchoolId) ?? null;
  const editingSchool = db.schools.find((s) => s.id === editingSchoolId) ?? activeSchool;
  const rosterTargetSchool = db.schools.find((s) => s.id === rosterSchoolId) ?? activeSchool;
  const schoolClasses = useMemo(
    () => (activeSchool ? sortClassRecords(db.classes.filter((c) => c.schoolId === activeSchool.id)) : []),
    [activeSchool, db.classes],
  );
  const {
    requestedClass, activeClass, classDir, selectedStudentId, focusClass, selectStudent, resetFocus,
  } = useClassFocus(schoolClasses);
  const schoolClassIds = useMemo(() => new Set(schoolClasses.map((c) => c.id)), [schoolClasses]);
  const schoolStudents = useMemo(() => db.students.filter((s) => schoolClassIds.has(s.classId)), [db.students, schoolClassIds]);
  const readyCount = useMemo(() => schoolStudents.filter((s) => s.printReady).length, [schoolStudents]);
  const readyPercent = schoolStudents.length ? Math.round((readyCount / schoolStudents.length) * 100) : 0;
  const defaultYear = schoolClasses[schoolClasses.length - 1]?.academicYear ?? currentAcademicYear();

  const query = searchQuery.trim().toLocaleLowerCase('tr-TR');
  const activeClassStudents = useMemo(
    () => db.students.filter((s) => s.classId === activeClass?.id),
    [db.students, activeClass?.id],
  );
  const classStudents = useMemo(
    () => (query ? activeClassStudents.filter((s) =>
      s.studentNumber.toLocaleLowerCase('tr-TR').includes(query) ||
      `${s.firstName} ${s.lastName}`.toLocaleLowerCase('tr-TR').includes(query)) : activeClassStudents),
    [activeClassStudents, query],
  );
  const selectedStudent = classStudents.find((s) => s.id === selectedStudentId) ?? classStudents[0] ?? null;
  const photoMap = useMemo(() => new Map(db.photos.map((p) => [p.id, p])), [db.photos]);
  const selectedPhoto = selectedStudent?.matchedPhotoId ? photoMap.get(selectedStudent.matchedPhotoId) : undefined;
  const validCheckedStuIds = useMemo(
    () => getVisibleCheckedStudentIds(checkedStudentIds, classStudents),
    [checkedStudentIds, classStudents],
  );

  const toggleAllStudents = useCallback(() => {
    setCheckedStudentIds(toggleVisibleStudentIds(validCheckedStuIds, classStudents));
  }, [classStudents, validCheckedStuIds]);

  const toggleStudentCheck = useCallback((studentId: string) => {
    setCheckedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  }, []);

  const handleBulkDeleteStudents = useCallback(async () => {
    if (validCheckedStuIds.length === 0) return;
    try {
      await deleteStudentsBatchMut.mutateAsync(validCheckedStuIds);
      setCheckedStudentIds([]);
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  }, [validCheckedStuIds, deleteStudentsBatchMut]);

  const focusClassWithDirection = useCallback((id: string, nextStudentId: string | null = null, clearSearch = false) => {
    focusClass(id, nextStudentId);
    if (clearSearch) setSearchQuery('');
    setCheckedStudentIds([]);
  }, [focusClass]);

  const handleSelectClass = useCallback((id: string) => {
    focusClassWithDirection(id, null, false);
  }, [focusClassWithDirection]);

  const handleJumpToStudent = useCallback((classId: string, studentId: string) => {
    focusClassWithDirection(classId, studentId, true);
  }, [focusClassWithDirection]);

  const handleToggleShowInAlbum = useCallback((stu: StudentRecord) => {
    updateStudentMut.mutate({
      id: stu.id, studentNumber: stu.studentNumber, firstName: stu.firstName,
      lastName: stu.lastName, role: stu.role, isPrincipal: stu.isPrincipal,
      groupCode: stu.groupCode, idCard: stu.idCard, showInAlbum: stu.showInAlbum === false,
    });
  }, [updateStudentMut]);

  const handleSortClass = useCallback((by: 'number' | 'name') => {
    if (activeClass) sortStudentsMut.mutate({ classId: activeClass.id, by });
  }, [activeClass, sortStudentsMut]);

  const handleOpenEditStudent = useCallback(
    (stu: StudentRecord, triggerEl: HTMLElement) => {
      setEditingStudent(stu);
      editStudentSheet.openFrom(`stu-edit-${stu.id}`, triggerEl);
    },
    [editStudentSheet.openFrom],
  );

  const handleOpenDeleteStudent = useCallback(
    (stu: StudentRecord, triggerEl: HTMLElement) => {
      setDeletingStudent(stu);
      deleteStudentSheet.openFrom(`stu-del-${stu.id}`, triggerEl);
    },
    [deleteStudentSheet.openFrom],
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeClass) return;
    try {
      const text = await readValidatedTextListFile(file, 'Liste dosyası');
      const rows = parseExcelOrCsvText(text, { isStaff: isTeacherClassName(activeClass.name) });
      const res = await addStudentsMut.mutateAsync({ classId: activeClass.id, rows });
      notifyStudio(rosterImportNotice(res), 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  const selectSchool = useCallback((id: string, onCommitted?: () => void, onFailed?: () => void) => {
    if (!onCommitted) setPendingOpenSchoolId(null);
    mutateSelectSchool(id, {
      // Odak sıfırlaması commit sonrası yapılır: eski okulda ara bir şube geçişi tetiklenmez.
      onSuccess: () => {
        resetFocus();
        setCheckedStudentIds([]);
        onCommitted?.();
      },
      onError: (err) => {
        onFailed?.();
        notifyStudio(formErrorMessage(err), 'error');
      },
    });
  }, [mutateSelectSchool, resetFocus, setPendingOpenSchoolId]);

  const openSchoolClasses = (schoolId?: string) => {
    if (schoolId && schoolId !== db.activeSchoolId) {
      setPendingOpenSchoolId(schoolId);
      selectSchool(schoolId, () => switchView('classes'), () => setPendingOpenSchoolId(null));
    } else {
      switchView('classes');
    }
  };

  const editSchoolTrigger = editSchoolSheet.trigger('edit');

  return (
    <div className="xl-pane">
      {!activeSchool ? (
        <EmptySchoolState
          schools={db.schools}
          schoolXlsxSheet={schoolXlsxSheet}
          schoolPasteSheet={schoolPasteSheet}
          newSchoolSheet={newSchoolSheet}
          onSelectSchool={selectSchool}
        />
      ) : (
        <>
          <header className="xl-hero">
            <div className="xl-hero-title">
              <AppleSchoolPicker schools={db.schools} activeSchool={activeSchool} academicYear={activeClass?.academicYear} onSelect={selectSchool} />
            </div>
            <div className="xl-actions">
              <AppleGlassSegment
                ariaLabel="Çalışma görünümü"
                items={[{ id: 'schools', label: `Okullar (${db.schools.length})` }, { id: 'classes', label: `Sınıflar (${schoolClasses.length})` }]}
                activeId={requestedView} onChange={(id) => switchView(id as WorkspaceView)}
              />
              <button type="button" className="xl-btn" {...editSchoolTrigger} onClick={(e) => { setEditingSchoolId(activeSchool.id); editSchoolTrigger.onClick(e); }}>
                <SheetAutoIcon text="Okul Bilgisi Düzenle" />Okul Bilgisi Düzenle
              </button>
              <button type="button" className="xl-btn xl-btn-primary" {...newSchoolSheet.trigger('header')}>
                <SheetAutoIcon text="Yeni Okul" />Yeni Okul
              </button>
            </div>
          </header>

          <AppleCrossfadeSlot
            activeKey={view === 'schools' ? 'schools' : `classes::${activeSchool.id}`}
            direction={viewDir}
            variant="page"
            className="xl-workspace-pages"
            cellClassName="xl-view-stage"
          >
            {view === 'schools' ? (
              <SchoolsView
                db={db} editSchoolSheet={editSchoolSheet}
                schoolPasteSheet={schoolPasteSheet} schoolXlsxSheet={schoolXlsxSheet}
                schoolRosterXlsxSheet={schoolRosterXlsxSheet}
                onSelectSchool={selectSchool} onEditSchool={setEditingSchoolId}
                onPrepareSchoolRoster={setRosterSchoolId}
                onOpenClasses={openSchoolClasses}
              />
            ) : (
              <>
                <AppleClassRibbon
                  schoolId={activeSchool.id}
                  institutionCode={activeSchool.institutionCode}
                  defaultYear={defaultYear}
                  classes={schoolClasses}
                  students={schoolStudents}
                  readyCount={readyCount}
                  readyPercent={readyPercent}
                  activeClass={requestedClass}
                  editClassSheet={editClassSheet}
                  deleteClassSheet={deleteClassSheet}
                  schoolRosterSheet={schoolRosterXlsxSheet}
                  onPrepareSchoolRoster={() => setRosterSchoolId(activeSchool.id)}
                  onSelectClass={handleSelectClass}
                  onEditClass={setEditingClass}
                  onNotice={notifyStudio}
                />

                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={handleFileUpload} />

                {activeClass ? (
                  <div className="xl-class-stage">
                    <ExcelClassToolbar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      activeSchool={activeSchool}
                      activeClass={activeClass}
                      schoolClasses={schoolClasses}
                      schoolStudents={schoolStudents}
                      classStudents={classStudents}
                      photos={db.photos}
                      xlsxSheet={xlsxSheet}
                      pasteSheet={pasteSheet}
                      studentSheet={studentSheet}
                      onTriggerCsvUpload={() => fileInputRef.current?.click()}
                      onJumpToStudent={handleJumpToStudent}
                    />

                    <div className="xl-workspace-split">
                      <div className="xl-class-main">
                        <AppleCrossfadeSlot activeKey={activeClass.id} direction={classDir} variant="page">
                          <ExcelStudentTable
                            activeClass={activeClass} schoolClasses={schoolClasses} students={classStudents}
                            resetKey={`${activeClass.id}::${query}`} photos={db.photos} photoMap={photoMap}
                            checkedIds={validCheckedStuIds} selectedStudentId={selectedStudent?.id ?? null}
                            onToggleAll={toggleAllStudents}
                            onToggleCheck={toggleStudentCheck} onSelectStudent={selectStudent}
                            onToggleShowInAlbum={handleToggleShowInAlbum} onSort={handleSortClass}
                            onDeleteChecked={handleBulkDeleteStudents}
                            onEditStudent={handleOpenEditStudent}
                            onRequestDeleteStudent={handleOpenDeleteStudent}
                          />
                        </AppleCrossfadeSlot>
                      </div>

                      <StudioInspectorPanel
                        activeClass={activeClass} schoolClasses={schoolClasses} selectedStudent={selectedStudent}
                        selectedPhoto={selectedPhoto} checkedStudentIds={validCheckedStuIds}
                        photoMatcherSheet={photoMatcherSheet} portraitPreviewSheet={portraitPreviewSheet}
                        onEditPhotos={onEditPhotos} onNotice={notifyStudio}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyClassState
                    school={activeSchool}
                    schoolRosterXlsxSheet={schoolRosterXlsxSheet}
                    classSheet={classSheet}
                    onPrepareSchoolRoster={() => setRosterSchoolId(activeSchool.id)}
                  />
                )}
              </>
            )}
          </AppleCrossfadeSlot>
        </>
      )}

      <ExcelListModals
        {...sheets}
        activeSchool={activeSchool} editingSchool={editingSchool} rosterTargetSchool={rosterTargetSchool}
        defaultYear={defaultYear} activeClass={activeClass} editingClass={editingClass}
        editingStudent={editingStudent} deletingStudent={deletingStudent}
        selectedStudent={selectedStudent} selectedStudentId={selectedStudent?.id ?? null}
        activeClassStudents={activeClassStudents} photos={db.photos} photoMap={photoMap}
        onSelectCreatedClass={handleSelectClass} onSelectStudent={selectStudent}
        onEditPhotos={onEditPhotos}
      />
    </div>
  );
});
