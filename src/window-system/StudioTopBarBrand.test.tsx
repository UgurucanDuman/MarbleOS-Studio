// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { StudioTopBar } from './StudioTopBar';

afterEach(cleanup);

test('top bar always shows the fixed MarbleOS system icon, never a company logo', () => {
  const { container } = render(
    <StudioTopBar activeWindowTitle="Masaüstü" companyName="Örnek Stüdyo" companyAddress="Ankara" />,
  );
  const logoBox = container.querySelector('.os-topbar-logo-box')!;
  expect(logoBox.querySelector('svg')).not.toBeNull();
  expect(logoBox.querySelector('img')).toBeNull();
  expect(container.textContent).toContain('Örnek Stüdyo');
});
