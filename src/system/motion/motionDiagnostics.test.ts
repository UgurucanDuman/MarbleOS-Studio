import { expect, test } from 'vitest';
import { summarizeFrameIntervals } from './motionDiagnostics';

test('reports the actual cadence without forcing 60 Hz on a 120 Hz sample', () => {
  const result = summarizeFrameIntervals(Array.from({ length: 120 }, () => 1000 / 120));
  expect(result?.rafCadenceHz).toBe(120);
  expect(result?.intervalsOver1_5xMedian).toBe(0);
});
test('includes stalls in tail latency instead of hiding them behind average FPS', () => {
  const result = summarizeFrameIntervals([...Array.from({ length: 90 }, () => 16.67), ...Array(10).fill(100)]);
  expect(result?.p95Ms).toBe(100);
  expect(result?.intervalsOver1_5xMedian).toBe(10);
});
test('does not fabricate a frame rate for insufficient or invalid samples', () => {
  expect(summarizeFrameIntervals([])).toBeNull();
  expect(summarizeFrameIntervals([NaN, Infinity, 0])).toBeNull();
});
