import { useState } from 'react';
import {
  useBatchApprovePhotosMutation,
  useDeleteStudioPhotosMutation,
} from '../../system/query/usePhotoManagementQueries';
import type { ClassRecord, StudioDatabaseSnapshot } from '../../system/sqlite/types';
import { AppleGlassSegment } from '../../window-system/sheet/AppleGlassSegment';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';
import { OriginSheet } from '../../window-system/sheet/OriginSheet';
import { SheetAutoIcon } from '../../window-system/sheet/SheetFieldIcons';
import { useOriginSheet } from '../../window-system/sheet/useOriginSheet';
import { PhotoBatchMatchSheet } from './PhotoBatchMatchSheet';

export type PhotoFilterMode = 'all' | 'pending' | 'approved' | 'unmatched';

export interface PhotoFilterCounts {
  all: number;
  pending: number;
  approved: number;
  unmatched: number;
}

export function PhotoManagementBar({
  db,
  selectedClass,
  checkedIds,
  visibleCount,
  matchedCount,
  counts,
  searchQuery,
  filterMode,
  onSearchChange,
  onFilterChange,
  onToggleAll,
  onDeleted,
  onNotice,
  disabled,
}: {
  db: StudioDatabaseSnapshot;
  selectedClass?: ClassRecord;
  checkedIds: string[];
  visibleCount: number;
  matchedCount: number;
  counts: PhotoFilterCounts;
  searchQuery: string;
  filterMode: PhotoFilterMode;
  onSearchChange: (q: string) => void;
  onFilterChange: (mode: PhotoFilterMode) => void;
  onToggleAll: () => void;
  onDeleted: () => void;
  onNotice: (message: string, tone?: 'success' | 'error') => void;
  disabled: boolean;
}) {
  const approvalPct = counts.all > 0 ? Math.round((counts.approved / counts.all) * 100) : 0;
  const isAllApproved = counts.all > 0 && counts.approved === counts.all;
  const match = useOriginSheet();
  const remove = useOriginSheet();
  const deleteMut = useDeleteStudioPhotosMutation();
  const batchApproveMut = useBatchApprovePhotosMutation();
  const [deletion, setDeletion] = useState<{ classId?: string; photoIds: string[] }>({ photoIds: [] });
  const [error, setError] = useState<string | null>(null);
  const deleteTrigger = remove.trigger('delete-selected-photos');

  const submitDelete = async () => {
    try {
      const count = await deleteMut.mutateAsync(deletion);
      onDeleted();
      onNotice(`${count} fotoğraf Studio arşivinden silindi.`, 'success');
      remove.close();
    } catch (cause) {
      setError(formErrorMessage(cause));
    }
  };

  const handleBatchApprove = async () => {
    if (!checkedIds.length) return;
    try {
      const count = await batchApproveMut.mutateAsync({
        photoIds: checkedIds,
        approved: true,
        classId: selectedClass?.id,
      });
      onNotice(`${count} fotoğraf baskı onayı aldı.`, 'success');
    } catch (cause) {
      onNotice(formErrorMessage(cause), 'error');
    }
  };

  return (
    <>
      <section className="mod-command-deck" aria-label="Stüdyo kontrol ve durum şeridi">
        <div className="mod-deck-controls">
          <div className="ps-toolbar-left">
            <div className="ps-search-wrap">
              <span className="ps-search-icon" aria-hidden="true">
                <SheetAutoIcon text="Ara" size={13} />
              </span>
              <input
                type="search"
                className="ps-search-input"
                aria-label="Portrelerde ara"
                placeholder="No, ad soyad veya dosya ara…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            <AppleGlassSegment
              ariaLabel="Portre filtre sekmeleri"
              activeId={filterMode}
              compact
              onChange={(id) => onFilterChange(id as PhotoFilterMode)}
              items={[
                { id: 'all', label: `Tümü (${counts.all})`, iconHint: 'Görsel' },
                { id: 'pending', label: `Bekleyen (${counts.pending})`, iconHint: 'Parlaklık' },
                { id: 'approved', label: `Onaylı (${counts.approved})`, iconHint: 'Onay' },
                { id: 'unmatched', label: `Eşleşmeyen (${counts.unmatched})`, iconHint: 'Öğrenci' },
              ]}
            />
          </div>

          <div className="mod-btn-row studio-photo-management">
            <button
              type="button"
              className="mod-action-btn"
              disabled={disabled || !selectedClass || !counts.all}
              {...match.trigger('match-class-photos')}
            >
              Otomatik Eşleştir
            </button>
            <button
              type="button"
              className="mod-secondary-btn"
              disabled={disabled || !visibleCount}
              onClick={onToggleAll}
            >
              {checkedIds.length === visibleCount && visibleCount > 0 ? 'Seçimi Temizle' : 'Tümünü Seç'}
            </button>
            <button
              type="button"
              className="mod-secondary-btn"
              disabled={disabled || batchApproveMut.isPending || !checkedIds.length}
              onClick={() => void handleBatchApprove()}
            >
              Seçilileri Onayla ({checkedIds.length})
            </button>
            <button
              type="button"
              className="mod-secondary-btn studio-delete-photos"
              {...deleteTrigger}
              disabled={disabled || !checkedIds.length}
              onClick={(event) => {
                setDeletion({ classId: selectedClass?.id, photoIds: checkedIds });
                setError(null);
                deleteTrigger.onClick(event);
              }}
            >
              Seçilenleri Sil ({checkedIds.length})
            </button>
          </div>
        </div>

        <div className="mod-deck-telemetry">
          <div className="mod-telemetry-group">
            <span className="mod-telemetry-item">
              <SheetAutoIcon text="Fotoğraf" size={12.5} />
              <strong>{counts.all} Portre Kare</strong>
            </span>
            <span className="mod-telemetry-sep" aria-hidden="true">·</span>
            <span className="mod-telemetry-item">
              <SheetAutoIcon text="Öğrenci" size={12.5} />
              <strong>{matchedCount} / {counts.all} Eşleşti</strong>
            </span>
            {selectedClass && (
              <>
                <span className="mod-telemetry-sep" aria-hidden="true">·</span>
                <span className="mod-telemetry-muted">{selectedClass.name} · {selectedClass.academicYear}</span>
              </>
            )}
          </div>

          <div className={`mod-approval-gauge ${isAllApproved ? 'is-complete' : ''}`.trim()}>
            <SheetAutoIcon text="Onay" size={12.5} />
            <span className="mod-gauge-label">Baskı Onayı</span>
            <div className="mod-gauge-track" aria-hidden="true">
              <div className="mod-gauge-fill" style={{ width: `${approvalPct}%` }} />
            </div>
            <strong className="mod-gauge-value">
              {counts.approved} / {counts.all} (%{approvalPct})
            </strong>
          </div>
        </div>
      </section>

      {selectedClass && match.phase !== 'closed' && (
        <PhotoBatchMatchSheet controller={match} db={db} selectedClass={selectedClass} onNotice={onNotice} />
      )}
      {remove.phase !== 'closed' && (
        <OriginSheet
          controller={remove}
          title="Seçilen Fotoğrafları Sil"
          description={`${deletion.photoIds.length} fotoğraf Studio arşivinden kalıcı olarak silinecek.`}
          submitLabel="Fotoğrafları Kalıcı Sil"
          busy={deleteMut.isPending}
          error={error}
          canSubmit={deletion.photoIds.length > 0}
          onSubmit={() => void submitDelete()}
        >
          <p>Öğrenci kayıtları ve kaynak klasördeki dosyalar korunur. Silinen fotoğrafların bağlantıları ve baskı onayları temizlenir.</p>
        </OriginSheet>
      )}
    </>
  );
}
