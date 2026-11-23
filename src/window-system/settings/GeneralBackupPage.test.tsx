import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';

MotionGlobalConfig.skipAnimations = true;

let downloaded: { name: string; blob: Blob } | null = null;

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  downloaded = null;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        downloaded = { name: '', blob };
        return 'blob:test';
      },
      revokeObjectURL: () => undefined,
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (downloaded) downloaded.name = this.download;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function renderSettingsBackupPage() {
  const [{ default: App }, { StudioQueryProvider }, db] = await Promise.all([
    import('../../App'),
    import('../../system/query/StudioQueryProvider'),
    import('../../system/sqlite/studioDatabase'),
  ]);
  render(
    <StudioQueryProvider>
      <App />
    </StudioQueryProvider>,
  );
  let schoolId = '';
  act(() => {
    schoolId = db.studioDbActions.createSchool({
      name: 'Gizli Veri Koleji',
      institutionCode: '778899',
      address: 'Merkez',
      notes: 'Not',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const classId = db.studioDbActions.addClass('5-A', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(classId, [
      { studentNumber: '501', firstName: 'Gökçen Şule', lastName: 'Doğan' },
    ]);
    const studentId = db.getStudioDatabaseSnapshot().students[0]!.id;
    db.studioDbActions.uploadPhotos([{ fileName: '501.png', dataUrl: TINY_PNG }], classId, 'number', studentId);
    const photoId = db.getStudioDatabaseSnapshot().photos[0]!.id;
    db.studioDbActions.updatePhotoStudioSettings(
      photoId,
      { zoom: 1.15, brightness: 104, contrast: 101, warmth: 2, rotation: 90 },
      false,
    );
  });

  fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
  await screen.findByRole('dialog', { name: 'MarbleOS Sistem Ayarları ve El Kitabı' });
  fireEvent.click(screen.getByRole('button', { name: /Şifreli Yedekleme/ }));
  await screen.findByText('Şifreli Yedekleme ve Geri Yükleme Merkezi');
  return { db, schoolId };
}

test('settings backup page exports encrypted .marbleos-yedek and restores only with the right password', async () => {
  const { db, schoolId } = await renderSettingsBackupPage();

  fireEvent.click(screen.getByRole('radio', { name: /Tekil Okul/ }));
  const [pw, pw2] = screen.getAllByLabelText(/Parola/) as HTMLInputElement[];
  expect(pw!.type).toBe('password');
  fireEvent.change(pw!, { target: { value: 'kisa1' } });
  fireEvent.change(pw2!, { target: { value: 'kisa1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Şifreli Okul Yedeğini İndir' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Parola en az 10 karakter olmalı.');
  expect(downloaded).toBeNull();

  fireEvent.change(pw!, { target: { value: 'Okul-Yedek-2026!' } });
  fireEvent.change(pw2!, { target: { value: 'Okul-Yedek-2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Şifreli Okul Yedeğini İndir' }));
  await vi.waitFor(() => expect(downloaded?.name).toMatch(/\.marbleos-yedek$/), { timeout: 10_000 });
  const fileText = await downloaded!.blob.text();
  expect(JSON.parse(fileText).format).toBe('marbleos-school-backup-v2-encrypted');
  for (const secret of ['Gizli Veri Koleji', 'Gökçen Şule', '778899']) expect(fileText).not.toContain(secret);

  act(() => {
    db.studioDbActions.deleteSchool(schoolId);
  });
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(0);

  const file = new File([fileText], downloaded!.name, { type: 'application/octet-stream' });
  fireEvent.change(screen.getByLabelText('Yedek dosyası'), { target: { files: [file] } });
  const unlock = await screen.findByLabelText(/Açma Parolası/);
  fireEvent.change(unlock, { target: { value: 'Yanlis-Parola-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Yedeği Geri Yükle' }));
  await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Parola yanlış'), { timeout: 10_000 });
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(0);

  fireEvent.change(screen.getByLabelText(/Açma Parolası/), { target: { value: 'Okul-Yedek-2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Yedeği Geri Yükle' }));
  await vi.waitFor(() => expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(1), { timeout: 10_000 });
  const snap = db.getStudioDatabaseSnapshot();
  expect(snap.schools[0]?.name).toBe('Gizli Veri Koleji');
  expect(snap.students.map((s) => s.firstName)).toEqual(['Gökçen Şule']);
  const restoredPhoto = snap.photos.find((p) => p.id === snap.students[0]?.matchedPhotoId);
  expect(restoredPhoto?.fileName).toBe('501.png');
  expect(restoredPhoto?.adjustments.zoom).toBe(1.15);
  expect(restoredPhoto?.adjustments.rotation).toBe(90);
}, 30_000);

test('settings backup page rejects files that are not MarbleOS backups', async () => {
  await renderSettingsBackupPage();
  const file = new File(['{"hello":"world"}'], 'baska.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText('Yedek dosyası'), { target: { files: [file] } });
  expect((await screen.findByRole('alert')).textContent).toBe('Bu dosya bir MarbleOS okul veya kasa yedeği değil.');
  expect((screen.getByRole('button', { name: 'Yedeği Geri Yükle' }) as HTMLButtonElement).disabled).toBe(true);
});

test('settings backup page exports encrypted .marbleos-kasa and restores all schools', async () => {
  const { db, schoolId } = await renderSettingsBackupPage();
  let secondSchoolId = '';
  act(() => {
    secondSchoolId = db.studioDbActions.createSchool({
      name: 'İkinci Kampüs Lisesi',
      institutionCode: '445566',
      address: 'Kuzey',
      notes: '',
      makeBiometric: true,
      makeVesikalik: false,
    });
  });

  const [pw, pw2] = screen.getAllByLabelText(/Parola/) as HTMLInputElement[];
  fireEvent.change(pw!, { target: { value: 'Kasa-Yedek-2026!' } });
  fireEvent.change(pw2!, { target: { value: 'Kasa-Yedek-2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Şifreli Kasa Yedeğini İndir' }));

  await vi.waitFor(() => expect(downloaded?.name).toMatch(/\.marbleos-kasa$/), { timeout: 15_000 });
  const kasaText = await downloaded!.blob.text();
  expect(JSON.parse(kasaText).format).toBe('marbleos-workspace-backup-v1-encrypted');
  expect(kasaText).not.toContain('Gizli Veri Koleji');
  expect(kasaText).not.toContain('İkinci Kampüs Lisesi');

  act(() => {
    db.studioDbActions.deleteSchoolsBatch([schoolId, secondSchoolId]);
  });
  expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(0);

  const file = new File([kasaText], downloaded!.name, { type: 'application/octet-stream' });
  fireEvent.change(screen.getByLabelText('Yedek dosyası'), { target: { files: [file] } });
  const unlock = await screen.findByLabelText(/Açma Parolası/);
  fireEvent.change(unlock, { target: { value: 'Kasa-Yedek-2026!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Yedeği Geri Yükle' }));

  await vi.waitFor(() => expect(db.getStudioDatabaseSnapshot().schools).toHaveLength(2), { timeout: 15_000 });
  expect(db.getStudioDatabaseSnapshot().schools.map((s) => s.name)).toEqual([
    'Gizli Veri Koleji',
    'İkinci Kampüs Lisesi',
  ]);
  expect(db.getStudioDatabaseSnapshot().students[0]?.firstName).toBe('Gökçen Şule');
}, 40_000);
