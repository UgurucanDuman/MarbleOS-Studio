import type { AlbumTemplateConfig } from '../../system/sqlite/types';
import { mmToPx, PRINT_DPI, type PdfRasterPage } from '../../system/storage/binaryPrintFormats';
import { canvasToJpegBytes } from '../../system/storage/portraitPrintRenderer';
import { decodeImageUrlToCanvas } from '../../system/storage/printImageDecode';
import { paintTeacherBookletSheet } from '../../system/storage/teacher-charts/drawBookletCanvas';
import {
  paintTeacherTabularSheet,
  type TabularCanvasStudent,
} from '../../system/storage/teacher-charts/drawTabularCanvas';
import {
  buildBookletA4Sheets,
  paginateTabularRoster,
  resolveTeacherChartConfig,
} from '../../system/storage/teacher-charts/paginationMath';
import { safePrintAccentColor } from './idCardSheetComposer';
import type { ImpositionPage } from './printSpecs';
import { drawCalibrationRuler, isStaffStudentNumber } from './sheetComposer';

/**
 * İZOLE MODÜL 04 ALBÜM, ÖĞRETMEN ÇİZELGESİ & CEP FORMASI BESTECİSİ:
 * A4 Dikey Öğretmen Çizelgesi / Cep Defteri / ŞÖK / Cep Albümü ve A4 Yatay Yıllık sayfalarını 300 DPI işler.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export async function renderAlbumChartPageToPdfRaster(options: {
  page: ImpositionPage;
  totalPages: number;
  schoolName: string;
  albumConfig: AlbumTemplateConfig;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  showCropMarks?: boolean;
  sheetCanvas?: HTMLCanvasElement;
}): Promise<PdfRasterPage> {
  const {
    page,
    totalPages,
    schoolName,
    albumConfig,
    renderedPortraits,
    showCropMarks = false,
    sheetCanvas,
  } = options;
  const canvas = sheetCanvas ?? document.createElement('canvas');
  if (canvas.width !== page.widthPx || canvas.height !== page.heightPx) {
    canvas.width = page.widthPx;
    canvas.height = page.heightPx;
  }
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx) throw new Error('Sınıf panosu tuvali başlatılamadı.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const isPortraitTeacherDoc = page.widthMm < page.heightMm;
  if (isPortraitTeacherDoc) {
    const { template, palette, courseName } = resolveTeacherChartConfig(albumConfig, page.titleLabel);
    const sourceEntries = page.rosterEntries ?? page.slots.map((s) => s.entry);
    const mappedRoster: TabularCanvasStudent[] = sourceEntries.map((item) => ({
      photoId: item.photo.id,
      studentNumber: item.student.studentNumber,
      firstName: item.student.firstName,
      lastName: item.student.lastName,
    }));
    const subIdx = page.subPageIndex ?? 0;
    const subTotal = page.subTotalPages ?? totalPages;

    if (template.engine === 'tabular-gradebook' || template.engine === 'tabular-sok') {
      const paginated = paginateTabularRoster(mappedRoster, template);
      const target = paginated[subIdx] ?? paginated[0];
      paintTeacherTabularSheet({
        ctx,
        widthPx: canvas.width,
        heightPx: canvas.height,
        template,
        palette,
        schoolName,
        academicYear: page.academicYear || '2026-2027',
        className: page.titleLabel || 'ŞUBE',
        teacherName: page.teacherLabel || '',
        courseName,
        showStudentNumbers: albumConfig.showStudentNumbers,
        showTeacherBadge: albumConfig.showTeacherBadge,
        printFontPt: albumConfig.printFontPt,
        pageNumber: subIdx + 1,
        totalPages: subTotal,
        leftColumn: target?.leftColumn ?? [],
        rightColumn: target?.rightColumn ?? [],
        renderedPortraits,
      });
    } else {
      const isAlbum = template.engine === 'booklet-album-inner' || template.engine === 'booklet-album-cover';
      const isCover = template.engine === 'booklet-gradebook-front' || template.engine === 'booklet-album-cover';
      const customCoverBitmap = isCover ? await decodeImageUrlToCanvas(albumConfig.customCoverDataUrl) : null;
      const bookletSheets =
        template.studentsPerPage > 0
          ? buildBookletA4Sheets(mappedRoster, isAlbum ? 12 : 5, isAlbum ? 2 : 3, !isAlbum)
          : [];
      paintTeacherBookletSheet({
        ctx,
        widthPx: canvas.width,
        heightPx: canvas.height,
        template,
        palette,
        schoolName,
        academicYear: page.academicYear || '2026-2027',
        className: page.titleLabel || 'ŞUBE',
        teacherName: page.teacherLabel || '',
        courseName,
        coverTitle: albumConfig.coverTitle,
        coverSubtitle: albumConfig.coverSubtitle,
        customCoverBitmap,
        customCoverMode: albumConfig.customCoverMode,
        showStudentNumbers: albumConfig.showStudentNumbers,
        printFontPt: albumConfig.printFontPt,
        strips: bookletSheets[subIdx]?.strips ?? [],
        renderedPortraits,
      });
    }

    if (showCropMarks) {
      drawCalibrationRuler(ctx, canvas.width, canvas.height, page.rulerLengthMm, false);
    }
    const jpegBytes = await canvasToJpegBytes(canvas, 0.95, PRINT_DPI);
    return {
      jpegBytes,
      pixelWidth: page.widthPx,
      pixelHeight: page.heightPx,
      widthMm: page.widthMm,
      heightMm: page.heightMm,
    };
  }

  // A4 Yatay Yıllık / Sınıf Panosu
  const accent = safePrintAccentColor(albumConfig.accentColor);
  const { palette: landscapePalette } = resolveTeacherChartConfig(albumConfig, page.titleLabel);
  const landscapeFontScale = (albumConfig.printFontPt ?? 8) / 8;
  const pad = mmToPx(11, PRINT_DPI);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = accent;
  ctx.fillRect(pad, mmToPx(9, PRINT_DPI), canvas.width - pad * 2, mmToPx(1.1, PRINT_DPI));

  ctx.fillStyle = '#09090b';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `700 ${mmToPx(3.6, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText(schoolName, pad, mmToPx(12.5, PRINT_DPI), canvas.width - pad * 3);

  ctx.fillStyle = '#52525b';
  ctx.font = `500 ${mmToPx(2.3, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText(albumConfig.headerTitle || 'Eğitim Öğretim Yılı Sınıf Panosu', pad, mmToPx(18, PRINT_DPI));

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = `700 ${mmToPx(3.8, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText(page.titleLabel || '', canvas.width - pad, mmToPx(12.5, PRINT_DPI));
  if (albumConfig.showTeacherBadge && page.teacherLabel) {
    ctx.fillStyle = '#3f3f46';
    ctx.font = `500 ${mmToPx(2.2, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.fillText(`Rehber Öğrt.: ${page.teacherLabel}`, canvas.width - pad, mmToPx(18.2, PRINT_DPI));
  }

  for (const slot of page.slots) {
    const x = mmToPx(slot.xMm, PRINT_DPI);
    const y = mmToPx(slot.yMm, PRINT_DPI);
    const w = mmToPx(slot.widthMm, PRINT_DPI);
    const h = mmToPx(slot.heightMm, PRINT_DPI);
    const stu = slot.entry.student;
    const isStaff = isStaffStudentNumber(stu.studentNumber);

    const portrait = renderedPortraits.get(slot.entry.photo.id);
    if (portrait) ctx.drawImage(portrait, x, y, w, h);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = Math.max(1, mmToPx(0.2, PRINT_DPI));
    ctx.strokeRect(x, y, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = landscapePalette.inkPrimary;
    ctx.font = `600 ${mmToPx(1.95 * landscapeFontScale, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.fillText(`${stu.firstName} ${stu.lastName}`, Math.round(x + w / 2), y + h + mmToPx(1.1, PRINT_DPI), w + mmToPx(3, PRINT_DPI));

    const sub = isStaff
      ? (stu.isPrincipal ? 'Okul Müdürü' : (stu.role || 'Öğretmen'))
      : (albumConfig.showStudentNumbers ? stu.studentNumber : '');
    if (sub) {
      ctx.fillStyle = '#52525b';
      ctx.font = `500 ${mmToPx(1.75, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
      ctx.fillText(sub, Math.round(x + w / 2), y + h + mmToPx(3.8, PRINT_DPI), w);
    }
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#71717a';
  ctx.font = `500 ${mmToPx(1.9, PRINT_DPI)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText(`Sayfa ${page.pageIndex + 1} / ${totalPages}`, canvas.width - pad, canvas.height - mmToPx(8, PRINT_DPI));

  if (showCropMarks) {
    drawCalibrationRuler(ctx, canvas.width, canvas.height, page.rulerLengthMm, false);
  }
  ctx.restore();

  const jpegBytes = await canvasToJpegBytes(canvas, 0.95, PRINT_DPI);
  return {
    jpegBytes,
    pixelWidth: page.widthPx,
    pixelHeight: page.heightPx,
    widthMm: page.widthMm,
    heightMm: page.heightMm,
  };
}
