import type { CSSProperties } from 'react';

/**
 * ORTAK PENCERE SİSTEMİ YARDIMCISI: Apple tarzı kaydırıcı dolgu yüzdesi
 * `WheelRange` / range girdilerinde topun solundaki izi doldurmak için `--os-range-fill`
 * yüzde değerini üretir (CSS tarafında linear-gradient ile kullanılır).
 * Excel Liste ve Fotoğraf Stüdyosu modülleri bu tek kaynağı paylaşır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function rangeFill(value: number, min: number, max: number): CSSProperties {
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return { '--os-range-fill': `${pct.toFixed(2)}%` } as CSSProperties;
}
