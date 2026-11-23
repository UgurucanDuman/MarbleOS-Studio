import { useDeferredValue, useRef, useState } from 'react';
import { notifyStudio } from '../../system/desktop/studioToast';
import { useUpdateAlbumConfigMutation } from '../../system/query/useStudioQueries';
import type { AlbumLayoutKind, AlbumTemplateConfig } from '../../system/sqlite/types';
import { formErrorMessage } from '../../window-system/sheet/formErrorMessage';

/**
 * İZOLE MODÜL 03 GÖRÜNÜM SEÇİM HOOK'U: Sekme & Şube Anında Tepki + Arka Planda Hazırlanan Sahne
 * - Sekme (Sınıf Çizelgesi / Yıllık & Kütük / PVC) ve şube seçimi tıklandığı anda ekranda görünür;
 *   kalıcı kayıt arkada yapılır, kayıt hata verirse seçim kendiliğinden eski değere döner.
 * - Ağır A4 / kart sahnesi `useDeferredValue` ile düşük öncelikte hazırlanır; hazır olunca
 *   `AppleCrossfadeSlot` ile yumuşakça geçer, seçici ve kayan cam hap bu sırada takılmaz.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

const LAYOUT_ORDER: readonly AlbumLayoutKind[] = ['class-chart', 'yearbook-spread', 'id-card'];

export function useAlbumViewSelection(albumConfig: AlbumTemplateConfig) {
  // Ayrı mutation örnekleri: diğer ayar kayıtları bu seçimlerin geri çağrılarını ezmez.
  const layoutMut = useUpdateAlbumConfigMutation();
  const classMut = useUpdateAlbumConfigMutation();
  const [pendingLayout, setPendingLayout] = useState<AlbumLayoutKind | null>(null);
  const [pendingClassId, setPendingClassId] = useState<string | null>(null);
  const [layoutDir, setLayoutDir] = useState(1);
  const layoutSeq = useRef(0);
  const classSeq = useRef(0);

  const layoutKind = pendingLayout ?? albumConfig.layoutKind;
  const selectedClassId = pendingClassId ?? albumConfig.selectedClassId;

  const selectLayout = (next: AlbumLayoutKind) => {
    if (next === layoutKind) return;
    const prevIdx = LAYOUT_ORDER.indexOf(layoutKind);
    const nextIdx = LAYOUT_ORDER.indexOf(next);
    setLayoutDir(nextIdx > prevIdx ? 1 : -1);
    const seq = ++layoutSeq.current;
    setPendingLayout(next);
    layoutMut.mutate(
      { layoutKind: next },
      {
        onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
        onSettled: () => {
          if (layoutSeq.current === seq) setPendingLayout(null);
        },
      },
    );
  };

  const selectClass = (nextClassId: string) => {
    if (!nextClassId || nextClassId === selectedClassId) return;
    const seq = ++classSeq.current;
    setPendingClassId(nextClassId);
    classMut.mutate(
      { selectedClassId: nextClassId },
      {
        onError: (err) => notifyStudio(formErrorMessage(err), 'error'),
        onSettled: () => {
          if (classSeq.current === seq) setPendingClassId(null);
        },
      },
    );
  };

  return {
    layoutKind,
    selectedClassId,
    contentLayout: useDeferredValue(layoutKind),
    contentClassId: useDeferredValue(selectedClassId),
    layoutDir,
    selectLayout,
    selectClass,
  };
}
