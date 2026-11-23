import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { mmToPx, PRINT_DPI, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { canvasToJpegBytes } from '../../system/storage/portraitPrintRenderer';
import { resolvePvcCardDesign } from '../../system/storage/pvc-cards/catalog';
import { paintPvcCardToCanvas } from '../../system/storage/pvc-cards/drawPvcCardCanvas';
import { resolveTeacherChartConfig } from '../../system/storage/teacher-charts/paginationMath';
import type { DecodedSchoolPrintVisuals, SchoolPrintVisualUrls } from './kutukSheetComposer';
import type { ImpositionPage } from './printSpecs';
import { drawCalibrationRuler, drawCornerCropMarks, isStaffStudentNumber } from './sheetComposer';

/**
 * İZOLE MODÜL 04 KİMLİK SAYFA BESTECİSİ:
 * 5 hazır kurumsal tasarım ve fotoğrafçının kendi özel CR80 PVC Kimlik Kartlarını
 * (85.6×54 / 54×85.6 mm tekli veya A4 8'li/9'lu, ön & arka yüz) 300 DPI JPEG/PDF katmanına işler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function safePrintAccentColor(hex?: string): string {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#2563eb';
}

export async function renderIdCardPageToPdfRaster(options: {
  page: ImpositionPage;
  totalPages: number;
  schoolName: string;
  albumConfig: AlbumTemplateConfig;
  schoolVisuals?: SchoolPrintVisualUrls;
  decodedVisuals?: DecodedSchoolPrintVisuals | null;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  showCropMarks?: boolean;
  sheetCanvas?: HTMLCanvasElement;
}): Promise<PdfRasterPage> {
  const {
    page,
    totalPages,
    schoolName,
    albumConfig,
    schoolVisuals,
    decodedVisuals,
    renderedPortraits,
    showCropMarks = true,
    sheetCanvas,
  } = options;
  const canvas = sheetCanvas ?? document.createElement('canvas');
  if (canvas.width !== page.widthPx || canvas.height !== page.heightPx) {
    canvas.width = page.widthPx;
    canvas.height = page.heightPx;
  }
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Kimlik dizgi tuvali başlatılamadı.');

  const design = resolvePvcCardDesign(albumConfig);
  const { palette } = resolveTeacherChartConfig(albumConfig);
  const side = page.cardSide ?? 'front';
  const isMultiSheet = page.slots.length > 1 || Math.max(page.widthMm, page.heightMm) >= 180;
  const minSlotY = page.slots.reduce((m, s) => Math.min(m, s.yMm), 99);
  const showSheetHeader = isMultiSheet && minSlotY >= 11;
  const minGapY = page.rows > 1 && page.slots.length > page.cols
    ? Math.max(0, (page.slots[page.cols]!.yMm) - (page.slots[0]!.yMm + page.slots[0]!.heightMm))
    : 10;
  const cropTickMm = minGapY < 5.5 ? Math.max(0.8, Math.min(2.4, minGapY * 0.36)) : 2.4;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (showSheetHeader) {
    const hFont = mmToPx(2.3, PRINT_DPI);
    const pad = mmToPx(9, PRINT_DPI);
    const top = mmToPx(5.5, PRINT_DPI);
    const sideLabel = side === 'back' ? 'Arka Yüz' : 'Ön Yüz';
    ctx.fillStyle = '#18181b';
    ctx.font = `600 ${hFont}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${schoolName} · ${design.name} · ${sideLabel} (${design.widthMm}×${design.heightMm} mm)`,
      pad,
      top,
    );
    ctx.fillStyle = '#52525b';
    ctx.textAlign = 'right';
    ctx.fillText(`Sayfa ${page.pageIndex + 1} / ${totalPages}`, canvas.width - pad, top);
  }

  for (const slot of page.slots) {
    const x = mmToPx(slot.xMm, PRINT_DPI);
    const y = mmToPx(slot.yMm, PRINT_DPI);
    const w = mmToPx(slot.widthMm, PRINT_DPI);
    const h = mmToPx(slot.heightMm, PRINT_DPI);
    const stu = slot.entry.student;
    const isStaff = isStaffStudentNumber(stu.studentNumber);

    paintPvcCardToCanvas({
      ctx,
      design,
      side,
      xPx: x,
      yPx: y,
      widthPx: w,
      heightPx: h,
      palette,
      data: {
        schoolName,
        schoolAddress: schoolVisuals?.schoolAddress,
        institutionCode: schoolVisuals?.institutionCode,
        academicYear: slot.entry.classRecord?.academicYear,
        className: slot.entry.className,
        isStaffCard: isStaff,
        student: stu,
        studio: schoolVisuals?.studio,
        backNote: albumConfig.pvcBackNote,
      },
      bitmaps: {
        portrait: renderedPortraits.get(slot.entry.photo.id) ?? null,
        logo: decodedVisuals?.logoBitmap ?? null,
        studioLogo: decodedVisuals?.studioLogoBitmap ?? null,
        principalSig: decodedVisuals?.principalSigBitmap ?? null,
        deputySig: decodedVisuals?.deputySigBitmap ?? null,
        frontBg: decodedVisuals?.pvcFrontBgBitmap ?? null,
        backBg: decodedVisuals?.pvcBackBgBitmap ?? null,
        elementImages: decodedVisuals?.pvcElementBitmaps,
      },
      printFontPt: albumConfig.printFontPt,
      drawOuterBorder: isMultiSheet,
    });

    if (isMultiSheet && showCropMarks) {
      drawCornerCropMarks(ctx, x, y, w, h, undefined, cropTickMm);
    }
  }

  if (isMultiSheet && showCropMarks && page.rulerLengthMm > 0) {
    drawCalibrationRuler(ctx, canvas.width, canvas.height, page.rulerLengthMm, false);
  }
  ctx.restore();

  const jpegBytes = await canvasToJpegBytes(canvas, 0.96, PRINT_DPI);
  return {
    jpegBytes,
    pixelWidth: page.widthPx,
    pixelHeight: page.heightPx,
    widthMm: page.widthMm,
    heightMm: page.heightMm,
  };
}
