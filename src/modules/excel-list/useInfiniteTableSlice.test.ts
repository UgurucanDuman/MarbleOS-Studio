import React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TableSkeletonBoxes } from './TableSkeletonBoxes';
import { useInfiniteTableSlice } from './useInfiniteTableSlice';

test('slices items in chunks of 20 and loads 20 more on demand', () => {
  const rows = Array.from({ length: 55 }, (_, idx) => `row-${idx + 1}`);
  const { result, rerender } = renderHook(
    ({ key }) => useInfiniteTableSlice(rows, key, 20),
    { initialProps: { key: 'all' } },
  );

  expect(result.current.visibleCount).toBe(20);
  expect(result.current.totalCount).toBe(55);
  expect(result.current.hasMore).toBe(true);

  act(() => result.current.loadMore());
  expect(result.current.visibleCount).toBe(40);
  expect(result.current.hasMore).toBe(true);

  act(() => result.current.loadMore());
  expect(result.current.visibleCount).toBe(55);
  expect(result.current.hasMore).toBe(false);

  rerender({ key: 'search-changed' });
  expect(result.current.visibleCount).toBe(20);
});

test('renders 20-row skeleton box loading placeholders for student, school and compact tables', () => {
  const { container, rerender } = render(React.createElement(TableSkeletonBoxes, { variant: 'students' }));
  expect(container.querySelectorAll('.xl-skeleton-row.is-students')).toHaveLength(20);

  rerender(React.createElement(TableSkeletonBoxes, { variant: 'schools', overlay: true }));
  expect(container.querySelectorAll('.xl-skeleton-row.is-schools')).toHaveLength(20);
  expect(container.querySelector('.xl-skeleton-layer.is-overlay')).toBeTruthy();

  rerender(React.createElement(TableSkeletonBoxes, { variant: 'compact' }));
  expect(container.querySelectorAll('.xl-skeleton-row.is-compact')).toHaveLength(20);
});
