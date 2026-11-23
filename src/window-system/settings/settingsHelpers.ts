import type { GeneratedRecoveryKey } from '../../system/schemas/backupSchemas';
import { formErrorMessage as settingsErrorMessage } from '../sheet/formErrorMessage';

export const BOOK_BACKUP_SCHOOL_EXT = '.marbleos-yedek';
export const BOOK_BACKUP_WORKSPACE_EXT = '.marbleos-kasa';

export { settingsErrorMessage };

export function downloadBookFile(fileName: string, content: string, mime = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function buildRecoveryCertificateText(generated: GeneratedRecoveryKey): string {
  return [
    'MARBLEOS STUDIO — 256-BIT YEREL VERİ KASASI KURTARMA BELGESİ',
    '=============================================================',
    `Oluşturulma Tarihi (UTC): ${generated.recoveryConfiguredAt}`,
    `Anahtar Özeti (Parmak İzi): #${generated.recoveryFingerprint}`,
    '',
    'KURTARMA ANAHTARI (56 KARAKTER — 7×8 GRUP):',
    generated.recoveryKey,
    '',
    'ÖNEMLİ GÜVENLİK UYARISI:',
    '- Bu anahtar, Windows yeniden kurulduğunda veya kullanıcı profiliniz',
    '  değiştiğinde yerel SQLite veritabanınızı ve şifreli fotoğraflarınızı açar.',
    '- MarbleOS bu anahtarın düz metnini hiçbir yerde saklamaz.',
    '- Bu belgeyi harici şifreli USB bellekte veya basılı olarak kasada saklayın.',
  ].join('\r\n');
}

