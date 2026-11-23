import React, { useMemo, useState } from 'react';
import { useUpdateClassMutation } from '../../system/query/useStudioQueries';
import { updateClassSchema } from '../../system/schemas/studioSchemas';
import type { ClassRecord, StudentRecord } from '../../system/sqlite/types';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { formErrorMessage, isTeacherClassName } from './sheets/formHelpers';

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Öğretmen Kadrosundan Öğrenci Şubesine Apple Seçicili Hızlı Atama Kartı
 * - Ham tarayıcı `<select>` yerine ortak `AppleSelect` (Popover Listbox) bileşenini kullanır.
 * - Seçili öğretmeni veya Md. Yrd. unvanlı idareciyi tek tıkla öğrenci şubesine bağlar / kaldırır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const StaffBranchAssignBox: React.FC<{
  staffMember: StudentRecord;
  schoolClasses: ClassRecord[];
  onNotice: (msg: string | null) => void;
}> = React.memo(({ staffMember, schoolClasses, onNotice }) => {
  const updateClassMut = useUpdateClassMutation();

  const studentBranches = useMemo(
    () => schoolClasses.filter((cls) => !isTeacherClassName(cls.name)),
    [schoolClasses],
  );

  const [targetBranchId, setTargetBranchId] = useState('');

  const fullName = `${staffMember.firstName} ${staffMember.lastName}`.trim().slice(0, 60);
  const normalizedFull = fullName.toLocaleLowerCase('tr-TR');
  const upperRole = (staffMember.role ?? '').trim().toUpperCase();
  const isPrincipalRole = Boolean(staffMember.isPrincipal || upperRole === 'MDR.');
  const isDeputyRole = upperRole === 'MD.YRD.';

  const assignedBranches = useMemo(
    () =>
      studentBranches.filter((cls) => {
        const current = isDeputyRole ? (cls.deputyPrincipalName ?? '') : cls.teacherName;
        return current.trim().toLocaleLowerCase('tr-TR') === normalizedFull;
      }),
    [studentBranches, isDeputyRole, normalizedFull],
  );

  const selectedBranch =
    studentBranches.find((cls) => cls.id === targetBranchId) ??
    studentBranches.find((cls) => !assignedBranches.some((a) => a.id === cls.id)) ??
    studentBranches[0];

  const selectOptions = useMemo(
    () =>
      studentBranches.map((cls) => {
        const currentOwner = (isDeputyRole ? cls.deputyPrincipalName : cls.teacherName)?.trim() || '';
        const mine = currentOwner.toLocaleLowerCase('tr-TR') === normalizedFull;
        const suffix = mine
          ? ' · Atandı'
          : currentOwner
            ? ` · ${currentOwner}`
            : ' · Boş';
        return {
          value: cls.id,
          label: `${cls.name}${suffix}`,
          iconHint: 'Şube',
        };
      }),
    [studentBranches, isDeputyRole, normalizedFull],
  );

  const isSelectedAlreadyAssigned = Boolean(
    selectedBranch && assignedBranches.some((a) => a.id === selectedBranch.id),
  );

  const handleToggleBranch = async (branch: ClassRecord, remove: boolean) => {
    onNotice(null);
    const nextValue = remove ? '' : fullName;
    const parsed = updateClassSchema.safeParse({
      id: branch.id,
      name: branch.name,
      teacherName: isDeputyRole ? branch.teacherName : nextValue,
      deputyPrincipalName: isDeputyRole ? nextValue : (branch.deputyPrincipalName ?? ''),
    });
    if (!parsed.success) {
      onNotice(parsed.error.issues[0]?.message ?? 'Şube atama bilgisi geçersiz.');
      return;
    }
    try {
      await updateClassMut.mutateAsync(parsed.data);
      if (remove) {
        onNotice(`${branch.name} şubesinden ${fullName} ataması kaldırıldı.`);
      } else {
        onNotice(
          `${fullName} → ${branch.name} ${isDeputyRole ? 'müdür yardımcısı' : 'sınıf öğretmeni'} olarak atandı.`,
        );
      }
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  if (isPrincipalRole) {
    return (
      <div className="xl-inspector-section">
        <span className="xl-inspector-title">
          <SheetAutoIcon text="Müdür" size={12.5} />
          Kurum Temsili
        </span>
        <span className="xl-inspector-hint">
          Okul Müdürü tüm şube çizelgelerinde ve albüm sayfalarında otomatik yer alır.
        </span>
      </div>
    );
  }

  return (
    <div className="xl-inspector-section">
      <span className="xl-inspector-title">
        <SheetAutoIcon text="Şube" size={12.5} />
        {isDeputyRole ? 'Sorumlu Şube Ata (Md. Yrd.)' : 'Şubeye Sınıf Öğretmeni Ata'}
      </span>

      {studentBranches.length === 0 ? (
        <span className="xl-inspector-hint">
          Atama yapmak için önce öğrenci şubesi (Örn: 9-A) oluşturun.
        </span>
      ) : (
        <>
          {assignedBranches.length > 0 && (
            <div className="xl-staff-assigned-list" aria-label="Atandığı şubeler">
              {assignedBranches.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  className="xl-staff-assigned-chip"
                  disabled={updateClassMut.isPending}
                  title={`${cls.name} şubesinden atamayı kaldır`}
                  onClick={() => void handleToggleBranch(cls, true)}
                >
                  <SheetAutoIcon text="Şube" size={11} />
                  <span>{cls.name}</span>
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}

          {selectedBranch && (
            <>
              <AppleSelect
                ariaLabel="Atanacak şube"
                value={selectedBranch.id}
                options={selectOptions}
                placeholder="Şube seçin…"
                disabled={updateClassMut.isPending}
                onChange={setTargetBranchId}
              />

              <button
                type="button"
                className={
                  isSelectedAlreadyAssigned
                    ? 'xl-mini-btn xl-inspector-wide-btn'
                    : 'xl-btn xl-btn-primary xl-inspector-wide-btn'
                }
                disabled={updateClassMut.isPending}
                onClick={() => void handleToggleBranch(selectedBranch, isSelectedAlreadyAssigned)}
              >
                <SheetAutoIcon text={isSelectedAlreadyAssigned ? 'İptal' : 'Kaydet'} size={12.5} />
                {isSelectedAlreadyAssigned ? 'Şube Atamasını Kaldır' : 'Şubeye Ata'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
});
