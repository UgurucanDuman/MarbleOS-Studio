import { useEffect, useState } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetSection, SheetTextField } from '../../../window-system/sheet/SheetFields';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import {
  useDeleteSchoolMutation,
  useMergeSchoolsMutation,
  usePromoteSchoolYearMutation,
} from '../../../system/query/useSchoolQueries';
import {
  mergeSchoolsSchema,
  promoteSchoolYearSchema,
  SCHOOL_LIMITS,
} from '../../../system/schemas/schoolSchemas';
import type { SchoolRow } from '../schoolRows';
import { currentAcademicYear, formErrorMessage } from './formHelpers';

/**
 * Okul Birleştir kartı:
 * Ortak müdür/idareye sahip ilkokul + ortaokul gibi birden fazla okulu seçip
 * yeni bir okul adı altında tüm şube, öğrenci ve fotoğraflarıyla birleştirir.
 */
export function MergeSchoolsSheet({ controller, rows, initialSelectedIds = [] }: {
  controller: OriginSheetController;
  rows: SchoolRow[];
  initialSelectedIds?: string[];
}) {
  const mergeMut = useMergeSchoolsMutation();
  const [newSchoolName, setNewSchoolName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!controller.isOpen) return;
    setNewSchoolName('');
    setSelectedIds(initialSelectedIds);
    setError(null);
  }, [controller.isOpen]);

  const toggleSchool = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    setError(null);
    const parsed = mergeSchoolsSchema.safeParse({ newSchoolName, schoolIds: selectedIds });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Okul birleştirme bilgileri geçersiz.');
      return;
    }
    try {
      await mergeMut.mutateAsync(parsed.data);
      notifyStudio(`${selectedIds.length} okul "${parsed.data.newSchoolName}" altında birleştirildi.`, 'success');
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Okul Birleştir"
      description="Ortak okul müdürü veya idaresi olan ilkokul, ortaokul vb. okulları yeni bir okul kaydında birleştirir."
      width={520}
      submitLabel="Okulları Birleştir"
      busy={mergeMut.isPending}
      error={error}
      onSubmit={submit}
    >
      <SheetTextField
        label="Yeni okul adı"
        required
        autoFocus
        value={newSchoolName}
        onChange={setNewSchoolName}
        maxLength={SCHOOL_LIMITS.nameMax}
        placeholder="Örn. Atatürk İlk ve Ortaokulu"
        hint="Seçtiğiniz okulların şubeleri, öğrencileri ve fotoğrafları bu yeni okula aktarılır."
      />

      <SheetSection title={`Birleştirmek istediğiniz okulları seçin (${selectedIds.length} seçili)`}>
        <div className="xl-merge-list" role="group" aria-label="Birleştirilecek okullar">
          {rows.map(({ school, classCount, studentCount }) => {
            const checked = selectedIds.includes(school.id);
            return (
              <label key={school.id} className={`xl-merge-row ${checked ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  className="xl-row-check"
                  checked={checked}
                  onChange={() => toggleSchool(school.id)}
                />
                <span className="xl-mono">{school.code}</span>
                <span className="xl-school-name">{school.name}</span>
                <span className="xl-num">{classCount} şb · {studentCount} öğr</span>
              </label>
            );
          })}
        </div>
      </SheetSection>
    </OriginSheet>
  );
}

/** Seçili okulu silmeden önce şube ve öğrenci sayılarını gösteren onay kartı. */
export function DeleteSchoolSheet({ controller, row }: {
  controller: OriginSheetController;
  row: SchoolRow | null;
}) {
  const deleteMut = useDeleteSchoolMutation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!controller.isOpen) return;
    setError(null);
  }, [controller.isOpen]);

  const submit = async () => {
    if (!row) return;
    setError(null);
    try {
      await deleteMut.mutateAsync(row.school.id);
      notifyStudio(`${row.school.name} okulu silindi.`, 'info');
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Okulu Sil"
      description={row ? `${row.school.code} · ${row.school.name}` : undefined}
      width={440}
      submitLabel="Okulu Kalıcı Olarak Sil"
      busy={deleteMut.isPending}
      error={error}
      onSubmit={submit}
    >
      {row && (
        <p className="xl-delete-warn">
          <strong>{row.school.name}</strong> okulu ile birlikte bu okula bağlı{' '}
          <strong>{row.classCount} şube</strong> ve <strong>{row.studentCount} öğrenci</strong>{' '}
          kaydı silinecek. Silmeden önce isterseniz üst bardaki <strong>Ayarlar → Şifreli Yedekleme</strong> üzerinden arşiv alabilirsiniz.
        </p>
      )}
    </OriginSheet>
  );
}

/** Seçili okulun şubelerini bir üst sınıfa (Örn. 9-A → 10-A) ve yeni eğitim yılına taşıyan kart. */
export function PromoteSchoolYearSheet({ controller, row }: {
  controller: OriginSheetController;
  row: SchoolRow | null;
}) {
  const promoteMut = usePromoteSchoolYearMutation();
  const [targetYear, setTargetYear] = useState(currentAcademicYear());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!controller.isOpen) return;
    const base = currentAcademicYear();
    const parts = base.split('-').map(Number);
    setTargetYear(parts.length === 2 && !Number.isNaN(parts[0]) ? `${parts[0] + 1}-${parts[1] + 1}` : base);
    setError(null);
  }, [controller.isOpen]);

  const submit = async () => {
    if (!row) return;
    setError(null);
    const parsed = promoteSchoolYearSchema.safeParse({
      schoolId: row.school.id,
      targetAcademicYear: targetYear,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Yeni eğitim yılı geçersiz.');
      return;
    }
    try {
      await promoteMut.mutateAsync(parsed.data);
      notifyStudio(`${row.school.name} şubeleri ${parsed.data.targetAcademicYear} dönemine taşındı.`, 'success');
      controller.close();
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Yeni Döneme Aktar (Üst Sınıfa Taşı)"
      description={row ? `${row.school.code} · ${row.school.name}` : undefined}
      width={460}
      submitLabel="Şubeleri Yeni Döneme Taşı"
      busy={promoteMut.isPending}
      error={error}
      onSubmit={submit}
    >
      <SheetTextField
        label="Yeni eğitim yılı"
        required
        autoFocus
        value={targetYear}
        onChange={setTargetYear}
        maxLength={20}
        placeholder="Örn. 2027-2028"
        hint="Şubeler otomatik bir üst sınıfa (9-A → 10-A) terfi ettirilir; 4, 8 ve 12. sınıflar mezun sayılır."
      />
    </OriginSheet>
  );
}

