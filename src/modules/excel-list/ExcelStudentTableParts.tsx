import React from 'react';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { TableMasterCheckbox } from './TableActionIcons';
import { TableHeaderLabel } from './TableHeaderIcons';

/** 11 sütunlu öğrenci/kadro tablosu için sabit sütun genişliği şablonu (başlık + gövde eşleşmesi). */
export const StudentTableColGroup: React.FC = () => (
  <colgroup>
    <col className="xl-col-check" />
    <col className="xl-col-sn" />
    <col className="xl-col-no" />
    <col className="xl-col-name" />
    <col className="xl-col-surname" />
    <col className="xl-col-photo" />
    <col className="xl-col-file" />
    <col className="xl-col-center" />
    <col className="xl-col-center" />
    <col className="xl-col-status" />
    <col className="xl-col-actions" />
  </colgroup>
);

interface StudentTableHeaderProps {
  headRef: React.RefObject<HTMLDivElement>;
  isStaff: boolean;
  allChecked: boolean;
  someChecked: boolean;
  disabled: boolean;
  checkedCount: number;
  onDeleteChecked: () => void;
  onToggleAll: () => void;
}

/** Kaydırma çubuğu dışında sabitlenen Mac Excel/Numbers tarzı başlık şeridi. */
export const StudentTableHeader: React.FC<StudentTableHeaderProps> = React.memo(
  ({
    headRef,
    isStaff,
    allChecked,
    someChecked,
    disabled,
    checkedCount,
    onDeleteChecked,
    onToggleAll,
  }) => (
    <div className="xl-student-head-wrap" ref={headRef}>
      <table className={isStaff ? 'mod-table is-staff-table' : 'mod-table'}>
        <StudentTableColGroup />
        <thead>
          <tr>
            <th className="xl-th-check">
              <TableMasterCheckbox
                checked={allChecked}
                indeterminate={someChecked}
                disabled={disabled}
                label="Tüm öğrencileri seç"
                checkedCount={checkedCount}
                onDeleteChecked={onDeleteChecked}
                onChange={onToggleAll}
              />
            </th>
            <th className="xl-th-sn"><TableHeaderLabel icon="order" label="S/N" align="center" /></th>
            <th className="xl-th-no">
              <TableHeaderLabel icon={isStaff ? 'institution' : 'code'} label={isStaff ? 'Görevi' : 'Okul No'} />
            </th>
            <th className="xl-th-name"><TableHeaderLabel icon="person" label="Ad" /></th>
            <th className="xl-th-surname"><TableHeaderLabel icon="surname" label="Soyad" /></th>
            <th className="xl-th-photo"><TableHeaderLabel icon="camera" label="Fotoğraf" align="center" /></th>
            <th className="xl-th-file"><TableHeaderLabel icon="institution" label="Resim Dosyası" /></th>
            <th className="xl-th-center"><TableHeaderLabel icon="eye" label="Göster" align="center" /></th>
            <th className="xl-th-center"><TableHeaderLabel icon="group" label="Grup" align="center" /></th>
            <th className="xl-th-status"><TableHeaderLabel icon="status" label="Stüdyo Durumu" /></th>
            <th className="xl-th-actions"><TableHeaderLabel icon="actions" label="İşlem" align="center" /></th>
          </tr>
        </thead>
      </table>
    </div>
  ),
);

interface StudentTableBottomBarProps {
  visibleCount: number;
  totalCount: number;
  studentCount: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onSort?: (by: 'number' | 'name') => void;
}

/** Kayıt sayacı, öğrenci no/alfabe sıralama ve +20 kayıt yükleme alt çubuğu. */
export const StudentTableBottomBar: React.FC<StudentTableBottomBarProps> = React.memo(
  ({ visibleCount, totalCount, studentCount, hasMore, onLoadMore, onSort }) => {
    if (totalCount === 0 && !(onSort && studentCount > 0)) return null;
    return (
      <div className="xl-table-bottom-bar">
        <span className="xl-table-bottom-count">
          {totalCount > 0 && (
            <>
              Gösterilen: <strong>{visibleCount}</strong> / <strong>{totalCount}</strong> kayıt
              {hasMore && " · Kaydırdıkça 20'şer yüklenir"}
            </>
          )}
        </span>
        <div className="xl-table-bottom-actions">
          {onSort && studentCount > 0 && (
            <>
              <button type="button" className="xl-mini-btn" onClick={() => onSort('number')}>
                <SheetAutoIcon text="Sırala" size={12.5} />
                Sırala (Öğrenci No)
              </button>
              <button type="button" className="xl-mini-btn" onClick={() => onSort('name')}>
                <SheetAutoIcon text="Sırala" size={12.5} />
                Sırala (Alfabe)
              </button>
            </>
          )}
          {hasMore && (
            <button type="button" className="xl-btn xl-btn-sm" onClick={onLoadMore}>
              +20 Kayıt Daha Göster
            </button>
          )}
        </div>
      </div>
    );
  },
);

