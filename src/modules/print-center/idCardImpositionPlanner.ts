import type { PrintDuplexMode, PrintOrientation } from '../../system/desktop/desktopPrinter';
import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { mmToPx, PRINT_DPI } from '../../system/storage/binaryPrintFormats';
import {
  DEFAULT_PVC_PRINT_SIDES,
  resolvePvcCardDesign,
} from '../../system/storage/pvc-cards/catalog';
import type { PvcCardSide } from '../../system/storage/pvc-cards/types';
import type { ImpositionPage, PrintableStudentEntry } from './printSpecs';

/**
 * İZOLE MODÜL 04 PVC KİMLİK KARTI DİZGİ PLANLAYICISI:
 * A4 tabakasında Otomatik veya 5 / 6 / 8 / 9 / 10'lu (2×5 Dragon Sheet dahil) ve tekli CR80 kartlarda
 * Tek Yüz / Çift Yüz (aynalanmış arka yüz) baskı sayfalarını planlar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const PVC_A4_CARDS_PER_PAGE_CHOICES = [5, 6, 8, 9, 10] as const;

interface A4GridPlan {
  cols: number;
  rows: number;
  perPage: number;
  gapX: number;
  gapY: number;
  leftMm: number;
  topMm: number;
  rulerLengthMm: number;
}

function resolveA4IdGrid(options: {
  paperW: number;
  paperH: number;
  cardW: number;
  cardH: number;
  isPortraitCard: boolean;
  isLandscapeSheet: boolean;
  isStdCr80: boolean;
  requestedPerPage?: number;
}): A4GridPlan {
  const { paperW, paperH, cardW, cardH, isPortraitCard, isLandscapeSheet, isStdCr80, requestedPerPage } = options;
  const minMargin = 6.5;
  const minGap = 2.6;
  const maxCols = Math.max(1, Math.floor((paperW - minMargin * 2 + minGap) / (cardW + minGap)));
  const maxRows = Math.max(1, Math.floor((paperH - minMargin * 2 + minGap) / (cardH + minGap)));
  const maxCap = maxCols * maxRows;

  // Varsayılan (Otomatik): mevcut standart 8'li / 9'lu / 10'lu A4 ölçülerini birebir korur
  if (!requestedPerPage) {
    const gapX = isStdCr80 ? (isLandscapeSheet ? (isPortraitCard ? 3.6 : 8) : 8) : 6;
    const gapY = isStdCr80 ? (isLandscapeSheet ? (isPortraitCard ? 10 : 8) : (isPortraitCard ? 5 : 10)) : 6;
    const cols = isStdCr80
      ? (isLandscapeSheet ? (isPortraitCard ? 5 : 3) : (isPortraitCard ? 3 : 2))
      : Math.max(1, Math.floor((paperW - 14 + gapX) / (cardW + gapX)));
    const rows = isStdCr80
      ? (isLandscapeSheet ? (isPortraitCard ? 2 : 3) : (isPortraitCard ? 3 : 4))
      : Math.max(1, Math.floor((paperH - 24 + gapY) / (cardH + gapY)));
    const leftMm = Number(Math.max(0, (paperW - (cols * cardW + (cols - 1) * gapX)) / 2).toFixed(2));
    const topMm = isStdCr80
      ? (isLandscapeSheet ? (isPortraitCard ? 14 : 16) : (isPortraitCard ? 13 : 21))
      : Number(Math.max(10, (paperH - (rows * cardH + (rows - 1) * gapY)) / 2).toFixed(2));
    return { cols, rows, perPage: cols * rows, gapX, gapY, leftMm, topMm, rulerLengthMm: 50 };
  }

  const perPage = Math.max(1, Math.min(Math.round(requestedPerPage), maxCap));

  // Hedef adede en az boş hücre bırakarak sığan dengeli (cols, rows) çiftini seç
  let bestCols = maxCols;
  let bestRows = maxRows;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let c = 1; c <= maxCols; c += 1) {
    const r = Math.ceil(perPage / c);
    if (r > maxRows) continue;
    const waste = c * r - perPage;
    // Dikeyde 2 sütunlu, yatayda çok sütunlu ferah dizgiyi tercih et
    const shapePenalty = isLandscapeSheet ? r * 0.3 : Math.abs(c - Math.min(maxCols, 2)) * 0.25;
    const score = waste * 10 + shapePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestCols = c;
      bestRows = r;
    }
  }

  const maxAvailGapX = bestCols > 1 ? (paperW - minMargin * 2 - bestCols * cardW) / (bestCols - 1) : 0;
  const maxAvailGapY = bestRows > 1 ? (paperH - minMargin * 2 - bestRows * cardH) / (bestRows - 1) : 0;
  const preferredGapX = bestCols >= 5 ? 3.4 : 8;
  const preferredGapY = bestRows >= 5 ? 2.8 : bestRows === 4 ? 10 : 12;
  const gapX = bestCols > 1 ? Number(Math.max(minGap, Math.min(preferredGapX, maxAvailGapX)).toFixed(2)) : 0;
  const gapY = bestRows > 1 ? Number(Math.max(minGap, Math.min(preferredGapY, maxAvailGapY)).toFixed(2)) : 0;

  const totalW = bestCols * cardW + (bestCols - 1) * gapX;
  const totalH = bestRows * cardH + (bestRows - 1) * gapY;
  const leftMm = Number(Math.max(0, (paperW - totalW) / 2).toFixed(2));
  const rawTop = (paperH - totalH) / 2;
  const topMm = Number(Math.max(minMargin, rawTop).toFixed(2));
  // 10'lu (2×5) gibi dikeyde 280+ mm dolu sayfalarda 50 mm cetveli kartlara çakışmasın
  const rulerLengthMm = topMm >= 12 && paperH - (topMm + totalH) >= 12 ? 50 : 0;

  return { cols: bestCols, rows: bestRows, perPage, gapX, gapY, leftMm, topMm, rulerLengthMm };
}

export function planIdCardPages(
  entries: readonly PrintableStudentEntry[],
  isSingleCard: boolean,
  albumConfig?: Partial<AlbumTemplateConfig>,
  orientation: PrintOrientation = 'portrait',
  duplex?: PrintDuplexMode,
): ImpositionPage[] {
  const design = resolvePvcCardDesign(albumConfig ?? {});
  const isPortraitCard = design.orientation === 'portrait';
  const cardW = design.widthMm;
  const cardH = design.heightMm;
  const cfgSides = albumConfig?.pvcPrintSides ?? DEFAULT_PVC_PRINT_SIDES;
  const effectiveSides = duplex === undefined
    ? cfgSides
    : duplex !== 'simplex'
      ? 'front-and-back'
      : cfgSides === 'back-only'
        ? 'back-only'
        : 'front-only';
  const sidesToEmit: readonly PvcCardSide[] =
    effectiveSides === 'front-and-back'
      ? ['front', 'back']
      : effectiveSides === 'back-only'
        ? ['back']
        : ['front'];

  const isLandscapeSheet = !isSingleCard && orientation === 'landscape';
  const paperW = isSingleCard ? cardW : isLandscapeSheet ? 297 : 210;
  const paperH = isSingleCard ? cardH : isLandscapeSheet ? 210 : 297;
  const isStdCr80 =
    (Math.abs(cardW - 85.6) < 0.2 && Math.abs(cardH - 54) < 0.2) ||
    (Math.abs(cardW - 54) < 0.2 && Math.abs(cardH - 85.6) < 0.2);

  const grid: A4GridPlan = isSingleCard
    ? { cols: 1, rows: 1, perPage: 1, gapX: 0, gapY: 0, leftMm: 0, topMm: 0, rulerLengthMm: 0 }
    : resolveA4IdGrid({
        paperW,
        paperH,
        cardW,
        cardH,
        isPortraitCard,
        isLandscapeSheet,
        isStdCr80,
        requestedPerPage: albumConfig?.pvcCardsPerPage,
      });

  const pages: ImpositionPage[] = [];
  for (let offset = 0; offset < entries.length; offset += grid.perPage) {
    const chunk = entries.slice(offset, offset + grid.perPage);
    for (const side of sidesToEmit) {
      // Çift yüz A4 tabakasında arka yüz sütunları yatay aynalanır (kağıt çevrildiğinde ön/arka birebir örtüşür).
      const mirrorCols = !isSingleCard && side === 'back' && effectiveSides === 'front-and-back';
      pages.push({
        pageIndex: pages.length,
        kind: 'id-card-sheet',
        cardSide: side,
        titleLabel: `${design.name} · ${side === 'back' ? 'Arka Yüz' : 'Ön Yüz'}`,
        widthMm: paperW,
        heightMm: paperH,
        widthPx: mmToPx(paperW, PRINT_DPI),
        heightPx: mmToPx(paperH, PRINT_DPI),
        cols: grid.cols,
        rows: grid.rows,
        rulerLengthMm: grid.rulerLengthMm,
        slots: chunk.map((entry, idx) => {
          const rawCol = idx % grid.cols;
          const col = mirrorCols ? grid.cols - 1 - rawCol : rawCol;
          const row = Math.floor(idx / grid.cols);
          return {
            entry,
            xMm: Number((grid.leftMm + col * (cardW + grid.gapX)).toFixed(2)),
            yMm: Number((grid.topMm + row * (cardH + grid.gapY)).toFixed(2)),
            widthMm: cardW,
            heightMm: cardH,
          };
        }),
      });
    }
  }
  return pages;
}
