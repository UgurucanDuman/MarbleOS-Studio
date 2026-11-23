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

test('PVC Kimlik Stüdyosu 5 şablon, T.C. başlığı, stüdyo arkası, Mail tarzı öğrenci şeridi ve px yazı boyutunu yönetir', async () => {
  const { StudioQueryProvider } = await import('../../../system/query/StudioQueryProvider');
  const { AlbumDesignerWindow } = await import('../AlbumDesignerWindow');
  const db = await import('../../../system/sqlite/studioDatabase');

  await act(async () => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Atatürk İlkokulu',
      institutionCode: '755300',
      address: 'Cumhuriyet Cad. No:12',
      notes: '',
      makeBiometric: false,
      makeVesikalik: true,
    });
    const classId = db.studioDbActions.addClass('1-A', 'Merve Kaya', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(classId, [
      { studentNumber: '715', firstName: 'Bülent Demir', lastName: 'Uçar', idCard: { bloodType: 'A Rh+' } },
      { studentNumber: '783', firstName: 'Tuğçe', lastName: 'Yılmaz' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '715.png', dataUrl: TINY_PNG },
        { fileName: '783.png', dataUrl: TINY_PNG },
      ],
      classId,
      'number',
    );
    db.studioDbActions.updateAlbumConfig({ layoutKind: 'id-card' });
  });

  render(
    <StudioQueryProvider>
      <AlbumDesignerWindow />
    </StudioQueryProvider>,
  );

  // Gereksiz Albüm Başlığı & Okul No Göster kontrolleri PVC modunda gizlenir
  expect(screen.queryByPlaceholderText('Albüm / Çizelge Başlığı')).toBeNull();
  expect(screen.queryByText('Okul No Göster')).toBeNull();

  // T.C. MEB başlığı ve gerçek öğrenci bilgisi kartta görünür
  expect(screen.getAllByText('T.C. MİLLÎ EĞİTİM BAKANLIĞI').length).toBeGreaterThan(0);
  expect(screen.getAllByText('BÜLENT DEMİR UÇAR').length).toBeGreaterThan(0);

  // Apple Mail tarzı öğrenci şeridinde diğer öğrenciye tıklanınca kart ve aktif isim güncellenir
  fireEvent.click(screen.getByRole('option', { name: /783 · Tuğçe Yılmaz/i }));
  await waitFor(() => {
    expect(screen.getAllByText('TUĞÇE YILMAZ').length).toBeGreaterThan(0);
  });

  // 5 şablon arasında geçiş (Dikey Yaka + Akıllı Kampüs Tech QR)
  fireEvent.click(screen.getByRole('radio', { name: /Dikey Yaka Kartı/i }));
  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().albumConfig.pvcTemplateId).toBe('vertical-lanyard');
  });

  fireEvent.click(screen.getByRole('radio', { name: /Akıllı Kampüs/i }));
  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().albumConfig.pvcTemplateId).toBe('minimal-pro');
    expect(screen.getByText('1-A · 783')).toBeTruthy();
  });

  // Barkod / QR Kod / Yok geçişi Akıllı Kampüs şablonunda da çalışır
  fireEvent.click(screen.getByRole('tab', { name: 'Barkod' }));
  await waitFor(() => {
    expect(db.getStudioDatabaseSnapshot().albumConfig.pvcCodeType).toBe('barcode');
  });

  // Stüdyo sekmesinden fotoğrafhane bilgisi kaydedilince arka yüzde görünür
  fireEvent.click(screen.getByRole('tab', { name: 'Stüdyo' }));
  fireEvent.change(screen.getByPlaceholderText(/Foto Ufuk/i), { target: { value: 'Foto Ufuk Stüdyo' } });
  fireEvent.change(screen.getByPlaceholderText(/0532/i), { target: { value: '0532 555 44 33' } });
  fireEvent.click(screen.getByRole('button', { name: /Stüdyo Bilgilerini Kaydet/i }));
  await waitFor(() => {
    expect(screen.getAllByText('FOTO UFUK STÜDYO').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tel: 0532 555 44 33').length).toBeGreaterThan(0);
  });

  // Tasarla sekmesinde T.C. MİLLÎ EĞİTİM BAKANLIĞI seçilip px boyutu değiştirilebilir
  fireEvent.click(screen.getByRole('tab', { name: 'Tasarla' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Ön Yüz' }));
  const headerLayer = await screen.findByRole('option', { name: /T\.C\. MİLLÎ/i });
  fireEvent.click(headerLayer);
  const pxInput = await screen.findByLabelText('Boyut (px)');
  fireEvent.change(pxInput, { target: { value: '14' } });
  await waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot().albumConfig;
    const custom = snap.pvcCustomDesigns?.find((d) => d.id === snap.pvcTemplateId);
    const hdrEl = custom?.front.elements.find((e) => e.id === 'header-top');
    expect(hdrEl?.fontSizePt).toBe(10.5);
  });
}, 15_000);
