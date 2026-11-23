import { useCallback, useDeferredValue, useEffect, useState } from 'react';

export type WorkspaceView = 'classes' | 'schools';

/**
 * Okullar ↔ Sınıflar görünüm durumu.
 * - `requestedView`: Üst çubuktaki kayan cam hap (`AppleGlassSegment`) anında tepki verir.
 * - `view` / `viewDir`: Ağır sayfa sahnesi (`AppleCrossfadeSlot`) `useDeferredValue` ile
 *   kesilebilir/ertelenmiş olarak hazırlanır; cam hap animasyonu takılmaz.
 * - Başka bir okulun sınıflarını açarken: okul seçimi diske yazılıp yayınlandığı İLK render'da
 *   sınıflar sayfası da aynı karede açılır; `deferred.view` yetişene kadar `'schools'` ara karesine
 *   geri sekme oluşmaz.
 */
export function useExcelWorkspaceView(activeSchoolId: string | null) {
  const [state, setWorkspaceView] = useState<{ view: WorkspaceView; viewDir: number }>({
    view: 'schools', viewDir: 1,
  });
  const [pendingOpenSchoolId, setPendingOpenSchoolId] = useState<string | null>(null);
  const deferred = useDeferredValue(state);

  const switchView = useCallback((nextView: WorkspaceView) => {
    if (nextView === 'schools') setPendingOpenSchoolId(null);
    setWorkspaceView((previous) => previous.view === nextView
      ? previous
      : { view: nextView, viewDir: nextView === 'classes' ? 1 : -1 });
  }, []);

  const opening = pendingOpenSchoolId !== null && pendingOpenSchoolId === activeSchoolId;

  useEffect(() => {
    if (opening && deferred.view === 'classes') {
      setPendingOpenSchoolId(null);
    }
  }, [opening, deferred.view]);

  return {
    requestedView: opening ? 'classes' as const : state.view,
    view: opening ? 'classes' as const : deferred.view,
    viewDir: opening ? 1 : deferred.viewDir,
    switchView,
    setPendingOpenSchoolId,
  };
}
