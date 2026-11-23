import type { TeacherChartPalette } from '../teacher-charts/types';
import type { KutukStudentLike } from './staffDirectory';
import type { KutukResolvedPage } from './types';

/**
 * İZOLE SİSTEM 300 DPI TUVAL YARDIMCISI: İdareci Kütük Sayfası Üst Başlık, Kadro Rozetleri ve İmza Altlığı
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const KUTUK_CANVAS_FONT = 'Inter, "Segoe UI", Arial, sans-serif';

export function paintKutukSheetHeader(options: {
  ctx: CanvasRenderingContext2D;
  px: (mm: number) => number;
  contentX: number;
  contentW: number;
  headY: number;
  headH: number;
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  palette: TeacherChartPalette;
  schoolName: string;
  headerTitle: string;
  showSubtitle?: boolean;
  showTeacherBadge: boolean;
  showStaffPortraits: boolean;
  renderedPortraits: ReadonlyMap<string, HTMLCanvasElement>;
  logoBitmap?: HTMLCanvasElement | null;
}): void {
  const {
    ctx, px, contentX, contentW, headY, headH, page, palette,
    schoolName, headerTitle, showSubtitle = true, showTeacherBadge, showStaffPortraits,
    renderedPortraits, logoBitmap,
  } = options;
  const isLandscape = page.landscape;
  const rightEdge = contentX + contentW;
  const midX = contentX + contentW / 2;

  ctx.fillStyle = palette.accent;
  ctx.fillRect(contentX, headY, contentW, Math.max(2, px(0.95)));

  let leftInset = 0;
  if (logoBitmap) {
    const logoSize = px(isLandscape ? 12 : 13.5);
    ctx.drawImage(logoBitmap, contentX, headY + px(2.4), logoSize, logoSize);
    leftInset = logoSize + px(2.6);
  }

  let rightInset = 0;
  if (showStaffPortraits) {
    const portraitBadges = page.staffBadges.filter((b) => Boolean(b.photoRef && renderedPortraits.has(b.photoRef)));
    const slotW = px(isLandscape ? 16.5 : 15.2);
    const miniH = px(isLandscape ? 9.8 : 9.4);
    const miniW = Math.round(miniH * 0.75);
    let cursorRight = rightEdge;

    for (let i = portraitBadges.length - 1; i >= 0; i -= 1) {
      const badge = portraitBadges[i]!;
      const bmp = badge.photoRef ? renderedPortraits.get(badge.photoRef) : undefined;
      if (!bmp) continue;
      const slotLeft = cursorRight - slotW;
      if (slotLeft < midX + px(36)) break;
      const photoX = Math.round(slotLeft + (slotW - miniW) / 2);
      const photoY = headY + px(2.1);
      ctx.drawImage(bmp, photoX, photoY, miniW, miniH);
      ctx.strokeStyle = palette.gridBorder;
      ctx.lineWidth = Math.max(1, px(0.18));
      ctx.strokeRect(photoX, photoY, miniW, miniH);

      const cx = Math.round(slotLeft + slotW / 2);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillStyle = palette.inkSecondary;
      ctx.font = `700 ${px(1.58)}px ${KUTUK_CANVAS_FONT}`;
      ctx.fillText(badge.roleLabel, cx, photoY + miniH + px(0.55), slotW - px(0.6));
      ctx.fillStyle = palette.inkPrimary;
      ctx.font = `700 ${px(1.72)}px ${KUTUK_CANVAS_FONT}`;
      ctx.fillText(badge.fullName, cx, photoY + miniH + px(2.5), slotW - px(0.6));
      cursorRight = slotLeft - px(1.2);
      rightInset = rightEdge - cursorRight;
    }
  }

  const gradeUpper = page.classGradeLabel.toLocaleUpperCase('tr-TR');
  const branchUpper = page.classBranchLabel
    ? `${page.classBranchLabel.toLocaleUpperCase('tr-TR')}${page.branchTotalPages > 1 ? ` (${page.branchPageIndex + 1}/${page.branchTotalPages})` : ''}`
    : page.branchTotalPages > 1
      ? `SAYFA ${page.branchPageIndex + 1}/${page.branchTotalPages}`
      : '';
  const maxCenterW = Math.max(px(64), contentW - Math.max(leftInset, rightInset) * 2 - px(4));
  const docHeading = headerTitle.trim() || page.template.officialTitle;
  const cleanTeacher = page.teacherName.trim();
  const cleanDeputy = page.deputyPrincipalName.trim();
  const metaParts = [
    gradeUpper,
    ...(branchUpper ? [branchUpper] : []),
    `Mevcut: ${page.branchStudentCount} Öğrenci`,
  ];
  if (showTeacherBadge && cleanTeacher) metaParts.push(`Sınıf Öğrt.: ${cleanTeacher}`);
  if (cleanDeputy) metaParts.push(`Sorumlu Md. Yrd.: ${cleanDeputy}`);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.inkPrimary;
  ctx.font = `800 ${px(isLandscape ? 3.1 : 3.25)}px ${KUTUK_CANVAS_FONT}`;
  ctx.fillText(`${schoolName.toLocaleUpperCase('tr-TR')} (${page.academicYear})`, midX, headY + px(2.1), maxCenterW);

  if (showSubtitle) {
    ctx.fillStyle = palette.headingInk;
    ctx.font = `700 ${px(isLandscape ? 2.1 : 2.25)}px ${KUTUK_CANVAS_FONT}`;
    ctx.fillText(docHeading, midX, headY + px(6.4), maxCenterW);
  }

  ctx.fillStyle = palette.inkSecondary;
  ctx.font = `600 ${px(isLandscape ? 1.95 : 2.05)}px ${KUTUK_CANVAS_FONT}`;
  ctx.fillText(metaParts.join(' · '), midX, headY + px(showSubtitle ? 10.0 : 6.7), maxCenterW);

  ctx.strokeStyle = palette.gridBorder;
  ctx.lineWidth = Math.max(1, px(0.26));
  ctx.beginPath();
  ctx.moveTo(contentX, headY + headH);
  ctx.lineTo(rightEdge, headY + headH);
  ctx.stroke();
}

export function paintKutukSheetFooter(options: {
  ctx: CanvasRenderingContext2D;
  px: (mm: number) => number;
  contentX: number;
  contentW: number;
  footY: number;
  page: KutukResolvedPage<KutukStudentLike, string | null>;
  palette: TeacherChartPalette;
  showTeacherBadge: boolean;
  showTeacherSig?: boolean;
  showDeputySig?: boolean;
  showPrincipalSig?: boolean;
  showPageNumber?: boolean;
  pageNumber: number;
  totalPages: number;
  principalSigBitmap?: HTMLCanvasElement | null;
  deputySigBitmap?: HTMLCanvasElement | null;
}): void {
  const {
    ctx, px, contentX, contentW, footY, page, palette,
    showTeacherBadge,
    showTeacherSig = true,
    showDeputySig = true,
    showPrincipalSig = true,
    showPageNumber = true,
    pageNumber, totalPages, principalSigBitmap, deputySigBitmap,
  } = options;
  if (!showTeacherSig && !showDeputySig && !showPrincipalSig && !showPageNumber) return;

  const rightEdge = contentX + contentW;
  const cleanTeacher = page.teacherName.trim();
  const cleanDeputy = page.deputyPrincipalName.trim();

  ctx.strokeStyle = palette.gridHairline;
  ctx.lineWidth = Math.max(1, px(0.2));
  ctx.beginPath();
  ctx.moveTo(contentX, footY);
  ctx.lineTo(rightEdge, footY);
  ctx.stroke();

  const principalBadge = page.staffBadges.find((b) => b.roleLabel === 'Okul Müdürü');
  const cols: Array<{ title: string; name: string; sig?: HTMLCanvasElement | null }> = [];
  if (showTeacherSig) {
    cols.push({
      title: 'Sınıf / Rehber Öğretmeni',
      name: showTeacherBadge && cleanTeacher ? cleanTeacher : '............................',
    });
  }
  if (showDeputySig) {
    cols.push({
      title: 'Sorumlu Müdür Yardımcısı',
      name: cleanDeputy || '............................',
      sig: deputySigBitmap,
    });
  }
  if (showPrincipalSig) {
    cols.push({
      title: 'Okul Müdürü',
      name: principalBadge?.fullName || '............................',
      sig: principalSigBitmap,
    });
  }

  const sigTop = footY + px(1.5);
  const sigAreaW = showPageNumber ? contentW * 0.86 : contentW;
  const colStep = cols.length > 0 ? sigAreaW / cols.length : sigAreaW;
  const sigColW = Math.max(px(30), colStep - px(4));

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  cols.forEach((col, idx) => {
    const colX = contentX + idx * colStep;
    ctx.font = `600 ${px(2.0)}px ${KUTUK_CANVAS_FONT}`;
    ctx.fillStyle = palette.inkSecondary;
    ctx.fillText(col.title, colX, sigTop, sigColW);
    ctx.font = `700 ${px(2.15)}px ${KUTUK_CANVAS_FONT}`;
    ctx.fillStyle = palette.inkPrimary;
    ctx.fillText(col.name, colX, sigTop + px(2.8), sigColW);
    if (col.sig) {
      ctx.drawImage(col.sig, colX, sigTop + px(5.0), px(17), px(5.0));
    }
  });

  if (showPageNumber) {
    ctx.textAlign = 'right';
    ctx.fillStyle = palette.inkSecondary;
    ctx.font = `700 ${px(2.1)}px ${KUTUK_CANVAS_FONT}`;
    ctx.fillText(`Sayfa ${pageNumber} / ${totalPages}`, rightEdge, sigTop + px(2.6));
  }
}
