import { useEffect, useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import {
  useDeleteClassMutation,
  useDeleteStudentMutation,
} from '../../../system/query/useStudioQueries';
import type { ClassRecord, StudentRecord } from '../../../system/sqlite/types';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { formErrorMessage } from './formHelpers';

/** Seçili şubeyi silmeden önce kayıt sayısını gösteren Okul Sil kartıyla uyumlu onay kartı. */
export function DeleteClassSheet({
  controller,
  schoolName,
  classRecord,
  studentCount,
}: {
  controller: OriginSheetController;
  schoolName: string;
  classRecord: ClassRecord | null;
  studentCount: number;
}) {
  const deleteMut = useDeleteClassMutation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (controller.isOpen) setError(null);
  }, [controller.isOpen]);

  const submit = async () => {
    if (!classRecord) return;
    setError(null);
    try {
      await deleteMut.mutateAsync(classRecord.id);
      notifyStudio(`${classRecord.name} şubesi silindi.`, 'info');
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Şubeyi Sil"
      description={
        classRecord
          ? `${schoolName} · ${classRecord.name} (${classRecord.academicYear})`
          : undefined
      }
      width={440}
      submitLabel="Şubeyi Kalıcı Olarak Sil"
      busy={deleteMut.isPending}
      error={error}
      onSubmit={submit}
    >
      {classRecord && (
        <p className="xl-delete-warn">
          <strong>{classRecord.name}</strong> şubesi ile birlikte şubeye bağlı{' '}
          <strong>{studentCount} kayıt</strong> listeden kalıcı olarak silinecek. Eşleşen
          fotoğraflar silinmez, stüdyo havuzunda korunur.
        </p>
      )}
    </OriginSheet>
  );
}

/** Öğrenci veya kadro kaydını silmeden önce kişi bilgisini gösteren Apple onay kartı. */
export function DeleteStudentSheet({
  controller,
  className,
  isStaff = false,
  student,
}: {
  controller: OriginSheetController;
  className: string;
  isStaff?: boolean;
  student: StudentRecord | null;
}) {
  const deleteMut = useDeleteStudentMutation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (controller.isOpen) setError(null);
  }, [controller.isOpen]);

  const submit = async () => {
    if (!student) return;
    setError(null);
    try {
      await deleteMut.mutateAsync(student.id);
      notifyStudio(`${student.firstName} ${student.lastName} kaydı silindi.`, 'info');
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title={isStaff ? 'Kadro Kaydını Sil' : 'Öğrenciyi Sil'}
      description={
        student ? `${className} · ${student.firstName} ${student.lastName}` : undefined
      }
      width={420}
      submitLabel="Kaydı Kalıcı Olarak Sil"
      busy={deleteMut.isPending}
      error={error}
      onSubmit={submit}
    >
      {student && (
        <p className="xl-delete-warn">
          <strong>
            {student.firstName} {student.lastName}
          </strong>{' '}
          {!isStaff && student.studentNumber ? `(Okul No: ${student.studentNumber}) ` : ''}
          kaydı şube listesinden kalıcı olarak silinecek. Eşleşen fotoğraf havuzda
          korunur.
        </p>
      )}
    </OriginSheet>
  );
}

