import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function BrokenModule(): never { throw new Error('private-render-detail'); }

test('a failed module leaves its sibling mounted and hides raw error details', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const suppressExpectedError = (event: ErrorEvent) => {
    if (event.error?.message === 'private-render-detail') event.preventDefault();
  };
  window.addEventListener('error', suppressExpectedError);
  try {
    render(<>
      <ModuleErrorBoundary title="Fotoğraf"><BrokenModule /></ModuleErrorBoundary>
      <ModuleErrorBoundary title="Sınıflar"><p>Diğer pencere çalışıyor</p></ModuleErrorBoundary>
    </>);
  } finally {
    window.removeEventListener('error', suppressExpectedError);
  }
  expect(screen.getByRole('alert').textContent).toContain('Fotoğraf açılamadı');
  expect(screen.getByText('Diğer pencere çalışıyor')).toBeTruthy();
  expect(screen.queryByText('private-render-detail')).toBeNull();
});
