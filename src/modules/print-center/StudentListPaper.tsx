import { useLayoutEffect, useRef } from 'react';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';
import type { PrintFontPoint } from '../../system/storage/printTypography';
import type { TeacherChartPalette } from '../../system/storage/teacher-charts/types';
import { paintStudentList } from './paintStudentList';
import type { ImpositionPage } from './printSpecs';

export function StudentListPaper({ page, schoolName, palette, printFontPt, width, zoomWidthPx }: {
  page: ImpositionPage;
  schoolName: string;
  palette: TeacherChartPalette;
  printFontPt?: PrintFontPoint;
  width: string;
  zoomWidthPx?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = useWindowWorkEnabled();
  const dpi = zoomWidthPx !== undefined && zoomWidthPx > 1240 ? 300 : 150;
  useLayoutEffect(() => {
    if (ref.current && visible) paintStudentList(ref.current, page, schoolName, palette, printFontPt, dpi);
  }, [page, schoolName, palette, printFontPt, dpi, visible]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`${page.titleLabel} öğrenci sıra listesi · ${page.studentListRows?.length ?? 0} öğrenci`}
      className="pc-paper-sheet"
      style={{ width, maxWidth: 'none', aspectRatio: `${page.widthMm} / ${page.heightMm}`, display: 'block' }}
    />
  );
}
