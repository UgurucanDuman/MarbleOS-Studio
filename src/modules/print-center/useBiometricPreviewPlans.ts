import { useEffect, useRef, useState } from 'react';
import type { PhotoRecord } from '../../system/sqlite/types';
import {
  computeBiometricIcaoPlan,
  type BiometricIcaoPlan,
} from '../../system/storage/biometricFraming';
import { analyzePhotoRecordSubject } from '../../system/storage/portraitSmartAlign';

/**
 * İZOLE MODÜL 04 CANLI BİYOMETRİK ÖNİZLEME KANCASI:
 * Biyometrik 50×60 mm baskı sahnesindeki benzersiz öğrenci fotoğrafları için
 * 300 DPI motoruyla birebir aynı NVİ/ICAO saç payı ve baş hizalama planını önbellekten hesaplar.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function useBiometricPreviewPlans(
  enabled: boolean,
  photos: readonly PhotoRecord[],
): ReadonlyMap<string, BiometricIcaoPlan> {
  const [plans, setPlans] = useState<ReadonlyMap<string, BiometricIcaoPlan>>(() => new Map());
  // Plan yalnız kimlik, döndürme ve eğime bağlıdır; dizi kimliği her render'da değişse de
  // analiz yalnız imza değişince yeniden çalışır ve en güncel listeyi ref'ten okur.
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const photoSignature = enabled
    ? photos
      .map((p) => `${p.id}:${p.adjustments.rotation ?? 0}:${p.adjustments.tilt ?? 0}`)
      .join('|')
    : '';

  useEffect(() => {
    const photos = photosRef.current;
    if (!enabled || photos.length === 0) {
      setPlans((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }

    let cancelled = false;
    const uniquePhotos = new Map<string, PhotoRecord>();
    for (const p of photos) {
      if (!uniquePhotos.has(p.id)) uniquePhotos.set(p.id, p);
    }

    void (async () => {
      const entries = [...uniquePhotos.values()];
      const next = new Map<string, BiometricIcaoPlan>();
      await Promise.all(
        entries.map(async (photo) => {
          const rot = photo.adjustments.rotation ?? 0;
          const subject = await analyzePhotoRecordSubject(photo, rot);
          if (subject && subject.confidence >= 0.35) {
            next.set(photo.id, computeBiometricIcaoPlan(subject, photo.adjustments));
          }
        }),
      );
      if (!cancelled) setPlans(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, photoSignature]);

  return plans;
}

