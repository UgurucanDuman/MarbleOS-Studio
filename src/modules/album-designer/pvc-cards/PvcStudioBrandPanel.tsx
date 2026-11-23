import React, { useEffect, useRef, useState } from 'react';
import {
  removeCompanyLogo,
  updateCompanyProfile,
  uploadCompanyLogo,
  useCompanyLogoUrl,
  useCompanyProfile,
} from '../../../system/desktop/desktopPersonalization';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { formErrorMessage } from '../../../window-system/sheet/formErrorMessage';

/**
 * İZOLE MODÜL 03 ARKA YÜZ FOTOĞRAFÇI / STÜDYO KÜNYESİ PANELİ:
 * Fotoğrafçının şirket adı, yetkili adı, telefon numarası, adresi ve logosu
 * doğrudan MarbleOS Şirket Bilgileri ile senkron çalışır ve kartların arka yüzüne canlı yansır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PvcStudioBrandPanel: React.FC<{
  showStudioInfo: boolean;
  onToggleShowStudioInfo: (val: boolean) => void;
  onPreviewBackSide: () => void;
}> = React.memo(({ showStudioInfo, onToggleShowStudioInfo, onPreviewBackSide }) => {
  const company = useCompanyProfile();
  const logoUrl = useCompanyLogoUrl();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [companyName, setCompanyName] = useState(company.companyName);
  const [ownerName, setOwnerName] = useState(company.ownerName);
  const [phone, setPhone] = useState(company.phone);
  const [address, setAddress] = useState(company.address);

  useEffect(() => {
    setCompanyName(company.companyName);
    setOwnerName(company.ownerName);
    setPhone(company.phone);
    setAddress(company.address);
  }, [company]);

  const handleSave = () => {
    try {
      updateCompanyProfile({ companyName, ownerName, phone, address });
      notifyStudio('Fotoğrafçı / stüdyo bilgileri kaydedildi ve kart arka yüzüne yansıtıldı.', 'success');
      onPreviewBackSide();
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadCompanyLogo(file);
      notifyStudio('Fotoğrafhane logosu kart arka yüzüne eklendi.', 'success');
      onPreviewBackSide();
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <div className="pvc-editor-stack">
      <div className="tc-section">
        <div className="tc-section-head">
          <span className="tc-section-label">Arka Yüz Fotoğrafçı Bilgileri</span>
          <button type="button" className="tc-auto-link" onClick={onPreviewBackSide}>
            Arka Yüzü Gör
          </button>
        </div>

        <label className="mod-check-label">
          <input
            type="checkbox"
            checked={showStudioInfo}
            onChange={(e) => onToggleShowStudioInfo(e.target.checked)}
          />
          Hazır Şablon Arka Yüzünde Stüdyo Bilgisi Göster
        </label>

        <div className="pvc-studio-logo-box">
          <div className="pvc-studio-logo-thumb">
            {logoUrl ? <img src={logoUrl} alt="Stüdyo Logosu" /> : <span>LOGO</span>}
          </div>
          <div className="pvc-studio-logo-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              aria-label="Fotoğrafhane logosu seç"
              onChange={(e) => void handleLogoFile(e)}
            />
            <button type="button" className="pvc-mini-btn is-primary" onClick={() => fileRef.current?.click()}>
              {logoUrl ? 'Logoyu Değiştir' : 'Stüdyo Logosu Yükle'}
            </button>
            {logoUrl && (
              <button
                type="button"
                className="pvc-mini-btn is-danger"
                onClick={() => {
                  removeCompanyLogo();
                  notifyStudio('Stüdyo logosu kaldırıldı.', 'info');
                }}
              >
                Kaldır
              </button>
            )}
          </div>
        </div>

        <div className="tc-field-stack">
          <label className="pvc-prop-block">
            <span className="pvc-mini-label">Fotoğrafhane / Stüdyo Adı</span>
            <input
              type="text"
              className="mod-input"
              maxLength={70}
              placeholder="Örn: Foto Ufuk Okul Fotoğrafçılığı"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>
          <label className="pvc-prop-block">
            <span className="pvc-mini-label">Fotoğrafçı / Yetkili Adı</span>
            <input
              type="text"
              className="mod-input"
              maxLength={60}
              placeholder="Örn: Ufuk Kaya"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </label>
          <label className="pvc-prop-block">
            <span className="pvc-mini-label">Telefon Numarası</span>
            <input
              type="tel"
              className="mod-input"
              maxLength={30}
              placeholder="Örn: 0532 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="pvc-prop-block">
            <span className="pvc-mini-label">Stüdyo Adresi</span>
            <textarea
              rows={2}
              className="mod-input pvc-textarea"
              maxLength={240}
              placeholder="Cadde, mahalle, ilçe / il…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <button type="button" className="mod-action-btn" onClick={handleSave}>
            Stüdyo Bilgilerini Kaydet &amp; Karta Uygula
          </button>
        </div>
      </div>
    </div>
  );
});
