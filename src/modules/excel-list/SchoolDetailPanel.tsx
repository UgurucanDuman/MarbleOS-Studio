import React from 'react';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import { useResolvedSchoolAssetUrl } from '../../system/storage/useSchoolAssetUrl';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import type { OriginSheetController } from '../../window-system/sheet/useOriginSheet';
import type { SchoolRow } from './schoolRows';

/**
 * Seçili okulun sağ Apple Pro Denetçi Kartı (`StudioInspectorPanel` ile birebir aynı mimari, sıfır tekrar):
 * - Üstte tıklanabilir Okul Logosu yuvası + seçili okul kimlik ve baskı türü özeti
 * - Ortada 2'li tıklanabilir Kurum İmza önizlemeleri (Müdür & Müdür Yrd.)
 * - Altta yalnızca okul düzeyindeki benzersiz iş akışı görevleri
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const SchoolDetailPanel = React.memo(function SchoolDetailPanel({
  row,
  editSheet,
  rosterXlsxSheet,
  promoteSheet,
  onEdit,
  onImportRoster,
  onOpenClasses,
}: {
  row: SchoolRow;
  editSheet: OriginSheetController;
  rosterXlsxSheet: OriginSheetController;
  promoteSheet: OriginSheetController;
  onEdit: () => void;
  onImportRoster: () => void;
  onOpenClasses: () => void;
}) {
  const { school, classCount, studentCount } = row;
  const logoUrl = useResolvedSchoolAssetUrl(school.logoDataUrl, 'preview');
  const principalSigUrl = useResolvedSchoolAssetUrl(school.principalSignatureDataUrl, 'preview');
  const deputySigUrl = useResolvedSchoolAssetUrl(school.deputySignatureDataUrl, 'preview');
  const products = [school.makeBiometric && 'Biyometrik', school.makeVesikalik && 'Vesikalık'].filter(Boolean);

  const logoTrigger = editSheet.trigger('school-detail-logo');
  const assetPrincipalTrigger = editSheet.trigger('school-asset-principal');
  const assetDeputyTrigger = editSheet.trigger('school-asset-deputy');
  const rosterTrigger = rosterXlsxSheet.trigger('school-detail-roster');
  const promoteTrigger = promoteSheet.trigger('school-promote');

  return (
    <aside className="xl-inspector xl-school-inspector" aria-label="Seçili okul">
      <div className="xl-inspector-card">
        <AppleCrossfadeSlot activeKey={school.id} variant="card">
          <div className="xl-inspector-selected">
          <button
            type="button"
            className={`xl-inspector-portrait xl-school-logo-slot ${logoUrl ? 'has-logo' : ''}`.trim()}
            {...logoTrigger}
            onClick={(e) => {
              onEdit();
              logoTrigger.onClick(e);
            }}
            title="Okul logosu seç veya düzenle"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Okul Logosu" />
            ) : (
              <>
                <SheetAutoIcon text="Okul" size={20} />
                <span>Logo Seç</span>
              </>
            )}
          </button>

          <div className="xl-inspector-meta">
            <span className="xl-inspector-eyebrow">SEÇİLİ OKUL</span>
            <strong title={school.name}>{school.name}</strong>
            <span className="xl-inspector-no">
              Kod {school.code}
              {school.institutionCode ? ` · Kurum ${school.institutionCode}` : ''}
            </span>
            <span className="xl-inspector-no">
              {classCount} şube · {studentCount} öğrenci
            </span>
            <span className="xl-inspector-no">
              {products.length ? products.join(' · ') : 'Şablon seçilmedi'}
              {logoUrl ? ` · Filigran %${school.transparentLogoOpacity ?? 35}` : ''}
            </span>
          </div>
        </div>
        </AppleCrossfadeSlot>
      </div>

      <div className="xl-inspector-section">
        <span className="xl-inspector-title">
          <SheetAutoIcon text="İmza" size={12.5} />
          Kurum İmzaları
        </span>
        <AppleCrossfadeSlot activeKey={school.id} variant="card">
          <div className="xl-mini-assets" aria-label="Okul görselleri önizlemesi">
          <button
            type="button"
            className="xl-mini-asset"
            {...assetPrincipalTrigger}
            onClick={(e) => {
              onEdit();
              assetPrincipalTrigger.onClick(e);
            }}
          >
            <span>Müdür İmzası</span>
            <span className={`xl-mini-box ${principalSigUrl ? 'is-paper' : ''}`.trim()}>
              {principalSigUrl ? (
                <img src={principalSigUrl} alt="Müdür İmzası" className="xl-asset-sig" />
              ) : (
                <small>Ekle</small>
              )}
            </span>
          </button>

          <button
            type="button"
            className="xl-mini-asset"
            {...assetDeputyTrigger}
            onClick={(e) => {
              onEdit();
              assetDeputyTrigger.onClick(e);
            }}
          >
            <span>Md. Yrd. İmzası</span>
            <span className={`xl-mini-box ${deputySigUrl ? 'is-paper' : ''}`.trim()}>
              {deputySigUrl ? (
                <img src={deputySigUrl} alt="Müdür Yrd. İmzası" className="xl-asset-sig" />
              ) : (
                <small>Ekle</small>
              )}
            </span>
          </button>
          </div>
        </AppleCrossfadeSlot>
      </div>

      <div className="xl-inspector-section">
        <span className="xl-inspector-title">
          <SheetAutoIcon text="Şube" size={12.5} />
          Okul İşlemleri
        </span>

        <button
          type="button"
          className="xl-btn xl-btn-primary xl-inspector-wide-btn"
          onClick={onOpenClasses}
        >
          <SheetAutoIcon text="Sınıflara Geç" size={13.5} />
          Sınıflara Geç
        </button>

        <button
          type="button"
          className="xl-btn xl-inspector-wide-btn"
          {...rosterTrigger}
          onClick={(e) => {
            onImportRoster();
            rosterTrigger.onClick(e);
          }}
        >
          <SheetAutoIcon text="Excel" size={13.5} />
          Okula Excel'den Aktar (.xlsx)
        </button>

        <button
          type="button"
          className="xl-mini-btn xl-inspector-wide-btn"
          {...promoteTrigger}
        >
          <SheetAutoIcon text="Yeni Döneme Aktar" size={12} />
          Yeni Döneme Aktar
        </button>
      </div>
    </aside>
  );
});
