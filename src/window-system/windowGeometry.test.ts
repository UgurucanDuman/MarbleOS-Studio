import {
  createTiledWindowLayouts,
  getSmartWindowColumns,
  resolvePresetNormalizedBounds,
} from './windowGeometry';

/**
 * İZOLE PENCERE SİSTEMİ TESTİ: MerbleOS Akıllı Böl (`createTiledWindowLayouts`) & Ekran Bölme Testi
 * Dosya Sınırı Kuralı: .ts <= 250 satır.
 */
export function runWindowGeometryUnitTests(): boolean {
  const cols2 = getSmartWindowColumns(2, 1920);
  if (cols2 !== 2) throw new Error('2 pencere için 2 sütun dönmeli');

  const cols3Wide = getSmartWindowColumns(3, 1920);
  if (cols3Wide !== 3) throw new Error('Geniş ekranda 3 pencere için 3 sütun dönmeli');

  const layouts = createTiledWindowLayouts(['excel-list', 'photo-studio'] as const, 2);
  const left = layouts['excel-list'];
  const right = layouts['photo-studio'];
  if (!left || !right || right.x <= left.x) {
    throw new Error('Akıllı Böl 2 pencereyi sol ve sağ olarak ayırmalı');
  }

  const presetBounds = resolvePresetNormalizedBounds('top-left');
  if (presetBounds.w <= 0 || presetBounds.h <= 0) {
    throw new Error('Çeyrek ekran bölme koordinatları pozitif olmalı');
  }

  return true;
}

test('existing tiling and snap contracts', runWindowGeometryUnitTests);

import { expect, test } from 'vitest';

const screens = [
  { vw: 1366, vh: 768 }, { vw: 1920, vh: 1080 }, { vw: 2560, vh: 1440 },
];
const cases = screens.flatMap((size) => [2, 3, 4].map((count) => ({ ...size, count })));
test.each(cases)('$count tiles fit without overlap at $vw × $vh', ({ vw, vh, count }) => {
  const ids = ['a', 'b', 'c', 'd'].slice(0, count);
  const layouts = createTiledWindowLayouts(ids, getSmartWindowColumns(count, vw), { vw, vh });
  const rectangles = ids.map((id) => layouts[id]!);
  for (const rect of rectangles) {
    expect(rect.x * vw).toBeGreaterThanOrEqual(15.99);
    expect(rect.y * vh).toBeGreaterThanOrEqual(83.99);
    expect((rect.x + rect.w) * vw).toBeLessThanOrEqual(vw - 15.99);
    expect((rect.y + rect.h) * vh).toBeLessThanOrEqual(vh - 103.99);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  }
  for (let a = 0; a < rectangles.length; a++) {
    for (let b = a + 1; b < rectangles.length; b++) {
      const first = rectangles[a];
      const second = rectangles[b];
      expect(first.x + first.w <= second.x || second.x + second.w <= first.x ||
        first.y + first.h <= second.y || second.y + second.h <= first.y).toBe(true);
    }
  }
});
