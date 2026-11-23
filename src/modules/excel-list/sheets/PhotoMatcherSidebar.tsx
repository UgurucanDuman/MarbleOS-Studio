import React from 'react';
import { AppleCrossfadeSlot } from '../../../system/motion/AppleCrossfadeSlot';
import type { PhotoMatchMode } from '../../../system/schemas/studioSchemas';
import type { PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import { photoAdjustmentStyle, StudioPhotoImage } from '../../../system/storage/StudioPhotoImage';
import { AppleSelect } from '../../../window-system/sheet/AppleSelect';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Sınıf Fotoğraf Eşleştirme Sağ Görev & Animasyonlu Portre Çekmecesi
 * "Resimleri Göster" tıklandığında portre kartı aşağıdan yukarıya Apple yay eğrisiyle yükselir;
 * "Resimleri Gizle" tıklandığında aşağıya doğru süzülerek kapanır.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PhotoMatcherSidebar: React.FC<{
  matchMode: PhotoMatchMode;
  busy: boolean;
  activeStudent: StudentRecord | null;
  activePhoto: PhotoRecord | null;
  showPreview: boolean;
  onChangeMatchMode: (mode: PhotoMatchMode) => void;
  onPickFolder: () => void;
  onPickBatchFiles: () => void;
  onPickSingleFile: () => void;
  onShift: (direction: 'delete-shift-up' | 'insert-gap-down') => void;
  onUnassignActivePhoto: () => void;
  onTogglePreview: () => void;
}> = ({
  matchMode,
  busy,
  activeStudent,
  activePhoto,
  showPreview,
  onChangeMatchMode,
  onPickFolder,
  onPickBatchFiles,
  onPickSingleFile,
  onShift,
  onUnassignActivePhoto,
  onTogglePreview,
}) => (
  <aside className="xl-matcher-side">
    <div className="xl-matcher-tasks">
      <span className="xl-inspector-title">
        <SheetAutoIcon text="Fotoğraf" size={13} />
        Fotoğraf Eşleştirme Görevleri
      </span>
      <AppleSelect
        ariaLabel="Fotoğraf eşleştirme kuralı"
        disabled={busy}
        value={matchMode}
        onChange={(val) => onChangeMatchMode(val as PhotoMatchMode)}
        options={[
          { value: 'sequence', label: 'Çekim Sırası (1.jpg, 2.jpg → Liste Sırası)', iconHint: 'Sırala' },
          { value: 'smart', label: 'Akıllı (Okul No / Ad Soyad)', iconHint: 'Fotoğraf' },
          { value: 'number', label: 'Okul Numarasına Göre (165.jpg)', iconHint: 'Numara' },
          { value: 'name', label: 'Ad Soyada Göre (Ali Yilmaz.jpg)', iconHint: 'Ad' },
        ]}
      />

      <button
        type="button"
        className="xl-btn xl-btn-primary xl-inspector-wide-btn"
        disabled={busy}
        onClick={onPickFolder}
      >
        <SheetAutoIcon text="Klasör" size={13} />
        <span>Sınıf Fotoğraf Klasörünü Seç</span>
      </button>
      <button
        type="button"
        className="xl-btn xl-inspector-wide-btn"
        disabled={busy}
        onClick={onPickBatchFiles}
      >
        <SheetAutoIcon text="Klasör" size={13} />
        <span>Fotoğraf Dosyalarını Seç</span>
      </button>
      <button
        type="button"
        className="xl-btn xl-inspector-wide-btn"
        disabled={!activeStudent || busy}
        onClick={onPickSingleFile}
      >
        <SheetAutoIcon text="Fotoğraf" size={13} />
        <span>Resim Ekle / Değiştir</span>
      </button>
      <button
        type="button"
        className="xl-btn xl-inspector-wide-btn"
        disabled={!activeStudent || busy}
        title="Seçili satırdaki resmi siler ve altındaki tüm resimleri 1 satır yukarı kaydırır"
        onClick={() => onShift('delete-shift-up')}
      >
        <SheetAutoIcon text="Sil" size={13} />
        <span>Resim Satırını Sil (Altındakileri ↑)</span>
      </button>
      <button
        type="button"
        className="xl-btn xl-inspector-wide-btn"
        disabled={!activeStudent || busy}
        title="Gelmeyen öğrenci için bu satırı boş bırakır ve resimleri 1 satır aşağı kaydırır"
        onClick={() => onShift('insert-gap-down')}
      >
        <SheetAutoIcon text="Aşağı" size={13} />
        <span>Yeni Boş Satır Bırak (Altındakileri ↓)</span>
      </button>

      {activePhoto && (
        <button
          type="button"
          className="xl-btn xl-btn-danger xl-inspector-wide-btn"
          disabled={busy}
          onClick={onUnassignActivePhoto}
        >
          <SheetAutoIcon text="Sil" size={13} />
          <span>Sadece Bu Resmi Kaldır</span>
        </button>
      )}
    </div>

    <div className="xl-matcher-preview-card">
      <div className="xl-matcher-preview-head">
        <span className="xl-inspector-title">
          <SheetAutoIcon text="Görsel" size={12.5} />
          Seçili Portre
        </span>
        <button
          type="button"
          className="xl-mini-btn"
          aria-expanded={showPreview}
          onClick={onTogglePreview}
        >
          {showPreview ? 'Resimleri Gizle' : 'Resimleri Göster'}
        </button>
      </div>

      <div
        className={`xl-matcher-preview-drawer ${showPreview ? 'is-open' : ''}`.trim()}
        aria-hidden={!showPreview}
      >
        <div className="xl-matcher-preview-drawer-inner">
          <AppleCrossfadeSlot activeKey={`${activeStudent?.id ?? 'none'}:${activePhoto?.id ?? 'empty'}`} variant="card">
            <div className="xl-matcher-preview-box">
              {activePhoto ? (
                <>
                  <StudioPhotoImage photo={activePhoto} alt="" style={photoAdjustmentStyle(activePhoto.adjustments)} />
                  <div className="xl-matcher-preview-meta">
                    <strong>{activeStudent ? `${activeStudent.firstName} ${activeStudent.lastName}` : ''}</strong>
                    <small>{activePhoto.fileName}</small>
                  </div>
                </>
              ) : (
                <small>
                  {activeStudent
                    ? `${activeStudent.firstName} ${activeStudent.lastName} için fotoğraf atanmadı`
                    : 'Önizleme için satır seçin'}
                </small>
              )}
            </div>
          </AppleCrossfadeSlot>
        </div>
      </div>
    </div>
  </aside>
);

