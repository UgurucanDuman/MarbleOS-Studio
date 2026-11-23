import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioQueryProvider } from '../../system/query/StudioQueryProvider';

MotionGlobalConfig.skipAnimations = true;

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => cleanup());

async function setupStudioWithPhotos() {
  const { PhotoStudioWindow } = await import('./PhotoStudioWindow');
  const db = await import('../../system/sqlite/studioDatabase');

  let classId = '';
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Atatürk İlkokulu',
      institutionCode: '700100',
      address: 'Merkez',
      notes: '',
      makeBiometric: true,
      makeVesikalik: true,
    });
    classId = db.studioDbActions.addClass('4-A', 'Derya Yılmaz', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(classId, [
      { studentNumber: '101', firstName: 'Zeynep', lastName: 'Güneş' },
      { studentNumber: '102', firstName: 'Atlas', lastName: 'Kaya' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '101_zeynep.png', dataUrl: TINY_PNG },
        { fileName: '102_atlas.png', dataUrl: TINY_PNG },
        { fileName: '999_misafir.png', dataUrl: TINY_PNG },
      ],
      classId,
    );
  });

  function Harness() {
    const [cid, setCid] = useState(classId);
    return (
      <StudioQueryProvider>
        <PhotoStudioWindow classId={cid} onSelectClass={setCid} />
      </StudioQueryProvider>
    );
  }

  render(<Harness />);
  return { db, classId };
}

test('filters portraits by status and search, and advances via Onayla & Sonraki', async () => {
  const { db } = await setupStudioWithPhotos();

  expect(screen.getByText('3 Portre Kare')).toBeTruthy();
  expect(screen.getByText('2 / 3 Eşleşti')).toBeTruthy();

  // Eşleşmeyen filtresi yalnızca 999_misafir.png karesini gösterir
  fireEvent.click(screen.getByRole('tab', { name: /Eşleşmeyen \(1\)/ }));
  expect(screen.getAllByText('999_misafir.png').length).toBeGreaterThan(0);
  expect(screen.queryByText('101_zeynep.png')).toBeNull();

  // Tümü sekmesine dön ve arama kutusunu doğrula
  fireEvent.click(screen.getByRole('tab', { name: /Tümü \(3\)/ }));
  fireEvent.change(screen.getByLabelText('Portrelerde ara'), { target: { value: 'atlas' } });
  expect(screen.getAllByText('102_atlas.png').length).toBeGreaterThan(0);
  expect(screen.queryByText('101_zeynep.png')).toBeNull();
  fireEvent.change(screen.getByLabelText('Portrelerde ara'), { target: { value: '' } });

  // Sahne büyütme düğmesi animasyonlu büyük ekran sınıflarını açıp kapatır
  const expandBtn = screen.getByRole('button', { name: 'Büyüt' });
  fireEvent.click(expandBtn);
  const shrinkBtn = screen.getByRole('button', { name: 'Küçült' });
  expect(shrinkBtn.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('.mod-studio-layout.is-expanded')).toBeTruthy();
  expect(document.querySelector('.ps-portrait-frame.is-expanded')).toBeTruthy();
  fireEvent.click(shrinkBtn);
  expect(document.querySelector('.mod-studio-layout.is-expanded')).toBeNull();

  // Komut güvertesi (command deck) kompakt onay göstergesi başlangıçta 0 / 3 (%0) gösterir
  expect(screen.getByText('Baskı Onayı')).toBeTruthy();
  expect(screen.getByText('0 / 3 (%0)')).toBeTruthy();

  // İlk öğrenciyi seç ve Onayla & Sonraki ile onayla + sıradaki kareye geç
  fireEvent.click(screen.getByText('101 Zeynep'));
  fireEvent.click(screen.getByRole('button', { name: /Onayla & Sonraki/ }));

  await vi.waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot();
    const first = snap.photos.find((p) => p.fileName === '101_zeynep.png');
    expect(first?.approvedForPrint).toBe(true);
  });
  expect(screen.getByText('1 / 3 (%33)')).toBeTruthy();
  expect(screen.getByText('102 Atlas Kaya')).toBeTruthy();
});

test('applies preset and batch lighting calibration without overwriting individual framing', async () => {
  const { db } = await setupStudioWithPhotos();

  // İkinci öğrencinin bireysel kadrajını özel ayarla ve onayla (iki aşamalı kayıt: önce ayar, sonra onay)
  const secondBefore = db.getStudioDatabaseSnapshot().photos.find((p) => p.fileName === '102_atlas.png')!;
  act(() => {
    db.studioDbActions.updatePhotoStudioSettings(
      secondBefore.id,
      { zoom: 1.32, panX: 14, brightness: 100, contrast: 100, warmth: 0 },
      false,
    );
    db.studioDbActions.updatePhotoStudioSettings(
      secondBefore.id,
      { zoom: 1.32, panX: 14, brightness: 100, contrast: 100, warmth: 0 },
      true,
    );
  });

  // İlk öğrenci üzerinde Hazır & Toplu sekmesini aç, Oto. Stüdyo profilini seç ve tüm listeye uygula
  fireEvent.click(screen.getByText('101 Zeynep'));
  fireEvent.click(screen.getByRole('tab', { name: /Hazır & Toplu/ }));
  fireEvent.click(screen.getByRole('button', { name: /Oto\. Stüdyo/ }));

  await vi.waitFor(() => {
    const p1 = db.getStudioDatabaseSnapshot().photos.find((p) => p.fileName === '101_zeynep.png')!;
    expect(p1.adjustments.shadows).toBe(14);
  });

  fireEvent.click(screen.getByRole('button', { name: /Tüm Listeye Uygula \(3\)/ }));

  await vi.waitFor(() => {
    const p2 = db.getStudioDatabaseSnapshot().photos.find((p) => p.fileName === '102_atlas.png')!;
    expect(p2.adjustments.brightness).toBe(105);
    expect(p2.adjustments.shadows).toBe(14);
    expect(p2.adjustments.sharpen).toBe(10);
    // Bireysel yüz kadrajı korunur, ancak ışık değiştiği için eski baskı onayı düşer
    expect(p2.adjustments.zoom).toBe(1.32);
    expect(p2.adjustments.panX).toBe(14);
    expect(p2.approvedForPrint).toBe(false);
  });
});

test('focusPhoto opens and jumps directly to the requested student photo even across filter modes', async () => {
  const { PhotoStudioWindow } = await import('./PhotoStudioWindow');
  const db = await import('../../system/sqlite/studioDatabase');

  let classId = '';
  act(() => {
    const schoolId = db.studioDbActions.createSchool({
      name: 'Merkez Koleji',
      institutionCode: '900100',
      address: '',
      notes: '',
      makeBiometric: true,
      makeVesikalik: true,
    });
    classId = db.studioDbActions.addClass('5-B', '', schoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(classId, [
      { studentNumber: '201', firstName: 'Duru', lastName: 'Yılmaz' },
      { studentNumber: '202', firstName: 'Atlas', lastName: 'Çevik' },
    ]);
    db.studioDbActions.uploadPhotos(
      [
        { fileName: '201_duru.png', dataUrl: TINY_PNG },
        { fileName: '202_atlas.png', dataUrl: TINY_PNG },
      ],
      classId,
    );
  });

  const atlasPhoto = db.getStudioDatabaseSnapshot().photos.find((p) => p.fileName === '202_atlas.png')!;
  const duruPhoto = db.getStudioDatabaseSnapshot().photos.find((p) => p.fileName === '201_duru.png')!;

  const { rerender } = render(
    <StudioQueryProvider>
      <PhotoStudioWindow classId={classId} focusPhoto={{ photoId: atlasPhoto.id, seq: 1 }} onSelectClass={() => {}} />
    </StudioQueryProvider>,
  );

  // İlk açılışta doğrudan 2. öğrencinin (Atlas Çevik) karesi seçili gelir
  expect(screen.getByText('202 Atlas Çevik')).toBeTruthy();

  // Pencere açıkken başka bir öğrenci odaklandığında (seq artışı) doğrudan o kareye geçer
  rerender(
    <StudioQueryProvider>
      <PhotoStudioWindow classId={classId} focusPhoto={{ photoId: duruPhoto.id, seq: 2 }} onSelectClass={() => {}} />
    </StudioQueryProvider>,
  );
  expect(screen.getByText('201 Duru Yılmaz')).toBeTruthy();
});

test('resets checked or all photos back to original size, framing, and light via Orijinale Dön', async () => {
  const { db } = await setupStudioWithPhotos();
  const photos = db.getStudioDatabaseSnapshot().photos;

  // Tüm fotoğraflara farklı yakınlaştırma, kaydırma ve ışık ayarı uygula + eşleşenleri onayla
  act(() => {
    for (const p of photos) {
      const custom = { zoom: 1.48, panX: 12, panY: -9, tilt: 3, brightness: 112, contrast: 108, warmth: 6, shadows: 16 };
      db.studioDbActions.updatePhotoStudioSettings(p.id, custom, false);
      if (p.studentId) {
        db.studioDbActions.updatePhotoStudioSettings(p.id, custom, true);
      }
    }
  });

  // İlk iki fotoğrafı seçili işaretle ve yalnızca seçilileri orijinale döndür
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]!);
  fireEvent.click(checkboxes[1]!);
  fireEvent.click(screen.getByRole('button', { name: 'Orijinale Dön (2)' }));

  await vi.waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot().photos;
    const p1 = snap.find((p) => p.fileName === '101_zeynep.png')!;
    const p2 = snap.find((p) => p.fileName === '102_atlas.png')!;
    const p3 = snap.find((p) => p.fileName === '999_misafir.png')!;
    expect(p1.adjustments.zoom).toBe(1);
    expect(p1.adjustments.panX).toBeUndefined();
    expect(p1.adjustments.panY).toBeUndefined();
    expect(p1.adjustments.brightness).toBe(100);
    expect(p1.approvedForPrint).toBe(false);
    expect(p2.adjustments.zoom).toBe(1);
    // Üçüncü kare seçili olmadığı için henüz eski ayarında kalır
    expect(p3.adjustments.zoom).toBe(1.48);
  });

  // Şimdi Hazır & Toplu sekmesinden Tümünü Orijinale Dön (3) tıkla -> üçüncü kare de orijinal boyutuna döner
  fireEvent.click(screen.getByRole('tab', { name: /Hazır & Toplu/ }));
  fireEvent.click(screen.getByRole('button', { name: /Tümünü Orijinale Dön \(3\)/ }));

  await vi.waitFor(() => {
    const snap = db.getStudioDatabaseSnapshot().photos;
    for (const p of snap) {
      expect(p.adjustments.zoom).toBe(1);
      expect(p.adjustments.panX).toBeUndefined();
      expect(p.adjustments.panY).toBeUndefined();
      expect(p.adjustments.tilt).toBeUndefined();
      expect(p.adjustments.brightness).toBe(100);
      expect(p.adjustments.shadows).toBeUndefined();
      expect(p.approvedForPrint).toBe(false);
    }
  });
});

test('switches school directly from the Photo Studio header and resets to Tüm sınıflar for that school', async () => {
  const { db } = await setupStudioWithPhotos();

  act(() => {
    const secondSchoolId = db.studioDbActions.createSchool({
      name: 'Cumhuriyet Ortaokulu',
      institutionCode: '700200',
      address: 'Kuzey',
      notes: '',
      makeBiometric: true,
      makeVesikalik: true,
    });
    const secondClassId = db.studioDbActions.addClass('6-B', 'Selin Kaya', secondSchoolId, '2026-2027');
    db.studioDbActions.addStudentsBatch(secondClassId, [
      { studentNumber: '301', firstName: 'Ege', lastName: 'Yıldız' },
    ]);
    db.studioDbActions.uploadPhotos([{ fileName: '301_ege.png', dataUrl: TINY_PNG }], secondClassId);
    // İlk okula geri dön ki başlangıçta Atatürk İlkokulu aktif olsun
    const firstSchool = db.getStudioDatabaseSnapshot().schools.find((s) => s.name === 'Atatürk İlkokulu')!;
    db.studioDbActions.selectSchool(firstSchool.id);
  });

  // Üst bardaki okul seçicisinden doğrudan Cumhuriyet Ortaokulu seçilir
  fireEvent.click(screen.getByRole('button', { name: 'Fotoğraf stüdyo okulu' }));
  fireEvent.click(screen.getByRole('option', { name: 'Cumhuriyet Ortaokulu' }));

  await vi.waitFor(() => {
    expect(screen.getByText('1 Portre Kare')).toBeTruthy();
    expect(screen.getByText('301 Ege Yıldız')).toBeTruthy();
  });
});
