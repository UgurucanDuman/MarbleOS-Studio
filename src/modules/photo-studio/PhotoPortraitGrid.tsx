import React, { useEffect, useRef } from 'react';
import type { PhotoRecord, StudentRecord } from '../../system/sqlite/types';
import { StudioPhotoImage, photoAdjustmentStyle } from '../../system/storage/StudioPhotoImage';

/**
 * İZOLE MODÜL 02 ALT BİLEŞENİ: 3:4 Portre Izgarası & Yuvarlak Apple Seçim Kartları
 * React.memo ile izole edilmiştir; sağdaki karanlık oda sürgüleri oynarken ızgara yeniden boyanmaz.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */
export const PhotoPortraitGrid: React.FC<{
  visiblePhotos: readonly PhotoRecord[];
  totalScopedCount: number;
  hasMore: boolean;
  selectedPhotoId?: string;
  checkedPhotoIds: ReadonlySet<string>;
  studentsById: ReadonlyMap<string, StudentRecord>;
  sentinelRef: React.Ref<HTMLDivElement>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onSelectPhoto: (photoId: string) => void;
  onToggleCheck: (photoId: string, checked: boolean) => void;
}> = React.memo(({
  visiblePhotos,
  totalScopedCount,
  hasMore,
  selectedPhotoId,
  checkedPhotoIds,
  studentsById,
  sentinelRef,
  onScroll,
  onSelectPhoto,
  onToggleCheck,
}) => {
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedPhotoId || !gridRef.current) return;
    const card = gridRef.current.querySelector<HTMLElement>(`[data-photo-id="${selectedPhotoId}"]`);
    if (!card || typeof card.scrollIntoView !== 'function') return;
    const grid = gridRef.current;
    const scroller = getComputedStyle(grid).overflowY === 'auto'
      ? grid
      : card.closest<HTMLElement>('.os-window-content');
    if (scroller) {
      const cRect = card.getBoundingClientRect();
      const sRect = scroller.getBoundingClientRect();
      if (cRect.top >= sRect.top && cRect.bottom <= sRect.bottom) return;
    }
    card.scrollIntoView({ block: 'nearest' });
  }, [selectedPhotoId, visiblePhotos.length]);

  return (
    <div ref={gridRef} className="mod-photo-grid" onScroll={onScroll}>
      {visiblePhotos.length === 0 && (
        <div className="ps-empty-grid">
          <strong>{totalScopedCount === 0 ? 'Bu şubede henüz stüdyo karesi yok' : 'Filtreye uygun kare bulunamadı'}</strong>
          <span>
            {totalScopedCount === 0
              ? 'Üstteki "+ Stüdyo Fotoğrafı Aktar" düğmesiyle JPEG, PNG veya WebP portrelerini içeri alın.'
              : 'Arama metnini temizleyin veya üst sekmeden "Tümü" filtresine geçin.'}
          </span>
        </div>
      )}
      {visiblePhotos.map((photo) => {
        const matchedStu = photo.studentId ? studentsById.get(photo.studentId) : undefined;
        const isSelected = selectedPhotoId === photo.id;
        return (
          <div className="studio-photo-card" key={photo.id} data-photo-id={photo.id}>
            <button
              type="button"
              onClick={() => onSelectPhoto(photo.id)}
              className={`mod-photo-tile ${isSelected ? 'active' : ''}`}
            >
              <div className="mod-photo-thumb-box">
                <StudioPhotoImage
                  loading="lazy"
                  decoding="async"
                  photo={photo}
                  alt={photo.fileName}
                  style={photoAdjustmentStyle(photo.adjustments)}
                />
                <span className={`mod-photo-dot ${photo.approvedForPrint ? 'ok' : 'warn'}`} />
              </div>
              <div className="mod-photo-meta">
                <strong>
                  {matchedStu
                    ? matchedStu.studentNumber === '0' || matchedStu.studentNumber.startsWith('0-')
                      ? `${matchedStu.firstName} ${matchedStu.lastName}`
                      : `${matchedStu.studentNumber} ${matchedStu.firstName}`
                    : 'Eşleşmedi'}
                </strong>
                <small>{photo.fileName}</small>
              </div>
            </button>
            <input
              type="checkbox"
              className="studio-photo-check"
              aria-label={`${photo.fileName} seç`}
              checked={checkedPhotoIds.has(photo.id)}
              onChange={(event) => onToggleCheck(photo.id, event.target.checked)}
            />
          </div>
        );
      })}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
    </div>
  );
});
