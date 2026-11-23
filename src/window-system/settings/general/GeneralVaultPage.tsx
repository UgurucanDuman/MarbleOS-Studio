import { useState } from 'react';
import { usesDesktopStorage } from '../../../system/desktop/desktopStorage';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { GeneratedRecoveryKey } from '../../../system/schemas/backupSchemas';
import { generateStudioRecoveryKey, useStudioVaultStatus } from '../../../system/sqlite/studioDatabase';
import { SheetAutoIcon } from '../../sheet/SheetFieldIcons';
import { SheetSwitch } from '../../sheet/SheetFields';
import { BookIconVaultKey } from '../icons/SettingsBookIcons';
import { buildRecoveryCertificateText, downloadBookFile, settingsErrorMessage } from '../settingsHelpers';

export function GeneralVaultPage() {
  const vault = useStudioVaultStatus();
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [generated, setGenerated] = useState<GeneratedRecoveryKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    if (!usesDesktopStorage) {
      setError('Kurtarma anahtarı yalnız Windows masaüstü uygulamasında üretilir.');
      return;
    }
    if (vault.hasRecoveryKey && !confirmRotate) {
      setError('Yeni anahtar üretmeden önce mevcut kurtarma anahtarının geçersiz olacağını onaylayın.');
      return;
    }
    setBusy(true);
    try {
      const next = await generateStudioRecoveryKey(vault.hasRecoveryKey && confirmRotate);
      setGenerated(next);
      setConfirmRotate(false);
      notifyStudio(`Kurtarma anahtarı oluşturuldu (#${next.recoveryFingerprint}).`, 'success');
    } catch (err) {
      setError(settingsErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.recoveryKey);
      notifyStudio('Kurtarma anahtarı panoya kopyalandı.', 'success');
    } catch {
      notifyStudio('Pano erişimi reddedildi; Kurtarma Belgesini (.txt) indirin.', 'error');
    }
  };

  const canGenerate = usesDesktopStorage && (!vault.hasRecoveryKey || confirmRotate);

  return (
    <div className="os-book-page-stack">
      <div className="os-book-lead">
        <span className="os-book-lead-icon"><BookIconVaultKey size={38} /></span>
        <div>
          <h3>Yerel Veri Kasası ve 256-bit Kurtarma Anahtarı</h3>
          <p>
            Veritabanı ve görseller <strong>AES-256-GCM</strong> ana veri anahtarıyla şifrelenir; günlük kullanımda{' '}
            <strong>Windows DPAPI</strong>, profil değişiminde ise <strong>Argon2id (64 MiB)</strong> kurtarma anahtarıyla açılır.
          </p>
        </div>
      </div>

      <div className="os-book-card">
        <dl className="os-book-kv-grid">
          <div>
            <dt>Şifreleme Zarfı</dt>
            <dd>AES-256-GCM (MBLAEAD1) + AAD</dd>
          </div>
          <div>
            <dt>Kurtarma Türetimi</dt>
            <dd>Argon2id · 64 MiB · 3 Tur</dd>
          </div>
          <div>
            <dt>Kurtarma Anahtarı Durumu</dt>
            <dd>
              {usesDesktopStorage
                ? (vault.hasRecoveryKey
                    ? `Etkin · Özet #${vault.recoveryFingerprint ?? '—'}`
                    : 'Henüz üretilmedi')
                : 'Tarayıcı deneme modu (DPAPI devre dışı)'}
            </dd>
          </div>
          <div>
            <dt>Bulut Gönderimi</dt>
            <dd>Kapalı · %100 Yerel Depolama</dd>
          </div>
        </dl>

        {!usesDesktopStorage && (
          <p className="os-book-note" role="note">
            Tarayıcı önizlemesinde IndexedDB şifresiz çalışır. Windows DPAPI ve 256-bit Kurtarma Anahtarı, kurulu
            Windows masaüstü uygulamasında etkindir; bir sonraki sayfadan şifreli yedek alabilirsiniz.
          </p>
        )}

        {usesDesktopStorage && vault.hasRecoveryKey && (
          <SheetSwitch
            label="Mevcut kurtarma anahtarını yenile"
            description="Yeni anahtar üretildiğinde önceki 56 karakterlik kurtarma anahtarınız geçersiz olur."
            checked={confirmRotate}
            onChange={setConfirmRotate}
          />
        )}

        {error && <p role="alert" className="os-book-inline-error">{error}</p>}

        <div className="os-book-card-actions">
          <button
            type="button"
            className="os-book-action-btn is-primary"
            disabled={busy || !canGenerate}
            onClick={() => void handleGenerate()}
          >
            <SheetAutoIcon text="Kurtarma Anahtarı" size={13.5} />
            {busy
              ? 'Üretiliyor…'
              : vault.hasRecoveryKey
                ? 'Yeni Kurtarma Anahtarı Üret'
                : '256-bit Kurtarma Anahtarı Üret'}
          </button>
        </div>
      </div>

      {generated && (
        <div className="os-book-card os-book-secret-box" role="region" aria-label="Üretilen kurtarma anahtarı">
          <div className="os-book-secret-head">
            <strong>Yeni Kurtarma Anahtarınız (Yalnızca Bir Kez Gösterilir)</strong>
            <span>Özet: #{generated.recoveryFingerprint}</span>
          </div>
          <code className="os-book-secret-code">{generated.recoveryKey}</code>
          <div className="os-book-card-actions">
            <button
              type="button"
              className="os-book-action-btn"
              onClick={() =>
                downloadBookFile(
                  `marbleos_kurtarma_anahtari_${generated.recoveryFingerprint}.txt`,
                  buildRecoveryCertificateText(generated),
                  'text/plain;charset=utf-8',
                )
              }
            >
              <SheetAutoIcon text="İndir" size={13} />
              Kurtarma Belgesini İndir (.txt)
            </button>
            <button type="button" className="os-book-action-btn" onClick={() => void handleCopy()}>
              <SheetAutoIcon text="Kopyala" size={13} />
              Anahtarı Kopyala
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

