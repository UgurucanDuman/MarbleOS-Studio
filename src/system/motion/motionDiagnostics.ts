export function summarizeFrameIntervals(intervals: number[]) {
  if (intervals.length < 2) return null;
  const sorted = intervals.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const median = sorted[Math.floor(sorted.length / 2)];
  return {
    frames: sorted.length,
    medianMs: Number(median.toFixed(2)),
    p95Ms: Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
    rafCadenceHz: Number((1000 / median).toFixed(1)),
    intervalsOver1_5xMedian: sorted.filter((value) => value > median * 1.5).length,
  };
}

/** Opt-in, local development only. rAF cadence is not a GPU utilization/FPS benchmark. */
export function installMotionDiagnostics(): () => void {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get('motion-profile') !== '1') return () => {};
  let frame: number | null = null;
  let previous: number | null = null;
  let startedAt = 0;
  let values: number[] = [];
  let stopped = false;

  const stop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previous = null;
    values = [];
  };
  const sample = (time: number) => {
    if (stopped || document.hidden) { stop(); return; }
    if (previous !== null) values.push(time - previous);
    previous = time;
    if (time - startedAt < 6000) {
      frame = requestAnimationFrame(sample);
      return;
    }
    console.info('[Studio motion profile]', JSON.stringify(summarizeFrameIntervals(values)),
      '6s development UI sample; not GPU load or high-resolution image throughput.');
    stop();
  };
  const start = () => {
    if (stopped || frame !== null || document.hidden) return;
    startedAt = performance.now();
    frame = requestAnimationFrame(sample);
  };
  const visibility = () => { if (document.hidden) stop(); };
  window.addEventListener('pointerdown', start);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    stopped = true;
    stop();
    window.removeEventListener('pointerdown', start);
    document.removeEventListener('visibilitychange', visibility);
  };
}
