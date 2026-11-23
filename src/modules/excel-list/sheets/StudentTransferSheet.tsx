import { useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { useTransferStudentMutation } from '../../../system/query/useStudioQueries';
import type { ClassRecord, StudentRecord } from '../../../system/sqlite/types';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetSection } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { formErrorMessage } from './formHelpers';

export function StudentTransferSheet({ controller, student, source, targets }: {
  controller: OriginSheetController;
  student: StudentRecord;
  source: ClassRecord;
  targets: ClassRecord[];
}) {
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const transfer = useTransferStudentMutation();
  const target = targets.find((item) => item.id === targetId);
  const fullName = `${student.firstName} ${student.lastName}`;

  async function submit() {
    if (!target) return;
    setError(null);
    try {
      const targetClassName = await transfer.mutateAsync({
        studentId: student.id,
        sourceClassId: source.id,
        targetClassId: target.id,
      });
      controller.close();
      notifyStudio(`${fullName}, ${targetClassName} sınıfına taşındı.`, 'success');
    } catch (err) {
      setError(formErrorMessage(err));
    }
  }

  return (
    <OriginSheet
      controller={controller}
      title="Sınıf Değiştir"
      description={`${fullName} · Okul no ${student.studentNumber} · ${source.name} (${source.academicYear})`}
      width={430}
      submitLabel="Öğrenciyi Taşı"
      canSubmit={Boolean(target)}
      busy={transfer.isPending}
      error={error}
      onSubmit={submit}
    >
      {targets.length ? (
        <SheetSection title="Hedef sınıf">
          <AppleSelect
            ariaLabel="Hedef sınıf"
            placeholder="Sınıf seçin"
            value={targetId}
            disabled={transfer.isPending}
            expandMenu
            options={targets.map((item) => ({ value: item.id, label: item.name, iconHint: 'Şube' }))}
            onChange={(id) => {
              setTargetId(id);
              setError(null);
            }}
          />
        </SheetSection>
      ) : (
        <p className="xl-muted">Bu okul ve dönemde başka bir öğrenci sınıfı bulunmuyor.</p>
      )}
      {targets.length > 0 && student.matchedPhotoId && (
        <p className="xl-muted">Eşleşen fotoğraf da taşınır. Yeni sınıfta baskı onayı yeniden verilir.</p>
      )}
    </OriginSheet>
  );
}
