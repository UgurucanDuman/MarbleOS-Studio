import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowWorkEnabled } from '../../system/motion/windowWork';

const EDGE_TOLERANCE = 1;

function maxScrollLeft(track: HTMLElement) {
  return Math.max(0, track.scrollWidth - track.clientWidth);
}

export function useSegmentScroll(activeId: string, itemCount: number, fullWidth: boolean, reduced: boolean) {
  const enabled = useWindowWorkEnabled();
  const trackRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<number | null>(null);
  const edgesRef = useRef({ left: false, right: false });
  const [edges, setEdges] = useState(edgesRef.current);

  const scrollTo = useCallback((track: HTMLDivElement, left: number) => {
    const destination = Math.min(Math.max(0, left), maxScrollLeft(track));
    if (Math.abs(track.scrollLeft - destination) <= EDGE_TOLERANCE && targetRef.current === null) return;
    targetRef.current = destination;
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left: destination, behavior: reduced ? 'auto' : 'smooth' });
    } else {
      track.scrollLeft = destination;
    }
  }, [reduced]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;
    let frame = 0;
    let maximum = 0;

    const syncEdges = () => {
      frame = 0;
      const position = track.scrollLeft;
      if (targetRef.current !== null && Math.abs(position - targetRef.current) <= EDGE_TOLERANCE) {
        targetRef.current = null;
      }
      const left = position > EDGE_TOLERANCE;
      const right = maximum - position > EDGE_TOLERANCE;
      if (left === edgesRef.current.left && right === edgesRef.current.right) return;
      edgesRef.current = { left, right };
      setEdges(edgesRef.current);
    };
    const measure = () => {
      maximum = maxScrollLeft(track);
      if (targetRef.current !== null && targetRef.current > maximum) targetRef.current = null;
      if (frame) cancelAnimationFrame(frame);
      syncEdges();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(syncEdges);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      targetRef.current = null;
      if (maximum <= EDGE_TOLERANCE || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1;
      const left = Math.max(0, Math.min(maximum, track.scrollLeft + event.deltaY * unit));
      if (left === track.scrollLeft || !event.cancelable) return;
      event.preventDefault();
      track.scrollLeft = left;
    };
    const stopArrowScroll = () => {
      if (targetRef.current === null) return;
      targetRef.current = null;
      if (typeof track.scrollTo === 'function') track.scrollTo({ left: track.scrollLeft, behavior: 'auto' });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(track);
    if (itemsRef.current) observer?.observe(itemsRef.current);
    measure();
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('wheel', onWheel, { passive: false });
    track.addEventListener('pointerdown', stopArrowScroll, { passive: true });
    return () => {
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('wheel', onWheel);
      track.removeEventListener('pointerdown', stopArrowScroll);
      targetRef.current = null;
    };
  }, [enabled, itemCount]);

  const revealTab = useCallback((tab: HTMLElement) => {
    const track = trackRef.current;
    if (!enabled || fullWidth || !track || maxScrollLeft(track) <= EDGE_TOLERANCE) return;
    const start = tab.offsetLeft - 4;
    const end = tab.offsetLeft + tab.offsetWidth + 4;
    if (start < track.scrollLeft - EDGE_TOLERANCE) {
      scrollTo(track, start);
    } else if (end > track.scrollLeft + track.clientWidth + EDGE_TOLERANCE) {
      scrollTo(track, end - track.clientWidth);
    }
  }, [enabled, fullWidth, scrollTo]);

  useEffect(() => {
    if (!activeId) return;
    const tab = trackRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (tab) revealTab(tab);
  }, [activeId, itemCount, revealTab]);

  const scrollByStep = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const base = targetRef.current ?? track.scrollLeft;
    scrollTo(track, base + direction * Math.max(96, track.clientWidth * 0.75));
  };

  return { trackRef, itemsRef, edges, revealTab, scrollByStep };
}
