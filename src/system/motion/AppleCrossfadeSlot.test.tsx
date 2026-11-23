import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { AppleCrossfadeSlot } from './AppleCrossfadeSlot';

const initialSkip = MotionGlobalConfig.skipAnimations;

beforeEach(() => {
  vi.useFakeTimers();
  MotionGlobalConfig.skipAnimations = false;
});

afterEach(() => {
  MotionGlobalConfig.skipAnimations = initialSkip;
  vi.useRealTimers();
  cleanup();
});

test('keeps exiting DOM node alive during crossfade, avoids stacking, and settles to idle', () => {
  const { container, rerender } = render(
    <AppleCrossfadeSlot activeKey="schools" direction={1} variant="page">
      <div data-testid="page-schools">Okullar</div>
    </AppleCrossfadeSlot>,
  );

  const initialSchoolsNode = screen.getByTestId('page-schools');
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(1);

  rerender(
    <AppleCrossfadeSlot activeKey="classes" direction={1} variant="page">
      <div data-testid="page-classes">Sınıflar</div>
    </AppleCrossfadeSlot>,
  );

  // Eski sayfa DOM düğümü yeniden mount edilmeden çıkış animasyonuna girer.
  expect(screen.getByTestId('page-schools')).toBe(initialSchoolsNode);
  const exitingCell = initialSchoolsNode.closest('.os-crossfade-cell') as HTMLElement;
  const enteringCell = screen.getByTestId('page-classes').closest('.os-crossfade-cell') as HTMLElement;
  expect(exitingCell.getAttribute('data-exiting')).toBe('true');
  expect(exitingCell.getAttribute('aria-hidden')).toBe('true');
  expect(enteringCell.getAttribute('data-entering')).toBe('true');
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(2);

  // Hızlı üçüncü geçişte en fazla 2 katman (1 çıkan + 1 giren) tutulur; yığılma olmaz.
  rerender(
    <AppleCrossfadeSlot activeKey="branch-2" direction={1} variant="page">
      <div data-testid="page-branch-2">2-B</div>
    </AppleCrossfadeSlot>,
  );
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(2);
  expect(screen.queryByTestId('page-schools')).toBeNull();
  expect(screen.getByTestId('page-classes').closest('.os-crossfade-cell')?.getAttribute('data-exiting')).toBe('true');

  // Çıkış ve giriş süreleri bitince katman durgun hale döner, DOM düğümü korunur ve sıfır inline stil kalır.
  const b2Node = screen.getByTestId('page-branch-2');
  const b2Cell = b2Node.closest('.os-crossfade-cell') as HTMLElement;
  act(() => {
    vi.advanceTimersByTime(220);
  });
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(1);
  expect(screen.getByTestId('page-branch-2')).toBe(b2Node);

  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(b2Cell.getAttribute('data-entering')).toBeNull();
  expect(b2Cell.style.cssText).toBe('');
  expect(container.querySelector('.os-crossfade-grid')?.getAttribute('data-transitioning')).toBeNull();
});

test('handles rapid back-and-forth A -> B -> A and skipAnimations cleanly', () => {
  const { container, rerender } = render(
    <AppleCrossfadeSlot activeKey="a" direction={1}>
      <div>A</div>
    </AppleCrossfadeSlot>,
  );

  rerender(
    <AppleCrossfadeSlot activeKey="b" direction={1}>
      <div>B</div>
    </AppleCrossfadeSlot>,
  );
  rerender(
    <AppleCrossfadeSlot activeKey="a" direction={-1}>
      <div>A</div>
    </AppleCrossfadeSlot>,
  );
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(2);

  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(1);
  expect(screen.getByText('A')).toBeTruthy();

  MotionGlobalConfig.skipAnimations = true;
  rerender(
    <AppleCrossfadeSlot activeKey="c" direction={1}>
      <div>C</div>
    </AppleCrossfadeSlot>,
  );
  expect(container.querySelectorAll('.os-crossfade-cell')).toHaveLength(1);
  expect(screen.getByText('C')).toBeTruthy();
});
