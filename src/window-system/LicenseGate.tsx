import { useState } from 'react';
import { StudioBrandLogo } from '../system/brand/StudioBrandLogo';
import {
  activateDesktopLicense,
  activationCodeInputSchema,
  productKeyInputSchema,
  type StudioLicenseState,
} from '../system/desktop/desktopLicense';
import { notifyStudio } from '../system/desktop/studioToast';
import { startDesktopWorkspace } from '../system/sqlite/studioDatabase';
import { OriginSheet } from './sheet/OriginSheet';
import { SheetAutoIcon } from './sheet/SheetFieldIcons';
import { SheetSection, SheetTextArea, SheetTextField } from './sheet/SheetFields';
import { useOriginSheet } from './sheet/useOriginSheet';
import { formErrorMessage } from './sheet/formErrorMessage';

/**
 * PENCERE SİSTEMİ LİSANS KAPISI: MarbleOS Studio Çevrimdışı Lisans Etkinleştirme
 * Makine Kodu gösterilir; ürün anahtarı + satıcıdan alınan etkinleştirme kodu Rust tarafında doğrulanır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export function LicenseGate({ license }: { license: StudioLicenseState }) {
  const activateSheet = useOriginSheet();
  const [productKey, setProductKey] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (activateSheet.isOpen !== wasOpen) {
    setWasOpen(activateSheet.isOpen);
    setError(null);
  }

  const copyMachineCode = async () => {
    try {
      await navigator.clipboard.writeText(license.machineCode);
      notifyStudio('Makine kodu kopyalandı.', 'success');
    } catch {
      notifyStudio('Makine kodu kopyalanamadı; kodu elle seçip kopyalayın.', 'error');
    }
  };

  const handleActivate = async () => {
    setError(null);
    const keyCheck = productKeyInputSchema.safeParse(productKey);
    if (!keyCheck.success) {
      setError(keyCheck.error.issues[0]?.message ?? 'Ürün anahtarı geçersiz.');
      return;
    }
    const codeCheck = activationCodeInputSchema.safeParse(activationCode);
    if (!codeCheck.success) {
      setError(codeCheck.error.issues[0]?.message ?? 'Etkinleştirme kodu geçersiz.');
      return;
    }
    setBusy(true);
    try {
      await activateDesktopLicense(keyCheck.data, codeCheck.data);
      notifyStudio('MarbleOS Studio bu bilgisayarda etkinleştirildi.', 'success');
      activateSheet.close();
      setProductKey('');
      setActivationCode('');
      void startDesktopWorkspace();
    } catch (err) {
      setError(formErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!license.checked) {
    return (
      <section className="os-vault-gate" aria-label="Lisans denetleniyor" aria-busy="true">
        <div className="os-vault-card">
          <StudioBrandLogo size="lg" variant="icon" />
          <p>Lisans denetleniyor…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="os-vault-gate" aria-label="MarbleOS Studio lisans etkinleştirme">
      <div className="os-vault-card">
        <StudioBrandLogo size="lg" variant="icon" />
        <h2>MarbleOS Studio Lisansı</h2>
        <p>
          Bu kurulum henüz etkinleştirilmedi. Aşağıdaki Makine Kodunu ürün anahtarınızla birlikte satıcınıza
          iletin; size bu bilgisayara özel Etkinleştirme Kodu gönderilecektir. Lisans yalnızca bu bilgisayarda geçerlidir.
        </p>
        {license.machineCode ? (
          <span className="os-vault-fp">
            Makine Kodu: <strong className="os-license-machine-code">{license.machineCode}</strong>
          </span>
        ) : (
          <p>Bu bilgisayarın Windows kimliği okunamadı; lütfen satıcınızla iletişime geçin.</p>
        )}
        <div className="os-vault-actions">
          {license.machineCode && (
            <button type="button" className="os-vault-unlock-btn" onClick={() => void copyMachineCode()}>
              <SheetAutoIcon text="Kopya" size={14} />
              Makine Kodunu Kopyala
            </button>
          )}
          <button
            type="button"
            className="os-vault-unlock-btn"
            disabled={!license.machineCode}
            {...activateSheet.trigger('license-activate-trigger')}
          >
            <SheetAutoIcon text="Anahtar" size={14} />
            Lisansı Etkinleştir
          </button>
        </div>
      </div>

      <OriginSheet
        controller={activateSheet}
        title="Lisansı Etkinleştir"
        description={`Makine Kodu: ${license.machineCode}`}
        width={520}
        submitLabel="Doğrula ve Etkinleştir"
        busy={busy}
        canSubmit={productKey.trim().length > 0 && activationCode.trim().length > 0}
        error={error}
        onSubmit={() => void handleActivate()}
      >
        <SheetSection title="Ürün Anahtarı & Etkinleştirme Kodu">
          <SheetTextField
            label="Ürün Anahtarı"
            required
            autoFocus
            maxLength={64}
            placeholder="MOS-XXXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
            value={productKey}
            onChange={setProductKey}
          />
          <SheetTextArea
            label="Etkinleştirme Kodu"
            rows={3}
            required
            maxLength={256}
            placeholder="Satıcınızdan aldığınız etkinleştirme kodunu yapıştırın"
            hint="Tire ve boşluklar otomatik yok sayılır. Kod yalnızca bu bilgisayarda ve bu ürün anahtarıyla çalışır."
            value={activationCode}
            onChange={setActivationCode}
          />
        </SheetSection>
      </OriginSheet>
    </section>
  );
}
