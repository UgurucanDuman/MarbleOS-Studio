import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionGlobalConfig } from 'motion/react';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';

export const TABLE_CHUNK_SIZE = 20;
export const SKELETON_PULSE_MS = 240;
export type TableSliceLoadingMode = 'reset' | 'append';

/**
 * 20'şer kayıtlık sonsuz tablo dilimleyici (Infinite Scroll) + 20'li Apple Pro İskelet Yükleme (Skeleton) durumu.
 * - `resetKey`: Arama veya şube değiştiğinde dilim sınırını 20'ye sıfırlar.
 * - `skeletonKey`: Yalnızca şube/okul değiştiğinde tam tablo iskeleti ('reset') tetikler; arama yazarken anlık filtreler.
 * - `loadMore`: Kaydırma sonuna gelindiğinde mevcut satırları koruyarak altta 20 satırlık ('append') iskelet gösterir.
 */
export function useInfiniteTableSlice<T>(
  items: readonly T[],
  resetKey: string = '',
  chunkSize: number = TABLE_CHUNK_SIZE,
  _skeletonKey?: string,
  minVisibleCount: number = 0,
) {
  const workEnabled = useWindowWorkEnabled();
  const [limit, setLimit] = useState(() => Math.max(chunkSize, minVisibleCount));
  const [isSliceLoading, setIsSliceLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<TableSliceLoadingMode>('append');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseSkeleton = useCallback((mode: TableSliceLoadingMode) => {
    if (MotionGlobalConfig.skipAnimations) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoadingMode(mode);
    setIsSliceLoading(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsSliceLoading(false);
    }, SKELETON_PULSE_MS);
  }, []);

  useEffect(() => {
    setLimit(chunkSize);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsSliceLoading(false);
  }, [resetKey, chunkSize]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const effectiveLimit = Math.max(limit, minVisibleCount);
  const hasMore = effectiveLimit < items.length;

  const isWindowBusy = () =>
    typeof document !== 'undefined' &&
    document.querySelector('[data-window-resizing="true"], [data-window-transitioning="true"], [data-exiting="true"]') !== null;

  const loadMore = useCallback(() => {
    if (!workEnabled) return;
    setLimit((current) => {
      const base = Math.max(current, minVisibleCount);
      if (base >= items.length) return base;
      if (!isWindowBusy()) pulseSkeleton('append');
      return Math.min(items.length, base + chunkSize);
    });
  }, [items.length, chunkSize, minVisibleCount, pulseSkeleton, workEnabled]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (!hasMore) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 56) {
        loadMore();
      }
    },
    [hasMore, loadMore],
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!workEnabled || !node || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const scrollRoot = node.closest('.xl-table-scroll, .os-window-content');
    let observing = true;
    let deferredTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerLoad = () => {
      if (!observing) return;
      if (isWindowBusy()) {
        if (deferredTimer) clearTimeout(deferredTimer);
        deferredTimer = setTimeout(() => {
          deferredTimer = null;
          if (observing) loadMore();
        }, 200);
        return;
      }
      loadMore();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (observing && entries.some((entry) => entry.isIntersecting)) triggerLoad();
      },
      { root: scrollRoot instanceof Element ? scrollRoot : null, rootMargin: '64px' },
    );
    observer.observe(node);
    return () => {
      observing = false;
      if (deferredTimer) clearTimeout(deferredTimer);
      observer.disconnect();
    };
  }, [hasMore, loadMore, workEnabled]);

  const visibleItems = useMemo(
    () => (hasMore ? items.slice(0, effectiveLimit) : items),
    [items, hasMore, effectiveLimit],
  );

  return {
    visibleItems,
    visibleCount: visibleItems.length,
    totalCount: items.length,
    hasMore,
    isSliceLoading,
    loadingMode,
    loadMore,
    handleScroll,
    sentinelRef,
  };
}
