import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { useAddSchoolsBatchMutation } from '../../../system/query/useSchoolQueries';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { OriginSheet } from '../../../window-system/sheet/OriginSheet';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../../window-system/sheet/useOriginSheet';
import { rosterColumnLabel, usedRosterColumns, type RosterSheet } from '../rosterColumns';
import {
  readMappedSchools,
  suggestSchoolXlsxMapping,
  type SchoolXlsxColumns,
  type SchoolXlsxMapping,
} from '../schoolXlsxColumns';
import { loadValidatedXlsxWorkbook } from '../spreadsheetShared';
import { TableInfiniteFooter } from '../TableActionIcons';
import { TableHeaderLabel } from '../TableHeaderIcons';
import { TableSkeletonBoxes } from '../TableSkeletonBoxes';
import { useInfiniteTableSlice } from '../useInfiniteTableSlice';
import { formErrorMessage } from './formHelpers';

const SCHOOL_FIELDS: ReadonlyArray<readonly [keyof SchoolXlsxColumns, string, boolean]> = [
  ['name', 'Okul Adı (Zorunlu)', true],
  ['institutionCode', 'Kurum Kodu', false],
  ['address', 'Adres', false],
  ['notes', 'Notlar', false],
];

export function SchoolXlsxImportSheet({ controller }: { controller: OriginSheetController }) {
  const addMut = useAddSchoolsBatchMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sheets, setSheets] = useState<RosterSheet[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mapping, setMapping] = useState<SchoolXlsxMapping>({ columns: {}, startRow: 1 });
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (controller.isOpen && !wasOpen) {
    setWasOpen(true);
    setSheets([]);
    setFileName('');
    setError(null);
  } else if (!controller.isOpen && wasOpen) {
    setWasOpen(false);
  }

  const sheet = sheets[activeIndex];
  const columns = useMemo(() => (sheet ? usedRosterColumns(sheet.rows) : []), [sheet]);
  const preview = useMemo(() => {
    if (!sheet) return null;
    try {
      return { rows: readMappedSchools(sheet.rows, mapping), error: null };
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
      setMapping(suggestSchoolXlsxMapping(result[0]!.rows));
      setFileName(file.name);
    } catch (cause) {
      setError(formErrorMessage(cause));
    } finally {
      setReading(false);
    }
  };

  const changeColumn = (field: keyof SchoolXlsxColumns, value: string) => {
    setError(null);
    setMapping((curr) => ({
      ...curr,
      columns: { ...curr.columns, [field]: value === '' ? undefined : Number(value) },
    }));
  };

  const submit = async () => {
    if (!preview?.rows.length) return;
    setError(null);
    try {
      const count = await addMut.mutateAsync({ rows: preview.rows });
      notifyStudio(`${count} okul Excel dosyasından aktarıldı.`, 'success');
      controller.close();
    } catch (cause) {
      setError(formErrorMessage(cause));
    }
  };

  return (
    <OriginSheet
      controller={controller}
      title="Excel Dosyasından Okul Aktar (.xlsx)"
      description="MEB veya Excel çalışma kitabındaki okul listesini sütun eşleme ve önizlemeyle toplu kaydedin."
      width={720}
      submitLabel={preview?.rows.length ? `${preview.rows.length} Okulu Aktar` : 'Okulları Aktar'}
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
        aria-label="Okul Excel dosyası (.xlsx)"
        disabled={reading || addMut.isPending}
        onChange={(event) => void onFile(event)}
      />
      <div className="mod-file-picker-row">
        <div className="mod-file-picker-meta">
          <strong>{fileName || 'Okul listesi Excel çalışma kitabı (.xlsx) seçin'}</strong>
          <small>
            {fileName
              ? `${sheet?.rows.length ?? 0} satır okundu · Kurum kodu sıfırları korunur`
              : 'Kurum Kodu, Okul Adı, Adres, Notlar sütunları otomatik algılanır · Maksimum 8 MB'}
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
        <div className="mod-table-wrap mod-table-scroll" style={{ maxHeight: 220 }}>
          <TableSkeletonBoxes variant="compact" rows={12} />
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
                options={sheets.map((item, idx) => ({ value: String(idx), label: item.name, iconHint: 'Excel' }))}
                onChange={(val) => {
                  const idx = Number(val);
                  setActiveIndex(idx);
                  setMapping(suggestSchoolXlsxMapping(sheets[idx]!.rows));
                  setError(null);
                }}
              />
            </label>
          )}

          <div className="mod-map-grid">
            {SCHOOL_FIELDS.map(([field, label, required]) => (
              <label className="mod-field-label" key={field}>
                {label}
                <AppleSelect
                  ariaLabel={label}
                  value={mapping.columns[field] !== undefined ? String(mapping.columns[field]) : ''}
                  placeholder={required ? 'Sütun seçin' : 'Boş bırakılabilir'}
                  options={[
                    { value: '', label: required ? 'Sütun seçin' : 'Kullanma' },
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

          {Boolean(preview?.rows.length) && (
            <>
              <div
                className="mod-table-wrap mod-table-scroll"
                style={{ maxHeight: 240 }}
                onScroll={handleScroll}
                tabIndex={0}
                role="region"
                aria-label="Excel okul önizleme tablosu"
              >
                {isSliceLoading && <TableSkeletonBoxes variant="compact" rows={12} overlay />}
                <div className="mod-preview-caption">
                  <span>Önizleme · <strong>{preview!.rows.length}</strong> okul</span>
                  <span>Tüm okulları kaydırarak doğrulayabilirsiniz</span>
                </div>
                <table className="mod-table">
                  <thead>
                    <tr>
                      <th className="xl-th-sn"><TableHeaderLabel icon="order" label="S/N" align="center" /></th>
                      <th><TableHeaderLabel icon="institution" label="Kurum Kodu" /></th>
                      <th><TableHeaderLabel icon="school" label="Okul Adı" /></th>
                      <th><TableHeaderLabel icon="address" label="Adres" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((row, idx) => (
                      <tr key={`${row.name}-${idx}`}>
                        <td className="xl-td-sn">{idx + 1}</td>
                        <td className="mod-mono-badge">{row.institutionCode || '—'}</td>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.address || '—'}</td>
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
