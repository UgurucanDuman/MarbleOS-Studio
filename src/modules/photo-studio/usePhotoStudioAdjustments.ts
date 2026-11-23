import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyStudio } from '../../system/desktop/studioToast';
import { useBatchPhotoAdjustmentsMutation } from '../../system/query/usePhotoManagementQueries';
import { useUpdatePhotoStudioMutation } from '../../system/query/useStudioQueries';
import type { PhotoAdjustments, PhotoRecord } from '../../system/sqlite/types';
import {
  arePhotoAdjustmentsEqual,
  DEFAULT_PHOTO_ADJUSTMENTS,
  normalizePhotoAdjustments,
} from '../../system/storage/photoColorMath';
import { buildSmartBatchAdjustments } from '../../system/storage/portraitSmartAlign';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';

/**
 * İZOLE MODÜL 02 KANCA: Karanlık oda yerel taslak, anlık/gecikmeli kayıt, baskı onayı ve akıllı toplu hizalama.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */
export function usePhotoStudioAdjustments(options: {
  selectedPhoto?: PhotoRecord;
  nextPhoto?: PhotoRecord;
  filteredPhotos: readonly PhotoRecord[];
  checkedPhotoIds: ReadonlySet<string>;
  onSelectPhotoId: (photoId: string) => void;
}) {
  const { selectedPhoto, nextPhoto, filteredPhotos, checkedPhotoIds, onSelectPhotoId } = options;
  const { mutate: updateStudioPhoto } = useUpdatePhotoStudioMutation();
  const batchAdjMut = useBatchPhotoAdjustmentsMutation();

  const [smartAligning, setSmartAligning] = useState(false);
  const [draftAdjustments, setDraftAdjustments] = useState<{ photoId: string; adjustments: PhotoAdjustments } | null>(null);
  const draftRef = useRef<{ photoId: string; adjustments: PhotoAdjustments } | null>(null);
  draftRef.current = draftAdjustments;

  useEffect(() => {
    if (!draftAdjustments || !selectedPhoto || draftAdjustments.photoId !== selectedPhoto.id) return;
    if (arePhotoAdjustmentsEqual(selectedPhoto.adjustments, draftAdjustments.adjustments)) {
      setDraftAdjustments(null);
    }
  }, [selectedPhoto, draftAdjustments]);

  const hasUnsavedDraft = Boolean(
    selectedPhoto &&
      draftAdjustments?.photoId === selectedPhoto.id &&
      !arePhotoAdjustmentsEqual(selectedPhoto.adjustments, draftAdjustments.adjustments),
  );
  const activeAdjustments = selectedPhoto
    ? (draftAdjustments?.photoId === selectedPhoto.id ? draftAdjustments.adjustments : selectedPhoto.adjustments)
    : undefined;
  const isSelectedApproved = Boolean(selectedPhoto?.approvedForPrint && !hasUnsavedDraft);

  const persistAdjustments = useCallback((photoId: string, adjustments: PhotoAdjustments, approvedForPrint = false) => {
    const normalized = normalizePhotoAdjustments(adjustments);
    updateStudioPhoto(
      { photoId, adjustments: normalized, approvedForPrint },
      { onError: (err) => notifyStudio(formErrorMessage(err), 'error') },
    );
  }, [updateStudioPhoto]);

  const flushDraftAdjustments = useCallback(() => {
    const curr = draftRef.current;
    if (!curr || !selectedPhoto || curr.photoId !== selectedPhoto.id) return;
    if (!arePhotoAdjustmentsEqual(selectedPhoto.adjustments, curr.adjustments)) {
      persistAdjustments(curr.photoId, curr.adjustments, false);
    }
  }, [selectedPhoto, persistAdjustments]);

  const clearDraftAdjustments = useCallback(() => {
    setDraftAdjustments(null);
  }, []);

  const patchAdjustments = useCallback((patch: Partial<PhotoAdjustments>, immediate = false) => {
    if (!selectedPhoto) return;
    const base = draftRef.current?.photoId === selectedPhoto.id ? draftRef.current.adjustments : selectedPhoto.adjustments;
    const next = normalizePhotoAdjustments({ ...base, ...patch });
    const nextDraft = { photoId: selectedPhoto.id, adjustments: next };
    draftRef.current = nextDraft;
    setDraftAdjustments(nextDraft);
    if (immediate && !arePhotoAdjustmentsEqual(selectedPhoto.adjustments, next)) {
      persistAdjustments(selectedPhoto.id, next, false);
    }
  }, [selectedPhoto, persistAdjustments]);

  const togglePrintApproval = () => {
    if (!selectedPhoto || !activeAdjustments) return;
    flushDraftAdjustments();
    persistAdjustments(selectedPhoto.id, activeAdjustments, !isSelectedApproved);
  };

  const approveAndAdvance = () => {
    if (!selectedPhoto || !activeAdjustments) return;
    flushDraftAdjustments();
    updateStudioPhoto(
      { photoId: selectedPhoto.id, adjustments: normalizePhotoAdjustments(activeAdjustments), approvedForPrint: true },
      {
        onSuccess: () => {
          setDraftAdjustments(null);
          if (nextPhoto) onSelectPhotoId(nextPhoto.id);
        },
        onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
      },
    );
  };

  const handleApplyBatch = async (target: 'checked' | 'scope', copyFraming: boolean) => {
    if (!selectedPhoto || !activeAdjustments) return;
    const targetPhotos = target === 'checked'
      ? filteredPhotos.filter((p) => checkedPhotoIds.has(p.id))
      : filteredPhotos;
    const targetIds = targetPhotos.map((p) => p.id);
    if (!targetIds.length) return;
    if (!targetIds.includes(selectedPhoto.id)) flushDraftAdjustments();
    try {
      let smartPlan: Awaited<ReturnType<typeof buildSmartBatchAdjustments>> = null;
      if (copyFraming) {
        setSmartAligning(true);
        smartPlan = await buildSmartBatchAdjustments(selectedPhoto, activeAdjustments, targetPhotos);
      }
      const count = await batchAdjMut.mutateAsync({
        photoIds: targetIds,
        sourceAdjustments: activeAdjustments,
        copyFraming,
        ...(smartPlan ? { perPhotoAdjustments: smartPlan.perPhotoAdjustments } : {}),
      });
      if (targetIds.includes(selectedPhoto.id)) setDraftAdjustments(null);
      notifyStudio(
        smartPlan
          ? `${count} kare referansa göre akıllı hizalandı (yüz boyutu, baş hizası ve ışık).`
          : copyFraming
            ? `${count} kareye ışık, renk ve kadraj ayarı uygulandı.`
            : `${count} kareye ışık ve renk kalibrasyonu uygulandı.`,
        'success',
      );
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    } finally {
      setSmartAligning(false);
    }
  };

  const handleResetBatch = async (target: 'checked' | 'scope') => {
    const targetPhotos = target === 'checked'
      ? filteredPhotos.filter((p) => checkedPhotoIds.has(p.id))
      : filteredPhotos;
    const targetIds = targetPhotos.map((p) => p.id);
    if (!targetIds.length) return;
    const clearsActiveDraft = Boolean(selectedPhoto && targetIds.includes(selectedPhoto.id) && draftRef.current);
    try {
      const count = await batchAdjMut.mutateAsync({
        photoIds: targetIds,
        sourceAdjustments: { ...DEFAULT_PHOTO_ADJUSTMENTS },
        copyFraming: true,
      });
      if (selectedPhoto && targetIds.includes(selectedPhoto.id)) {
        draftRef.current = null;
        setDraftAdjustments(null);
      }
      const affected = count > 0 ? count : clearsActiveDraft ? 1 : 0;
      notifyStudio(
        affected > 0
          ? `${affected} kare orijinal boyut, kadraj ve ışık ayarlarına döndürüldü.`
          : 'Seçili kareler zaten orijinal boyut ve ışık ayarında.',
        affected > 0 ? 'success' : 'info',
      );
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return {
    activeAdjustments,
    isSelectedApproved,
    batchBusy: batchAdjMut.isPending || smartAligning,
    flushDraftAdjustments,
    clearDraftAdjustments,
    patchAdjustments,
    togglePrintApproval,
    approveAndAdvance,
    handleApplyBatch,
    handleResetBatch,
  };
}
