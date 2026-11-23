import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAssignPhotoMutation, useDeleteStudentMutation, useShiftStudentPhotoMutation,
} from '../../../system/query/useStudioQueries';
import type { PhotoMatchMode } from '../../../system/schemas/studioSchemas';
import type { ClassRecord, PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import { StudioPhotoImage } from '../../../system/storage/StudioPhotoImage';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { TableInfiniteFooter } from '../TableActionIcons';
import { TableHeaderLabel } from '../TableHeaderIcons';
import { TableSkeletonBoxes } from '../TableSkeletonBoxes';
import { useInfiniteTableSlice } from '../useInfiniteTableSlice';
import { formErrorMessage, isTeacherClassName } from './formHelpers';
import { PhotoFolderConfirmCard } from './PhotoFolderConfirmCard';
import { PhotoMatcherSidebar } from './PhotoMatcherSidebar';
import { usePhotoMatcherImport } from './usePhotoMatcherImport';
import '../excel-photo-matcher.css';

const NO_STUDENTS: readonly StudentRecord[] = [];

export const PhotoMatcherSheet: React.FC<{
  controller: OriginSheetController;
  studentSheet: OriginSheetController;
  activeClass: ClassRecord;
  students: StudentRecord[];
  photos: PhotoRecord[];
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string) => void;
  onNotice: (msg: string | null) => void;
}> = ({
  controller,
  studentSheet,
  activeClass,
  students,
  photos,
  selectedStudentId = null,
  onSelectStudent,
  onNotice,
}) => {
  const shiftPhotoMut = useShiftStudentPhotoMutation();
  const assignPhotoMut = useAssignPhotoMutation();
  const deleteStudentMut = useDeleteStudentMutation();

  const [selectedId, setSelectedId] = useState<string | null>(selectedStudentId);
  const [confirmDeleteStuId, setConfirmDeleteStuId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<PhotoMatchMode>('sequence');
  const [showPreview, setShowPreview] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const batchFilesRef = useRef<HTMLInputElement | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const singleFileRef = useRef<HTMLInputElement | null>(null);
  const isRendered = controller.phase !== 'closed';

  const effectiveSelectedId = selectedId ?? selectedStudentId;
  const selectedIndex = useMemo(
    () => (isRendered && effectiveSelectedId ? students.findIndex((s) => s.id === effectiveSelectedId) : -1),
    [isRendered, students, effectiveSelectedId],
  );
  const minSliceCount = selectedIndex >= 0 ? Math.ceil((selectedIndex + 1) / 20) * 20 : 0;

  const { visibleItems, visibleCount, totalCount, hasMore, isSliceLoading, loadMore, handleScroll } =
    useInfiniteTableSlice(isRendered ? students : NO_STUDENTS, activeClass.id, 20, undefined, minSliceCount);

  const isStaff = isTeacherClassName(activeClass.name);
  const photoMap = useMemo(() => (isRendered ? new Map(photos.map((p) => [p.id, p])) : null), [isRendered, photos]);
  const activeStudent = isRendered ? (students.find((s) => s.id === effectiveSelectedId) ?? students[0] ?? null) : null;
  const activePhoto = activeStudent?.matchedPhotoId ? (photoMap?.get(activeStudent.matchedPhotoId) ?? null) : null;
  const matchedCount = useMemo(
    () => (isRendered ? students.filter((s) => Boolean(s.matchedPhotoId)).length : 0),
    [isRendered, students],
  );

  const importer = usePhotoMatcherImport({
    activeClass,
    students,
    photos,
    matchMode,
    activeStudent,
    onNotice,
    onError: setLocalError,
    onFallbackFolderInput: () => folderRef.current?.click(),
  });

  useEffect(() => {
    if (controller.isOpen) setSelectedId(selectedStudentId);
    else importer.clearPendingFolder();
  }, [selectedStudentId, controller.isOpen]);

  useEffect(() => {
    if (!controller.isOpen || !effectiveSelectedId || !tableWrapRef.current) return;
    const row = tableWrapRef.current.querySelector<HTMLElement>(`tr[data-student-id="${effectiveSelectedId}"]`);
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [controller.isOpen, effectiveSelectedId]);

  const runShift = (direction: 'up' | 'down' | 'insert-gap-down' | 'delete-shift-up') => {
    if (!activeStudent) return;
    setLocalError(null);
    shiftPhotoMut.mutate(
      { studentId: activeStudent.id, direction },
      { onError: (err) => setLocalError(formErrorMessage(err)) },
    );
  };

  if (!photoMap) return null;

  return (
    <OriginSheet
      controller={controller}
      title={`Resim Eşleştirme · ${activeClass.name}`}
      description={`Eşleşen: ${matchedCount} / ${students.length}`}
      width={1040}
      submitLabel="Kapat"
      showCancel={false}
      busy={importer.busy}
      error={localError}
      onSubmit={() => controller.close()}
    >
      {importer.pendingFolder && (
        <PhotoFolderConfirmCard
          pending={importer.pendingFolder}
          matchMode={matchMode}
          busy={importer.importing}
          onConfirm={() => void importer.handleConfirmPendingFolder()}
          onCancel={importer.clearPendingFolder}
        />
      )}
      {importer.progress && <p className="xl-matcher-progress">{importer.progress}</p>}
      <input
        ref={batchFilesRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => void importer.handleBatchSelect(e)}
      />
      <input
        ref={(input) => { folderRef.current = input; input?.setAttribute('webkitdirectory', ''); }}
        type="file" hidden multiple
        onChange={(e) => void importer.handleBatchSelect(e, true)}
      />
      <input
        ref={singleFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={(e) => void importer.handleSingleSelect(e)}
      />

      <div className="xl-matcher-grid">
        <div className="xl-matcher-main">
          <div ref={tableWrapRef} className="mod-table-wrap xl-matcher-table-wrap" onScroll={handleScroll}>
            {(importer.importing || isSliceLoading) && <TableSkeletonBoxes variant="compact" rows={20} overlay />}
            <table className={isStaff ? 'mod-table is-staff-table' : 'mod-table'}>
              <thead>
                <tr>
                  <th className="xl-th-sn"><TableHeaderLabel icon="order" label="Sıra" align="center" /></th>
                  <th className="xl-th-no"><TableHeaderLabel icon={isStaff ? 'institution' : 'code'} label={isStaff ? 'Görevi' : 'No'} /></th>
                  <th className="xl-th-name"><TableHeaderLabel icon="person" label="Ad" /></th>
                  <th className="xl-th-surname"><TableHeaderLabel icon="surname" label="Soyad" /></th>
                  <th className="xl-th-photo"><TableHeaderLabel icon="camera" label="Resim" align="center" /></th>
                  <th className="xl-th-file"><TableHeaderLabel icon="institution" label="Resim Dosyası" /></th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="xl-muted">
                      Bu şubede henüz kayıt yok. Alttaki ekle butonu ile ekleyebilirsiniz.
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((stu, idx) => {
                    const photo = stu.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) : null;
                    const isSelected = activeStudent?.id === stu.id;
                    return (
                      <tr
                        key={stu.id}
                        data-student-id={stu.id}
                        className={isSelected ? 'is-selected-row' : ''}
                        onClick={() => {
                          setSelectedId(stu.id);
                          onSelectStudent?.(stu.id);
                        }}
                      >
                        <td className="xl-td-sn">{idx + 1}</td>
                        <td className="xl-td-wrap">
                          {isStaff ? (
                            <span className="xl-role-tag">{stu.isPrincipal ? 'Okul Müdürü' : (stu.role || 'Öğretmen')}</span>
                          ) : (
                            <span className="mod-mono-badge">{stu.studentNumber}</span>
                          )}
                        </td>
                        <td className="xl-td-wrap"><strong>{stu.firstName}</strong></td>
                        <td className="xl-td-wrap"><strong>{stu.lastName}</strong></td>
                        <td className="xl-td-photo">
                          <div className={`mod-student-cell xl-matcher-row-thumb ${showPreview ? 'is-shown' : 'is-hidden'}`}>
                            {photo ? (
                              <StudioPhotoImage photo={photo} alt="" className="mod-mini-thumb" loading="lazy" decoding="async" />
                            ) : (
                              <span className="xl-file-missing">—</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {photo ? (
                            <span className="xl-file-badge">
                              <SheetAutoIcon text="Fotoğraf" size={12} />
                              {photo.fileName}
                            </span>
                          ) : (
                            <span className="xl-file-missing">Atanmadı</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <TableInfiniteFooter visibleCount={visibleCount} totalCount={totalCount} hasMore={hasMore} onLoadMore={loadMore} />
          )}

          <div className="xl-matcher-bottom-bar">
            <button
              type="button"
              className="xl-btn"
              onClick={(e) => {
                controller.close();
                studentSheet.trigger('matcher-stu').onClick(e);
              }}
            >
              <SheetAutoIcon text="Yeni Öğrenci" size={13} />
              {isStaff ? 'Yeni Öğretmen Ekle' : 'Yeni Öğrenci Ekle'}
            </button>
            <button
              type="button"
              className="xl-btn xl-btn-danger"
              disabled={!activeStudent}
              onBlur={() => setConfirmDeleteStuId(null)}
              onClick={() => {
                if (!activeStudent) return;
                if (confirmDeleteStuId !== activeStudent.id) { setConfirmDeleteStuId(activeStudent.id); return; }
                setConfirmDeleteStuId(null);
                deleteStudentMut.mutate(activeStudent.id, { onError: (err) => setLocalError(formErrorMessage(err)) });
              }}
            >
              <SheetAutoIcon text="Sil" size={13} />
              {activeStudent && confirmDeleteStuId === activeStudent.id ? 'Kayıt Silinsin mi?' : 'Kaydı Sil'}
            </button>
            <button type="button" className="xl-btn" disabled={!activeStudent} onClick={() => runShift('up')}>
              <SheetAutoIcon text="Yukarı" size={13} />
              Resmi Yukarı Taşı
            </button>
            <button type="button" className="xl-btn" disabled={!activeStudent} onClick={() => runShift('down')}>
              <SheetAutoIcon text="Aşağı" size={13} />
              Resmi Aşağı Taşı
            </button>
          </div>
        </div>

        <PhotoMatcherSidebar
          matchMode={matchMode}
          busy={importer.busy}
          activeStudent={activeStudent}
          activePhoto={activePhoto}
          showPreview={showPreview}
          onChangeMatchMode={setMatchMode}
          onPickFolder={() => void importer.handlePickFolderClick()}
          onPickBatchFiles={() => batchFilesRef.current?.click()}
          onPickSingleFile={() => singleFileRef.current?.click()}
          onShift={(dir) => runShift(dir)}
          onUnassignActivePhoto={() => {
            if (activePhoto) assignPhotoMut.mutate({ photoId: activePhoto.id, studentId: null });
          }}
          onTogglePreview={() => setShowPreview((v) => !v)}
        />
      </div>
    </OriginSheet>
  );
};
