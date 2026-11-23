import React from 'react';
import type { SchoolRecord } from '../../system/sqlite/types';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';

export const EmptySchoolState: React.FC<{
  schools: SchoolRecord[];
  schoolXlsxSheet: OriginSheetController;
  schoolPasteSheet: OriginSheetController;
  newSchoolSheet: OriginSheetController;
  onSelectSchool: (schoolId: string) => void;
}> = ({ schools, schoolXlsxSheet, schoolPasteSheet, newSchoolSheet, onSelectSchool }) => (
  <div className="xl-empty">
    <h3>{schools.length ? 'Bir okul seçin' : 'İlk okulunuzu ekleyin'}</h3>
    <p>Sınıflar, öğrenci listeleri ve fotoğraflar seçili okula bağlı çalışır.</p>
    {schools.length > 0 && (
      <AppleSelect
        ariaLabel="Okul seç"
        inline
        placeholder="Okul seçin…"
        value=""
        options={schools.map((s) => ({ value: s.id, label: s.name, iconHint: 'Okul' }))}
        onChange={onSelectSchool}
      />
    )}
    <div className="xl-actions">
      <button type="button" className="xl-btn" {...schoolXlsxSheet.trigger('empty-xlsx')}>
        <SheetAutoIcon text="Excel" />
        Excel Dosyası (.xlsx)
      </button>
      <button type="button" className="xl-btn" {...schoolPasteSheet.trigger('empty-paste')}>
        <SheetAutoIcon text="Excel'den Yapıştır" />
        Excel'den Yapıştır
      </button>
      <button type="button" className="xl-btn xl-btn-primary" {...newSchoolSheet.trigger('empty')}>
        <SheetAutoIcon text="Yeni Okul" />
        Yeni Okul
      </button>
    </div>
  </div>
);

export const EmptyClassState: React.FC<{
  school: SchoolRecord;
  schoolRosterXlsxSheet: OriginSheetController;
  classSheet: OriginSheetController;
  onPrepareSchoolRoster: () => void;
}> = ({ school, schoolRosterXlsxSheet, classSheet, onPrepareSchoolRoster }) => {
  const rosterTrigger = schoolRosterXlsxSheet.trigger('empty-school-xlsx');
  return (
    <div className="xl-empty">
      <h3>İlk şubeyi oluşturun</h3>
      <p>{school.name} için henüz şube eklenmedi.</p>
      <div className="xl-actions">
        <button
          type="button"
          className="xl-btn"
          {...rosterTrigger}
          onClick={(e) => {
            onPrepareSchoolRoster();
            rosterTrigger.onClick(e);
          }}
        >
          <SheetAutoIcon text="Excel" />
          Okula Excel'den Aktar (.xlsx)
        </button>
        <button type="button" className="xl-btn xl-btn-primary" {...classSheet.trigger('empty-cls')}>
          <SheetAutoIcon text="Yeni Şube" />
          Yeni Şube
        </button>
      </div>
    </div>
  );
};

