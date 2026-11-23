import React, { useEffect, useRef, useState } from 'react';
import { StudioBrandLogo } from '../../../system/brand/StudioBrandLogo';
import {
  removeCompanyLogo,
  updateCompanyProfile,
  uploadCompanyLogo,
  useCompanyLogoUrl,
  useCompanyProfile,
} from '../../../system/desktop/desktopPersonalization';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { CompanyProfile } from '../../../system/schemas/desktopPersonalizationSchemas';
import { formErrorMessage } from '../../sheet/formErrorMessage';
import { BookIconCompanyStudio } from '../icons/SettingsBookIcons';

export function GeneralCompanyPage() {
  const company = useCompanyProfile();
  const companyLogoUrl = useCompanyLogoUrl();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<CompanyProfile>(company);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setDraft(company);
  }, [company]);

  const handleSave = () => {
    setError(null);
    setSavedNotice(null);
    try {
      const saved = updateCompanyProfile(draft);
      setDraft(saved);
      setSavedNotice('Şirket ve adres bilgileri kaydedildi.');
      notifyStudio('Şirket ve adres bilgileri güncellendi.', 'success');
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  const handleClear = () => {
    setError(null);
    setSavedNotice(null);
    removeCompanyLogo();
    const cleared = updateCompanyProfile({
      companyName: '',
      ownerName: '',
      phone: '',
      address: '',
      logoAssetId: null,
    });
    setDraft(cleared);
    setSavedNotice('Şirket bilgileri ve logosu temizlendi.');
    notifyStudio('Şirket ve adres bilgileri temizlendi.', 'info');
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setSavedNotice(null);
    setUploadingLogo(true);
    try {
      await uploadCompanyLogo(file);
      setSavedNotice('Şirket logosu kaydedildi.');
      notifyStudio('Şirket logosu güncellendi.', 'success');
    } catch (err) {
      setError(formErrorMessage(err));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setError(null);
    setSavedNotice(null);
    removeCompanyLogo();
    setSavedNotice('Şirket logosu kaldırıldı; varsayılan MarbleOS simgesine dönüldü.');
    notifyStudio('Şirket logosu kaldırıldı.', 'info');
  };

  const previewName = draft.companyName.trim();
  const previewAddress = draft.address.trim();

  return (
    <div className="os-book-page-stack">
      <div className="os-book-lead">
        <span className="os-book-lead-icon"><BookIconCompanyStudio size={38} /></span>
        <div>
          <h3>Şirket, Stüdyo ve Adres Bilgileri</h3>
          <p>
            Buraya eklediğiniz logo ve fotoğrafhane adı üst barda MarbleOS markasının yanında, adresiniz ise alt satırda ve masaüstü kimlik kartında görüntülenir.
          </p>
        </div>
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Üst Bar ve Masaüstü Önizlemesi</h4>
          <span>Anlık yansıtılır</span>
        </div>
        <div className="os-book-company-preview">
          <StudioBrandLogo size="md" variant="icon" logoUrl={companyLogoUrl} />
          <div className="os-book-company-preview-copy">
            <div className="os-book-company-preview-title">
              <strong>MarbleOS</strong>
              {previewName && <span>{previewName}</span>}
            </div>
            <small>{previewAddress || 'MASAÜSTÜ ÇALIŞMA ALANI'}</small>
          </div>
        </div>
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>İşletme Logosu, Kimliği ve Adres</h4>
          <span>Bilgisayarda yerel olarak saklanır</span>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="os-book-hidden-input"
          aria-label="Şirket logosu dosyası seç"
          onChange={(e) => void handleLogoFile(e)}
        />

        <div className="os-book-logo-uploader">
          <StudioBrandLogo size="lg" variant="icon" logoUrl={companyLogoUrl} />
          <div className="os-book-logo-copy">
            <strong>Şirket / Fotoğrafhane Logosu</strong>
            <small>PNG, JPEG veya WebP · En fazla 3 MB</small>
          </div>
          <div className="os-book-logo-actions">
            <button
              type="button"
              className="os-book-action-btn is-primary"
              disabled={uploadingLogo}
              onClick={() => logoInputRef.current?.click()}
            >
              {uploadingLogo ? 'Yükleniyor...' : companyLogoUrl ? 'Logoyu Değiştir' : 'Logo Yükle'}
            </button>
            {companyLogoUrl && (
              <button type="button" className="os-book-action-btn" onClick={handleRemoveLogo}>
                Logoyu Kaldır
              </button>
            )}
          </div>
        </div>

        <div className="os-book-form-grid">
          <label className="os-book-field is-full">
            <span>Şirket / Fotoğrafhane Adı</span>
            <input
              type="text"
              maxLength={70}
              placeholder="Örn: Foto Ufuk"
              value={draft.companyName}
              onChange={(e) => setDraft((curr) => ({ ...curr, companyName: e.target.value }))}
            />
          </label>

          <label className="os-book-field">
            <span>Yetkili / Fotoğrafçı Adı</span>
            <input
              type="text"
              maxLength={60}
              placeholder="Örn: Ufuk Kaya"
              value={draft.ownerName}
              onChange={(e) => setDraft((curr) => ({ ...curr, ownerName: e.target.value }))}
            />
          </label>

          <label className="os-book-field">
            <span>Telefon</span>
            <input
              type="tel"
              maxLength={30}
              placeholder="Örn: +90 532 000 00 00"
              value={draft.phone}
              onChange={(e) => setDraft((curr) => ({ ...curr, phone: e.target.value }))}
            />
          </label>

          <label className="os-book-field is-full">
            <span>Adres</span>
            <textarea
              rows={3}
              maxLength={240}
              placeholder="Şirket veya fotoğrafhane adresi..."
              value={draft.address}
              onChange={(e) => setDraft((curr) => ({ ...curr, address: e.target.value }))}
            />
          </label>
        </div>

        {error && (
          <p className="os-book-inline-error" role="alert">
            {error}
          </p>
        )}
        {savedNotice && <p className="os-book-note">{savedNotice}</p>}

        <div className="os-book-card-actions">
          <button type="button" className="os-book-action-btn is-primary" onClick={handleSave}>
            Bilgileri Kaydet
          </button>
          <button type="button" className="os-book-action-btn" onClick={handleClear}>
            Bilgileri Temizle
          </button>
        </div>
      </div>
    </div>
  );
}
