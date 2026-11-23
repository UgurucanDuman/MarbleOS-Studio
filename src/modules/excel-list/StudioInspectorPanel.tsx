import React, { useRef, useState } from 'react';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import {
  useAssignPhotoMutation,
  useBatchPatchClassStudentsMutation,
  useMoveStudentOrderMutation,
  useUpdateStudentMutation,
  useUploadPhotosMutation,
} from '../../system/query/useStudioQueries';
import { batchPatchClassStudentsSchema } from '../../system/schemas/studioSchemas';
import type { ClassRecord, PhotoRecord, StudentRecord } from '../../system/sqlite/types';
import { photoAdjustmentStyle, StudioPhotoImage } from '../../system/storage/StudioPhotoImage';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import { readPhotoFilesAsDataUrls } from '../../system/storage/photoImport';
import { StaffBranchAssignBox } from './StaffBranchAssignBox';
import { InspectorStaffRolePicker } from './InspectorStaffRolePicker';
import { formErrorMessage, isTeacherClassName } from './sheets/formHelpers';

export { QuickStudentCapsule } from './QuickStudentCapsule';

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Sağ Stüdyo Denetçisi (Apple macOS Pro Inspector — Sıfır Tekrar)
 * - Seçili kayıt portresi, tekli resim seç/kaldır, sıra taşıma ve 2x2 kadro unvan seçici
 * - Şube stüdyo araçları (Sınıf Fotoğraflarını Eşleştir, Fotoğrafları Düzenle, Albüm & Grup)
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const StudioInspectorPanel: React.FC<{
  activeClass: ClassRecord;
  schoolClasses: ClassRecord[];
  selectedStudent: StudentRecord | null;
  selectedPhoto?: PhotoRecord;
  checkedStudentIds: string[];
  photoMatcherSheet?: OriginSheetController;
  portraitPreviewSheet?: OriginSheetController;
  onEditPhotos?: (classId: string, photoId?: string) => void;
  onNotice: (msg: string | null) => void;
}> = React.memo(({
  activeClass,
  schoolClasses,
  selectedStudent,
  selectedPhoto,
  checkedStudentIds,
  photoMatcherSheet,
  portraitPreviewSheet,
  onEditPhotos,
  onNotice,
}) => {
  const moveOrderMut = useMoveStudentOrderMutation();
  const updateStuMut = useUpdateStudentMutation();
  const batchPatchMut = useBatchPatchClassStudentsMutation();
  const uploadPhotosMut = useUploadPhotosMutation();
  const assignPhotoMut = useAssignPhotoMutation();

  const [groupInput, setGroupInput] = useState('');
  const singlePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const isStaff = isTeacherClassName(activeClass.name);
  const portraitTrigger = selectedStudent
    ? portraitPreviewSheet?.trigger(`inspector-portrait-${selectedStudent.id}`)
    : undefined;

  const handleSetRole = async (roleValue: string) => {
    if (!selectedStudent || (selectedStudent.role ?? '') === roleValue) return;
    onNotice(null);
    try {
      await updateStuMut.mutateAsync({
        id: selectedStudent.id, studentNumber: selectedStudent.studentNumber,
        firstName: selectedStudent.firstName, lastName: selectedStudent.lastName,
        role: roleValue, isPrincipal: roleValue === 'MDR.',
        showInAlbum: selectedStudent.showInAlbum, groupCode: selectedStudent.groupCode,
        idCard: selectedStudent.idCard,
      });
      onNotice(`${selectedStudent.firstName} ${selectedStudent.lastName} görevi güncellendi.`);
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  const handleSinglePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedStudent) return;
    onNotice(null);
    try {
      const encoded = await readPhotoFilesAsDataUrls([file]);
      if (!encoded.length) return;
      await uploadPhotosMut.mutateAsync({
        files: encoded, classId: activeClass.id, targetStudentId: selectedStudent.id,
      });
      onNotice(`${selectedStudent.firstName} ${selectedStudent.lastName} fotoğrafı güncellendi.`);
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  const handleBatchShow = async (showInAlbum: boolean) => {
    onNotice(null);
    try {
      await batchPatchMut.mutateAsync({
        classId: activeClass.id,
        studentIds: checkedStudentIds.length ? checkedStudentIds : undefined,
        showInAlbum,
      });
      onNotice(showInAlbum ? 'Kayıtlar baskı ve albüme dahil edildi.' : 'Kayıtlar baskı ve albümden gizlendi.');
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  const handleAssignGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    onNotice(null);
    const nextGroup = groupInput.trim();
    if (!checkedStudentIds.length && selectedStudent && (selectedStudent.groupCode ?? '') === nextGroup) return;
    const targetIds = checkedStudentIds.length
      ? checkedStudentIds
      : selectedStudent
        ? [selectedStudent.id]
        : undefined;
    const parsed = batchPatchClassStudentsSchema.safeParse({
      classId: activeClass.id,
      studentIds: targetIds,
      groupCode: nextGroup,
    });
    if (!parsed.success) {
      onNotice(parsed.error.issues[0]?.message ?? 'Grup kodu geçersiz.');
      return;
    }
    try {
      await batchPatchMut.mutateAsync(parsed.data);
      setGroupInput('');
      onNotice(nextGroup ? `Grup "${nextGroup}" olarak güncellendi.` : 'Grup etiketi temizlendi.');
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  return (
    <aside className="xl-inspector" aria-label="Stüdyo Denetçisi">
      <input
        ref={singlePhotoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void handleSinglePhotoPick(e)}
      />

      <div className="xl-inspector-card">
        {selectedStudent ? (
          <>
            <AppleCrossfadeSlot activeKey={selectedStudent.id} variant="card">
              <div className="xl-inspector-selected">
              <button
                type="button"
                className={`xl-inspector-portrait ${selectedPhoto ? 'has-photo' : ''}`.trim()}
                {...(selectedPhoto && portraitTrigger
                  ? {
                      ...portraitTrigger,
                      'aria-label': `${selectedStudent.firstName} ${selectedStudent.lastName} portresini büyüt`,
                      title: 'Portreyi büyüt ve önizle',
                    }
                  : {
                      onClick: () => singlePhotoInputRef.current?.click(),
                      'aria-label': 'Portre seç',
                      title: 'Kişi fotoğrafı seç',
                    })}
              >
                {selectedPhoto ? (
                  <>
                    <StudioPhotoImage photo={selectedPhoto} alt="" style={photoAdjustmentStyle(selectedPhoto.adjustments)} />
                    <span className="xl-inspector-portrait-zoom" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M10.4 10.4L13.7 13.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <path d="M5.4 7h3.2M7 5.4v3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <>
                    <SheetAutoIcon text="Fotoğraf" size={26} />
                    <span>Portre Seç</span>
                  </>
                )}
              </button>
              <div className="xl-inspector-meta">
                <span className="xl-inspector-eyebrow">SEÇİLİ KAYIT</span>
                <strong title={`${selectedStudent.firstName} ${selectedStudent.lastName}`}>
                  {`${selectedStudent.firstName} ${selectedStudent.lastName}`.toLocaleUpperCase('tr-TR')}
                </strong>
                <span className="xl-inspector-no">
                  {isStaff
                    ? (selectedStudent.isPrincipal ? 'Okul Müdürü' : (selectedStudent.role || 'Öğretmen'))
                    : `Okul No: ${selectedStudent.studentNumber}`}
                </span>
                <div className={selectedPhoto ? 'xl-inspector-move-row' : 'xl-inspector-single-row'}>
                  <button
                    type="button"
                    className="xl-mini-btn"
                    onClick={() => singlePhotoInputRef.current?.click()}
                  >
                    <SheetAutoIcon text="Fotoğraf" size={14} />
                    {selectedPhoto ? 'Değiştir' : 'Resim Seç'}
                  </button>
                  {selectedPhoto && (
                    <button
                      type="button"
                      className="xl-mini-btn"
                      title="Bu kişiye bağlı fotoğrafı kaldır"
                      onClick={() => assignPhotoMut.mutate({ photoId: selectedPhoto.id, studentId: null })}
                    >
                      <SheetAutoIcon text="İptal" size={14} />
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
              </div>
            </AppleCrossfadeSlot>

            <div className="xl-inspector-dual">
              <button
                type="button"
                className="xl-mini-btn"
                onClick={() => moveOrderMut.mutate({ studentId: selectedStudent.id, direction: 'up' })}
              >
                <SheetAutoIcon text="Yukarı" size={14} />
                Yukarı Taşı
              </button>
              <button
                type="button"
                className="xl-mini-btn"
                onClick={() => moveOrderMut.mutate({ studentId: selectedStudent.id, direction: 'down' })}
              >
                <SheetAutoIcon text="Aşağı" size={14} />
                Aşağı Taşı
              </button>
            </div>

            {isStaff && (
              <InspectorStaffRolePicker role={selectedStudent.role ?? ''} onSelect={(id) => void handleSetRole(id)} />
            )}
          </>
        ) : (
          <div className="xl-inspector-empty">
            <SheetAutoIcon text="Öğrenci" size={18} />
            <span>Tablodan bir kayıt seçin</span>
          </div>
        )}
      </div>

      {isStaff && selectedStudent && (
        <StaffBranchAssignBox
          staffMember={selectedStudent}
          schoolClasses={schoolClasses}
          onNotice={onNotice}
        />
      )}

      <div className="xl-inspector-section">
        <span className="xl-inspector-title">
          <SheetAutoIcon text="Fotoğraf" size={14} />
          Fotoğraf &amp; Grup Görevleri
        </span>
        {photoMatcherSheet && (
          <button
            type="button"
            className="xl-btn xl-btn-primary xl-inspector-wide-btn"
            {...photoMatcherSheet.trigger('photo-matcher')}
          >
            <SheetAutoIcon text="Fotoğraf" size={15} />
            Sınıf Fotoğraflarını Eşleştir
          </button>
        )}
        {onEditPhotos && (
          <button
            type="button"
            className="xl-btn xl-inspector-wide-btn"
            onClick={() => onEditPhotos(activeClass.id, selectedStudent?.matchedPhotoId ?? undefined)}
          >
            <SheetAutoIcon text="Fotoğrafları Düzenle" size={15} />
            Fotoğrafları Düzenle
          </button>
        )}
        <div className="xl-inspector-dual">
          <button type="button" className="xl-mini-btn" onClick={() => void handleBatchShow(true)}>
            <SheetAutoIcon text="Kaydet" size={14} />
            Albüme Dahil Et
          </button>
          <button type="button" className="xl-mini-btn" onClick={() => void handleBatchShow(false)}>
            <SheetAutoIcon text="Gizle" size={14} />
            Albümden Gizle
          </button>
        </div>
        <form className="xl-inspector-group-form" onSubmit={handleAssignGroup}>
          <input
            type="text"
            className="xl-inspector-group-input"
            placeholder="Grup kodu (Örn: A)"
            maxLength={24}
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
          />
          <button type="submit" className="xl-inspector-group-submit">
            <SheetAutoIcon text="Grup" size={14} />
            Grup Ata
          </button>
        </form>
      </div>
    </aside>
  );
});
