import { invoke } from '@tauri-apps/api/core';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { usesDesktopStorage } from './desktopStorage';

/**
 * İZOLE MASAÜSTÜ LİSANS İSTEMCİSİ:
 * Lisans yetkisinin kaynağı Rust tarafıdır (`studio_license_*`, ECDSA P-256 + Windows makine kimliği).
 * Bu dosya yalnızca durumu okur, girdileri Zod ile sınırlar ve kilit ekranını besler.
 * Tarayıcı önizlemesinde yerel komut olmadığından lisans kilidi uygulanmaz.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const licenseStatusSchema = z
  .object({
    activated: z.boolean(),
    machineCode: z.string().max(64),
  })
  .strict();

export type StudioLicenseState = z.infer<typeof licenseStatusSchema> & { checked: boolean };

const CODE_CHARS = /^[0-9A-Za-z\s-]+$/;

export const productKeyInputSchema = z
  .string()
  .trim()
  .min(26, 'Ürün anahtarı eksik görünüyor.')
  .max(64, 'Ürün anahtarı çok uzun.')
  .regex(CODE_CHARS, 'Ürün anahtarı yalnızca harf, rakam ve tire içerebilir.');

export const activationCodeInputSchema = z
  .string()
  .trim()
  .min(100, 'Etkinleştirme kodu eksik görünüyor.')
  .max(256, 'Etkinleştirme kodu çok uzun.')
  .regex(CODE_CHARS, 'Etkinleştirme kodu yalnızca harf, rakam ve tire içerebilir.');

let state: StudioLicenseState = usesDesktopStorage
  ? { checked: false, activated: false, machineCode: '' }
  : { checked: true, activated: true, machineCode: '' };
const listeners = new Set<() => void>();

function publish(next: StudioLicenseState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStudioLicense(): StudioLicenseState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Uygulama açılışında bir kez çağrılır; lisans geçerliyse `true` döner. */
export async function startDesktopLicense(): Promise<boolean> {
  if (!usesDesktopStorage) return true;
  try {
    const status = licenseStatusSchema.parse(await invoke('studio_license_status'));
    publish({ ...status, checked: true });
    return status.activated;
  } catch {
    publish({ checked: true, activated: false, machineCode: '' });
    return false;
  }
}

export async function activateDesktopLicense(rawProductKey: string, rawActivationCode: string) {
  const productKey = productKeyInputSchema.parse(rawProductKey);
  const activationCode = activationCodeInputSchema.parse(rawActivationCode);
  const status = licenseStatusSchema.parse(
    await invoke('studio_license_activate', { productKey, activationCode }),
  );
  publish({ ...status, checked: true });
  if (!status.activated) throw new Error('Lisans etkinleştirilemedi.');
  return status;
}
