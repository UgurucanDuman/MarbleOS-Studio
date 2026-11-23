import { useState } from 'react';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import { rosterColumnLabel } from '../rosterColumns';
import { OPTIONAL_ROSTER_FIELDS, type OptionalRosterField } from '../rosterOptionalColumns';

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Katlanabilir Kimlik & Kütük Sütun Eşleştirici
 * T.C. Kimlik No, Doğum Tarihi/Yeri, Kan Grubu, Anne/Baba Adı, Görevi ve Grup Kodu
 * sütunlarını isteğe bağlı eşleştirir; kimlik kartı şablonları için veriyi hazırlar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export function OptionalIdColumnsSection({
  availableColumns,
  mappedColumns,
  onChangeOptional,
}: {
  availableColumns: readonly number[];
  mappedColumns: Partial<Record<OptionalRosterField, number>>;
  onChangeOptional: (field: OptionalRosterField, value: string) => void;
}) {
  const matchedCount = OPTIONAL_ROSTER_FIELDS.filter(([f]) => mappedColumns[f] !== undefined).length;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="xl-opt-cols-box">
      <button
        type="button"
        className="xl-btn"
        aria-expanded={expanded}
        style={{ width: '100%', justifyContent: 'space-between' }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <SheetAutoIcon text="Kimlik" size={13.5} />
          <span>
            Kimlik &amp; Kütük Sütunları (İsteğe Bağlı)
            {matchedCount > 0 ? ` · ${matchedCount} sütun otomatik algılandı` : ''}
          </span>
        </span>
        <span style={{ fontSize: 13, opacity: 0.72 }}>
          {expanded ? 'Gizle ▲' : 'Göster ▼'}
        </span>
      </button>

      {expanded && (
        <div className="mod-map-grid" style={{ marginTop: 8 }}>
          {OPTIONAL_ROSTER_FIELDS.map(([field, label]) => (
            <label className="mod-field-label" key={field}>
              {label}
              <AppleSelect
                ariaLabel={`${label} sütunu`}
                value={mappedColumns[field] !== undefined ? String(mappedColumns[field]) : ''}
                placeholder="— Eşleştirme Yok —"
                options={[
                  { value: '', label: '— Eşleştirme Yok —' },
                  ...availableColumns.map((colIndex) => ({
                    value: String(colIndex),
                    label: `${rosterColumnLabel(colIndex)} sütunu`,
                    iconHint: label,
                  })),
                ]}
                onChange={(val) => onChangeOptional(field, val)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

