import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notifyStudio } from '../../system/desktop/studioToast';
import { useSelectSchoolMutation } from '../../system/query/useSchoolQueries';
import {
  useAssignPhotoMutation,
  useStudioSnapshotQuery,
  useUploadPhotosMutation,
} from '../../system/query/useStudioQueries';
import { sortClassRecords } from '../../system/sqlite/classOrder';
import { photoClassId } from '../../system/sqlite/classPhotoMatching';
import { photoImportNotice } from '../../system/storage/photoImport';
import { usePhotoImport } from '../../system/storage/usePhotoImport';
import { useProgressiveSlice } from '../../system/storage/useProgressiveSlice';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import { PhotoDarkroomInspector } from './PhotoDarkroomInspector';
import { PhotoManagementBar, type PhotoFilterMode } from './PhotoManagementBar';
import { PhotoPortraitGrid } from './PhotoPortraitGrid';
import { usePhotoStudioAdjustments } from './usePhotoStudioAdjustments';
import './photo-studio.css';

/**
 * İZOLE MODÜL 02: Fotoğraf Eşleştirme & Apple Pro Karanlık Oda
 * Sürgü ve tekerlek hareketleri yerel taslağı günceller;
 * asenkron veritabanı kaydı yalnızca hareket tamamlandığında yapılır ve snapshot eşitlenene dek yerel taslak korunur.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PhotoStudioWindow: React.FC<{
  classId: string;
  focusPhoto?: { photoId: string; seq: number } | null;
  onSelectClass: (classId: string) => void;
}> = React.memo(({ classId, focusPhoto = null, onSelectClass }) => {
  const { data: db } = useStudioSnapshotQuery();
  const uploadPhotosMut = useUploadPhotosMutation();
  const assignPhotoMut = useAssignPhotoMutation();
  const selectSchoolMut = useSelectSchoolMutation();

  const [selectedPhotoId, setSelectedPhotoId] = useState<string>(focusPhoto?.photoId ?? db.photos[0]?.id ?? '');
  const [checkedPhotoIds, setCheckedPhotoIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<PhotoFilterMode>('all');
  const [showGuide, setShowGuide] = useState(false);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [expandedStage, setExpandedStage] = useState(false);

  const { run: importPhotos, reading, progress } = usePhotoImport();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSchool = db.schools.find((s) => s.id === db.activeSchoolId) ?? db.schools[0] ?? null;
  const scopedClasses = useMemo(
    () => sortClassRecords(activeSchool ? db.classes.filter((c) => c.schoolId === activeSchool.id) : db.classes),
    [activeSchool, db.classes],
  );
  const scopedClassIds = useMemo(() => new Set(scopedClasses.map((c) => c.id)), [scopedClasses]);
  const scopedStudents = useMemo(() => (activeSchool ? db.students.filter((s) => scopedClassIds.has(s.classId)) : db.students), [activeSchool, db.students, scopedClassIds]);
  const studentsById = useMemo(() => new Map(db.students.map((student) => [student.id, student])), [db.students]);
  const scopedClassId = scopedClassIds.has(classId) ? classId : '';
  const selectedClass = scopedClasses.find((item) => item.id === scopedClassId);

  const scopedPhotos = useMemo(() => db.photos.filter((photo) => {
    const scope = photoClassId(photo, studentsById);
    return scopedClassId ? scope === scopedClassId : !scope || scopedClassIds.has(scope);
  }), [db.photos, studentsById, scopedClassId, scopedClassIds]);

  const { counts, matchedPhotosCount } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let unmatched = 0;
    for (const p of scopedPhotos) {
      if (p.approvedForPrint) approved += 1;
      else pending += 1;
      if (!p.studentId) unmatched += 1;
    }
    return { counts: { all: scopedPhotos.length, pending, approved, unmatched }, matchedPhotosCount: scopedPhotos.length - unmatched };
  }, [scopedPhotos]);

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    return scopedPhotos.filter((photo) => {
      if (filterMode === 'pending' && photo.approvedForPrint) return false;
      if (filterMode === 'approved' && !photo.approvedForPrint) return false;
      if (filterMode === 'unmatched' && photo.studentId) return false;
      if (!q) return true;
      const stu = photo.studentId ? studentsById.get(photo.studentId) : undefined;
      const hay = `${photo.fileName} ${stu?.studentNumber ?? ''} ${stu?.firstName ?? ''} ${stu?.lastName ?? ''}`
        .toLocaleLowerCase('tr-TR');
      return hay.includes(q);
    });
  }, [scopedPhotos, filterMode, searchQuery, studentsById]);

  const selectedPhoto = filteredPhotos.find((p) => p.id === selectedPhotoId)
    ?? scopedPhotos.find((p) => p.id === selectedPhotoId)
    ?? filteredPhotos[0]
    ?? scopedPhotos[0];
  const currentIndex = selectedPhoto ? filteredPhotos.findIndex((p) => p.id === selectedPhoto.id) : -1;
  const nextPhoto = currentIndex >= 0 && currentIndex + 1 < filteredPhotos.length ? filteredPhotos[currentIndex + 1] : undefined;
  const minGridCount = currentIndex >= 0 ? Math.ceil((currentIndex + 1) / 48) * 48 : 0;
  const selectedPhotoClassId = selectedPhoto ? photoClassId(selectedPhoto, studentsById) : undefined;
  const checkedIds = useMemo(
    () => filteredPhotos.filter((photo) => checkedPhotoIds.has(photo.id)).map((photo) => photo.id),
    [filteredPhotos, checkedPhotoIds],
  );

  const { visibleItems: visiblePhotos, hasMore: hasMorePhotos, handleScroll: onGridScroll, sentinelRef } =
    useProgressiveSlice(filteredPhotos, `${activeSchool?.id ?? ''}:${scopedClassId}:${filterMode}:${searchQuery}`, 48, minGridCount);

  useEffect(() => { setCheckedPhotoIds(new Set()); }, [scopedClassId, activeSchool?.id]);

  const {
    activeAdjustments,
    isSelectedApproved,
    batchBusy,
    flushDraftAdjustments,
    clearDraftAdjustments,
    patchAdjustments,
    togglePrintApproval,
    approveAndAdvance,
    handleApplyBatch,
    handleResetBatch,
  } = usePhotoStudioAdjustments({
    selectedPhoto,
    nextPhoto,
    filteredPhotos,
    checkedPhotoIds,
    onSelectPhotoId: setSelectedPhotoId,
  });

  const togglePhotoCheck = useCallback((id: string, checked: boolean) => {
    setCheckedPhotoIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    e.target.value = '';
    try {
      const existingNames = scopedClassId
        ? new Set(scopedPhotos.map((p) => p.fileName.trim().toLocaleLowerCase('tr-TR')))
        : null;
      const freshFiles = existingNames
        ? filesArray.filter((f) => !existingNames.has((f.name.split(/[\\/]/).pop() || f.name).trim().toLocaleLowerCase('tr-TR')))
        : filesArray;
      if (freshFiles.length === 0) {
        throw new Error('Seçilen fotoğraflar bu şubede zaten yüklü; aynı dosyalar ikinci kez eklenmedi.');
      }
      const skipped = filesArray.length - freshFiles.length;
      const result = await importPhotos(freshFiles, false, false, (files) =>
        uploadPhotosMut.mutateAsync({ files, classId: scopedClassId || undefined }),
      );
      notifyStudio(skipped > 0 ? `${photoImportNotice(result)} (${skipped} mevcut fotoğraf korundu.)` : photoImportNotice(result), 'success');
    } catch (error) {
      notifyStudio(formErrorMessage(error), 'error');
    }
  };

  const handleSelectPhoto = useCallback((photoId: string) => {
    flushDraftAdjustments();
    clearDraftAdjustments();
    setSelectedPhotoId(photoId);
  }, [flushDraftAdjustments, clearDraftAdjustments]);

  const handleSelectSchool = useCallback((nextSchoolId: string) => {
    if (!nextSchoolId || nextSchoolId === activeSchool?.id) return;
    flushDraftAdjustments();
    clearDraftAdjustments();
    setCheckedPhotoIds(new Set());
    onSelectClass('');
    selectSchoolMut.mutate(nextSchoolId, {
      onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
    });
  }, [activeSchool?.id, clearDraftAdjustments, flushDraftAdjustments, onSelectClass, selectSchoolMut]);

  const lastFocusSeqRef = useRef<number | null>(focusPhoto?.seq ?? null);
  useEffect(() => {
    if (!focusPhoto || lastFocusSeqRef.current === focusPhoto.seq) return;
    lastFocusSeqRef.current = focusPhoto.seq;
    flushDraftAdjustments();
    clearDraftAdjustments();
    setFilterMode('all');
    setSearchQuery('');
    setSelectedPhotoId(focusPhoto.photoId);
  }, [focusPhoto, flushDraftAdjustments, clearDraftAdjustments]);

  const handleKeyNavigation = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === '\\') {
      e.preventDefault();
      setCompareOriginal((v) => !v);
    } else if (e.key === 'ArrowRight' && nextPhoto) {
      e.preventDefault();
      handleSelectPhoto(nextPhoto.id);
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault();
      handleSelectPhoto(filteredPhotos[currentIndex - 1].id);
    }
  };

  const assignableStudents = useMemo(
    () => (selectedPhoto
      ? scopedStudents.filter((stu) =>
          (!selectedPhotoClassId || stu.classId === selectedPhotoClassId) &&
          (!stu.matchedPhotoId || stu.matchedPhotoId === selectedPhoto.id))
      : []),
    [scopedStudents, selectedPhotoClassId, selectedPhoto],
  );

  return (
    <div className="mod-pane ps-studio-pane" onKeyDown={handleKeyNavigation}>
      <div className="mod-header">
        <div>
          <span className="mod-eyebrow">STÜDYO KARANLIK ODA · BİYOMETRİK &amp; PORTRE MASASI</span>
          <h3>Fotoğraf Eşleştirme, Kadraj ve Işık Kalibrasyonu</h3>
        </div>
        <div className="mod-btn-row">
          {db.schools.length > 0 && (
            <AppleSelect
              ariaLabel="Fotoğraf stüdyo okulu" inline value={activeSchool?.id ?? ''} onChange={handleSelectSchool}
              options={db.schools.map((school) => ({ value: school.id, label: school.name, iconHint: 'Okul' }))}
            />
          )}
          <AppleSelect
            ariaLabel="Fotoğraf stüdyo sınıfı" inline value={scopedClassId} onChange={onSelectClass}
            options={[
              { value: '', label: 'Tüm sınıflar · aktarımda elle eşleştir', iconHint: 'Klasör' },
              ...scopedClasses.map((item) => ({ value: item.id, label: `${item.name} · ${item.academicYear}`, iconHint: 'Şube' })),
            ]}
          />
          <input
            ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            multiple style={{ display: 'none' }} onChange={handleUploadFiles}
          />
          <button
            type="button" className="mod-action-btn"
            disabled={reading || uploadPhotosMut.isPending} onClick={() => fileInputRef.current?.click()}
          >
            + Stüdyo Fotoğrafı Aktar
          </button>
        </div>
      </div>

      <PhotoManagementBar
        db={db} selectedClass={selectedClass} checkedIds={checkedIds}
        visibleCount={filteredPhotos.length} matchedCount={matchedPhotosCount} counts={counts}
        searchQuery={searchQuery} filterMode={filterMode}
        onSearchChange={setSearchQuery} onFilterChange={setFilterMode}
        disabled={reading || uploadPhotosMut.isPending}
        onToggleAll={() =>
          setCheckedPhotoIds(checkedIds.length === filteredPhotos.length
            ? new Set() : new Set(filteredPhotos.map((photo) => photo.id)))}
        onDeleted={() => setCheckedPhotoIds(new Set())}
        onNotice={(msg, tone = 'success') => notifyStudio(msg, tone)}
      />
      {progress && <p className="ps-import-progress">{progress}</p>}

      <div className={`mod-studio-layout ${expandedStage ? 'is-expanded' : ''}`.trim()}>
        <PhotoPortraitGrid
          visiblePhotos={visiblePhotos} totalScopedCount={scopedPhotos.length}
          hasMore={hasMorePhotos} selectedPhotoId={selectedPhoto?.id}
          checkedPhotoIds={checkedPhotoIds} studentsById={studentsById}
          sentinelRef={sentinelRef} onScroll={onGridScroll}
          onSelectPhoto={handleSelectPhoto} onToggleCheck={togglePhotoCheck}
        />

        {selectedPhoto && activeAdjustments && (
          <PhotoDarkroomInspector
            photo={selectedPhoto} adjustments={activeAdjustments}
            matchedStudent={selectedPhoto.studentId ? studentsById.get(selectedPhoto.studentId) : undefined}
            scopedClasses={scopedClasses} assignableStudents={assignableStudents}
            isApproved={isSelectedApproved} showGuide={showGuide} compareOriginal={compareOriginal}
            expandedStage={expandedStage} checkedCount={checkedIds.length} scopeCount={filteredPhotos.length}
            batchBusy={batchBusy} canAdvanceNext={Boolean(nextPhoto)}
            onToggleGuide={() => setShowGuide((v) => !v)}
            onToggleCompare={() => setCompareOriginal((v) => !v)}
            onToggleExpand={() => setExpandedStage((v) => !v)}
            onAssignStudent={(studentId) => assignPhotoMut.mutate(
              { photoId: selectedPhoto.id, studentId },
              { onError: (err) => notifyStudio(formErrorMessage(err), 'error') },
            )}
            onPatchAdjustments={patchAdjustments} onFlushAdjustments={flushDraftAdjustments}
            onApplyBatch={(target, copyFraming) => void handleApplyBatch(target, copyFraming)}
            onResetBatch={(target) => void handleResetBatch(target)}
            onToggleApproval={togglePrintApproval} onApproveAndNext={approveAndAdvance}
          />
        )}
      </div>
    </div>
  );
});
