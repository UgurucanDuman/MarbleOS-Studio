import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { PhotoRecord, StudentRecord } from '../../../system/sqlite/types';
import { DEFAULT_PHOTO_ADJUSTMENTS } from '../../../system/storage/photoColorMath';
import { PhotoMatcherSidebar } from './PhotoMatcherSidebar';

MotionGlobalConfig.skipAnimations = true;

afterEach(() => cleanup());

const SAMPLE_STUDENT: StudentRecord = {
  id: 'stu-1',
  classId: 'cls-1',
  studentNumber: '702',
  firstName: 'Duru',
  lastName: 'Kablanoğlu',
  matchedPhotoId: 'pho-1',
  printReady: false,
  updatedAt: '2026-11-10T10:00:00.000Z',
};

const SAMPLE_PHOTO: PhotoRecord = {
  id: 'pho-1',
  fileName: 'P1420370.JPG',
  classId: 'cls-1',
  studentId: 'stu-1',
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  approvedForPrint: false,
  adjustments: { ...DEFAULT_PHOTO_ADJUSTMENTS },
  createdAt: '2026-11-10T10:00:00.000Z',
};

test('toggles portrait drawer open (bottom-up) and closed (top-down) via Resimleri Gizle / Resimleri Göster', () => {
  function Harness() {
    const [show, setShow] = useState(true);
    return (
      <PhotoMatcherSidebar
        matchMode="sequence"
        busy={false}
        activeStudent={SAMPLE_STUDENT}
        activePhoto={SAMPLE_PHOTO}
        showPreview={show}
        onChangeMatchMode={vi.fn()}
        onPickFolder={vi.fn()}
        onPickBatchFiles={vi.fn()}
        onPickSingleFile={vi.fn()}
        onShift={vi.fn()}
        onUnassignActivePhoto={vi.fn()}
        onTogglePreview={() => setShow((v) => !v)}
      />
    );
  }

  const { container } = render(<Harness />);
  const drawer = container.querySelector('.xl-matcher-preview-drawer');
  expect(drawer?.classList.contains('is-open')).toBe(true);
  expect(drawer?.getAttribute('aria-hidden')).toBe('false');

  const hideBtn = screen.getByRole('button', { name: 'Resimleri Gizle' });
  expect(hideBtn.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(hideBtn);

  expect(drawer?.classList.contains('is-open')).toBe(false);
  expect(drawer?.getAttribute('aria-hidden')).toBe('true');

  const showBtn = screen.getByRole('button', { name: 'Resimleri Göster' });
  expect(showBtn.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(showBtn);

  expect(drawer?.classList.contains('is-open')).toBe(true);
  expect(screen.getByText('Duru Kablanoğlu')).toBeTruthy();
  expect(screen.getByText('P1420370.JPG')).toBeTruthy();
});
