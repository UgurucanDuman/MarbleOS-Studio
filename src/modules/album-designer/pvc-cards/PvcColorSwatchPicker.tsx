import React from 'react';
import { PVC_ELEMENT_COLOR_SWATCHES } from '../../../system/storage/pvc-cards/fieldResolver';

/**
 * İZOLE MODÜL 03 RENK SEÇİCİ: PVC Kart Katmanları için Kurumsal Renk & Tema Jetonu Paleti
 * Turuncu kesinlikle yasaktır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const SEMANTIC_SWATCHES: ReadonlyArray<{ value: string; label: string; dot: string }> = [
  { value: 'accent', label: 'Okul Vurgusu', dot: 'var(--os-accent)' },
  { value: 'ink', label: 'Ana Mürekkep', dot: '#111827' },
  { value: 'onAccent', label: 'Açık Beyaz', dot: '#ffffff' },
  { value: 'accentSoft', label: 'Yumuşak Zemin', dot: '#dbeafe' },
];

export const PvcColorSwatchPicker: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  allowClear?: boolean;
}> = React.memo(({ label, value, onChange, allowClear = false }) => (
  <div className="pvc-prop-block">
    <div className="tc-section-head">
      <span className="pvc-mini-label">{label}</span>
      {allowClear && value && (
        <button type="button" className="tc-auto-link" onClick={() => onChange('')}>
          Temizle
        </button>
      )}
    </div>
    <div className="pvc-swatch-row">
      {SEMANTIC_SWATCHES.map((sw) => (
        <button
          key={sw.value}
          type="button"
          title={`Tema: ${sw.label}`}
          aria-label={`${label}: ${sw.label}`}
          className={`pvc-swatch-chip ${value === sw.value ? 'is-active' : ''}`.trim()}
          onClick={() => onChange(sw.value)}
        >
          <span style={{ background: sw.dot }} />
        </button>
      ))}
      {PVC_ELEMENT_COLOR_SWATCHES.map((sw) => (
        <button
          key={sw.hex}
          type="button"
          title={sw.label}
          aria-label={`${label}: ${sw.label}`}
          className={`pvc-swatch-chip ${value.toLowerCase() === sw.hex ? 'is-active' : ''}`.trim()}
          onClick={() => onChange(sw.hex)}
        >
          <span style={{ background: sw.hex }} />
        </button>
      ))}
    </div>
  </div>
));
