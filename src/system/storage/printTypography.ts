import { PRINT_DPI } from './binaryPrintFormats';

export const PRINT_FONT_POINTS = [8, 9, 10] as const;
export type PrintFontPoint = (typeof PRINT_FONT_POINTS)[number];
export const DEFAULT_PRINT_FONT_PT: PrintFontPoint = 8;

export function isPrintFontPoint(value: unknown): value is PrintFontPoint {
  return PRINT_FONT_POINTS.some((point) => point === value);
}

export function printFont(weight: number, points: number, dpi = PRINT_DPI): string {
  return `${weight} ${(points * dpi) / 72}px Arial, 'Segoe UI', sans-serif`;
}

export function printFontCqi(points: number, contentWidthMm: number): string {
  return `${(points * 25.4 * 100) / (72 * contentWidthMm)}cqi`;
}
