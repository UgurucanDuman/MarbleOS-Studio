import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { useImportSchoolRosterMutation } from '../../../system/query/useSchoolQueries';
import { schoolRosterImportNotice } from '../../../system/sqlite/schoolRosterImport';
import type { SchoolRecord } from '../../../system/sqlite/types';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { rosterColumnLabel, usedRosterColumns, type RosterSheet } from '../rosterColumns';
import {
  detectDefaultSchoolRosterMode,
  readBranchColumnRoster,
  suggestSchoolBranchMapping,
  type SchoolBranchColumns,
  type SchoolBranchMapping,
  type SchoolRosterMode,
} from '../schoolRosterColumns';
import { readMultiSheetSchoolRoster } from '../schoolRosterMultiSheet';
import { loadValidatedXlsxWorkbook } from '../spreadsheetShared';
import { AppleGlassSegment, TableInfiniteFooter } from '../TableActionIcons';
import { TableHeaderLabel } from '../TableHeaderIcons';
import { TableSkeletonBoxes } from '../TableSkeletonBoxes';
import { useInfiniteTableSlice } from '../useInfiniteTableSlice';
import { formErrorMessage } from './formHelpers';
import { OptionalIdColumnsSection } from './OptionalIdColumnsSection';

const BRANCH_FIELDS: ReadonlyArray<readonly [keyof SchoolBranchColumns, string]> = [
  ['className', 'Sınıf / Şube'],
  ['studentNumber', 'Okul Numarası'],
  ['firstName', 'Ad'],
  ['lastName', 'Soyad'],
];

export function SchoolRosterXlsxSheet({
  controller,
  school,
  defaultYear,
  onImportedClass,
}: {
  controller: OriginSheetController;
  school: SchoolRecord | null;
  defaultYear: string;
  onImportedClass?: (classId: string) => void;
}) {
  const importMut = useImportSchoolRosterMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sheets, setSheets] = useState<RosterSheet[]>([]);
  const [mode, setMode] = useState<SchoolRosterMode>('branch-column');
  const [activeIndex, setActiveIndex] = useState(0);
  const [mapping, setMapping] = useState<SchoolBranchMapping>({ columns: {}, startRow: 1 });
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openKey = controller.isOpen ? `${school?.id ?? 'none'}::${defaultYear}` : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setSheets([]);
    setFileName('');
    setAcademicYear(defaultYear);
    setError(null);
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const sheet = sheets[activeIndex];
  const columns = useMemo(() => (sheet ? usedRosterColumns(sheet.rows) : []), [sheet]);
  const preview = useMemo(() => {
    if (!sheets.length) return null;
    try {
      const parsed =
        mode === 'multi-sheet'
          ? readMultiSheetSchoolRoster(sheets)
          : sheet
            ? readBranchColumnRoster(sheet.rows, mapping)
            : { groups: [], previewRows: [] };
      return { ...parsed, error: null };
    } catch (cause) {
      return { groups: [], previewRows: [], error: formErrorMessage(cause) };
    }
  }, [sheets, mode, sheet, mapping]);

  const { visibleItems, visibleCount, totalCount, hasMore, isSliceLoading, loadMore, handleScroll, sentinelRef } =
    useInfiniteTableSlice(preview?.previewRows ?? [], `${fileName}-${mode}-${activeIndex}`, 20);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setSheets([]);
    setFileName('');
    setReading(true);
    try {
      const result = await loadValidatedXlsxWorkbook(file);
      const detected = detectDefaultSchoolRosterMode(result);
      setSheets(result);
      setActiveIndex(0);
      setMode(detected.mode);
      setMapping(detected.mapping);
      setFileName(file.name);
    } catch (cause) {
      setError(formErrorMessage(cause));
    } finally {
      setReading(false);
    }
  };

  const changeColumn = (field: keyof SchoolBranchColumns, value: string) => {
    setError(null);
    setMapping((curr) => ({
      ...curr,
      columns: { ...curr.columns, [field]: value === '' ? undefined : Number(value) },
    }));
  };

  const submit = async () => {
    if (!school || !preview?.groups.length) return;
    setError(null);
    try {
      const res = await importMut.mutateAsync({
        schoolId: school.id,
        academicYear: academicYear.trim(),
        classes: preview.groups,
      });
      notifyStudio(schoolRosterImportNotice(res), 'success');
      if (res.firstClassId) onImportedClass?.(res.firstClassId);
      controller.close();
    } catch (cause) {
      setError(formErrorMessage(cause));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Okula Excel'den Sınıf & Öğrenci Aktar (.xlsx)"
      description={school ? `Hedef okul: ${school.name} (Kod ${school.code})` : undefined}
      width={760}
      submitLabel={
        preview?.groups.length
          ? `${preview.groups.length} Şube · ${preview.previewRows.length} Öğrenciyi Aktar`
          : 'Okula Aktar'
      }
      busy={reading || importMut.isPending}
      canSubmit={Boolean(school && preview?.groups.length)}
      error={error ?? preview?.error}
      onSubmit={() => void submit()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        hidden
        aria-label="Okul şube ve öğrenci Excel dosyası (.xlsx)"
        disabled={reading || importMut.isPending}
        onChange={(event) => void onFile(event)}
      />
      <div className="mod-file-picker-row">
        <div className="mod-file-picker-meta">
          <strong>{fileName || 'Okulun tüm şube listesini içeren .xlsx dosyasını seçin'}</strong>
          <small>
            {fileName
              ? `${sheets.length} Excel sayfası · 9A / 9/A / 9-A şube adları ve baştaki sıfırlar korunur`
              : 'İster tek tabloda Sınıf/Şube sütunlu, ister her sayfası ayrı şube olan Excel (.xlsx) · Maksimum 8 MB'}
          </small>
        </div>
        <button
          type="button"
          className="xl-btn xl-btn-primary"
          disabled={reading || importMut.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <SheetAutoIcon text="Excel" size={13.5} />
          {fileName ? 'Dosyayı Değiştir' : 'Excel Dosyası Seç (.xlsx)'}
        </button>
      </div>

      {sheets.length > 0 && (
        <>
          <div className="mod-map-grid">
            <label className="mod-field-label">
              Aktarım düzeni
              <AppleGlassSegment
                fullWidth
                ariaLabel="Okul Excel düzeni"
                activeId={mode}
                items={[
                  { id: 'branch-column', label: 'Sütundan Şube Ayır' },
                  { id: 'multi-sheet', label: `Her Sayfa Bir Şube (${sheets.length})` },
                ]}
                onChange={(id) => {
                  setError(null);
                  setMode(id as SchoolRosterMode);
                }}
              />
            </label>
            <label className="mod-field-label">
              Eğitim dönemi
              <input
                type="text"
                className="mod-input"
                maxLength={20}
                aria-label="Eğitim dönemi"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              />
            </label>
          </div>

          {mode === 'branch-column' && sheet && (
            <>
              {sheets.length > 1 && (
                <label className="mod-field-label">
                  Excel sayfası
                  <AppleSelect
                    ariaLabel="Excel sayfası"
                    value={String(activeIndex)}
                    options={sheets.map((item, idx) => ({ value: String(idx), label: item.name, iconHint: 'Excel' }))}
                    onChange={(val) => {
                      const idx = Number(val);
                      setActiveIndex(idx);
                      setMapping(suggestSchoolBranchMapping(sheets[idx]!.rows));
                      setError(null);
                    }}
                  />
                </label>
              )}
              <div className="mod-map-grid">
                {BRANCH_FIELDS.map(([field, label]) => (
                  <label className="mod-field-label" key={field}>
                    {label}
                    <AppleSelect
                      ariaLabel={label}
                      value={mapping.columns[field] !== undefined ? String(mapping.columns[field]) : ''}
                      placeholder="Sütun seçin"
                      options={[
                        { value: '', label: 'Sütun seçin' },
                        ...columns.map((index) => ({
                          value: String(index),
                          label: `${rosterColumnLabel(index)} sütunu`,
                          iconHint: label,
                        })),
                      ]}
                      onChange={(val) => changeColumn(field, val)}
                    />
                  </label>
                ))}
                <label className="mod-field-label">
                  İlk veri satırı
                  <input
                    type="number"
                    className="mod-input"
                    min={1}
                    max={1_048_576}
                    value={mapping.startRow}
                    onChange={(e) => setMapping((curr) => ({ ...curr, startRow: Number(e.target.value) }))}
                  />
                </label>
              </div>
              <OptionalIdColumnsSection
                availableColumns={columns}
                mappedColumns={mapping.columns}
                onChangeOptional={(field, val) => changeColumn(field, val)}
              />
            </>
          )}

          {Boolean(preview?.previewRows.length) && (
            <>
              <div
                className="mod-table-wrap mod-table-scroll"
                style={{ maxHeight: 230 }}
                onScroll={handleScroll}
                tabIndex={0}
                role="region"
                aria-label="Okul şube ve öğrenci önizleme tablosu"
              >
                {isSliceLoading && <TableSkeletonBoxes variant="compact" rows={12} overlay />}
                <div className="mod-preview-caption">
                  <span>
                    Önizleme · <strong>{preview!.groups.length}</strong> şube ·{' '}
                    <strong>{preview!.previewRows.length}</strong> öğrenci
                  </span>
                  <span>{preview!.groups.map((g) => `${g.className} (${g.rows.length})`).slice(0, 6).join(' · ')}</span>
                </div>
                <table className="mod-table">
                  <thead>
                    <tr>
                      <th className="xl-th-sn"><TableHeaderLabel icon="order" label="S/N" align="center" /></th>
                      <th><TableHeaderLabel icon="branch" label="Şube" /></th>
                      <th><TableHeaderLabel icon="code" label="Okul No" /></th>
                      <th><TableHeaderLabel icon="person" label="Ad" /></th>
                      <th><TableHeaderLabel icon="surname" label="Soyad" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((row, idx) => (
                      <tr key={`${row.className}-${row.studentNumber}-${idx}`}>
                        <td className="xl-td-sn">{idx + 1}</td>
                        <td className="mod-mono-badge">{row.className}</td>
                        <td className="mod-mono-badge">{row.studentNumber}</td>
                        <td><strong>{row.firstName}</strong></td>
                        <td><strong>{row.lastName}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TableInfiniteFooter
                visibleCount={visibleCount}
                totalCount={totalCount}
                hasMore={hasMore}
                onLoadMore={loadMore}
                sentinelRef={sentinelRef}
              />
            </>
          )}
        </>
      )}
    </OriginSheet>
  );
}
