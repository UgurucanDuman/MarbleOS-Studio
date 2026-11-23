import React from 'react';
import type {
  PrintDuplexMode,
  PrintOrientation,
  PrintScaleMode,
  SystemPrinterInfo,
} from '../../system/desktop/desktopPrinter';
import { usesDesktopStorage } from '../../system/desktop/desktopStorage';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { AppleSelect } from '../../window-system/sheet/AppleSelect';
import type { PortraitExportFormat } from './jpgSheetExporter';
import {
  normalizeSheetModeForProduct,
  type PrintProductId,
  type PrintSheetMode,
} from './printSpecs';
import { PrintStudioIcon, type PrintStudioIconKind } from './PrintStudioIcons';

/**
 * İZOLE MODÜL 04 SOL DENETÇİ (BÖLÜM 1):
 * Baskı Kategorisi Kartları, Windows Doğrudan Yazıcı Seçimi, Kopya, Ölçek, Yön ve Çift Yüz Ayarları
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

const CATEGORY_CARDS: ReadonlyArray<{
  id: 'portrait' | 'pvc-id-card' | 'album-chart' | 'e-okul-zip';
  icon: PrintStudioIconKind;
  title: string;
  meta: string;
}> = [
  { id: 'portrait', icon: 'portrait', title: 'Vesikalık & Biyometrik', meta: '45×60 · 50×60 mm' },
  { id: 'pvc-id-card', icon: 'id-card', title: 'PVC Kimlik Kartı', meta: 'CR80 · 85.6×54 mm' },
  { id: 'album-chart', icon: 'album', title: 'Albüm & Sınıf Panosu', meta: 'A4 Dikey & Yatay' },
  { id: 'e-okul-zip', icon: 'e-okul', title: usesDesktopStorage ? 'e-Okul (JPG Klasör)' : 'e-Okul (.zip)', meta: '133×171 px · ≤120 KB' },
];

function sheetOptionsForProduct(productId: PrintProductId) {
  if (productId === 'pvc-id-card') {
    return [
      { value: 'a4-id-8up', label: "A4 Kesim Tabakası (5 / 6 / 8 / 9 / 10'lu)", iconHint: 'Kimlik' },
      { value: 'cr80-single', label: 'CR80 Kart Yazıcı — Tekli (85.6×54 / 54×85.6 mm)', iconHint: 'Kimlik' },
    ];
  }
  if (productId === 'album-chart') {
    return [
      { value: 'a4-album-portrait', label: 'A4 Dikey Öğretmen Çizelgesi (210×297 mm)', iconHint: 'Okul' },
      { value: 'a4-kutuk-portrait', label: 'A4 Dikey İdareci Kütük Dosyası (210×297 mm)', iconHint: 'Klasör' },
      { value: 'a4-album-landscape', label: 'A4 Yatay Kütük & Sınıf Albümü (297×210 mm)', iconHint: 'Okul' },
      { value: 'a4-student-list', label: 'A4 Öğrenci Sıra Listesi', iconHint: 'Öğrenci' },
    ];
  }
  if (productId === 'e-okul-zip') {
    return [
      { value: 'single-zip', label: usesDesktopStorage ? 'MEB e-Okul Hazır JPG Klasörü (133×171 px)' : 'MEB e-Okul Standart ZIP (133×171 px)', iconHint: 'Klasör' },
    ];
  }
  return [
    { value: 'a4-grid', label: 'A4 Dizgi Sayfası (210×297 mm)', iconHint: 'Klasör' },
    { value: '10x15-4up-student', label: '10×15 cm Kişi Kartı (Her Öğrenci 1 Kâğıt)', iconHint: 'Portre' },
    { value: '10x15-grid', label: '10×15 cm Sıralı Dizgi (100×150 mm)', iconHint: 'Görsel' },
    { value: 'single-zip', label: 'Tekil 300 DPI Kesilmiş Kareler (JPG Klasörü)', iconHint: 'Klasör' },
  ];
}

export const PrintCommandDeck: React.FC<{
  productId: PrintProductId;
  portraitVariant: 'vesikalik-45x60' | 'biometric-50x60';
  sheetMode: PrintSheetMode;
  exportFormat: PortraitExportFormat;
  printers: readonly SystemPrinterInfo[];
  selectedPrinter: string;
  loadingPrinters: boolean;
  copies: number;
  orientation: PrintOrientation;
  duplex: PrintDuplexMode;
  scaleMode: PrintScaleMode;
  onSelectProduct: (val: PrintProductId) => void;
  onSelectPortraitVariant: (val: 'vesikalik-45x60' | 'biometric-50x60') => void;
  onChangeSheetMode: (val: PrintSheetMode) => void;
  onChangeExportFormat: (val: PortraitExportFormat) => void;
  onSelectPrinter: (name: string) => void;
  onRefreshPrinters: () => void;
  onChangeCopies: (val: number) => void;
  onChangeOrientation: (val: PrintOrientation) => void;
  onChangeDuplex: (val: PrintDuplexMode) => void;
  onChangeScaleMode: (val: PrintScaleMode) => void;
}> = React.memo(({
  productId,
  portraitVariant,
  sheetMode,
  exportFormat,
  printers,
  selectedPrinter,
  loadingPrinters,
  copies,
  orientation,
  duplex,
  scaleMode,
  onSelectProduct,
  onSelectPortraitVariant,
  onChangeSheetMode,
  onChangeExportFormat,
  onSelectPrinter,
  onRefreshPrinters,
  onChangeCopies,
  onChangeOrientation,
  onChangeDuplex,
  onChangeScaleMode,
}) => {
  const isPortraitFamily = productId === 'vesikalik-45x60' || productId === 'biometric-50x60';
  const normalizedMode = normalizeSheetModeForProduct(productId, sheetMode);
  const isZipMode = productId === 'e-okul-zip' || normalizedMode === 'single-zip';

  const printerOptions =
    printers.length > 0
      ? printers.map((p) => ({
          value: p.name,
          label: `${p.name}${p.isDefault ? ' (Varsayılan)' : ''}${p.isOffline ? ' · Çevrimdışı' : ''}`,
          iconHint: 'Ayar',
        }))
      : [{ value: '', label: 'Sistemde kurulu yazıcı bulunamadı', iconHint: 'Ayar' }];

  return (
    <div className="pc-inspector-group">
      <section className="pc-panel-section" aria-label="Baskı ürün kategorisi">
        <div className="pc-section-head">
          <span className="pc-section-title">Baskı &amp; Çıktı Türü</span>
        </div>
        <div className="pc-category-grid" role="tablist" aria-label="Baskı kategorisi">
          {CATEGORY_CARDS.map((card) => {
            const active =
              card.id === 'portrait' ? isPortraitFamily : productId === card.id;
            return (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`pc-category-card ${active ? 'is-active' : ''}`.trim()}
                onClick={() =>
                  onSelectProduct(card.id === 'portrait' ? portraitVariant : card.id)
                }
              >
                <span className="pc-category-icon">
                  <PrintStudioIcon kind={card.icon} size={18} />
                </span>
                <span className="pc-category-copy">
                  <strong>{card.title}</strong>
                  <small>{card.meta}</small>
                </span>
              </button>
            );
          })}
        </div>

        {isPortraitFamily && (
          <div className="pc-control-field">
            <span className="pc-control-label">Portre Fiziksel Ölçüsü</span>
            <AppleGlassSegment
              ariaLabel="Portre ölçüsü"
              fullWidth
              compact
              activeId={productId}
              items={[
                { id: 'vesikalik-45x60', label: 'Vesikalık 45×60', iconHint: 'Görsel' },
                { id: 'biometric-50x60', label: 'Biyometrik 50×60', iconHint: 'Biyometrik' },
              ]}
              onChange={(id) => onSelectPortraitVariant(id as 'vesikalik-45x60' | 'biometric-50x60')}
            />
          </div>
        )}
      </section>

      <section className="pc-panel-section" aria-label="Yazıcı motoru ve kâğıt ayarları">
        <div className="pc-section-head">
          <span className="pc-section-title">
            <PrintStudioIcon kind="printer" size={14} />
            Yazıcı &amp; Kâğıt Motoru
          </span>
          <button
            type="button"
            className="pc-icon-ghost-btn"
            disabled={loadingPrinters}
            title="Sistem yazıcılarını yeniden tara"
            aria-label="Yazıcı listesini yenile"
            onClick={onRefreshPrinters}
          >
            <PrintStudioIcon kind="refresh" size={13} />
            <span>{loadingPrinters ? 'Taranıyor…' : 'Yenile'}</span>
          </button>
        </div>

        <div className="pc-control-field">
          <span className="pc-control-label">Hedef Yazıcı</span>
          <AppleSelect
            ariaLabel="Hedef yazıcı"
            disabled={printers.length === 0}
            value={selectedPrinter}
            options={printerOptions}
            onChange={onSelectPrinter}
          />
          {!usesDesktopStorage && (
            <small className="pc-printer-mode-hint">
              Tarayıcı önizlemesinde güvenlik sınırı nedeniyle Edge yazdırma penceresi açılır; Windows kurulumda (.exe)
              kurulu yazıcılar doğrudan burada listelenir ve tek tıkla kuyruğa gönderilir.
            </small>
          )}
        </div>

        <div className="pc-control-field">
          <span className="pc-control-label">Kâğıt &amp; Dizgi Düzeni</span>
          <AppleSelect
            ariaLabel="Kâğıt ve dizgi düzeni"
            disabled={productId === 'e-okul-zip'}
            value={normalizedMode}
            options={sheetOptionsForProduct(productId)}
            onChange={(val) => onChangeSheetMode(val as PrintSheetMode)}
          />
        </div>

        {!isZipMode && (
          <>
            {isPortraitFamily && (
              <div className="pc-control-field">
                <span className="pc-control-label">Dosya Çıktı Formatı</span>
                <AppleGlassSegment
                  ariaLabel="Dosya çıktı formatı"
                  fullWidth
                  compact
                  activeId={exportFormat}
                  items={[
                    { id: 'pdf', label: 'PDF Belge', iconHint: 'Klasör' },
                    { id: 'jpg', label: 'JPG (300 DPI)', iconHint: 'Görsel' },
                  ]}
                  onChange={(id) => onChangeExportFormat(id as PortraitExportFormat)}
                />
              </div>
            )}

            <div className="pc-hardware-row">
              <div className="pc-control-field">
                <span className="pc-control-label">Kopya Adedi</span>
                <div className="pc-copies-stepper" role="group" aria-label="Kopya adedi">
                  <button
                    type="button"
                    className="pc-stepper-btn"
                    aria-label="Kopya sayısını azalt"
                    disabled={copies <= 1}
                    onClick={() => onChangeCopies(Math.max(1, copies - 1))}
                  >
                    −
                  </button>
                  <strong className="pc-copies-val">{copies}</strong>
                  <button
                    type="button"
                    className="pc-stepper-btn"
                    aria-label="Kopya sayısını artır"
                    disabled={copies >= 99}
                    onClick={() => onChangeCopies(Math.min(99, copies + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pc-control-field">
                <span className="pc-control-label">Baskı Ölçeği</span>
                <AppleGlassSegment
                  ariaLabel="Baskı ölçeği"
                  fullWidth
                  compact
                  activeId={scaleMode}
                  items={[
                    { id: 'actual-100', label: '%100 mm', iconHint: 'Kırp' },
                    { id: 'fit-page', label: 'Sığdır', iconHint: 'Görsel' },
                  ]}
                  onChange={(id) => onChangeScaleMode(id as PrintScaleMode)}
                />
              </div>
            </div>

            <div className="pc-hardware-pair">
              <div className="pc-control-field">
                <span className="pc-control-label">Kâğıt Yönü</span>
                <AppleGlassSegment
                  ariaLabel="Kâğıt yönü"
                  fullWidth
                  compact
                  activeId={orientation}
                  items={[
                    { id: 'portrait', label: 'Dikey', iconHint: 'Portre' },
                    { id: 'landscape', label: 'Yatay', iconHint: 'Kimlik' },
                  ]}
                  onChange={(id) => onChangeOrientation(id as PrintOrientation)}
                />
              </div>

              <div className="pc-control-field">
                <span className="pc-control-label">Çift Yüz</span>
                <AppleGlassSegment
                  ariaLabel="Çift yüz baskı"
                  fullWidth
                  compact
                  activeId={duplex === 'simplex' ? 'simplex' : 'vertical'}
                  items={[
                    { id: 'simplex', label: 'Tek Yüz', iconHint: 'Kimlik' },
                    { id: 'vertical', label: 'Çift Yüz', iconHint: 'Kopya' },
                  ]}
                  onChange={(id) => onChangeDuplex(id as PrintDuplexMode)}
                />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
});
