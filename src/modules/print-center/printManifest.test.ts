import { expect, test } from 'vitest';
import { escapeCsvCell, buildPrintManifest } from './printManifest';
import { INITIAL_STUDIO_SEED } from '../../../tests/fixtures/studioSnapshot';

test.each(['=1+1', '+SUM(1)', '-1+2', '@SUM(1)', '  =1', '\t=1', '\n=1'])('neutralizes spreadsheet formulas: %j', (input) => {
  expect(escapeCsvCell(input)).toBe(`"'${input}"`);
});
test('quotes separators, newlines and embedded quotes', () => {
  expect(escapeCsvCell('Ali;"Can"\nYılmaz')).toBe('"Ali;""Can""\nYılmaz"');
});
test('manifest does not claim a measured DPI or print-ready PDF', () => {
  const value = buildPrintManifest(INITIAL_STUDIO_SEED);
  expect(value).toContain('KULLANICI_ONAYLI');
  expect(value).not.toContain('300DPI');
});
