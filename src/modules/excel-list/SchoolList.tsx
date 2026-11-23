import React, { useRef } from 'react';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import type { SchoolRow } from './schoolRows';
import {
  RowDeleteIconButton,
  RowEditIconButton,
  TableInfiniteFooter,
  TableMasterCheckbox,
} from './TableActionIcons';
import { TableHeaderLabel } from './TableHeaderIcons';
import { TableSkeletonBoxes } from './TableSkeletonBoxes';
import { useInfiniteTableSlice } from './useInfiniteTableSlice';

/**
 * Profesyonel Okullar Tablosu:
 * - Başlıkta "Tümünü Seç" + satır seçim kutuları
 * - Satır sağında Düzenle (Kalem) ve Sil (Çöp Kutusu) ikonları
 * - 20'şer kayıtlık sonsuz kaydırma (Infinite Scroll)
 */
export const SchoolList = React.memo(function SchoolList({
  rows,
  resetKey,
  activeSchoolId,
  checkedIds,
  editSheet,
  deleteSheet,
  onToggleAll,
  onToggleCheck,
  onDeleteChecked,
  onSelect,
  onEditRow,
  onDeleteRow,
  onOpenClasses,
}: {
  rows: SchoolRow[];
  resetKey: string;
  activeSchoolId: string | null;
  checkedIds: string[];
  editSheet: OriginSheetController;
  deleteSheet: OriginSheetController;
  onToggleAll: () => void;
  onToggleCheck: (schoolId: string) => void;
  onDeleteChecked: () => void;
  onSelect: (schoolId: string) => void;
  onEditRow: (schoolId: string) => void;
  onDeleteRow: (schoolId: string) => void;
  onOpenClasses: (schoolId: string) => void;
}) {
  const {
    visibleItems,
    visibleCount,
    totalCount,
    hasMore,
    isSliceLoading,
    loadingMode,
    loadMore,
    handleScroll,
    sentinelRef,
  } = useInfiniteTableSlice(rows, resetKey, 20, 'schools');

  const headWrapRef = useRef<HTMLDivElement>(null);
  const allChecked = rows.length > 0 && rows.every((r) => checkedIds.includes(r.school.id));
  const someChecked = !allChecked && rows.some((r) => checkedIds.includes(r.school.id));

  return (
    <div className="xl-school-list" role="listbox" aria-label="Okullar">
      <div className="xl-school-head-wrap" ref={headWrapRef}>
        <div className="xl-school-row xl-school-row-head">
          <span className="xl-cell-check">
            <TableMasterCheckbox
              checked={allChecked}
              indeterminate={someChecked}
              disabled={rows.length === 0}
              label="Tüm okulları seç"
              checkedCount={checkedIds.length}
              onDeleteChecked={onDeleteChecked}
              onChange={onToggleAll}
            />
          </span>
          <TableHeaderLabel icon="code" label="Kod" />
          <TableHeaderLabel icon="institution" label="Kurum Kodu" />
          <TableHeaderLabel icon="school" label="Okul Adı" />
          <TableHeaderLabel icon="address" label="Okul Adresi" />
          <TableHeaderLabel icon="note" label="Açıklama / Not" />
          <span className="xl-num"><TableHeaderLabel icon="branch" label="Şube" align="right" /></span>
          <span className="xl-num"><TableHeaderLabel icon="students" label="Mevcut" align="right" /></span>
          <span className="xl-col-actions"><TableHeaderLabel icon="actions" label="İşlem" align="center" /></span>
        </div>
      </div>

      <div
        className="xl-table-scroll"
        onScroll={(e) => {
          if (headWrapRef.current) headWrapRef.current.scrollLeft = e.currentTarget.scrollLeft;
          handleScroll(e);
        }}
      >

        <div className={isSliceLoading && loadingMode === 'reset' ? 'xl-tbody-deferred' : undefined}>
          {visibleItems.map(({ school, classCount, studentCount }) => {
            const active = school.id === activeSchoolId;
            const isChecked = checkedIds.includes(school.id);
            const editTrigger = editSheet.trigger(`row-edit-${school.id}`);
            const delTrigger = deleteSheet.trigger(`row-del-${school.id}`);
            return (
              <div
                key={school.id}
                role="option"
                tabIndex={0}
                aria-selected={active}
                className={`xl-school-row ${active ? 'is-active' : ''} ${isChecked ? 'is-checked' : ''}`}
                onClick={() => onSelect(school.id)}
                onDoubleClick={() => onOpenClasses(school.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(school.id);
                  }
                }}
              >
                <span className="xl-cell-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="xl-row-check"
                    aria-label={`${school.name} seç`}
                    checked={isChecked}
                    onChange={() => onToggleCheck(school.id)}
                  />
                </span>
                <span className="xl-mono">{school.code}</span>
                <span className="xl-mono">{school.institutionCode || '—'}</span>
                <span className="xl-school-name" title={school.name}>
                  {school.name}
                </span>
                <span className="xl-cell-text" title={school.address || undefined}>
                  {school.address || '—'}
                </span>
                <span className="xl-cell-text" title={school.notes || undefined}>
                  {school.notes || '—'}
                </span>
                <span className="xl-num">{classCount}</span>
                <span className="xl-num">{studentCount}</span>
                <span className="xl-col-actions" onClick={(e) => e.stopPropagation()}>
                  <span className="xl-row-actions">
                    <RowEditIconButton
                      label={`${school.name} düzenle`}
                      {...editTrigger}
                      onClick={(e) => {
                        onEditRow(school.id);
                        editTrigger.onClick(e);
                      }}
                    />
                    <RowDeleteIconButton
                      label={`${school.name} sil`}
                      {...delTrigger}
                      onClick={(e) => {
                        onDeleteRow(school.id);
                        delTrigger.onClick(e);
                      }}
                    />
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        {isSliceLoading && (
          <TableSkeletonBoxes
            variant="schools"
            rows={20}
            overlay={loadingMode === 'reset'}
          />
        )}
        {hasMore && <div ref={sentinelRef} className="xl-scroll-sentinel" aria-hidden="true" />}
      </div>

      <TableInfiniteFooter
        visibleCount={visibleCount}
        totalCount={totalCount}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </div>
  );
});
