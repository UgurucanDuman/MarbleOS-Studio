import { useState } from 'react';
import { notifyStudio } from '../system/desktop/studioToast';
import { recoveryKeyInputSchema, type VaultStatus } from '../system/schemas/backupSchemas';
import { unlockStudioVault } from '../system/sqlite/studioDatabase';
import { OriginSheet } from './sheet/OriginSheet';
import { SheetAutoIcon } from './sheet/SheetFieldIcons';
import { SheetSection, SheetTextArea } from './sheet/SheetFields';
import { useOriginSheet } from './sheet/useOriginSheet';

export function VaultUnlockGate({ vault }: { vault: VaultStatus }) {
  const unlockSheet = useOriginSheet();
  const [rawKey, setRawKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (unlockSheet.isOpen !== wasOpen) {
    setWasOpen(unlockSheet.isOpen);
    setRawKey('');
    setError(null);
  }

  const handleUnlock = async () => {
    setError(null);
    const parsed = recoveryKeyInputSchema.safeParse(rawKey);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kurtarma anahtarı geçersiz.');
      return;
    }
    setBusy(true);
    try {
      await unlockStudioVault(parsed.data);
      notifyStudio('Veri kasası kilidi açıldı ve yeni Windows profilinize bağlandı.', 'success');
      unlockSheet.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setRawKey('');
    }
  };

  return (
    <section className="os-vault-gate" aria-label="Yerel veri kasası kilidi">
      <div className="os-vault-card">
        <span className="os-vault-icon" aria-hidden="true">
          <SheetAutoIcon text="Kilit" size={20} />
        </span>
        <h2>Yerel Veri Kasası Kilitli</h2>
        {vault.hasRecoveryKey ? (
          <>
            <p>
              Windows kullanıcı profili veya sistem anahtarı (DPAPI) değiştiği için yerel veritabanı ve şifreli
              fotoğraflar korumaya alındı. Mevcut kayıtlarınız olduğu gibi duruyor.
            </p>
            {vault.recoveryFingerprint && (
              <span className="os-vault-fp">
                Beklenen Kurtarma Anahtarı Özeti: <strong>#{vault.recoveryFingerprint}</strong>
              </span>
            )}
            <div className="os-vault-actions">
              <button
                type="button"
                className="os-vault-unlock-btn"
                {...unlockSheet.trigger('vault-unlock-trigger')}
              >
                <SheetAutoIcon text="Kurtarma Anahtarı" size={14} />
                Kurtarma Anahtarı ile Kilidi Aç
              </button>
            </div>
          </>
        ) : (
          <p>
            Windows kullanıcı profili değiştiği için eski DPAPI anahtarına erişilemiyor ve bu kurulumda önceden
            üretilmiş bir 256-bit Kurtarma Anahtarı bulunmuyor. Mevcut şifreli dosyalarınız silinmeden korundu;
            aldığınız şifreli <code>.marbleos-kasa</code> veya <code>.marbleos-yedek</code> dosyalarından temiz
            kurulumda geri yükleme yapabilirsiniz.
          </p>
        )}
      </div>

      <OriginSheet
        controller={unlockSheet}
        title="Kurtarma Anahtarı ile Kilidi Aç"
        description={
          vault.recoveryFingerprint
            ? `Beklenen anahtar özeti: #${vault.recoveryFingerprint}`
            : '56 karakterlik 256-bit kurtarma anahtarınızı girin'
        }
        width={480}
        submitLabel="Kasayı Doğrula ve Aç"
        busy={busy}
        canSubmit={rawKey.trim().length > 0}
        error={error}
        onSubmit={() => void handleUnlock()}
      >
        <SheetSection title="256-bit Kurtarma Anahtarı (7×8 Grup)">
          <SheetTextArea
            label="Kurtarma Anahtarı"
            rows={2}
            required
            autoFocus
            maxLength={120}
            placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
            hint="Tire ve boşluklar otomatik düzenlenir; anahtar doğrulandığında veri kasanız mevcut Windows hesabınıza yeniden bağlanır."
            value={rawKey}
            onChange={setRawKey}
          />
        </SheetSection>
      </OriginSheet>
    </section>
  );
}

