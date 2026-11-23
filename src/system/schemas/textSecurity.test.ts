import { expect, test } from 'vitest';
import { safeSingleLine, sanitizeSpreadsheetText, startsWithFormulaTrigger } from './textSecurity';

test('sanitizeSpreadsheetText keeps plain signed numbers but strips formula triggers', () => {
  expect(sanitizeSpreadsheetText('-5')).toBe('-5');
  expect(sanitizeSpreadsheetText(' -12,50 ')).toBe('-12,50');
  expect(sanitizeSpreadsheetText('+90 555 123 45 67')).toBe('+90 555 123 45 67');

  expect(sanitizeSpreadsheetText('=HYPERLINK("http://x")')).toBe('HYPERLINK("http://x")');
  expect(sanitizeSpreadsheetText('-2+cmd|" /C calc"!A0')).toBe('2+cmd|" /C calc"!A0');
  expect(sanitizeSpreadsheetText('+A1')).toBe('A1');
  expect(sanitizeSpreadsheetText('@SUM(A1)')).toBe('SUM(A1)');
  expect(sanitizeSpreadsheetText('-')).toBe('');
});

test('form schemas accept signed numbers but still reject formulas', () => {
  const schema = safeSingleLine(1, 40, 'boş');
  expect(schema.safeParse('-5').success).toBe(true);
  expect(schema.safeParse('+90 555 123 45 67').success).toBe(true);
  expect(schema.safeParse('-5+A1').success).toBe(false);
  expect(schema.safeParse('=1+1').success).toBe(false);
  expect(startsWithFormulaTrigger('=5')).toBe(true);
});
