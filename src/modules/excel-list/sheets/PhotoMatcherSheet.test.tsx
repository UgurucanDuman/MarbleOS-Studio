import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioQueryProvider } from '../../../system/query/StudioQueryProvider';
import { useOriginSheet } from '../../../window-system/sheet/useOriginSheet';

MotionGlobalConfig.skipAnimations = true;

const TINY_PNG_A = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
const TINY_PNG_B = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  vi.restoreAllMocks();
});

test('PhotoMatcherSheet defaults to Çekim Sırası and uses the in-app Apple Pro folder confirm UI before importing', async () => {
  const { PhotoMatcherSheet } = await import('./PhotoMatcherSheet');
  const db = await import('../../../system/sqlite/studioDatabase');

  let classId = '';
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Atatürk İlkokulu',
      institutionCode: '701',
      address: '',
      notes: '',
      makeBiometric: true,
      makeVesikalik: true,
    });
    classId = db.studioDbActions.addClass('1-A', 'Derya', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(classId, [
      { studentNumber: '101', firstName: 'Defne', lastName: 'Ak' },
      { studentNumber: '102', firstName: 'Ege', lastName: 'Kaya' },
    ]);
  });

  // Modern tarayıcı/desktop klasör seçicisini taklit et (Edge webkitdirectory uyarısı olmadan)
  const file1 = new File([TINY_PNG_A], 'DSC001.png', { type: 'image/png' });
  const file2 = new File([TINY_PNG_B], 'DSC002.png', { type: 'image/png' });
  (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker = vi.fn().mockResolvedValue({
    kind: 'directory',
    name: '1-A Çekim',
    async *values() {
      yield { kind: 'file', name: 'DSC002.png', getFile: async () => file2 };
      yield { kind: 'file', name: 'DSC001.png', getFile: async () => file1 };
    },
  });

  const onNotice = vi.fn();

  function Harness() {
    const snap = db.useStudioDatabase();
    const sheet = useOriginSheet();
    const studentSheet = useOriginSheet();
    const cls = snap.classes.find((c) => c.id === classId)!;
    const students = snap.students.filter((s) => s.classId === classId);
    return (
      <>
        <button type="button" onClick={sheet.trigger('open').onClick}>Aç</button>
        <PhotoMatcherSheet
          controller={sheet}
          studentSheet={studentSheet}
          activeClass={cls}
          students={students}
          photos={snap.photos}
          onNotice={onNotice}
        />
      </>
    );
  }

  render(<StudioQueryProvider><Harness /></StudioQueryProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Aç' }));

  // Varsayılan kural Çekim Sırası seçili gelmelidir
  const ruleBtn = screen.getByRole('button', { name: 'Fotoğraf eşleştirme kuralı' });
  expect(ruleBtn.textContent).toContain('Çekim Sırası');

  // Klasör seçimi uygulama içi Apple Pro onay kartını açar; henüz yükleme başlamaz
  fireEvent.click(screen.getByRole('button', { name: 'Sınıf Fotoğraf Klasörünü Seç' }));
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Klasör aktarım onayı' })).toBeTruthy();
    expect(screen.getByText(/1-A Çekim/i)).toBeTruthy();
  });
  expect(db.getStudioDatabaseSnapshot().photos).toHaveLength(0);

  // Onay düğmesi tıklandığında fotoğraflar çekim sırasıyla öğrencilere eşleşir
  fireEvent.click(screen.getByRole('button', { name: '2 Fotoğrafı Aktar' }));
  await waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot();
    expect(snap.photos).toHaveLength(2);
    const defne = snap.students.find((s) => s.firstName === 'Defne')!;
    const ege = snap.students.find((s) => s.firstName === 'Ege')!;
    expect(snap.photos.find((p) => p.id === defne.matchedPhotoId)?.fileName).toBe('DSC001.png');
    expect(snap.photos.find((p) => p.id === ege.matchedPhotoId)?.fileName).toBe('DSC002.png');
  });
});
