import { mmToPx, PRINT_DPI } from '../binaryPrintFormats';
import type { TeacherChartPalette } from '../teacher-charts/types';
import type { KutukStudentLike } from './staffDirectory';
import type { KutukResolvedPage } from './types';

/**
 * İZOLE SİSTEM 300 DPI TUVAL BESTECİSİ: İdareci Kütük & Sınıf Albümü Ön Kapak Sayfası
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const FONT_STACK = 'Inter, "Segoe UI", Arial, sans-serif';

export function paintKutukCoverSheet(options: {
  ctx: CanvasRenderingContext2D;
  widthPx: number;
  heightPx: number;
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  palette: TeacherChartPalette;
  schoolName: string;
  coverTitle?: string;
  coverSubtitle?: string;
  customCoverMode?: 'full-bleed' | 'emblem';
  isCustomHero?: boolean;
  logoBitmap?: HTMLCanvasElement | null;
  heroBitmap?: HTMLCanvasElement | null;
  principalSigBitmap?: HTMLCanvasElement | null;
  deputySigBitmap?: HTMLCanvasElement | null;
}): void {
  const {
    ctx, widthPx, heightPx, page, palette, schoolName,
    coverTitle = '', coverSubtitle = '', customCoverMode = 'emblem', isCustomHero = false,
    logoBitmap, heroBitmap, principalSigBitmap, deputySigBitmap,
  } = options;

  const isLandscape = page.landscape;
  const paperW = isLandscape ? 297 : 210;
  const paperH = isLandscape ? 210 : 297;
  const px = (mm: number) => Math.round(mmToPx(mm, PRINT_DPI));
  const leftMm = isLandscape ? 13 : 15;
  const rightMm = 11;
  const topMm = isLandscape ? 11 : 14;
  const bottomMm = isLandscape ? 11 : 14;

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
    ctx.moveTo(px(8.2), px(topMm));
    ctx.lineTo(px(8.2), px(paperH - bottomMm));
    ctx.stroke();
    ctx.setLineDash?.([]);
  }

  const boxX = px(leftMm);
  const boxY = px(topMm);
  const boxW = px(paperW - leftMm - rightMm);
  const boxH = px(paperH - topMm - bottomMm);
  const centerX = Math.round(boxX + boxW / 2);
  const mainTitle = coverTitle.trim() || 'İDARECİ ÖĞRENCİ KÜTÜK VE SINIF ALBÜM DOSYASI';
  const subTitle = coverSubtitle.trim() || page.scopeTitle;

  if (heroBitmap && isCustomHero && customCoverMode === 'full-bleed') {
    const scale = Math.max(boxW / Math.max(1, heroBitmap.width), boxH / Math.max(1, heroBitmap.height));
    const dw = Math.round(heroBitmap.width * scale);
    const dh = Math.round(heroBitmap.height * scale);
    ctx.drawImage(heroBitmap, Math.round(boxX + (boxW - dw) / 2), Math.round(boxY + (boxH - dh) / 2), dw, dh);

    const plateW = boxW - px(16);
    const plateH = px(34);
    const plateX = boxX + px(8);
    const plateY = boxY + boxH - plateH - px(8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fillRect(plateX, plateY, plateW, plateH);
    ctx.strokeStyle = palette.gridBorder;
    ctx.lineWidth = Math.max(1, px(0.32));
    ctx.strokeRect(plateX, plateY, plateW, plateH);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.inkPrimary;
    ctx.font = `800 ${px(3.6)}px ${FONT_STACK}`;
    ctx.fillText(`${schoolName.toLocaleUpperCase('tr-TR')} · ${page.academicYear}`, centerX, plateY + px(5), plateW - px(8));
    ctx.fillStyle = palette.headingInk;
    ctx.font = `900 ${px(4.5)}px ${FONT_STACK}`;
    ctx.fillText(mainTitle, centerX, plateY + px(12), plateW - px(8));
    ctx.fillStyle = palette.inkSecondary;
    ctx.font = `700 ${px(2.8)}px ${FONT_STACK}`;
    ctx.fillText(`${subTitle} · ${page.totalStudentCount} Öğrenci`, centerX, plateY + px(21), plateW - px(8));

    ctx.strokeStyle = palette.gridBorder;
    ctx.lineWidth = Math.max(2, px(0.45));
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.restore();
    return;
  }

  ctx.strokeStyle = palette.gridBorder;
  ctx.lineWidth = Math.max(2, px(0.45));
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.fillStyle = palette.accent;
  ctx.fillRect(boxX + px(8), boxY + px(7), boxW - px(16), Math.max(2, px(1.2)));

  let cursorY = boxY + px(12);
  if (logoBitmap) {
    const logoSize = px(isLandscape ? 16 : 21);
    ctx.drawImage(logoBitmap, Math.round(centerX - logoSize / 2), cursorY, logoSize, logoSize);
    cursorY += logoSize + px(3.5);
  }

  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = `800 ${px(isLandscape ? 4.8 : 5.0)}px ${FONT_STACK}`;
  ctx.fillText(schoolName.toLocaleUpperCase('tr-TR'), centerX, cursorY, boxW - px(16));
  cursorY += px(7);

  ctx.fillStyle = palette.inkSecondary;
  ctx.font = `700 ${px(2.9)}px ${FONT_STACK}`;
  ctx.fillText(`${page.academicYear} EĞİTİM VE ÖĞRETİM YILI`, centerX, cursorY, boxW - px(16));
  cursorY += px(7.5);

  const statsH = px(19);
  const statsY = boxY + boxH - px(42);
  const availableHeroH = Math.max(px(22), statsY - cursorY - px(22));

  if (heroBitmap) {
    const maxHeroW = Math.round(boxW * 0.66);
    const maxHeroH = Math.min(px(isLandscape ? 48 : 74), availableHeroH);
    const ratio = heroBitmap.width / Math.max(1, heroBitmap.height);
    let hw = maxHeroW;
    let hh = Math.round(hw / ratio);
    if (hh > maxHeroH) {
      hh = maxHeroH;
      hw = Math.round(hh * ratio);
    }
    const hx = Math.round(centerX - hw / 2);
    ctx.drawImage(heroBitmap, hx, cursorY, hw, hh);
    ctx.strokeStyle = palette.gridBorder;
    ctx.lineWidth = Math.max(1, px(0.3));
    ctx.strokeRect(hx, cursorY, hw, hh);
    cursorY += hh + px(6.5);
  } else {
    cursorY += Math.min(px(isLandscape ? 12 : 26), Math.round(availableHeroH * 0.4));
  }

  ctx.fillStyle = palette.headingInk;
  ctx.font = `900 ${px(isLandscape ? 5.0 : 5.2)}px ${FONT_STACK}`;
  ctx.fillText(mainTitle, centerX, cursorY, boxW - px(16));
  cursorY += px(7.2);

  ctx.fillStyle = palette.inkSecondary;
  ctx.font = `700 ${px(3.0)}px ${FONT_STACK}`;
  ctx.fillText(subTitle, centerX, cursorY, boxW - px(16));

  const statsX = boxX + px(8);
  const statsW = boxW - px(16);
  ctx.fillStyle = palette.headerTint;
  ctx.fillRect(statsX, statsY, statsW, statsH);
  ctx.strokeStyle = palette.gridBorder;
  ctx.lineWidth = Math.max(1, px(0.3));
  ctx.strokeRect(statsX, statsY, statsW, statsH);

  const colW = statsW / 3;
  const labels: ReadonlyArray<[string, string]> = [
    ['TESLİM BİRİMİ', page.deputyPrincipalName ? `Md. Yrd. ${page.deputyPrincipalName}` : 'Müdür Yardımcılığı'],
    ['SINIF VE ŞUBE', page.coverClassSummary],
    ['TOPLAM ÖĞRENCİ', `${page.totalStudentCount} Öğrenci`],
  ];
  labels.forEach(([lbl, val], idx) => {
    const cx = Math.round(statsX + colW * idx + colW / 2);
    if (idx > 0) {
      ctx.strokeStyle = palette.gridHairline;
      ctx.beginPath();
      ctx.moveTo(Math.round(statsX + colW * idx), statsY + px(3));
      ctx.lineTo(Math.round(statsX + colW * idx), statsY + statsH - px(3));
      ctx.stroke();
    }
    ctx.fillStyle = palette.inkSecondary;
    ctx.font = `700 ${px(2.1)}px ${FONT_STACK}`;
    ctx.fillText(lbl, cx, statsY + px(3.8), colW - px(4));
    ctx.fillStyle = palette.headingInk;
    ctx.font = `800 ${px(3.1)}px ${FONT_STACK}`;
    ctx.fillText(val, cx, statsY + px(9.2), colW - px(4));
  });

  const principalBadge = page.staffBadges.find((b) => b.roleLabel === 'Okul Müdürü');
  const sigY = boxY + boxH - px(15);
  const leftSigX = Math.round(boxX + boxW * 0.28);
  const rightSigX = Math.round(boxX + boxW * 0.72);

  if (deputySigBitmap) {
    ctx.drawImage(deputySigBitmap, leftSigX - px(11), sigY - px(6.8), px(22), px(6.5));
  }
  if (principalSigBitmap) {
    ctx.drawImage(principalSigBitmap, rightSigX - px(11), sigY - px(6.8), px(22), px(6.5));
  }

  ctx.fillStyle = palette.inkPrimary;
  ctx.font = `700 ${px(2.5)}px ${FONT_STACK}`;
  ctx.fillText(page.deputyPrincipalName || 'Müdür Yardımcısı', leftSigX, sigY, boxW * 0.36);
  ctx.fillText(principalBadge?.fullName || 'Okul Müdürü', rightSigX, sigY, boxW * 0.36);

  ctx.fillStyle = palette.inkSecondary;
  ctx.font = `600 ${px(2.1)}px ${FONT_STACK}`;
  ctx.fillText('Sorumlu Müdür Yardımcısı', leftSigX, sigY + px(3.6), boxW * 0.36);
  ctx.fillText('Okul Müdürü', rightSigX, sigY + px(3.6), boxW * 0.36);
  ctx.restore();
}
