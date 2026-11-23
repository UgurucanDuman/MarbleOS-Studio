import { memo } from 'react';
import { useReducedMotion } from 'motion/react';
import { useSegmentScroll } from '../../window-system/sheet/useSegmentScroll';
import type { ImpositionPage } from './printSpecs';

export const PrintPageStrip = memo(function PrintPageStrip({ pages, activeIndex, onChangePage }: {
  pages: readonly ImpositionPage[];
  activeIndex: number;
  onChangePage: (pageIndex: number, direction: number) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const { trackRef, itemsRef, edges, revealTab, scrollByStep } = useSegmentScroll(String(activeIndex), pages.length, false, reduced);
  const showArrows = edges.left || edges.right;

  return (
    <div className="pc-filmstrip-shell">
      {showArrows && (
        <button
          type="button"
          className="pc-step-btn"
          aria-label="Sayfa şeridini sola kaydır"
          disabled={!edges.left}
          onClick={() => scrollByStep(-1)}
        >
          ‹
        </button>
      )}
      <div ref={trackRef} className="pc-filmstrip" role="tablist" aria-label="Baskı sayfaları şeridi">
        <div ref={itemsRef} className="pc-filmstrip-items">
          {pages.map((page) => {
            const active = page.pageIndex === activeIndex;
            return (
              <button
                key={page.pageIndex}
                type="button"
                role="tab"
                aria-selected={active}
                className={`pc-filmstrip-chip ${active ? 'is-active' : ''}`.trim()}
                onClick={(event) => {
                  if (active) {
                    revealTab(event.currentTarget);
                  } else {
                    onChangePage(page.pageIndex, page.pageIndex > activeIndex ? 1 : -1);
                  }
                }}
              >
                <span>Sayfa {page.pageIndex + 1}</span>
                <small>{page.titleLabel || `${page.slots.length} Kayıt`}</small>
              </button>
            );
          })}
        </div>
      </div>
      {showArrows && (
        <button
          type="button"
          className="pc-step-btn"
          aria-label="Sayfa şeridini sağa kaydır"
          disabled={!edges.right}
          onClick={() => scrollByStep(1)}
        >
          ›
        </button>
      )}
    </div>
  );
});
