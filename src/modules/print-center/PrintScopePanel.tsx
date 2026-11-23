import React, { useMemo } from 'react';
import { notifyStudio } from '../../system/desktop/studioToast';
import { useSelectSchoolMutation } from '../../system/query/useSchoolQueries';
import type { ClassRecord, SchoolRecord, StudentRecord } from '../../system/sqlite/types';
import type { DeputyScopeOption } from '../../system/storage/yearbook-kutuk/types';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { PrintApprovalFilter } from './printSpecs';
import { isStaffStudentNumber } from './sheetComposer';
import './print-scope-panel.css';

/**
 * İZOLE MODÜL 04 SOL DENETÇİ (BÖLÜM 2):
 * Okul Seçimi, Şube Kapsamı, Onay Filtresi, Okul Onay Çubuğu ve Etkileşimli Şube Hazırlık Listesi
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PrintScopePanel: React.FC<{
  isRoster?: boolean;
  schools: readonly SchoolRecord[];
  allClasses: readonly ClassRecord[];
  activeSchoolId: string;
  scopedClasses: readonly ClassRecord[];
  deputyOptions?: readonly DeputyScopeOption[];
  classStatsMap: ReadonlyMap<string, { total: number; ready: number }>;
  effectiveScopeId: string;
  scopeLabel: string;
  approvalFilter: PrintApprovalFilter;
  approvedCount: number;
  allMatchedCount: number;
  readyStudents: number;
  totalStudents: number;
  readyPercent: number;
  missingPhotos: readonly StudentRecord[];
  onChangeScope: (val: string) => void;
  onChangeApprovalFilter: (val: PrintApprovalFilter) => void;
}> = React.memo(({
  isRoster = false,
  schools,
  allClasses,
  activeSchoolId,
  scopedClasses,
  deputyOptions = [],
  classStatsMap,
  effectiveScopeId,
  scopeLabel,
  approvalFilter,
  approvedCount,
  allMatchedCount,
  readyStudents,
  totalStudents,
  readyPercent,
  missingPhotos,
  onChangeScope,
  onChangeApprovalFilter,
}) => {
  const selectSchoolMut = useSelectSchoolMutation();
  const schoolOptions = useMemo(() => {
    const classCounts = new Map<string, number>();
    for (const cls of allClasses) {
      classCounts.set(cls.schoolId, (classCounts.get(cls.schoolId) ?? 0) + 1);
    }
    return schools.map((sch) => {
      const count = classCounts.get(sch.id) ?? 0;
      return {
        value: sch.id,
        label: `${sch.name} (${count} Şube)`,
        iconHint: 'Okul',
      };
    });
  }, [schools, allClasses]);

  const handleSelectSchool = (schoolId: string) => {
    if (!schoolId || schoolId === activeSchoolId) {
      onChangeScope('ALL');
      return;
    }
    selectSchoolMut.mutate(schoolId, {
      onSuccess: () => onChangeScope('ALL'),
      onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
    });
  };

  return (
    <section className="pc-panel-section" aria-label="Çıktı kapsamı ve şube hazırlığı">
      <div className="pc-section-head">
        <span className="pc-section-title">
          <SheetAutoIcon text="Okul" size={13.5} />
          {isRoster ? 'Öğrenci Listesi Kapsamı' : 'Kapsam & Şube Hazırlığı'}
        </span>
        {!isRoster && <span className="pc-section-counter">
          {readyStudents}/{totalStudents} (%{readyPercent})
        </span>}
      </div>

      {schoolOptions.length > 0 && (
        <div className="pc-control-field">
          <span className="pc-control-label">Okul Seçimi</span>
          <AppleSelect
            ariaLabel="Baskı okulu seç"
            disabled={selectSchoolMut.isPending}
            value={activeSchoolId}
            options={schoolOptions}
            onChange={handleSelectSchool}
          />
        </div>
      )}

      <div className="pc-control-field">
        <div className="pc-section-head">
          <span className="pc-control-label">Çıktı Kapsamı</span>
          {effectiveScopeId !== 'ALL' && scopedClasses.length > 0 && (
            <button
              type="button"
              className="pc-inline-link"
              onClick={() => onChangeScope('ALL')}
            >
              Tümünü Seç
            </button>
          )}
        </div>
        <AppleSelect
          ariaLabel="Çıktı kapsamı"
          value={effectiveScopeId}
          options={[
            { value: 'ALL', label: `Tüm Okul (${scopedClasses.length} Şube)`, iconHint: 'Okul' },
            ...deputyOptions.map((dep) => ({
              value: `DEPUTY:${dep.deputyName}`,
              label: `Md. Yrd.: ${dep.deputyName} (${dep.branchCount} Şube)`,
              iconHint: 'Müdür',
            })),
            ...scopedClasses.map((cls) => ({
              value: cls.id,
              label: `${cls.name} (${classStatsMap.get(cls.id)?.total ?? 0} Kayıt)`,
              iconHint: 'Şube',
            })),
          ]}
          onChange={onChangeScope}
        />
      </div>

      {!isRoster && <div className="pc-control-field">
        <span className="pc-control-label">Dahil Edilecek Kayıtlar</span>
        <AppleGlassSegment
          ariaLabel="Onay filtresi"
          fullWidth
          compact
          activeId={approvalFilter}
          items={[
            { id: 'approved-only', label: `Onaylı (${approvedCount})`, iconHint: 'Onay' },
            { id: 'all-matched', label: `Eşleşen (${allMatchedCount})`, iconHint: 'Öğrenci' },
          ]}
          onChange={(id) => onChangeApprovalFilter(id as PrintApprovalFilter)}
        />
      </div>}

      {!isRoster && <div className="pc-readiness-meter" aria-hidden="true">
        <div
          className={`pc-readiness-fill ${totalStudents > 0 && readyStudents === totalStudents ? 'is-complete' : ''}`.trim()}
          style={{ width: `${readyPercent}%` }}
        />
      </div>}

      {scopedClasses.length > 0 && (
        <div className="pc-branch-list" role="list" aria-label="Şube baskı hazırlık durumu">
          {scopedClasses.map((cls) => {
            const stat = classStatsMap.get(cls.id) ?? { total: 0, ready: 0 };
            const isSelected = effectiveScopeId === cls.id;
            const isEmpty = stat.total === 0;
            const isComplete = stat.total > 0 && stat.ready === stat.total;
            const statusText = isEmpty
              ? 'Kayıt Yok'
              : isComplete
                ? '✓ Onay Tamam'
                : `${stat.ready}/${stat.total} Onaylı`;
            const statusClass = isEmpty
              ? 'is-empty'
              : isComplete
                ? 'is-complete'
                : 'is-pending';

            return (
              <button
                key={cls.id}
                type="button"
                role="listitem"
                className={`pc-branch-row ${isSelected ? 'is-selected' : ''}`.trim()}
                onClick={() => onChangeScope(isSelected ? 'ALL' : cls.id)}
              >
                <span className="pc-branch-main">
                  <strong>{cls.name}</strong>
                  <small>{stat.total} Kayıt{cls.teacherName ? ` · ${cls.teacherName}` : ''}</small>
                </span>
                {!isRoster && <span className={`pc-branch-status ${statusClass}`}>{statusText}</span>}
              </button>
            );
          })}
        </div>
      )}

      {!isRoster && missingPhotos.length > 0 && (
        <div className="pc-missing-note">
          <strong>Fotoğrafı Eksik — {scopeLabel} ({missingPhotos.length})</strong>
          <p>
            {missingPhotos
              .slice(0, 18)
              .map((s) =>
                isStaffStudentNumber(s.studentNumber)
                  ? `${s.firstName} ${s.lastName}`
                  : `${s.studentNumber} ${s.firstName} ${s.lastName}`,
              )
              .join(' · ')}
            {missingPhotos.length > 18 ? ` · +${missingPhotos.length - 18} kişi` : ''}
          </p>
        </div>
      )}
    </section>
  );
});
