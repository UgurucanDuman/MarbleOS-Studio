import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import { photoAdjustmentStyle, StudioPhotoImage } from '../../../system/storage/StudioPhotoImage';

/**
 * İZOLE MODÜL 03 · YATAY ÖĞRENCİ ŞERİDİ:
 * Fare tekerleği ile sağa/sola akıcı kaydırma, sol/sağ yön butonları, tut-sürükle kaydırma
 * ve sınıftaki tüm gerçek öğrencilere kesintisiz erişim sağlar.
 * Dosya Sınırı Kuralı: .tsx <= 350 satır.
 */

export const PvcStudentFilmstrip: React.FC<{
  students: readonly StudentRecord[];
  activeStudentId: string | null;
  photoMap: ReadonlyMap<string, PhotoRecord>;
  onSelectStudentId: (id: string) => void;
}> = React.memo(({ students, activeStudentId, photoMap, onSelectStudentId }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ down: boolean; startX: number; startLeft: number; moved: boolean }>({
    down: false,
    startX: 0,
    startLeft: 0,
    moved: false,
  });
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    syncEdges();

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (el.scrollWidth <= el.clientWidth + 2) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      el.scrollLeft += delta * 1.15;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', syncEdges, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncEdges) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', syncEdges);
      ro?.disconnect();
    };
  }, [students.length, syncEdges]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !activeStudentId) return;
    const activeChip = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (typeof activeChip?.scrollIntoView === 'function') {
      activeChip.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  }, [activeStudentId]);

  const scrollByStep = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(220, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <div className="pvc-filmstrip-shell">
      <button
        type="button"
        className="pvc-film-nav-btn"
        aria-label="Öğrenci şeridini sola kaydır"
        title="Sola kaydır"
        disabled={!edges.left}
        onClick={() => scrollByStep(-1)}
      >
        ‹
      </button>

      <div
        ref={trackRef}
        className="pvc-filmstrip"
        role="listbox"
        aria-label="Sınıftaki gerçek öğrenci kayıtları"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const el = trackRef.current;
          if (!el) return;
          dragRef.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          const el = trackRef.current;
          if (!d.down || !el) return;
          const dx = e.clientX - d.startX;
          if (Math.abs(dx) > 6) d.moved = true;
          if (d.moved) el.scrollLeft = d.startLeft - dx;
        }}
        onPointerUp={() => {
          dragRef.current.down = false;
        }}
        onPointerCancel={() => {
          dragRef.current.down = false;
        }}
      >
        {students.map((stu) => {
          const photo = stu.matchedPhotoId ? photoMap.get(stu.matchedPhotoId) : undefined;
          const isCurrent = activeStudentId === stu.id;
          return (
            <button
              key={stu.id}
              type="button"
              role="option"
              aria-selected={isCurrent}
              aria-label={`${stu.studentNumber} · ${stu.firstName} ${stu.lastName}`}
              title={`${stu.studentNumber} · ${stu.firstName} ${stu.lastName}`}
              className={`pvc-film-chip ${isCurrent ? 'is-active' : ''}`.trim()}
              onClick={() => {
                if (dragRef.current.moved) {
                  dragRef.current.moved = false;
                  return;
                }
                onSelectStudentId(stu.id);
              }}
            >
              <span className="pvc-film-thumb">
                {photo ? (
                  <StudioPhotoImage
                    photo={photo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={photoAdjustmentStyle(photo.adjustments, true)}
                  />
                ) : (
                  <em>{stu.firstName.slice(0, 1).toLocaleUpperCase('tr-TR')}</em>
                )}
              </span>
              <span className="pvc-film-name" aria-hidden={!isCurrent}>
                <strong>{stu.firstName} {stu.lastName}</strong>
                <small>No: {stu.studentNumber}</small>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="pvc-film-nav-btn"
        aria-label="Öğrenci şeridini sağa kaydır"
        title="Sağa kaydır"
        disabled={!edges.right}
        onClick={() => scrollByStep(1)}
      >
        ›
      </button>
    </div>
  );
});
