import { drawChartLine, drawRotatedLabel } from './canvasPrimitives';
import type { TeacherChartPalette, TeacherDocEngineKind } from './types';

/**
 * İZOLE 300 DPI CEP KİTAPÇIĞI KAPAK & DERS PROGRAMI ÇİZİCİSİ:
 * Kurumsal veya Özel Tasarım (Tam Kapak / Orta Amblem) Ön Kapak + Sabah/Öğlen Haftalık Ders Programı.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function drawBookletFrontCoverStrip(options: {
  ctx: CanvasRenderingContext2D;
  rightX: number;
  halfW: number;
  innerY: number;
  innerH: number;
  engine: TeacherDocEngineKind;
  palette: TeacherChartPalette;
  schoolName: string;
  academicYear: string;
  className: string;
  teacherName: string;
  courseName: string;
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverBitmap?: ImageBitmap | HTMLCanvasElement | null;
  customCoverMode?: 'full-bleed' | 'emblem';
  px: (mm: number) => number;
}): void {
  const {
    ctx, rightX, halfW, innerY, innerH, engine, palette, schoolName, academicYear,
    className, teacherName, courseName, coverTitle, coverSubtitle, customCoverBitmap, customCoverMode, px,
  } = options;

  if (customCoverBitmap && (customCoverMode ?? 'full-bleed') === 'full-bleed') {
    ctx.drawImage(customCoverBitmap, rightX, innerY, halfW, innerH);
    return;
  }

  ctx.strokeStyle = palette.gridHairline;
  ctx.lineWidth = Math.max(1, px(0.2));
  ctx.strokeRect(rightX + px(1.5), innerY + px(1.5), halfW - px(3), innerH - px(3));

  const cx = rightX + halfW / 2;
  ctx.fillStyle = palette.inkPrimary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${px(3.0)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText((schoolName || 'OKUL ADI').toLocaleUpperCase('tr-TR'), cx, innerY + innerH * 0.16, halfW - px(6));

  if (customCoverBitmap && customCoverMode === 'emblem') {
    const maxEmblemW = halfW * 0.36;
    const maxEmblemH = innerH * 0.28;
    const scale = Math.min(maxEmblemW / Math.max(1, customCoverBitmap.width), maxEmblemH / Math.max(1, customCoverBitmap.height));
    const ew = customCoverBitmap.width * scale;
    const eh = customCoverBitmap.height * scale;
    ctx.drawImage(customCoverBitmap, cx - ew / 2, innerY + innerH * 0.25, ew, eh);
  }

  const bandY = innerY + innerH * 0.58;
  const bandH = px(6.2);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(rightX + px(5), bandY, halfW - px(10), bandH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${px(2.3)}px Inter, Segoe UI, Arial, sans-serif`;
  const bandLabel = (coverSubtitle ?? '').trim() || `${academicYear || '2026-2027'} Eğitim-Öğretim Yılı`;
  ctx.fillText(bandLabel, cx, bandY + bandH / 2, halfW - px(12));

  ctx.fillStyle = palette.inkPrimary;
  ctx.font = `700 ${px(2.5)}px Inter, Segoe UI, Arial, sans-serif`;
  const defaultMainTitle = engine === 'booklet-album-cover' ? 'Öğretmen Fotoğraf Albümü' : `${className || 'Şube'} Sınıfı`;
  ctx.fillText((coverTitle ?? '').trim() || defaultMainTitle, cx, bandY + bandH + px(5), halfW - px(8));

  if (engine !== 'booklet-album-cover') {
    ctx.font = `500 ${px(1.9)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = palette.inkSecondary;
    ctx.fillText(`Ders: ${courseName || '........................................'}`, cx, bandY + bandH + px(10.2), halfW - px(8));
    ctx.fillText(`Öğretmen: ${teacherName || '....................................'}`, cx, bandY + bandH + px(15), halfW - px(8));
  }
}

export function drawBookletScheduleStrip(options: {
  ctx: CanvasRenderingContext2D;
  leftX: number;
  rightX: number;
  halfW: number;
  innerY: number;
  innerH: number;
  palette: TeacherChartPalette;
  px: (mm: number) => number;
}): void {
  const { ctx, leftX, rightX, halfW, innerY, innerH, palette, px } = options;
  ctx.fillStyle = palette.inkPrimary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${px(2.0)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText('HAFTALIK DERS PROGRAMI', leftX + halfW / 2, innerY + px(2.8));

  const schedTop = innerY + px(5.6);
  const schedH = innerH - px(7);
  const periodW = px(5.2);
  const numW = px(4.6);
  const leadW = periodW + numW;
  const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
  const dayW = (halfW - leadW) / 5;
  const rH = schedH / 13;

  ctx.fillStyle = palette.headerTint;
  ctx.fillRect(leftX, schedTop, halfW, rH);
  ctx.fillStyle = palette.summaryTint;
  ctx.fillRect(leftX, schedTop + rH, periodW, schedH - rH);

  ctx.strokeStyle = palette.gridBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, schedTop, halfW, schedH);
  drawChartLine(ctx, leftX + periodW, schedTop + rH, leftX + periodW, schedTop + schedH, palette.gridBorder, 1);
  drawChartLine(ctx, leftX + leadW, schedTop, leftX + leadW, schedTop + schedH, palette.gridBorder, 1);

  ctx.fillStyle = palette.inkPrimary;
  days.forEach((d, di) => {
    const dx = leftX + leadW + di * dayW;
    if (di > 0) drawChartLine(ctx, dx, schedTop, dx, schedTop + schedH, palette.gridHairline, 1);
    ctx.font = `700 ${px(1.25)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.fillText(d, dx + dayW / 2, schedTop + rH / 2, dayW - px(0.4));
  });

  drawChartLine(ctx, leftX, schedTop + rH, leftX + halfW, schedTop + rH, palette.gridBorder, 1);
  for (let hr = 1; hr <= 12; hr += 1) {
    const ry = schedTop + hr * rH;
    if (hr > 1) {
      const fromX = hr === 7 ? leftX : leftX + periodW;
      drawChartLine(ctx, fromX, ry, leftX + halfW, ry, hr === 7 ? palette.gridBorder : palette.gridHairline, hr === 7 ? 1.3 : 1);
    }
    ctx.font = `600 ${px(1.3)}px Inter, Segoe UI, Arial, sans-serif`;
    ctx.fillText(String(hr <= 6 ? hr : hr - 6), leftX + periodW + numW / 2, ry + rH / 2);
  }
  ctx.font = `700 ${px(1.4)}px Inter, Segoe UI, Arial, sans-serif`;
  drawRotatedLabel(ctx, 'SABAH', leftX + periodW / 2, schedTop + rH + 3 * rH, 5.6 * rH);
  drawRotatedLabel(ctx, 'ÖĞLEN', leftX + periodW / 2, schedTop + 7 * rH + 3 * rH, 5.6 * rH);

  const rcx = rightX + halfW / 2;
  ctx.font = `500 ${px(2.0)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText('Bu "Not Defteri" ........ sayfadır.', rcx, innerY + innerH * 0.25);
  ctx.fillText('Tasdik Olunur', rcx, innerY + innerH * 0.56);
  ctx.font = `700 ${px(2.1)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.fillText('Okul Müdürü', rcx, innerY + innerH * 0.65);
}
