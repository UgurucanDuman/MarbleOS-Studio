import { z } from 'zod';

/**
 * İZOLE SİSTEM GÜVENLİK KATMANI: Metin Hijyeni, NFC Normalizasyonu ve Enjeksiyon Koruması
 * - C0/C1 kontrol karakterlerini ve Unicode çift yönlü (Bidi Override / Trojan Source) aldatma karakterlerini reddeder.
 * - Tablo / CSV / DDE formül tetikleyicilerini (=, +, -, @) veri şeması sınırında engeller.
 * - macOS / Excel kaynaklı ayrışık Türkçe harfleri NFC biçimine normalize eder.
 */

export const UNSAFE_SINGLE_LINE_RE =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

export const UNSAFE_MULTI_LINE_RE =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

const FORMULA_TRIGGER_RE = /^[=+\-@]/;
const MULTILINE_FORMULA_RE = /^[=+@]/;
/**
 * Yaln\u0131z i\u015faret + rakam/bo\u015fluk/ayra\u00e7tan olu\u015fan de\u011fer ("-5", "-12,50", "+90 555 123 45 67")
 * fonksiyon veya h\u00fccre ba\u015fvurusu ta\u015f\u0131yamaz; form\u00fcl tetikleyicisi say\u0131lmaz.
 */
const SIGNED_NUMBER_RE = /^[+-]\d[\d\s.,]*$/;

export function startsWithFormulaTrigger(value: string, trigger: RegExp = FORMULA_TRIGGER_RE): boolean {
  return trigger.test(value) && !SIGNED_NUMBER_RE.test(value);
}

export function noUnsafeSingleLineChars(value: string): boolean {
  return !UNSAFE_SINGLE_LINE_RE.test(value);
}

export function sanitizeSpreadsheetText(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .trim();
  if (SIGNED_NUMBER_RE.test(cleaned)) return cleaned;
  return cleaned.replace(/^[=+\-@]+/, '').trim();
}

export function safeSingleLine(min: number, max: number, minMessage: string, maxMessage?: string) {
  return z
    .string()
    .transform((val) => val.normalize('NFC').trim())
    .pipe(
      z
        .string()
        .min(min, minMessage)
        .max(max, maxMessage ?? `En fazla ${max} karakter girilebilir`)
        .refine(noUnsafeSingleLineChars, 'Geçersiz karakter içeriyor (kontrol veya yön değiştirici karakter)')
        .refine(
          (val) => !val || !startsWithFormulaTrigger(val),
          'Değer formül karakteriyle (=, +, -, @) başlayamaz',
        ),
    );
}

export function safeOptionalSingleLine(max: number, label: string, minWhenPresent = 0, minMsg = '') {
  return z
    .string()
    .transform((val) => val.normalize('NFC').trim())
    .pipe(
      z
        .string()
        .max(max, `${label} en fazla ${max} karakter olabilir`)
        .refine(noUnsafeSingleLineChars, 'Geçersiz karakter içeriyor (kontrol veya yön değiştirici karakter)')
        .refine(
          (val) => !val || !startsWithFormulaTrigger(val),
          `${label} formül karakteriyle (=, +, -, @) başlayamaz`,
        )
        .refine((val) => !val || val.length >= minWhenPresent, minMsg || `${label} çok kısa`),
    )
    .optional()
    .or(z.literal(''));
}

export function safeMultiLine(max: number) {
  return z
    .string()
    .transform((val) => val.normalize('NFC').trim())
    .pipe(
      z
        .string()
        .max(max, `En fazla ${max} karakter girilebilir`)
        .refine(
          (val) => !UNSAFE_MULTI_LINE_RE.test(val),
          'Geçersiz karakter içeriyor (kontrol veya yön değiştirici karakter)',
        )
        .refine(
          (val) => !val || !startsWithFormulaTrigger(val, MULTILINE_FORMULA_RE),
          'Metin formül karakteriyle (=, +, @) başlayamaz',
        ),
    );
}
