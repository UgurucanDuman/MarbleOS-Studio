import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { useImportClassRosterMutation } from '../../../system/query/useStudioQueries';
import { rosterImportNotice } from '../../../system/sqlite/rosterImportActions';
import type { ClassRecord } from '../../../system/sqlite/types';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import {
  readMappedRoster, rosterColumnLabel, suggestRosterMapping, usedRosterColumns,
  type RosterColumns, type RosterMapping, type RosterSheet,
} from '../rosterColumns';
import { loadValidatedXlsxWorkbook } from '../spreadsheetShared';
import { TableInfiniteFooter } from '../TableActionIcons';
import { TableHeaderLabel } from '../TableHeaderIcons';
import { TableSkeletonBoxes } from '../TableSkeletonBoxes';
import { useInfiniteTableSlice } from '../useInfiniteTableSlice';
import { formErrorMessage } from './formHelpers';
import { OptionalIdColumnsSection } from './OptionalIdColumnsSection';

const fields = [
  ['studentNumber', 'Okul numarası'],
  ['firstName', 'Ad'],
  ['lastName', 'Soyad'],
] as const;

export function XlsxImportSheet({ controller, activeClass }: {
  controller: OriginSheetController;
  activeClass: ClassRecord | undefined;
}) {
  const addMut = useImportClassRosterMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sheets, setSheets] = useState<RosterSheet[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mapping, setMapping] = useState<RosterMapping>({ columns: {}, startRow: 1 });
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openKey = controller.isOpen ? (activeClass?.id ?? 'open') : '';
  const [lastOpenKey, setLastOpenKey] = useState('');

  if (openKey && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    setSheets([]);
    setFileName('');
    setError(null);
  } else if (!openKey && lastOpenKey) {
    setLastOpenKey('');
  }

  const sheet = sheets[activeIndex];
  const columns = useMemo(() => sheet ? usedRosterColumns(sheet.rows) : [], [sheet]);
  const preview = useMemo(() => {
    if (!sheet) return null;
    try {
      return { rows: readMappedRoster(sheet.rows, mapping), error: null };
    } catch (cause) {
      return { rows: [], error: formErrorMessage(cause) };
    }
  }, [sheet, mapping]);
  const { visibleItems, visibleCount, totalCount, hasMore, isSliceLoading, loadMore, handleScroll, sentinelRef } =
    useInfiniteTableSlice(preview?.rows ?? [], `${fileName}-${activeIndex}`, 20);

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
      setSheets(result);
      setActiveIndex(0);
      setMapping(suggestRosterMapping(result[0]!.rows));
      setFileName(file.name);
    } catch (cause) {
      setError(formErrorMessage(cause));
    } finally {
      setReading(false);
    }
  };

  const changeColumn = (field: keyof RosterColumns, value: string) => {
    setError(null);
    setMapping((current) => ({ ...current, columns: { ...current.columns, [field]: value === '' ? undefined : Number(value) } }));
  };

  const submit = async () => {
    if (!activeClass || !preview?.rows.length) return;
    setError(null);
    try {
      const result = await addMut.mutateAsync({ classId: activeClass.id, rows: preview.rows });
      notifyStudio(rosterImportNotice(result), 'success');
      controller.close();
    } catch (cause) {
      setError(formErrorMessage(cause));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Excel Dosyasından Aktar"
      description={activeClass ? `Hedef şube: ${activeClass.name} · ${activeClass.academicYear}` : undefined}
      width={680}
      submitLabel={preview?.rows.length ? `${preview.rows.length} Öğrenciyi Aktar` : 'Öğrencileri Aktar'}
      busy={reading || addMut.isPending}
      canSubmit={Boolean(preview?.rows.length)}
      error={error ?? preview?.error}
      onSubmit={() => void submit()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        hidden
        aria-label="Excel dosyası (.xlsx)"
        disabled={reading || addMut.isPending}
        onChange={(event) => void onFile(event)}
      />
      <div className="mod-file-picker-row">
        <div className="mod-file-picker-meta">
          <strong>{fileName || 'Excel çalışma kitabı (.xlsx) seçin'}</strong>
          <small>
            {fileName
              ? `${sheet?.rows.length ?? 0} satır okundu · Sütunları aşağıdan doğrulayabilirsiniz`
              : 'e-Okul veya Excel öğrenci listesi · Maksimum 8 MB'}
          </small>
        </div>
        <button
          type="button"
          className="xl-btn xl-btn-primary"
          disabled={reading || addMut.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <SheetAutoIcon text="Excel" size={13.5} />
          {fileName ? 'Dosyayı Değiştir' : 'Excel Dosyası Seç (.xlsx)'}
        </button>
      </div>
      {reading && !sheet && (
        <div className="mod-table-wrap mod-table-scroll" style={{ maxHeight: 240 }}>
          <TableSkeletonBoxes variant="compact" rows={20} />
        </div>
      )}
      {sheet && (
        <>
          {sheets.length > 1 && (
            <label className="mod-field-label">
              Excel sayfası
              <AppleSelect
                ariaLabel="Excel sayfası"
                value={String(activeIndex)}
                options={sheets.map((item, index) => ({ value: String(index), label: item.name, iconHint: 'Excel' }))}
                onChange={(val) => {
                  const index = Number(val);
                  setActiveIndex(index);
                  setMapping(suggestRosterMapping(sheets[index].rows));
                  setError(null);
                }}
              />
            </label>
          )}
          <div className="mod-map-grid">
            {fields.map(([field, label]) => (
              <label className="mod-field-label" key={field}>
                {label}
                <AppleSelect
                  ariaLabel={label}
                  value={mapping.columns[field] !== undefined ? String(mapping.columns[field]) : ''}
                  placeholder="Sütun seçin"
                  options={[
                    { value: '', label: 'Sütun seçin' },
                    ...columns.map((index) => ({ value: String(index), label: `${rosterColumnLabel(index)} sütunu`, iconHint: label })),
                  ]}
                  onChange={(val) => changeColumn(field, val)}
                />
              </label>
            ))}
            <label className="mod-field-label">
              İlk veri satırı
              <input type="number" className="mod-input" min={1} max={1_048_576} value={mapping.startRow}
                onChange={(event) => setMapping((current) => ({ ...current, startRow: Number(event.target.value) }))} />
            </label>
          </div>
          <OptionalIdColumnsSection
            availableColumns={columns}
            mappedColumns={mapping.columns}
            onChangeOptional={(field, val) => changeColumn(field, val)}
          />
          {Boolean(preview?.rows.length) && (
            <>
              <div className="mod-table-wrap mod-table-scroll" style={{ maxHeight: 240 }} onScroll={handleScroll} tabIndex={0} role="region" aria-label="Excel öğrenci önizleme tablosu">
                {isSliceLoading && <TableSkeletonBoxes variant="compact" rows={20} overlay />}
                <div className="mod-preview-caption">
                  <span>Önizleme · <strong>{preview!.rows.length}</strong> öğrenci</span>
                  <span>Tüm listeyi kaydırarak kontrol edebilirsiniz</span>
                </div>
                <table className="mod-table">
                  <thead>
                    <tr>
                      <th className="xl-th-sn"><TableHeaderLabel icon="order" label="S/N" align="center" /></th>
                      <th><TableHeaderLabel icon="code" label="Okul No" /></th>
                      <th><TableHeaderLabel icon="person" label="Ad" /></th>
                      <th><TableHeaderLabel icon="surname" label="Soyad" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((row, idx) => (
                      <tr key={`${row.studentNumber}-${idx}`}>
                        <td className="xl-td-sn">{idx + 1}</td>
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
