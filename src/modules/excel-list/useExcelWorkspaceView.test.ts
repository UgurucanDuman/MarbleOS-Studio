import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useExcelWorkspaceView } from './useExcelWorkspaceView';

test('opening another school classes never bounces back to schools while deferred view settles', () => {
  const seenViews: string[] = [];
  const { result, rerender } = renderHook(
    ({ activeSchoolId }) => {
      const value = useExcelWorkspaceView(activeSchoolId);
      seenViews.push(value.view);
      return value;
    },
    { initialProps: { activeSchoolId: 'sch-1' as string | null } },
  );

  expect(result.current.view).toBe('schools');
  act(() => result.current.setPendingOpenSchoolId('sch-2'));
  // Disk commit olmadan görünüm hâlâ okullar kalır.
  expect(result.current.view).toBe('schools');

  seenViews.length = 0;
  // Disk commit yayınlanır: ilk render'da doğrudan 'classes' açılır.
  rerender({ activeSchoolId: 'sch-2' });
  expect(result.current.view).toBe('classes');
  expect(result.current.requestedView).toBe('classes');

  // onSuccess -> switchView('classes') çağrısında ara bir 'schools' karesine geri sekmez.
  act(() => result.current.switchView('classes'));
  expect(result.current.view).toBe('classes');
  expect(seenViews).not.toContain('schools');

  // Okullar sekmesine dönüş temiz çalışır.
  act(() => result.current.switchView('schools'));
  expect(result.current.requestedView).toBe('schools');
  expect(result.current.view).toBe('schools');
});
