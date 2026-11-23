import { PVC_CODE_SOURCE_OPTIONS, PVC_FIELD_META } from '../../../system/storage/pvc-cards/fieldResolver';
import type { PvcPhotoShape, PvcShapeVariant } from '../../../system/storage/pvc-cards/types';

/**
 * İZOLE MODÜL 03 · PVC DENETÇİ SEÇENEK SABİTLERİ (.ts <= 240 satır)
 */

export const PVC_FIELD_SELECT_OPTIONS = PVC_FIELD_META.map((item) => ({
  value: item.key,
  label: item.label,
  iconHint: 'Öğrenci',
}));

export const PVC_CODE_SRC_SELECT_OPTIONS = PVC_CODE_SOURCE_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label,
  iconHint: 'Kod',
}));

export const PVC_FONT_OPTIONS = [
  { value: 'sans', label: 'Modern Sans (Inter)' },
  { value: 'serif', label: 'Akademik Serif (Georgia)' },
  { value: 'display', label: 'Dinamik Display' },
  { value: 'mono', label: 'Teknik Mono (Kod)' },
];

export const PVC_WEIGHT_OPTIONS = [
  { value: '400', label: 'Normal (400)' },
  { value: '500', label: 'Orta (500)' },
  { value: '600', label: 'Yarı Kalın (600)' },
  { value: '700', label: 'Kalın (700)' },
  { value: '800', label: 'Ekstra Kalın (800)' },
];

export const PVC_PHOTO_SHAPE_OPTIONS: ReadonlyArray<{ id: PvcPhotoShape; label: string }> = [
  { id: 'rect', label: 'Kare' },
  { id: 'rounded', label: 'Yumuşak' },
  { id: 'circle', label: 'Daire' },
  { id: 'arch', label: 'Kemer' },
  { id: 'hexagon', label: 'Altıgen' },
];

export const PVC_SHAPE_VARIANT_OPTIONS: ReadonlyArray<{ id: PvcShapeVariant; label: string }> = [
  { id: 'rect', label: 'Kutu' },
  { id: 'circle', label: 'Daire' },
  { id: 'wave', label: 'Dalga' },
  { id: 'diagonal', label: 'Çapraz' },
  { id: 'line', label: 'Çizgi' },
];
