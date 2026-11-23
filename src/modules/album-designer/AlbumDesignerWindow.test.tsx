import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

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

test('AlbumDesignerWindow renders 2-line vertical names, 5x zoom, custom cover studio, schedule grid, and Baskıya Onayla handoff', async () => {
  const { StudioQueryProvider } = await import('../../system/query/StudioQueryProvider');
  const { AlbumDesignerWindow } = await import('./AlbumDesignerWindow');
  const db = await import('../../system/sqlite/studioDatabase');

  const emptyView = render(
    <StudioQueryProvider>
      <AlbumDesignerWindow />
    </StudioQueryProvider>,
  );
  expect(screen.getByText(/Önce Sınıf Listesi penceresinden kendi okul ve sınıfınızı ekleyin/i)).toBeTruthy();
  emptyView.unmount();

  let class4AId = '';
  await act(async () => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Cumhuriyet İlköğretim ve Lisesi',
      institutionCode: '755100',
      address: 'Merkez',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
      logoDataUrl: '',
      transparentLogoOpacity: 35,
      principalSignatureDataUrl: '',
      deputySignatureDataUrl: '',
      schoolPhotoDataUrl: '',
      schoolPhotoZoom: 1,
    });
    db.studioDbActions.addClass('ÖĞRETMEN', '', schoolId, '2026-2027');
    class4AId = db.studioDbActions.addClass('4-A', 'Zeynep Kaya', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(class4AId, [
      { studentNumber: '417', firstName: 'Hafize', lastName: 'Güven' },
      { studentNumber: '719', firstName: 'Bülent Demir', lastName: 'Uçar' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '417.png', dataUrl: TINY_PNG },
        { fileName: '719.png', dataUrl: TINY_PNG },
      ],
      class4AId,
      'number',
    );
  });

  const onApproveForPrint = vi.fn();

  render(
    <StudioQueryProvider>
      <AlbumDesignerWindow onApproveForPrint={onApproveForPrint} />
    </StudioQueryProvider>,
  );

  // 4-A sınıfı için otomatik 4. Sınıflar Puan Çizelgesi ve dengeli 2 satırlı kırpılmaz dikey isimler
  expect(screen.getAllByText(/4\. Sınıflar Puan Çizelgesi/i).length).toBeGreaterThan(0);
  expect(screen.getByText('417 Hafize')).toBeTruthy();
  expect(screen.getByText('Güven')).toBeTruthy();
  expect(screen.getByText('719 Bülent')).toBeTruthy();
  expect(screen.getByText('Demir Uçar')).toBeTruthy();
  expect(screen.queryByText(/#417/)).toBeNull();

  // Sığdır modunda kanonik 1040px süper-örnekleme aktif; 5x (%500) zumda ham 2600px vektör keskinlik aktif
  const initialFrame = document.querySelector('.tc-scale-frame') as HTMLElement | null;
  const initialPaper = document.querySelector('.tc-a4-paper') as HTMLElement | null;
  expect(initialFrame?.style.width).toContain('min(510px');
  expect(initialPaper?.style.width).toBe('1040px');
  expect(initialPaper?.classList.contains('is-scaled')).toBe(true);

  fireEvent.click(screen.getByRole('button', { name: '5x yakınlaştır' }));
  expect(screen.getByText('%500')).toBeTruthy();
  expect((document.querySelector('.tc-scale-frame') as HTMLElement | null)?.style.width).toBe('2600px');
  expect((document.querySelector('.tc-a4-paper') as HTMLElement | null)?.style.width).toBe('2600px');
  expect(document.querySelector('.tc-a4-paper')?.classList.contains('is-scaled')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Sığdır' }));
  expect((document.querySelector('.tc-scale-frame') as HTMLElement | null)?.style.width).toContain('min(510px');
  expect((document.querySelector('.tc-a4-paper') as HTMLElement | null)?.style.width).toBe('1040px');

  // Ders adı girildiğinde çizelge başlığına yansır
  const courseInput = screen.getByLabelText('Ders adı');
  fireEvent.change(courseInput, { target: { value: 'Matematik' } });
  await waitFor(() => {
    expect(screen.getByText(/MATEMATİK DERSİ/i)).toBeTruthy();
  });

  // Lise Not Çizelgesi -> Şablon 1 (16 Öğrenci) seçimi
  fireEvent.click(screen.getByRole('tab', { name: /Lise Not Çizelgesi/i }));
  const high16Radio = await screen.findByRole('radio', { name: /Şablon 1 · Büyük Portreli \(16 Öğrenci\)/i });
  fireEvent.click(high16Radio);
  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().albumConfig.chartTemplateId).toBe('high-16');
  });

  // Lise Cep Not Defteri -> Özel Kapak Tasarımı ve Sabah/Öğlen Ders Programı
  fireEvent.click(screen.getByRole('tab', { name: /Lise Cep Not Defteri/i }));
  const frontCoverRadio = await screen.findByRole('radio', { name: /Kapak Ön Taraf/i });
  fireEvent.click(frontCoverRadio);
  const coverTitleInput = await screen.findByLabelText('Kapak ana başlığı');
  fireEvent.change(coverTitleInput, { target: { value: 'Özel Öğretmen Defteri' } });
  await waitFor(() => {
    expect(screen.getAllByText('Özel Öğretmen Defteri').length).toBe(3);
  });

  const backCoverRadio = await screen.findByRole('radio', { name: /Kapak Arka Taraf/i });
  fireEvent.click(backCoverRadio);
  await waitFor(() => {
    expect(screen.getAllByText('HAFTALIK DERS PROGRAMI').length).toBe(3);
    expect(screen.getAllByText('SABAH').length).toBe(3);
    expect(screen.getAllByText('ÖĞLEN').length).toBe(3);
  });

  // Şube Öğretmenler Kurulu (ŞÖK) 12 Öğrenci görünümü
  fireEvent.click(screen.getByRole('tab', { name: /Şube Öğretmenler Kurulu/i }));
  await waitFor(() => {
    expect(screen.getAllByText(/ŞUBE ÖĞRETMENLER KURULU GÖRÜŞLERİ/i).length).toBeGreaterThan(0);
    expect(db.getStudioDatabaseSnapshot().albumConfig.chartTemplateId).toBe('sok-12');
  });

  // Baskıya Onayla & Baskıda Aç tuşu tüm şubeyi onaylar ve Modül 04 handoff'unu tetikler
  const approveBtn = screen.getByRole('button', { name: /Baskıya Onayla & Baskıda Aç/i });
  fireEvent.click(approveBtn);
  await waitFor(() => {
    expect(onApproveForPrint).toHaveBeenCalledWith({
      classId: class4AId,
      layoutKind: 'class-chart',
    });
    const snap = db.getStudioDatabaseSnapshot();
    expect(snap.photos.every((p) => p.approvedForPrint)).toBe(true);
    expect(snap.students.every((s) => s.printReady)).toBe(true);
  });

  fireEvent.click(screen.getByRole('tab', { name: /PVC Kimlik Kartı/i }));
  await waitFor(() => {
    expect(screen.getAllByText('ÖĞRENCİ KİMLİK KARTI').length).toBeGreaterThan(0);
  });
}, 15_000);

test('AlbumDesignerWindow Yıllık & Kütük builds multi-class Vice Principal dossier, filters by Deputy Principal, supports portrait/landscape + cover, and hands off scope to Print Center', async () => {
  const { StudioQueryProvider } = await import('../../system/query/StudioQueryProvider');
  const { AlbumDesignerWindow } = await import('./AlbumDesignerWindow');
  const db = await import('../../system/sqlite/studioDatabase');

  await act(async () => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Atatürk Anadolu Lisesi',
      institutionCode: '755200',
      address: 'Merkez',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const staffClassId = db.studioDbActions.addClass('ÖĞRETMEN', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(staffClassId, [
      { studentNumber: '0', firstName: 'Selim', lastName: 'Korkmaz', role: 'MDR.', isPrincipal: true },
      { studentNumber: '0', firstName: 'Ahmet', lastName: 'Demir', role: 'MD.YRD.' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '0.png', dataUrl: TINY_PNG },
        { fileName: '0-2.png', dataUrl: TINY_PNG },
      ],
      staffClassId,
      'sequence',
    );

    const class9A = db.studioDbActions.addClass('9-A', 'Derya Yılmaz', schoolId, '2026-2027', 'Ahmet Demir');
    const class10B = db.studioDbActions.addClass('10-B', 'Kemal Arslan', schoolId, '2026-2027', 'Merve Aksoy');

    db.studioDbActions.addStudentsBatch(class9A, [
      { studentNumber: '101', firstName: 'Elif', lastName: 'Aydın' },
      { studentNumber: '102', firstName: 'Kerem', lastName: 'Koç' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '101.png', dataUrl: TINY_PNG },
        { fileName: '102.png', dataUrl: TINY_PNG },
      ],
      class9A,
      'number',
    );

    db.studioDbActions.addStudentsBatch(class10B, [
      { studentNumber: '205', firstName: 'Zehra', lastName: 'Polat' },
    ]);
    db.studioDbActions.uploadPhotos([{ fileName: '205.png', dataUrl: TINY_PNG }], class10B, 'number');
  });

  const onApproveForPrint = vi.fn();

  render(
    <StudioQueryProvider>
      <AlbumDesignerWindow onApproveForPrint={onApproveForPrint} />
    </StudioQueryProvider>,
  );

  fireEvent.click(screen.getByRole('tab', { name: /Yıllık & Kütük/i }));

  await waitFor(() => {
    expect(screen.getByText(/Standart İdareci Kütüğü \(30 Öğrenci\) · 9\. Sınıf · A Şubesi/i)).toBeTruthy();
  });
  expect(screen.getByText('Tüm Okul · 2 Sınıf (9. Sınıf, 10. Sınıf)')).toBeTruthy();
  expect(screen.getByText('9. SINIF')).toBeTruthy();
  expect(screen.getByText('A ŞUBESİ')).toBeTruthy();
  expect(screen.getByText('Elif Aydın')).toBeTruthy();
  expect(screen.getByText('101')).toBeTruthy();
  expect(screen.getAllByText('Selim Korkmaz').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Ahmet Demir').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Sayfa 1 / 2').length).toBeGreaterThan(0);
  expect(document.querySelector('.kt-card.is-box-apple-soft')).toBeTruthy();
  expect(document.querySelector('.kt-photo-box.is-frame-rounded')).toBeTruthy();

  // Özel esnek ızgara seçimi (7 sütun × 7 satır = 49 portre) ve orta/üst başlık aç-kapa anahtarları
  const colGroup = screen.getByRole('tablist', { name: 'Soldan sağa sütun sayısı' });
  fireEvent.click(colGroup.querySelectorAll('[role="tab"]')[3]!);
  const rowGroup = screen.getByRole('tablist', { name: 'Yukarıdan aşağı satır sayısı' });
  fireEvent.click(rowGroup.querySelectorAll('[role="tab"]')[3]!);
  await waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot().albumConfig;
    expect(snap.kutukCols).toBe(7);
    expect(snap.kutukRows).toBe(7);
    expect(screen.getByText(/Sayfa başı 49 portre \(7×7\)/i)).toBeTruthy();
  });

  fireEvent.click(screen.getByLabelText(/Orta Başlık Satırını Göster/i));
  await waitFor(() => {
    expect(document.querySelector('.kt-doc-subtitle')).toBeNull();
  });

  fireEvent.click(screen.getByLabelText(/Üst Başlık Bloğunu Göster/i));
  await waitFor(() => {
    expect(document.querySelector('.kt-head')).toBeNull();
  });
  fireEvent.click(screen.getByLabelText(/Üst Başlık Bloğunu Göster/i));
  await waitFor(() => {
    expect(document.querySelector('.kt-head')).toBeTruthy();
  });

  // İsim kutusu stili (Renkli Bant), fotoğraf çerçevesi (Paspartulu) ve özel çerçeve rengi seçimi
  fireEvent.click(screen.getByRole('radio', { name: /Renkli Bant/i }));
  fireEvent.click(screen.getByRole('tab', { name: 'Paspartulu' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Çerçeve rengi: Anadolu Bordosu' }));
  await waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot().albumConfig;
    expect(snap.kutukNameBoxStyle).toBe('filled-band');
    expect(snap.kutukPhotoFrame).toBe('double-frame');
    expect(snap.kutukFrameColor).toBe('#6b1d2f');
    expect(document.querySelector('.kt-card.is-box-filled-band')).toBeTruthy();
    expect(document.querySelector('.kt-photo-box.is-frame-double-frame')).toBeTruthy();
    expect((document.querySelector('.tc-a4-paper') as HTMLElement | null)?.style.getPropertyValue('--kt-frame-color')).toBe('#6b1d2f');
  });

  // 10. Sınıf · B Şubesi sayfasına hızlı geçiş
  fireEvent.click(screen.getByRole('button', { name: '10. Sınıf · B Şubesi' }));
  await waitFor(() => {
    expect(screen.getByText('10. SINIF')).toBeTruthy();
    expect(screen.getByText('B ŞUBESİ')).toBeTruthy();
    expect(screen.getByText('Zehra Polat')).toBeTruthy();
    expect(screen.getAllByText('Sayfa 2 / 2').length).toBeGreaterThan(0);
  });

  // Dosya başına ön kapak ekleme (1 Kapak + 2 Sınıf = 3 Sayfa)
  fireEvent.click(screen.getByLabelText(/Dosya Başına Ön Kapak Sayfası Ekle/i));
  await waitFor(() => {
    expect(screen.getAllByText('Sayfa 2 / 3').length).toBeGreaterThan(0);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ön Kapak' }));
  await waitFor(() => {
    expect(screen.getByText(/İDARECİ ÖĞRENCİ KÜTÜK VE SINIF ALBÜM DOSYASI/i)).toBeTruthy();
  });

  // A4 Yatay Sınıf Albümü şablonuna geçiş
  fireEvent.click(screen.getByRole('tab', { name: /A4 Yatay Sınıf Albümü/i }));
  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().albumConfig.kutukTemplateId).toBe('kutuk-landscape-24');
    expect(document.querySelector('.tc-a4-paper.is-landscape')).toBeTruthy();
  });

  // Sorumlu Müdür Yardımcısına göre süzme (Ahmet Demir -> yalnız 9-A şubesi + Ön Kapak = 2 Sayfa)
  fireEvent.click(screen.getByRole('tab', { name: 'Md. Yrd.' }));
  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().albumConfig.kutukScopeMode).toBe('deputy');
    expect(screen.getAllByText('Sayfa 1 / 2').length).toBeGreaterThan(0);
  });

  fireEvent.click(screen.getByRole('button', { name: /Baskıya Onayla & Baskıda Aç/i }));
  await waitFor(() => {
    expect(onApproveForPrint).toHaveBeenCalledWith({
      classId: 'DEPUTY:Ahmet Demir',
      layoutKind: 'yearbook-spread',
    });
  });
}, 15_000);

test('AlbumDesignerWindow switches school directly from the top deck bar beside the class selector', async () => {
  const { StudioQueryProvider } = await import('../../system/query/StudioQueryProvider');
  const { AlbumDesignerWindow } = await import('./AlbumDesignerWindow');
  const db = await import('../../system/sqlite/studioDatabase');

  await act(async () => {
    const s1 = db.studioDbActions.createSchool({
      name: 'Birinci Okul', institutionCode: '701', address: '', notes: '', makeBiometric: false, makeVesikalik: true,
    });
    const c1 = db.studioDbActions.addClass('1-R', 'Canan', s1, '2026-2027');
    db.studioDbActions.addStudentsBatch(c1, [{ studentNumber: '11', firstName: 'Ece', lastName: 'Ak' }]);

    const s2 = db.studioDbActions.createSchool({
      name: 'İkinci Okul', institutionCode: '702', address: '', notes: '', makeBiometric: false, makeVesikalik: true,
    });
    const c2 = db.studioDbActions.addClass('3-C', 'Murat', s2, '2026-2027');
    db.studioDbActions.addStudentsBatch(c2, [{ studentNumber: '22', firstName: 'Kaan', lastName: 'Öz' }]);
    db.studioDbActions.selectSchool(s1);
  });

  render(<StudioQueryProvider><AlbumDesignerWindow /></StudioQueryProvider>);
  expect(screen.getAllByText(/Ece/i).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Tasarım şubesi seç' }).textContent).toContain('1-R');

  fireEvent.click(screen.getByRole('button', { name: 'Tasarım okulu seç' }));
  fireEvent.click(screen.getByRole('option', { name: 'İkinci Okul' }));

  await waitFor(() => {
    expect(screen.getAllByText(/Kaan/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Tasarım şubesi seç' }).textContent).toContain('3-C');
    expect(screen.getAllByText(/İkinci Okul/i).length).toBeGreaterThan(0);
  });
});
