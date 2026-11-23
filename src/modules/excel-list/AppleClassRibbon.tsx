import React, { useMemo, useState } from 'react';
import {
  useCreateClassMutation,
  useDuplicateClassMutation,
} from '../../system/query/useStudioQueries';
import { createClassSchema } from '../../system/schemas/studioSchemas';
import type { ClassRecord, StudentRecord } from '../../system/sqlite/types';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import { AppleGlassSegment } from './TableActionIcons';
import { formErrorMessage, isTeacherClassName } from './sheets/formHelpers';

interface AppleClassRibbonProps {
  schoolId: string;
  institutionCode?: string;
  defaultYear: string;
  classes: ClassRecord[];
  students: StudentRecord[];
  readyCount: number;
  readyPercent: number;
  activeClass: ClassRecord | undefined;
  editClassSheet: OriginSheetController;
  deleteClassSheet: OriginSheetController;
  schoolRosterSheet: OriginSheetController;
  onPrepareSchoolRoster: () => void;
  onSelectClass: (classId: string) => void;
  onEditClass: (cls: ClassRecord) => void;
  onNotice: (msg: string | null) => void;
}

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Birleşik Apple Pro Şube Komut Güvertesi & Okul Telemetri Şeridi
 * - Üst katman: Cam (Glass) segment seçici, hızlı şube açma kapsülü ve seçili şube yönetim aksiyonları
 * - Alt katman: Şube/öğrenci sayısı ve kompakt Baskıya Hazır onay göstergesi (tüm modüllerle tek tasarım)
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const AppleClassRibbon: React.FC<AppleClassRibbonProps> = React.memo(({
  schoolId,
  institutionCode,
  defaultYear,
  classes,
  students,
  readyCount,
  readyPercent,
  activeClass,
  editClassSheet,
  deleteClassSheet,
  schoolRosterSheet,
  onPrepareSchoolRoster,
  onSelectClass,
  onEditClass,
  onNotice,
}) => {
  const createClassMut = useCreateClassMutation();
  const duplicateClassMut = useDuplicateClassMutation();

  const [quickName, setQuickName] = useState('');

  const hasTeacherClass = useMemo(() => classes.some((c) => isTeacherClassName(c.name)), [classes]);

  const handleQuickCreate = async (presetName?: string) => {
    const rawName = (presetName ?? quickName).trim();
    if (!rawName) return;
    onNotice(null);
    const parsed = createClassSchema.safeParse({
      name: rawName,
      teacherName: '',
      schoolId,
      academicYear: defaultYear,
    });
    if (!parsed.success) {
      onNotice(parsed.error.issues[0]?.message ?? 'Şube adı geçersiz.');
      return;
    }
    try {
      const id = await createClassMut.mutateAsync(parsed.data);
      if (!presetName) setQuickName('');
      onSelectClass(id);
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  const handleDuplicate = async () => {
    if (!activeClass) return;
    onNotice(null);
    try {
      const newId = await duplicateClassMut.mutateAsync(activeClass.id);
      onSelectClass(newId);
    } catch (err) {
      onNotice(formErrorMessage(err));
    }
  };

  const editTrigger = editClassSheet.trigger('cls-edit');
  const deleteTrigger = deleteClassSheet.trigger('cls-delete');
  const schoolRosterTrigger = schoolRosterSheet.trigger('ribbon-school-xlsx');

  const segmentItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      counts.set(s.classId, (counts.get(s.classId) ?? 0) + 1);
    }
    return classes.map((cls) => ({
      id: cls.id,
      label: `${cls.name} (${counts.get(cls.id) ?? 0})`,
    }));
  }, [classes, students]);

  const isAllReady = students.length > 0 && readyCount === students.length;

  return (
    <section className="mod-command-deck" aria-label="Şube ve okul komut şeridi">
      <div className="mod-deck-controls">
        <div className="xl-apple-ribbon">
          <div className="xl-apple-ribbon-left">
            <AppleGlassSegment
              ariaLabel="Şubeler"
              emptyText="Henüz şube açılmadı"
              items={segmentItems}
              activeId={activeClass?.id ?? ''}
              onChange={onSelectClass}
            />

            {!hasTeacherClass && (
              <button
                type="button"
                className="xl-mini-btn xl-teacher-chip"
                disabled={createClassMut.isPending}
                onClick={() => void handleQuickCreate('ÖĞRETMEN')}
                title="Okul idare ve öğretmen kadrosu için liste oluştur"
              >
                <SheetAutoIcon text="Öğretmen" size={13} />
                + Öğretmen Kadrosu
              </button>
            )}
          </div>

          <div className="xl-apple-ribbon-right">
            <form
              className="xl-inline-branch-capsule"
              onSubmit={(e) => {
                e.preventDefault();
                void handleQuickCreate();
              }}
            >
              <input
                type="text"
                className="xl-capsule-input"
                value={quickName}
                maxLength={20}
                placeholder="Hızlı şube (Örn: 9-A)…"
                aria-label="Hızlı şube adı"
                onChange={(e) => setQuickName(e.target.value)}
              />
              <button
                type="submit"
                className="xl-capsule-submit"
                disabled={createClassMut.isPending || !quickName.trim()}
              >
                <SheetAutoIcon text="Kaydet" size={12.5} />
                Aç
              </button>
            </form>

            <button
              type="button"
              className="xl-mini-btn"
              {...schoolRosterTrigger}
              onClick={(e) => {
                onPrepareSchoolRoster();
                schoolRosterTrigger.onClick(e);
              }}
            >
              <SheetAutoIcon text="Excel" size={12.5} />
              Okula Excel (.xlsx)
            </button>

            {activeClass && (
              <>
                <button
                  type="button"
                  className="xl-mini-btn"
                  {...editTrigger}
                  onClick={(e) => {
                    onEditClass(activeClass);
                    editTrigger.onClick(e);
                  }}
                >
                  <SheetAutoIcon text="Şube Düzenle" size={12.5} />
                  Şube Düzenle
                </button>
                <button
                  type="button"
                  className="xl-mini-btn"
                  disabled={duplicateClassMut.isPending}
                  onClick={() => void handleDuplicate()}
                >
                  <SheetAutoIcon text="Çoğalt" size={12.5} />
                  Çoğalt
                </button>
                <button
                  type="button"
                  className="xl-mini-btn xl-btn-danger"
                  {...deleteTrigger}
                >
                  <SheetAutoIcon text="Sil" size={12.5} />
                  Şubeyi Sil
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mod-deck-telemetry">
        <div className="mod-telemetry-group">
          <span className="mod-telemetry-item">
            <SheetAutoIcon text="Şube" size={12.5} />
            <strong>{classes.length} Şube</strong>
          </span>
          <span className="mod-telemetry-sep" aria-hidden="true">·</span>
          <span className="mod-telemetry-item">
            <SheetAutoIcon text="Öğrenci" size={12.5} />
            <strong>{students.length} Öğrenci</strong>
          </span>
          {institutionCode && (
            <>
              <span className="mod-telemetry-sep" aria-hidden="true">·</span>
              <span className="mod-telemetry-muted">Kurum: {institutionCode}</span>
            </>
          )}
        </div>

        <div className={`mod-approval-gauge ${isAllReady ? 'is-complete' : ''}`.trim()}>
          <SheetAutoIcon text="Onay" size={12.5} />
          <span className="mod-gauge-label">Baskıya Hazır</span>
          <div className="mod-gauge-track" aria-hidden="true">
            <div className="mod-gauge-fill" style={{ width: `${readyPercent}%` }} />
          </div>
          <strong className="mod-gauge-value">
            {readyCount} / {students.length} (%{readyPercent})
          </strong>
        </div>
      </div>
    </section>
  );
});

