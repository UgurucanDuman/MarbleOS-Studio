import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';

MotionGlobalConfig.skipAnimations = true;

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('PrintScopePanel lets the user switch schools and automatically selects all classes of the chosen school', async () => {
  const { PrintCenterWindow } = await import('./PrintCenterWindow');
  const db = await import('../../system/sqlite/studioDatabase');

  let school1Id = '';
  await act(async () => {
    school1Id = db.studioDbActions.createSchool({
      name: 'Atatürk İlkokulu',
      institutionCode: '111111',
      address: '',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const c1a = db.studioDbActions.addClass('1-A', '', school1Id, '2026-2027');
    const c1b = db.studioDbActions.addClass('1-B', '', school1Id, '2026-2027');
    db.studioDbActions.addStudentsBatch(c1a, [{ studentNumber: '101', firstName: 'Ali', lastName: 'Yılmaz' }]);
    db.studioDbActions.addStudentsBatch(c1b, [{ studentNumber: '102', firstName: 'Ayşe', lastName: 'Demir' }]);
    db.studioDbActions.uploadPhotos([{ fileName: '101.png', dataUrl: TINY_PNG }], c1a, 'number');
    db.studioDbActions.uploadPhotos([{ fileName: '102.png', dataUrl: TINY_PNG }], c1b, 'number');

    const school2Id = db.studioDbActions.createSchool({
      name: 'Cumhuriyet Ortaokulu',
      institutionCode: '222222',
      address: '',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const c5a = db.studioDbActions.addClass('5-A', '', school2Id, '2026-2027');
    db.studioDbActions.addStudentsBatch(c5a, [{ studentNumber: '501', firstName: 'Kerem', lastName: 'Kaya' }]);
    db.studioDbActions.uploadPhotos([{ fileName: '501.png', dataUrl: TINY_PNG }], c5a, 'number');

    for (const p of db.getStudioDatabaseSnapshot().photos) {
      db.studioDbActions.updatePhotoStudioSettings(p.id, p.adjustments, true);
    }
  });

  render(
    <StudioQueryProvider>
      <PrintCenterWindow />
    </StudioQueryProvider>,
  );

  // Başlangıçta son eklenen okul (Cumhuriyet Ortaokulu · 1 Şube) aktiftir
  expect(screen.getByRole('button', { name: 'Baskı okulu seç' }).textContent).toContain('Cumhuriyet Ortaokulu (1 Şube)');

  // Önce tek şube seç (5-A), ardından Tümünü Seç bağlantısı görünür
  fireEvent.click(screen.getByText('5-A').closest('button')!);
  expect(screen.getByRole('button', { name: 'Tümünü Seç' })).toBeTruthy();

  // Okul Seçimi açılır listesinden Atatürk İlkokulu seçilince otomatik Tüm Okul (2 Şube) kapsamına geçer
  fireEvent.click(screen.getByRole('button', { name: 'Baskı okulu seç' }));
  fireEvent.click(screen.getByRole('option', { name: 'Atatürk İlkokulu (2 Şube)' }));

  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().activeSchoolId).toBe(school1Id);
    expect(screen.getByRole('button', { name: 'Çıktı kapsamı' }).textContent).toContain('Tüm Okul (2 Şube)');
    expect(screen.getByText('101 Ali')).toBeTruthy();
    expect(screen.getByText('102 Ayşe')).toBeTruthy();
  });
});
