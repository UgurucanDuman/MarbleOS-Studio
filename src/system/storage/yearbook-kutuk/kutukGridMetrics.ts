import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';

/**
 * İZOLE SİSTEM GEOMETRİSİ: Canlı A4 Önizleme & 300 DPI Baskı Ortak Kütük Izgara Ölçü Motoru
 * - Tüm kartlarda eşit isim kutusu yüksekliği ve dengeli portre oranı (asla aşağıya uzatmaz).
 * - Yatay A4'te dar kenar payları ve sıkı aralıklarla 40–50 portreye kadar boşluksuz yerleşim sağlar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface KutukGridMetrics {
  paperWMm: number;
  paperHMm: number;
  leftMm: number;
  rightMm: number;
  topMm: number;
  bottomMm: number;
  headHMm: number;
  footHMm: number;
  gridTopGapMm: number;
  gridBottomGapMm: number;
  gapXMm: number;
  gapYMm: number;
  cardWMm: number;
  cardHMm: number;
  captionMm: number;
  photoHMm: number;
  nameFontMm: number;
  numFontMm: number;
  cardRadiusMm: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function computeKutukGridMetrics(options: {
  landscape: boolean;
  cols: number;
  rows: number;
  hasHeader: boolean;
  hasSubtitle: boolean;
  hasFooter: boolean;
  printFontPt?: PrintFontPoint;
}): KutukGridMetrics {
  const {
    landscape,
    cols,
    rows,
    hasHeader,
    hasSubtitle,
    hasFooter,
    printFontPt = DEFAULT_PRINT_FONT_PT,
  } = options;

  const paperWMm = landscape ? 297 : 210;
  const paperHMm = landscape ? 210 : 297;
  // Ofis yazıcıların 6.35 mm tutucu payını korurken kenar israfını en aza indirir
  const leftMm = landscape ? 7.2 : 10.6;
  const rightMm = landscape ? 7.2 : 7.0;
  const topMm = landscape ? 5.6 : 6.4;
  const bottomMm = landscape ? 5.6 : 6.4;

  const headHMm = !hasHeader
    ? 0
    : landscape
      ? hasSubtitle ? 15.8 : 12.6
      : hasSubtitle ? 19.2 : 15.6;
  const footHMm = hasFooter ? (landscape ? 10.0 : 12.0) : 0;
  const gridTopGapMm = hasHeader ? (landscape ? 1.8 : 2.2) : 0;
  const gridBottomGapMm = hasFooter ? (landscape ? 1.6 : 2.0) : 0;

  const contentWMm = paperWMm - leftMm - rightMm;
  const availGridHMm = paperHMm - topMm - bottomMm - headHMm - gridTopGapMm - footHMm - gridBottomGapMm;

  const gapXMm = landscape
    ? cols >= 9 ? 1.25 : cols >= 7 ? 1.45 : 1.7
    : cols >= 7 ? 1.45 : cols === 6 ? 1.7 : 2.0;
  const gapYMm = landscape
    ? rows >= 5 ? 1.3 : 1.55
    : rows >= 7 ? 1.45 : rows === 6 ? 1.7 : 2.0;

  const maxCellW = (contentWMm - (cols - 1) * gapXMm) / cols;
  const maxCellH = (availGridHMm - (rows - 1) * gapYMm) / rows;

  // Font ve isim kutusu yüksekliği sütun genişliğine göre dengelenir; satır içi tüm kartlarda sabit kalır
  const fontScale = printFontPt / DEFAULT_PRINT_FONT_PT;
  const widthFactor = Math.min(1.06, Math.max(0.72, maxCellW / 32));
  const rowFactor = rows >= 7 ? 0.88 : rows === 6 ? 0.94 : 1.0;
  const density = Math.max(0.68, Math.min(1.06, widthFactor * rowFactor));
  const nameFontMm = r2(Math.max(1.48, Math.min(2.38, 2.18 * fontScale * density)));
  const numFontMm = r2(Math.max(1.36, nameFontMm * 0.92));

  // Sabit kilitli isim kutusu: Okul No + 2 satır tam ad soyad her zaman eşit yükseklikte kalır
  const rawCaptionMm = nameFontMm * 2.95 + 0.95;
  const captionMm = r2(Math.max(4.7, Math.min(rawCaptionMm, maxCellH * 0.255)));

  // Portre en/boy oranı sınırları: ne aşağıya sünmüş dar şerit (min 0.74) ne de yatık kutu (max 0.90)
  const MIN_PORTRAIT_RATIO = 0.74;
  const MAX_PORTRAIT_RATIO = 0.9;

  const maxPhotoH = Math.max(10, maxCellH - captionMm);
  let cardWMm = maxCellW;
  let photoHMm = maxPhotoH;

  if (cardWMm / photoHMm > MAX_PORTRAIT_RATIO) {
    cardWMm = Math.min(maxCellW, photoHMm * MAX_PORTRAIT_RATIO);
  }
  if (cardWMm / photoHMm < MIN_PORTRAIT_RATIO) {
    photoHMm = Math.min(maxPhotoH, cardWMm / MIN_PORTRAIT_RATIO);
  }

  const cardHMm = r2(photoHMm + captionMm);
  const cardRadiusMm = r2(Math.max(1.0, Math.min(1.55, cardWMm * 0.052)));

  return {
    paperWMm,
    paperHMm,
    leftMm,
    rightMm,
    topMm,
    bottomMm,
    headHMm,
    footHMm,
    gridTopGapMm,
    gridBottomGapMm,
    gapXMm,
    gapYMm,
    cardWMm: r2(cardWMm),
    cardHMm,
    captionMm,
    photoHMm: r2(photoHMm),
    nameFontMm,
    numFontMm,
    cardRadiusMm,
  };
}
