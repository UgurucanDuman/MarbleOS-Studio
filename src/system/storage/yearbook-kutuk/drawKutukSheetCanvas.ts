import { mmToPx, PRINT_DPI } from '../binaryPrintFormats';
import { DEFAULT_PRINT_FONT_PT, type PrintFontPoint } from '../printTypography';
import type { TeacherChartPalette } from '../teacher-charts/types';
import {
  DEFAULT_KUTUK_NAME_BOX_STYLE,
  DEFAULT_KUTUK_PHOTO_FRAME,
} from './catalog';
import { paintKutukStudentCell } from './drawKutukCardCell';
import {
  paintKutukSheetFooter,
  paintKutukSheetHeader,
} from './drawKutukSheetChrome';
import { computeKutukGridMetrics } from './kutukGridMetrics';
import { isKutukStaffBranchName, type KutukStudentLike } from './staffDirectory';
import type {
  KutukNameBoxStyle,
  KutukPhotoFrame,
  KutukResolvedPage,
} from './types';

/**
 * İZOLE SİSTEM 300 DPI TUVAL BESTECİSİ: İdareci Kütük & Sınıf Albümü İç Sayfası (Dikey & Yatay A4)
 * Canlı önizleme ile birebir aynı kutukGridMetrics milimetrik yerleşimini kullanır.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function paintKutukClassSheet(options: {
  ctx: CanvasRenderingContext2D;
  widthPx: number;
  heightPx: number;
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  palette: TeacherChartPalette;
  schoolName: string;
  headerTitle?: string;
  nameBoxStyle?: KutukNameBoxStyle;
  photoFrame?: KutukPhotoFrame;
  frameColor?: string;
  showStudentNumbers: boolean;
  showTeacherBadge: boolean;
  showHeader?: boolean;
  showSubtitle?: boolean;
  showStaffPortraits: boolean;
  showTeacherSig?: boolean;
  showDeputySig?: boolean;
  showPrincipalSig?: boolean;
  showPageNumber?: boolean;
  printFontPt?: PrintFontPoint;
  pageNumber: number;
  totalPages: number;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  logoBitmap?: HTMLCanvasElement | null;
  principalSigBitmap?: HTMLCanvasElement | null;
  deputySigBitmap?: HTMLCanvasElement | null;
}): void {
  const {
    ctx, widthPx, heightPx, page, palette, schoolName,
    headerTitle = '',
    nameBoxStyle = DEFAULT_KUTUK_NAME_BOX_STYLE,
    photoFrame = DEFAULT_KUTUK_PHOTO_FRAME,
    frameColor = '',
    showStudentNumbers, showTeacherBadge,
    showHeader = true, showSubtitle = true, showStaffPortraits,
    showTeacherSig = true, showDeputySig = true, showPrincipalSig = true, showPageNumber = true,
    printFontPt = DEFAULT_PRINT_FONT_PT, pageNumber, totalPages,
    renderedPortraits, logoBitmap, principalSigBitmap, deputySigBitmap,
  } = options;

  const isLandscape = page.landscape;
  const cols = page.template.cols;
  const rows = page.template.rows;
  const hasFooter = showTeacherSig || showDeputySig || showPrincipalSig || showPageNumber;
  const metrics = computeKutukGridMetrics({
    landscape: isLandscape,
    cols,
    rows,
    hasHeader: showHeader,
    hasSubtitle: showSubtitle,
    hasFooter,
    printFontPt,
  });

  const px = (mm: number) => Math.round(mmToPx(mm, PRINT_DPI));
  const frameHex =
    frameColor && /^#[0-9a-fA-F]{6}$/.test(frameColor) ? frameColor : palette.accent;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (!isLandscape) {
    ctx.strokeStyle = palette.gridHairline;
    ctx.lineWidth = Math.max(1, px(0.18));
    ctx.setLineDash?.([px(1.6), px(1.4)]);
    ctx.beginPath();
    ctx.moveTo(px(6.8), px(metrics.topMm));
    ctx.lineTo(px(6.8), px(metrics.paperHMm - metrics.bottomMm));
    ctx.stroke();
    ctx.setLineDash?.([]);
  }

  const contentX = px(metrics.leftMm);
  const contentW = px(metrics.paperWMm - metrics.leftMm - metrics.rightMm);
  const headY = px(metrics.topMm);
  const headH = px(metrics.headHMm);

  if (showHeader) {
    paintKutukSheetHeader({
      ctx, px, contentX, contentW, headY, headH, page, palette,
      schoolName, headerTitle, showSubtitle, showTeacherBadge, showStaffPortraits,
      renderedPortraits, logoBitmap,
    });
  }

  const footH = px(metrics.footHMm);
  const footY = px(metrics.paperHMm - metrics.bottomMm) - footH;
  const gridTop = headY + headH + px(metrics.gridTopGapMm);

  const gapX = px(metrics.gapXMm);
  const gapY = px(metrics.gapYMm);
  const cardW = px(metrics.cardWMm);
  const cardH = px(metrics.cardHMm);
  const totalGridW = cols * cardW + (cols - 1) * gapX;
  const gridStartX = Math.round(contentX + Math.max(0, (contentW - totalGridW) / 2));

  const namePx = Math.max(11, px(metrics.nameFontMm));
  const numPx = Math.max(10, px(metrics.numFontMm));
  const captionH = px(metrics.captionMm);
  const cardRadiusPx = px(metrics.cardRadiusMm);
  const isStaffClass = isKutukStaffBranchName(page.className);

  page.items.forEach(({ student }, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    if (row >= rows) return;
    paintKutukStudentCell({
      ctx,
      px,
      cx: Math.round(gridStartX + col * (cardW + gapX)),
      cy: Math.round(gridTop + row * (cardH + gapY)),
      cw: cardW,
      ch: cardH,
      cardWMm: metrics.cardWMm,
      cols,
      nameFontMm: metrics.nameFontMm,
      namePx,
      numPx,
      captionH,
      cardRadiusPx,
      student,
      isStaffClass,
      showStudentNumbers,
      nameBoxStyle,
      photoFrame,
      frameHex,
      palette,
      renderedPortraits,
    });
  });

  if (hasFooter) {
    paintKutukSheetFooter({
      ctx, px, contentX, contentW, footY, page, palette,
      showTeacherBadge, showTeacherSig, showDeputySig, showPrincipalSig, showPageNumber,
      pageNumber, totalPages, principalSigBitmap, deputySigBitmap,
    });
  }
  ctx.restore();
}
