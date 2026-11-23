import { useState } from 'react';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetFieldRow, SheetTextField } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import {
  useCreateClassMutation,
  useUpdateClassMutation,
} from '../../../system/query/useStudioQueries';
import {
  createClassSchema,
  updateClassSchema,
} from '../../../system/schemas/studioSchemas';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { ClassRecord } from '../../../system/sqlite/types';
import { formErrorMessage, hasClassRecordChanged } from './formHelpers';

/** Seçili okulda yeni şube açma veya mevcut şubeyi (rehber öğretmen / müdür yrd.) düzenleme. */
export function ClassSheet({
  controller,
  schoolId,
  schoolName,
  defaultYear,
  classRecord = null,
  onCreated,
}: {
  controller: OriginSheetController;
  schoolId: string;
  schoolName: string;
  defaultYear: string;
  classRecord?: ClassRecord | null;
  onCreated?: (classId: string) => void;
}) {
  const createMut = useCreateClassMutation();
  const updateMut = useUpdateClassMutation();
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [name, setName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [deputyPrincipalName, setDeputyPrincipalName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const openKey = controller.isOpen ? `${classRecord?.id ?? 'new'}::${defaultYear}` : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (classRecord) {
      setAcademicYear(classRecord.academicYear);
      setName(classRecord.name);
      setTeacherName(classRecord.teacherName);
      setDeputyPrincipalName(classRecord.deputyPrincipalName ?? '');
    } else {
      setAcademicYear(defaultYear);
      setName('');
      setTeacherName('');
      setDeputyPrincipalName('');
    }
    setError(null);
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const submit = async () => {
    setError(null);
    try {
      if (classRecord) {
        const parsed = updateClassSchema.safeParse({
          id: classRecord.id,
          name,
          teacherName,
          deputyPrincipalName,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Şube bilgileri geçersiz.');
          return;
        }
        if (!hasClassRecordChanged(classRecord, parsed.data)) {
          controller.close();
          return;
        }
        await updateMut.mutateAsync(parsed.data);
        notifyStudio(`${parsed.data.name} şube bilgileri güncellendi.`, 'success');
        controller.close();
        return;
      }

      const parsed = createClassSchema.safeParse({
        name,
        teacherName,
        deputyPrincipalName,
        schoolId,
        academicYear,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Şube bilgileri geçersiz.');
        return;
      }
      const id = await createMut.mutateAsync(parsed.data);
      notifyStudio(`${parsed.data.name} şubesi oluşturuldu.`, 'success');
      onCreated?.(id);
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title={classRecord ? 'Şube Bilgisi Düzenle' : 'Yeni Şube'}
      description={schoolName}
      width={460}
      submitLabel={classRecord ? 'Değişiklikleri Kaydet' : 'Şubeyi Aç'}
      busy={createMut.isPending || updateMut.isPending}
      error={error}
      onSubmit={submit}
    >
      <SheetFieldRow>
        <SheetTextField
          label="Şube"
          required
          autoFocus
          value={name}
          onChange={setName}
          maxLength={20}
          placeholder="Örn. 4-A veya ÖĞRETMEN"
        />
        {!classRecord && (
          <SheetTextField
            label="Eğitim dönemi"
            required
            value={academicYear}
            onChange={setAcademicYear}
            maxLength={20}
          />
        )}
      </SheetFieldRow>
      <SheetFieldRow>
        <SheetTextField
          label="Rehber öğretmen"
          value={teacherName}
          onChange={setTeacherName}
          maxLength={60}
          placeholder="Sınıf öğretmeni adı"
        />
        <SheetTextField
          label="Müdür yardımcısı"
          value={deputyPrincipalName}
          onChange={setDeputyPrincipalName}
          maxLength={60}
          placeholder="Sorumlu müdür yrd."
        />
      </SheetFieldRow>
    </OriginSheet>
  );
}
