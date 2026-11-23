import { ZodError } from 'zod';

/** Form kartlarında gösterilecek tek satırlık, ham veri içermeyen hata metni. */
export function formErrorMessage(err: unknown): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? 'Girilen bilgiler geçersiz.';
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'İşlem tamamlanamadı. Kayıt değiştirilmedi.';
}

