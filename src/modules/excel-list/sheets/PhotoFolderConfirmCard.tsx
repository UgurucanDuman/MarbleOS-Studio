import React from 'react';
import type { PhotoMatchMode } from '../../../system/schemas/studioSchemas';
import { comparePhotoNames, formatPhotoSize } from '../../../system/storage/photoImport';
import { SheetAutoIcon } from '../../../window-system/sheet/SheetFieldIcons';
import './photo-folder-confirm.css';

export interface PendingFolderImport {
  folderName: string;
  files: File[];
  totalBytes: number;
  skippedCount: number;
}

const MATCH_MODE_LABELS: Record<PhotoMatchMode, string> = {
  sequence: 'Çekim Sırası (1.jpg, 2.jpg → Liste Sırası)',
  smart: 'Akıllı (Okul No / Ad Soyad)',
  number: 'Okul Numarasına Göre',
  name: 'Ad Soyada Göre',
};

/**
 * İZOLE MODÜL 01 ALT BİLEŞENİ: Apple Pro Klasör Aktarım Onay Kartı
 * Tarayıcı/Edge'in "Bu sitedeki tüm dosyalar karşıya yüklensin mi?" uyarısı yerine
 * uygulama içi saf siyah onay ve dosya önizleme yüzeyi sunar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PhotoFolderConfirmCard: React.FC<{
  pending: PendingFolderImport;
  matchMode: PhotoMatchMode;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ pending, matchMode, busy, onConfirm, onCancel }) => {
  const orderedNames = [...pending.files]
    .map((f) => f.name)
    .sort(comparePhotoNames);
  const previewNames = orderedNames.slice(0, 4).join(', ');
  const extraCount = Math.max(0, orderedNames.length - 4);

  return (
    <div className="xl-folder-confirm" role="region" aria-label="Klasör aktarım onayı">
      <div className="xl-folder-confirm-info">
        <div className="xl-folder-confirm-head">
          <SheetAutoIcon text="Klasör" size={14} />
          <strong>“{pending.folderName}” klasöründeki fotoğraflar aktarılsın mı?</strong>
        </div>
        <p className="xl-folder-confirm-meta">
          <strong>{pending.files.length} yeni fotoğraf</strong> · {formatPhotoSize(pending.totalBytes)}
          {pending.skippedCount > 0 ? ` · ${pending.skippedCount} mevcut atlandı` : ''}
          {' · '}Kural: {MATCH_MODE_LABELS[matchMode]}
        </p>
        <p className="xl-folder-confirm-files">
          {previewNames}
          {extraCount > 0 ? ` +${extraCount} fotoğraf daha` : ''}
        </p>
      </div>
      <div className="xl-folder-confirm-actions">
        <button type="button" className="xl-btn" disabled={busy} onClick={onCancel}>
          Vazgeç
        </button>
        <button type="button" className="xl-btn xl-btn-primary" disabled={busy} onClick={onConfirm}>
          <SheetAutoIcon text="Fotoğraf" size={13} />
          <span>{pending.files.length} Fotoğrafı Aktar</span>
        </button>
      </div>
    </div>
  );
};
