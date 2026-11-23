export function measureSelectPopover(trigger: HTMLElement, gap: number, heightLimit: number) {
  const anchor = trigger.getBoundingClientRect();
  const pane = trigger
    .closest('.os-book-leaf-stage, .tc-rail, .os-sheet-body, .os-window-content')
    ?.getBoundingClientRect();
  const hasPaneBounds = pane && pane.height > 0;
  const top = hasPaneBounds ? Math.max(0, pane.top) : 0;
  const bottom = hasPaneBounds ? Math.min(window.innerHeight, pane.bottom) : window.innerHeight;
  const spaceBelow = bottom - anchor.bottom - gap;
  const spaceAbove = anchor.top - top - gap;
  const opensUp = spaceBelow < heightLimit && spaceAbove > spaceBelow;
  return {
    opensUp,
    maxHeight: Math.max(0, Math.min(heightLimit, opensUp ? spaceAbove : spaceBelow)),
  };
}
