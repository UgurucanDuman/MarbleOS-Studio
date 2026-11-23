import React, { useMemo, useRef, useState } from 'react';
import {
  useAddSchoolsBatchMutation,
  useDeleteSchoolsBatchMutation,
} from '../../system/query/useSchoolQueries';
import { notifyStudio } from '../../system/desktop/studioToast';
import type { StudioDatabaseSnapshot } from '../../system/sqlite/types';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { useOriginSheet, type OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import { SchoolDetailPanel } from './SchoolDetailPanel';
import { SchoolList } from './SchoolList';
import { parseSchoolExcelOrCsvText } from './schoolExcelParser';
import { buildSchoolRows, filterSchoolRows } from './schoolRows';
import { readValidatedTextListFile } from './spreadsheetShared';
import { formErrorMessage } from './sheets/formHelpers';
import {
  DeleteSchoolSheet,
  MergeSchoolsSheet,
  PromoteSchoolYearSheet,
} from './sheets/SchoolManageSheets';
import { AppleSearchField } from './TableActionIcons';

/**
 * Pencere 01 içindeki "Okullar" görünümü:
 * Okul arama, Tümünü Seç + toplu silme/birleştirme, satır içi Düzenle/Sil ikonları,
 * 20'şer sonsuz kaydırma ve Excel (.xlsx) / CSV / Yapıştır okul aktarımı.
 */
export const SchoolsView: React.FC<{
  db: StudioDatabaseSnapshot;
  editSchoolSheet: OriginSheetController;
  schoolPasteSheet: OriginSheetController;
  schoolXlsxSheet: OriginSheetController;
  schoolRosterXlsxSheet: OriginSheetController;
  onSelectSchool: (schoolId: string) => void;
  onEditSchool: (schoolId: string) => void;
  onPrepareSchoolRoster: (schoolId: string) => void;
  onOpenClasses: (schoolId?: string) => void;
}> = React.memo(({
  db,
  editSchoolSheet,
  schoolPasteSheet,
  schoolXlsxSheet,
  schoolRosterXlsxSheet,
  onSelectSchool,
  onEditSchool,
  onPrepareSchoolRoster,
  onOpenClasses,
}) => {
  const addSchoolsMut = useAddSchoolsBatchMutation();
  const deleteBatchMut = useDeleteSchoolsBatchMutation();
  const mergeSheet = useOriginSheet();
  const deleteSheet = useOriginSheet();
  const promoteSheet = useOriginSheet();
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { schools, classes, students } = db;
  // Yalnız okul/şube/öğrenci listeleri değişince yeniden hesaplanır; aktif okul değişimi tetiklemez.
  const rows = useMemo(() => buildSchoolRows({ schools, classes, students }), [schools, classes, students]);
  const visible = useMemo(() => filterSchoolRows(rows, query), [rows, query]);
  const activeRow = rows.find((row) => row.school.id === db.activeSchoolId) ?? rows[0] ?? null;
  const deleteTargetRow = rows.find((row) => row.school.id === deleteTargetId) ?? activeRow;
  const totalStudents = useMemo(() => rows.reduce((sum, row) => sum + row.studentCount, 0), [rows]);
  const rowIdSet = useMemo(() => new Set(rows.map((r) => r.school.id)), [rows]);
  const validCheckedIds = useMemo(
    () => checkedIds.filter((id) => rowIdSet.has(id)),
    [checkedIds, rowIdSet],
  );

  const toggleAllVisible = () => {
    const visibleIds = visible.map((r) => r.school.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => validCheckedIds.includes(id));
    setCheckedIds(
      allSelected
        ? validCheckedIds.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...validCheckedIds, ...visibleIds])),
    );
  };

  const toggleCheck = (schoolId: string) => {
    setCheckedIds((prev) =>
      prev.includes(schoolId) ? prev.filter((id) => id !== schoolId) : [...prev, schoolId],
    );
  };

  const handleBulkDelete = async () => {
    if (validCheckedIds.length === 0) return;
    try {
      await deleteBatchMut.mutateAsync(validCheckedIds);
      setCheckedIds([]);
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  const handleSchoolFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await readValidatedTextListFile(file, 'Okul listesi dosyası');
      const parsed = parseSchoolExcelOrCsvText(text);
      const count = await addSchoolsMut.mutateAsync({ rows: parsed });
      notifyStudio(`${count} okul listeye aktarıldı.`, 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <div className="xl-schools-view">
      <div className="xl-schools-main">
        <section className="mod-command-deck" aria-label="Okullar komut şeridi">
          <div className="mod-deck-controls">
            <AppleSearchField
              wide
              ariaLabel="Okul ara"
              placeholder="Aradığınız okul adını, kodunu veya kurum kodunu yazın"
              value={query}
              onChange={setQuery}
            />
            <div className="xl-actions">
              <input ref={csvFileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={handleSchoolFileUpload} />
              <button type="button" className="xl-btn" {...mergeSheet.trigger('schools-merge')}>
                <SheetAutoIcon text="Okul Birleştir" />
                Okul Birleştir
              </button>
              <button type="button" className="xl-btn" onClick={() => csvFileRef.current?.click()}>
                <SheetAutoIcon text="CSV / TSV Okul" />
                CSV / TSV Okul
              </button>
              <button type="button" className="xl-btn" {...schoolXlsxSheet.trigger('schools-xlsx')}>
                <SheetAutoIcon text="Excel" />
                Excel Dosyası (.xlsx)
              </button>
              <button type="button" className="xl-btn" {...schoolPasteSheet.trigger('schools-paste')}>
                <SheetAutoIcon text="Excel'den Yapıştır" />
                Excel'den Yapıştır
              </button>
            </div>
          </div>
          <div className="mod-deck-telemetry">
            <div className="mod-telemetry-group">
              <span className="mod-telemetry-item">
                <SheetAutoIcon text="Okul" size={12.5} />
                <strong>{rows.length} Okul</strong>
              </span>
              <span className="mod-telemetry-sep" aria-hidden="true">·</span>
              <span className="mod-telemetry-item">
                <SheetAutoIcon text="Öğrenci" size={12.5} />
                <strong>{totalStudents} Öğrenci</strong>
              </span>
              {validCheckedIds.length > 0 && (
                <>
                  <span className="mod-telemetry-sep" aria-hidden="true">·</span>
                  <span className="mod-telemetry-item">
                    <strong>{validCheckedIds.length} Seçili</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        <SchoolList
          rows={visible}
          resetKey={query}
          activeSchoolId={db.activeSchoolId}
          checkedIds={validCheckedIds}
          editSheet={editSchoolSheet}
          deleteSheet={deleteSheet}
          onToggleAll={toggleAllVisible}
          onToggleCheck={toggleCheck}
          onDeleteChecked={() => void handleBulkDelete()}
          onSelect={onSelectSchool}
          onEditRow={onEditSchool}
          onDeleteRow={setDeleteTargetId}
          onOpenClasses={(id) => onOpenClasses(id)}
        />
        {visible.length === 0 && <p className="xl-muted">Aramaya uyan okul bulunamadı.</p>}
      </div>

      {activeRow && (
        <SchoolDetailPanel
          row={activeRow}
          editSheet={editSchoolSheet}
          rosterXlsxSheet={schoolRosterXlsxSheet}
          promoteSheet={promoteSheet}
          onEdit={() => onEditSchool(activeRow.school.id)}
          onImportRoster={() => onPrepareSchoolRoster(activeRow.school.id)}
          onOpenClasses={() => onOpenClasses(activeRow.school.id)}
        />
      )}

      {mergeSheet.phase !== 'closed' && (
        <MergeSchoolsSheet
          controller={mergeSheet}
          rows={rows}
          initialSelectedIds={validCheckedIds}
        />
      )}
      {deleteSheet.phase !== 'closed' && (
        <DeleteSchoolSheet controller={deleteSheet} row={deleteTargetRow} />
      )}
      {promoteSheet.phase !== 'closed' && (
        <PromoteSchoolYearSheet controller={promoteSheet} row={activeRow} />
      )}
    </div>
  );
});
