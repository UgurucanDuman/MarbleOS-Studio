import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowWorkEnabled } from '../motion/windowWork';

/**
 * Büyük fotoğraf/kart ızgaralarında yüzlerce DOM düğümünü ve sorgu kancasını
 * tek seferde bağlamak yerine 48'erli dilimler halinde akıcı biçimde açar.
 */
export function useProgressiveSlice<T>(
  items: readonly T[],
  resetKey: string,
  batchSize = 48,
  minVisibleCount = 0,
) {
  const workEnabled = useWindowWorkEnabled();
  const [limit, setLimit] = useState(() => Math.max(batchSize, minVisibleCount));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLimit((curr) => Math.max(batchSize, minVisibleCount, curr > batchSize ? batchSize : 0));
  }, [resetKey, batchSize]);

  const effectiveLimit = Math.max(limit, minVisibleCount);
  const hasMore = effectiveLimit < items.length;

  const loadMore = useCallback(() => {
    if (!workEnabled) return;
    setLimit((curr) => {
      const base = Math.max(curr, minVisibleCount);
      return base >= items.length ? base : Math.min(items.length, base + batchSize);
    });
  }, [items.length, batchSize, minVisibleCount, workEnabled]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (!hasMore) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 120) {
        loadMore();
      }
    },
    [hasMore, loadMore],
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!workEnabled || !node || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const scrollRoot = node.closest('.os-window-content');
    let observing = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (observing && entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { root: scrollRoot instanceof Element ? scrollRoot : null, rootMargin: '160px' },
    );
    observer.observe(node);
    return () => {
      observing = false;
      observer.disconnect();
    };
  }, [hasMore, loadMore, workEnabled]);

  const visibleItems = useMemo(
    () => (hasMore ? items.slice(0, effectiveLimit) : items),
    [items, hasMore, effectiveLimit],
  );

  return {
    visibleItems,
    hasMore,
    handleScroll,
    sentinelRef,
  };
}

