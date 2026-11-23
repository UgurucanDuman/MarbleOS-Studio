import React, { useCallback, useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetFieldRow, SheetSection, SheetSwitch, SheetTextField } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import {
  useAddStudentsBatchMutation, useAssignPhotoMutation, useUpdatePhotoStudioMutation,
  useUpdateStudentMutation, useUploadPhotosMutation,
} from '../../../system/query/useStudioQueries';
import { getStudioDatabaseSnapshot } from '../../../system/sqlite/studioDatabase';
import { studentInputSchema, updateStudentSchema } from '../../../system/schemas/studioSchemas';
import type {
  ClassRecord, PhotoAdjustments, PhotoRecord, StudentIdCardDetails, StudentRecord,
} from '../../../system/sqlite/types';
import { arePhotoAdjustmentsEqual, DEFAULT_PHOTO_ADJUSTMENTS, normalizePhotoAdjustments } from '../../../system/storage/photoColorMath';
import { formErrorMessage, hasStudentRecordChanged, isTeacherClassName } from './formHelpers';
import { EMPTY_ID_CARD, StudentIdCardFields, toIdCardForm } from './StudentIdCardFields';
import { type PendingStudentPhoto, StudentPhotoSection } from './StudentPhotoSection';
import '../excel-student-sheet.css';

interface StudentFormState {
  openKey: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  role: string;
  isPrincipal: boolean;
  groupCode: string;
  showInAlbum: boolean;
  idCard: Required<StudentIdCardDetails>;
  pendingPhoto: PendingStudentPhoto | null;
  photoRemoved: boolean;
  adjustments: PhotoAdjustments;
  error: string | null;
  savedCount: number;
}

function createStudentFormState(
  openKey: string,
  student: StudentRecord | null,
  existingPhoto: PhotoRecord | undefined,
  isStaff: boolean,
  savedCount = 0,
): StudentFormState {
  if (student) {
    return {
      openKey,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      role: student.role ?? '',
      isPrincipal: Boolean(student.isPrincipal || student.role === 'MDR.'),
      groupCode: student.groupCode ?? '',
      showInAlbum: student.showInAlbum !== false,
      idCard: toIdCardForm(student.idCard),
      pendingPhoto: null,
      photoRemoved: false,
      adjustments: existingPhoto
        ? { ...existingPhoto.adjustments, rotation: existingPhoto.adjustments.rotation ?? 0 }
        : { ...DEFAULT_PHOTO_ADJUSTMENTS },
      error: null,
      savedCount: 0,
    };
  }
  return {
    openKey,
    studentNumber: isStaff ? '0' : '',
    firstName: '',
    lastName: '',
    role: '',
    isPrincipal: false,
    groupCode: '',
    showInAlbum: true,
    idCard: EMPTY_ID_CARD,
    pendingPhoto: null,
    photoRemoved: false,
    adjustments: { ...DEFAULT_PHOTO_ADJUSTMENTS },
    error: null,
    savedCount,
  };
}

/**
 * Tek öğrenci/öğretmen ekleme ve düzenleme kartı.
 * Açılış karesinde 12 ayrı state tetiklemek yerine tek atomik form durumu kullanır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const StudentSheet = React.memo(function StudentSheet({
  controller,
  activeClass,
  student = null,
  existingPhoto,
}: {
  controller: OriginSheetController;
  activeClass: ClassRecord | undefined;
  student?: StudentRecord | null;
  existingPhoto?: PhotoRecord;
}) {
  const addMut = useAddStudentsBatchMutation();
  const updateMut = useUpdateStudentMutation();
  const uploadPhotosMut = useUploadPhotosMutation();
  const assignPhotoMut = useAssignPhotoMutation();
  const updatePhotoStudioMut = useUpdatePhotoStudioMutation();

  const isStaff = isTeacherClassName(activeClass?.name);
  const openKey = controller.isOpen
    ? `${student?.id ?? 'new'}::${existingPhoto?.id ?? 'none'}::${isStaff ? 'staff' : 'stu'}`
    : '';

  const [form, setForm] = useState<StudentFormState>(() =>
    createStudentFormState('', null, undefined, isStaff),
  );

  if (openKey && openKey !== form.openKey) {
    setForm(createStudentFormState(openKey, student, existingPhoto, isStaff));
  } else if (!openKey && form.openKey) {
    setForm((prev) => ({ ...prev, openKey: '' }));
  }

  const patchForm = useCallback((patch: Partial<StudentFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleIdCardChange = useCallback(
    <K extends keyof StudentIdCardDetails>(key: K, val: string) => {
      setForm((prev) => ({ ...prev, idCard: { ...prev.idCard, [key]: val } }));
    },
    [],
  );

  const setError = useCallback((error: string | null) => patchForm({ error }), [patchForm]);
  const setAdjustments = useCallback((adjustments: PhotoAdjustments) => patchForm({ adjustments }), [patchForm]);

  const applyPhotoChanges = async (targetClassId: string, targetStudentId: string) => {
    if (form.pendingPhoto) {
      await uploadPhotosMut.mutateAsync({
        files: [form.pendingPhoto],
        classId: targetClassId,
        targetStudentId,
      });
      if (!arePhotoAdjustmentsEqual(form.adjustments, DEFAULT_PHOTO_ADJUSTMENTS)) {
        const createdStu = getStudioDatabaseSnapshot().students.find((s) => s.id === targetStudentId);
        if (createdStu?.matchedPhotoId) {
          await updatePhotoStudioMut.mutateAsync({
            photoId: createdStu.matchedPhotoId,
            adjustments: normalizePhotoAdjustments(form.adjustments),
            approvedForPrint: false,
          });
        }
      }
      return;
    }
    if (form.photoRemoved && existingPhoto) {
      await assignPhotoMut.mutateAsync({ photoId: existingPhoto.id, studentId: null });
      return;
    }
    if (existingPhoto && !arePhotoAdjustmentsEqual(form.adjustments, existingPhoto.adjustments)) {
      await updatePhotoStudioMut.mutateAsync({
        photoId: existingPhoto.id,
        adjustments: normalizePhotoAdjustments(form.adjustments),
        approvedForPrint: false,
      });
    }
  };

  const save = async (keepOpen: boolean) => {
    if (!activeClass && !student) return;
    setError(null);
    try {
      const payload = {
        studentNumber: isStaff ? (student?.studentNumber || '0') : form.studentNumber,
        firstName: form.firstName,
        lastName: form.lastName,
        role: isStaff ? form.role : '',
        isPrincipal: isStaff ? form.isPrincipal : false,
        groupCode: isStaff ? '' : form.groupCode,
        showInAlbum: form.showInAlbum,
        idCard: form.idCard,
      };
      if (student) {
        const parsed = updateStudentSchema.safeParse({ id: student.id, ...payload });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Kayıt bilgileri geçersiz.');
          return;
        }
        const stuChanged = hasStudentRecordChanged(student, parsed.data);
        const photoChanged =
          Boolean(form.pendingPhoto) ||
          (form.photoRemoved && Boolean(existingPhoto)) ||
          Boolean(existingPhoto && !arePhotoAdjustmentsEqual(form.adjustments, existingPhoto.adjustments));
        if (!stuChanged && !photoChanged) {
          controller.close();
          return;
        }
        if (stuChanged) await updateMut.mutateAsync(parsed.data);
        if (photoChanged) await applyPhotoChanges(student.classId, student.id);
        notifyStudio(`${parsed.data.firstName} ${parsed.data.lastName} kaydı güncellendi.`, 'success');
        controller.close();
        return;
      }

      if (!activeClass) return;
      const parsed = studentInputSchema.safeParse(payload);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Kayıt bilgileri geçersiz.');
        return;
      }
      await addMut.mutateAsync({ classId: activeClass.id, rows: [parsed.data] });
      if (form.pendingPhoto) {
        const classRows = getStudioDatabaseSnapshot().students.filter((s) => s.classId === activeClass.id);
        const addedStudent = classRows[classRows.length - 1];
        if (addedStudent) await applyPhotoChanges(activeClass.id, addedStudent.id);
      }
      notifyStudio(`${parsed.data.firstName} ${parsed.data.lastName} listeye eklendi.`, 'success');
      if (!keepOpen) {
        controller.close();
        return;
      }
      setForm((prev) => createStudentFormState(prev.openKey, null, undefined, isStaff, prev.savedCount + 1));
      document.querySelector<HTMLElement>('.os-sheet-panel [data-autofocus]')?.focus();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  const sheetTitle = student
    ? (isStaff ? 'Öğretmen Düzelt' : 'Öğrenci Düzelt')
    : (isStaff ? 'Yeni Öğretmen / İdareci' : 'Yeni Öğrenci');

  const description = student
    ? (isStaff
        ? `${student.firstName} ${student.lastName}${student.role ? ` · ${student.role}` : ''}`
        : `Okul No: ${student.studentNumber} · ${student.firstName} ${student.lastName}`)
    : activeClass
      ? `${activeClass.name} listesine eklenir${form.savedCount ? ` · bu oturumda ${form.savedCount} kayıt eklendi` : ''}`
      : undefined;

  const isBusy =
    addMut.isPending || updateMut.isPending || uploadPhotosMut.isPending ||
    assignPhotoMut.isPending || updatePhotoStudioMut.isPending;

  return (
    <OriginSheet
      controller={controller}
      title={sheetTitle}
      description={description}
      width={860}
      submitLabel={student ? 'Değişiklikleri Kaydet' : 'Kaydet'}
      secondaryAction={student ? undefined : { label: 'Kaydet ve Yeni', onClick: () => void save(true) }}
      busy={isBusy}
      error={form.error}
      onSubmit={() => void save(false)}
    >
      <div className="xl-stu-modal-split">
        <div className="xl-stu-form-col">
          <SheetSection title="Baskı ve Dizgi Tercihleri">
            <SheetSwitch
              label="Kimlik, Vesikalık ve Albüm Baskısına Dahil Et"
              description="Pasif bırakılan kayıtlar sınıf listesinde korunur; PVC kimlik kartı, vesikalık dizgi ve yıllık albüm çıktılarında yer almaz."
              checked={form.showInAlbum}
              onChange={(showInAlbum) => patchForm({ showInAlbum })}
            />
          </SheetSection>

          {isStaff ? (
            <SheetSection title="Öğretmen Bilgisi">
              <div className="xl-stu-teacher-top-row">
                <SheetTextField label="Ad" required autoFocus value={form.firstName} onChange={(firstName) => patchForm({ firstName })} maxLength={60} />
                <SheetTextField label="Soyad" required value={form.lastName} onChange={(lastName) => patchForm({ lastName })} maxLength={60} />
                <label className="xl-stu-principal-check">
                  <input
                    type="checkbox"
                    checked={form.isPrincipal}
                    onChange={(e) => {
                      const isPrincipal = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        isPrincipal,
                        role: isPrincipal && !prev.role.trim()
                          ? 'Okul Müdürü'
                          : !isPrincipal && (prev.role === 'MDR.' || prev.role === 'Okul Müdürü')
                            ? ''
                            : prev.role,
                      }));
                    }}
                  />
                  <span>Okul Müdürü</span>
                </label>
              </div>
              <SheetTextField
                label="Görevi"
                value={form.role}
                onChange={(role) => patchForm({ role })}
                maxLength={60}
                placeholder="Örn. Sınıf Öğretmeni, Matematik Öğretmeni, Müdür Yardımcısı"
              />
            </SheetSection>
          ) : (
            <SheetSection title="Öğrenci Bilgisi">
              <SheetFieldRow>
                <SheetTextField label="Okul numarası" required autoFocus value={form.studentNumber} onChange={(studentNumber) => patchForm({ studentNumber })} maxLength={15} />
                <SheetTextField label="Grup etiketi" value={form.groupCode} onChange={(groupCode) => patchForm({ groupCode })} maxLength={24} placeholder="İsteğe bağlı (Örn. A, 1, SAY)" />
              </SheetFieldRow>
              <SheetFieldRow>
                <SheetTextField label="Ad" required value={form.firstName} onChange={(firstName) => patchForm({ firstName })} maxLength={60} />
                <SheetTextField label="Soyad" required value={form.lastName} onChange={(lastName) => patchForm({ lastName })} maxLength={60} />
              </SheetFieldRow>
            </SheetSection>
          )}

          <StudentIdCardFields value={form.idCard} onChange={handleIdCardChange} />
        </div>

        <StudentPhotoSection
          isStaff={isStaff}
          existingPhoto={existingPhoto}
          pendingPhoto={form.pendingPhoto}
          photoRemoved={form.photoRemoved}
          adjustments={form.adjustments}
          onSelectPending={(pendingPhoto) => patchForm({ pendingPhoto, photoRemoved: false })}
          onRemovePhoto={() =>
            patchForm({
              pendingPhoto: null,
              photoRemoved: true,
              adjustments: { ...DEFAULT_PHOTO_ADJUSTMENTS },
            })
          }
          onChangeAdjustments={setAdjustments}
          onError={setError}
        />
      </div>
    </OriginSheet>
  );
});
