import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';

MotionGlobalConfig.skipAnimations = true;

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(() => cleanup());

async function renderWindow(onEditPhotos?: (classId: string, photoId?: string) => void) {
  const { ExcelListWindow } = await import('./ExcelListWindow');
  const db = await import('../../system/sqlite/studioDatabase');
  render(<StudioQueryProvider><ExcelListWindow onEditPhotos={onEditPhotos} /></StudioQueryProvider>);
  return db;
}

test('moves a student from the row action to a selected class in the same school and year', async () => {
  const db = await renderWindow();
  let destination = '';
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Deneme Okulu', institutionCode: '', address: '', notes: '',
      makeBiometric: false, makeVesikalik: true,
    });
    const source = db.studioDbActions.addClass('4-A', '', schoolId, '2026-2027');
    destination = db.studioDbActions.addClass('4-B', '', schoolId, '2026-2027');
    db.studioDbActions.addClass('4-C', '', schoolId, '2027-2028');
    db.studioDbActions.addClass('Öğretmenler', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(source, [{ studentNumber: '001', firstName: 'Ada', lastName: 'Test' }]);
  });
  fireEvent.click(screen.getByRole('tab', { name: /Sınıflar/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Ada Test sınıf değiştir' }));
  const dialog = screen.getByRole('dialog', { name: 'Sınıf Değiştir' });
  const save = within(dialog).getByRole('button', { name: 'Öğrenciyi Taşı' }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Hedef sınıf' }));
  const options = within(dialog).getAllByRole('option');
  expect(options.map((option) => option.textContent)).toEqual(['4-B']);
  fireEvent.click(options[0]);
  fireEvent.click(save);
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.queryByRole('cell', { name: '001' })).toBeNull();
  expect(db.getStudioDatabaseSnapshot().students[0].classId).toBe(destination);
  fireEvent.click(screen.getByRole('tab', { name: '4-B (1)' }));
  expect(screen.getByRole('cell', { name: '001' })).toBeTruthy();
});

test('empty start renders and the new school form shows info, templates and visuals in one form', async () => {
  await renderWindow();
  expect(screen.getByText('İlk okulunuzu ekleyin')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Yeni Okul' }));
  expect(screen.getByRole('dialog')).toBeTruthy();

  // Sekme yok: bilgiler, şablonlar ve görseller aynı formda birlikte görünür
  expect(screen.queryByRole('tab', { name: 'Okul Görselleri' })).toBeNull();
  expect(screen.getByLabelText(/Okul adı/)).toBeTruthy();
  expect(screen.getByText('Vesikalık Baskı Şablonu (45×60 mm)')).toBeTruthy();
  expect(screen.getByText('Transparan Logo')).toBeTruthy();
  expect(screen.getByText('Müdür İmzası')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Okul Resmi Seç' })).toBeTruthy();

  // Görsel yokken Sil gösterilmez, yakınlaştırma pasif kalır
  expect(screen.queryByRole('button', { name: 'Okul resmini sil' })).toBeNull();
  expect((screen.getByLabelText('Okul resmi yakınlaştırma') as HTMLInputElement).disabled).toBe(true);
});

test('student table starts with 20 rows and appends remaining rows while scrolling', async () => {
  const db = await renderWindow();
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Kendi Okulum',
      institutionCode: '123456',
      address: 'Merkez Mah. Atatürk Cad.',
      notes: 'Cuma çekimi',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const classId = db.studioDbActions.addClass('4-A', '', schoolId, '2026-2027');
    const batch = Array.from({ length: 33 }, (_, idx) => ({
      studentNumber: String(idx + 1).padStart(3, '0'),
      firstName: idx === 0 ? 'Ada' : `Öğrenci`,
      lastName: idx === 0 ? 'Test' : `No${idx + 1}`,
    }));
    db.studioDbActions.addStudentsBatch(classId, batch);
  });

  // Üstteki Apple okul seçici menüsü açılır ve okul seçilebilir
  fireEvent.click(screen.getByRole('button', { name: 'Seçili okul' }));
  const schoolPickerList = screen.getByRole('listbox', { name: 'Okullar listesi' });
  expect(schoolPickerList).toBeTruthy();
  fireEvent.click(within(schoolPickerList).getByRole('option', { name: /Kendi Okulum/ }));
  await vi.waitFor(() => expect(screen.queryByRole('listbox', { name: 'Okullar listesi' })).toBeNull());

  // İlk açılışta seçicide Okullar ilk sıradadır ve varsayılan olarak seçilidir
  const viewTabs = screen.getAllByRole('tab');
  expect(viewTabs[0]?.textContent).toContain('Okullar');
  expect(viewTabs[0]?.getAttribute('aria-selected')).toBe('true');
  expect(viewTabs[1]?.textContent).toContain('Sınıflar');
  fireEvent.click(screen.getByRole('tab', { name: /Sınıflar/ }));

  const list = screen.getByRole('region', { name: 'Kaydırılabilir öğrenci listesi' });
  const headWrap = list.closest('.xl-student-table-wrap')?.querySelector('.xl-student-head-wrap');
  expect(headWrap?.querySelector('thead')).toBeTruthy();
  expect(list.querySelector('thead')).toBeNull();
  expect(list.querySelectorAll('tbody tr')).toHaveLength(20);
  expect(screen.queryByRole('cell', { name: '021' })).toBeNull();
  Object.defineProperties(list, { clientHeight: { value: 675 }, scrollHeight: { value: 684 } });
  fireEvent.scroll(list, { target: { scrollTop: 9 } });
  expect(list.querySelectorAll('tbody tr')).toHaveLength(33);
  expect(screen.getByRole('cell', { name: '021' })).toBeTruthy();
  expect(screen.getByRole('cell', { name: '001' })).toBeTruthy();

  // Satır içi Düzenle ikonu öğrenci düzenleme kartını (Kimlik Kartı Detayları + Kişi Resmi ile) açar
  fireEvent.click(screen.getByRole('button', { name: 'Ada Test düzenle' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText('Kimlik, Vesikalık ve Albüm Baskısına Dahil Et')).toBeTruthy();
  expect(screen.getByText('Kimlik Kartı ve Kütük Bilgileri')).toBeTruthy();
  expect(screen.getByText('Standart Portre Kadrajı')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Kimlik No'), { target: { value: '12345678901' } });
  fireEvent.change(screen.getByLabelText('Bölümü / Alanı'), { target: { value: 'Bilişim Teknolojileri' } });
  fireEvent.change(screen.getByLabelText('Kan Grubu'), { target: { value: 'A Rh+' } });
  fireEvent.click(screen.getByRole('button', { name: 'Değişiklikleri Kaydet' }));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(db.getStudioDatabaseSnapshot().students[0]?.idCard?.nationalId).toBe('12345678901');
  expect(db.getStudioDatabaseSnapshot().students[0]?.idCard?.department).toBe('Bilişim Teknolojileri');
  expect(db.getStudioDatabaseSnapshot().students[0]?.idCard?.bloodType).toBe('A Rh+');

  // Tümünü Seç onay kutusu
  fireEvent.click(screen.getByRole('checkbox', { name: 'Tüm öğrencileri seç' }));
  expect(screen.getByRole('button', { name: 'Seçilenleri Sil (33)' })).toBeTruthy();

  // Okullar görünümü: Tümünü seç, Adres/Not sütunları ve satır ikonları
  fireEvent.click(screen.getByRole('tab', { name: /Okullar/ }));
  expect(screen.getByRole('listbox', { name: 'Okullar' })).toBeTruthy();
  expect(screen.getByText('Merkez Mah. Atatürk Cad.')).toBeTruthy();
  expect(screen.getAllByText('Cuma çekimi').length).toBeGreaterThanOrEqual(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Tüm okulları seç' }));
  fireEvent.click(screen.getByRole('button', { name: 'Seçilenleri Sil (1)' }));
  expect(
    screen.getByRole('button', { name: 'Tümünü silmek istediğinizden emin misiniz?' }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Kendi Okulum düzenle' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByText('Vazgeç'));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  fireEvent.click(screen.getByRole('button', { name: 'Sınıflara Geç' }));
  expect(screen.getByRole('cell', { name: 'Ada' })).toBeTruthy();
  expect(screen.getByRole('cell', { name: 'Test' })).toBeTruthy();
}, 15000);

test('Apple class ribbon, quick student capsule and studio inspector work end-to-end', async () => {
  const db = await renderWindow();
  act(() => {
    db.studioDbActions.createSchool({
      name: 'Cumhuriyet Koleji',
      institutionCode: '654321',
      address: '',
      notes: '',
      makeBiometric: true,
      makeVesikalik: true,
    });
  });

  // Okullar ilk görünüm olarak açılır; Sınıflar sekmesine geçilir
  fireEvent.click(screen.getByRole('tab', { name: /Sınıflar/ }));

  // Hızlı şube açma kapsülü ile 9-A oluşturulur
  fireEvent.change(screen.getByLabelText('Hızlı şube adı'), { target: { value: '9-A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aç' }));
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: '9-A (0)' })).toBeTruthy());

  // Seri kayıt kapsülü ile hızlı öğrenci eklenir
  fireEvent.change(screen.getByLabelText('Okul numarası'), { target: { value: '102' } });
  fireEvent.change(screen.getByLabelText('Ad'), { target: { value: 'Zeynep' } });
  fireEvent.change(screen.getByLabelText('Soyad'), { target: { value: 'Yılmaz' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hızlı Ekle' }));

  await vi.waitFor(() => expect(screen.getByRole('cell', { name: 'Zeynep' })).toBeTruthy());
  expect(screen.getByRole('cell', { name: 'Yılmaz' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Müdür' })).toBeNull();

  // Satır içi Sil ve Şubeyi Sil butonları Okul Sil ile uyumlu Apple onay kartını açar
  fireEvent.click(screen.getByRole('button', { name: 'Zeynep Yılmaz sil' }));
  expect(screen.getByRole('dialog').textContent).toContain('Öğrenciyi Sil');
  expect(screen.getByRole('button', { name: 'Kaydı Kalıcı Olarak Sil' })).toBeTruthy();
  fireEvent.click(screen.getByText('Vazgeç'));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByRole('cell', { name: 'Zeynep' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Şubeyi Sil' }));
  expect(screen.getByRole('dialog').textContent).toContain('Şubeyi Sil');
  expect(screen.getByRole('button', { name: 'Şubeyi Kalıcı Olarak Sil' })).toBeTruthy();
  fireEvent.click(screen.getByText('Vazgeç'));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  // + Öğretmen Kadrosu tek tıkla açılır; öğretmende Okul No sorulmaz, Görevi ve Müdür seçimi gösterilir
  fireEvent.click(screen.getByRole('button', { name: '+ Öğretmen Kadrosu' }));
  await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'ÖĞRETMEN (0)' })).toBeTruthy());
  await vi.waitFor(() => expect(screen.getByLabelText('Öğretmen adı')).toBeTruthy());
  expect(screen.queryByLabelText('Okul numarası')).toBeNull();
  fireEvent.change(screen.getByLabelText('Öğretmen adı'), { target: { value: 'Kemal' } });
  fireEvent.change(screen.getByLabelText('Soyad'), { target: { value: 'Demir' } });
  fireEvent.change(screen.getByLabelText('Görevi'), { target: { value: 'Matematik Öğretmeni' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hızlı Kaydet' }));
  await vi.waitFor(() => expect(screen.getByRole('cell', { name: 'Kemal' })).toBeTruthy());

  // Sağ Stüdyo Denetçisi üzerinden öğretmen kadro unvanı atanabilir ve öğrenci şubesine sınıf öğretmeni olarak bağlanabilir
  fireEvent.click(screen.getByRole('tab', { name: 'Standart' }));
  expect(screen.getByLabelText('Atanacak şube')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Şubeye Ata' }));
  await vi.waitFor(() =>
    expect(db.getStudioDatabaseSnapshot().classes.find((c) => c.name === '9-A')?.teacherName).toBe('Kemal Demir'),
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Müdür' }));
  await vi.waitFor(() => expect(screen.getAllByText('Okul Müdürü').length).toBeGreaterThanOrEqual(1));

  fireEvent.click(screen.getByRole('button', { name: 'Sınıf Fotoğraflarını Eşleştir' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sınıf Fotoğraf Klasörünü Seç' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Fotoğraf Dosyalarını Seç' })).toBeTruthy();
}, 15000);

test('selecting a student row focuses that exact student in PhotoMatcherSheet and passes matchedPhotoId to PhotoStudio', async () => {
  const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const onEditPhotos = vi.fn();
  const db = await renderWindow(onEditPhotos);
  let classId = '';
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Örnek İlkokulu',
      institutionCode: '00001',
      address: '',
      notes: '',
      makeBiometric: true,
      makeVesikalik: true,
    });
    classId = db.studioDbActions.addClass('4-A', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(classId, [
      { studentNumber: '711', firstName: 'Duru', lastName: 'Kablanoğlu' },
      { studentNumber: '712', firstName: 'Atlas', lastName: 'Çevik' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '711_P1420370.png', dataUrl: TINY_PNG },
        { fileName: '712_P1420371.png', dataUrl: TINY_PNG },
      ],
      classId,
    );
  });

  // Okullar görünümünden Sınıflar sekmesine geçilir ve tablodan 2. öğrenci (Atlas Çevik 712) seçilir
  fireEvent.click(screen.getByRole('tab', { name: /Sınıflar/ }));
  fireEvent.click(screen.getByRole('cell', { name: 'Atlas' }));

  // Fotoğrafları Düzenle tıklanınca seçili öğrencinin eşleşen fotoğraf kimliği aktarılır
  const atlasPhoto = db.getStudioDatabaseSnapshot().photos.find((p) => p.fileName === '712_P1420371.png')!;
  fireEvent.click(screen.getByRole('button', { name: 'Fotoğrafları Düzenle' }));
  expect(onEditPhotos).toHaveBeenCalledWith(classId, atlasPhoto.id);

  // Sağ denetçideki portreye tıklanınca aynı OriginSheet animasyonuyla tam boy portre önizleme açılır ve kapanır
  const zoomBtn = screen.getByRole('button', { name: 'Atlas Çevik portresini büyüt' });
  fireEvent.click(zoomBtn);
  expect(zoomBtn.getAttribute('data-sheet-trigger')).toBe('hidden');
  const previewDialog = screen.getByRole('dialog');
  expect(previewDialog.textContent).toContain('Portre Önizleme · Atlas Çevik');
  expect(previewDialog.textContent).toContain('712_P1420371.png');
  fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(zoomBtn.getAttribute('data-sheet-trigger')).toBe('visible');

  // Sınıf Fotoğraflarını Eşleştir açıldığında ilk sıradaki Duru değil, seçili Atlas Çevik ve fotoğrafı odaklanır
  fireEvent.click(screen.getByRole('button', { name: 'Sınıf Fotoğraflarını Eşleştir' }));
  const dialog = screen.getByRole('dialog');
  const selectedRow = dialog.querySelector('tbody tr.is-selected-row');
  expect(selectedRow?.textContent).toContain('712');
  expect(selectedRow?.textContent).not.toContain('#712');
  expect(selectedRow?.textContent).toContain('Atlas');
  const portraitCard = dialog.querySelector('.xl-matcher-preview-card');
  expect(portraitCard?.textContent).toContain('Atlas Çevik');
  expect(portraitCard?.textContent).toContain('712_P1420371.png');
});

test('cross-class search jumps across branches and supports 60-character student names', async () => {
  const db = await renderWindow();
  const longFirst = 'M'.repeat(60);
  const longLast = 'Y'.repeat(60);
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Merkez Fen Lisesi',
      institutionCode: '445566',
      address: '',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const class9A = db.studioDbActions.addClass('9-A', '', schoolId, '2026-2027');
    const class9B = db.studioDbActions.addClass('9-B', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(class9A, [
      { studentNumber: '101', firstName: 'Ece', lastName: 'Kaya' },
    ]);
    db.studioDbActions.addStudentsBatch(class9B, [
      { studentNumber: '205', firstName: longFirst, lastName: longLast },
    ]);
  });

  fireEvent.click(screen.getByRole('tab', { name: /Sınıflar/ }));
  expect(screen.getByRole('cell', { name: 'Ece' })).toBeTruthy();

  const crossInput = screen.getByLabelText('Tüm sınıflarda öğrenci ara');
  fireEvent.change(crossInput, { target: { value: '205' } });
  const resultsBox = await screen.findByRole('listbox', { name: 'Tüm sınıflarda arama sonuçları' });
  expect(resultsBox.textContent).toContain('9-B');
  fireEvent.click(screen.getByRole('option', { name: /205/ }));

  await vi.waitFor(() => expect(screen.getByRole('cell', { name: longFirst })).toBeTruthy());
  expect(screen.getByRole('cell', { name: longLast })).toBeTruthy();
  const inspector = screen.getByLabelText('Stüdyo Denetçisi');
  const stage = inspector.closest('.xl-class-stage');
  const split = inspector.closest('.xl-workspace-split');
  expect(inspector.className).toBe('xl-inspector');
  expect(stage).toBeTruthy();
  expect(split).toBeTruthy();
  expect(crossInput.closest('.xl-workspace-split')).toBeNull();
  expect(crossInput.closest('.xl-class-stage')).toBe(stage);
  expect(split?.contains(screen.getByRole('cell', { name: longFirst }))).toBe(true);
  expect(inspector.textContent).toContain('Okul No: 205');
});
