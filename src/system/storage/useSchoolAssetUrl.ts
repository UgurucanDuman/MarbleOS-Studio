import { useQuery } from '@tanstack/react-query';
import {
  getCachedDesktopPhotoPreview,
  loadCachedDesktopPhotoPreview,
} from '../desktop/desktopPhotoPreview';
import {
  loadDesktopPhotoOriginal,
  usesDesktopStorage,
} from '../desktop/desktopStorage';
import { parseSchoolAssetId } from '../schemas/schoolSchemas';
import { useWindowWorkEnabled } from '../motion/windowWork';

/**
 * Okul görseli URL çözücü:
 * - Tarayıcıda veya henüz kaydedilmemiş form seçiminde `data:image/...` değerini anında döndürür.
 * - Masaüstünde `marbleos-school-asset:<uuid>` referansını yönetilen DPAPI dosyasından
 *   (`preview`: 512px LRU Blob önizleme, `original`: tam çözünürlüklü baskı görseli) çözer.
 */
export function useResolvedSchoolAssetUrl(
  value: string | undefined,
  quality: 'preview' | 'original' = 'preview',
): string {
  const assetId = parseSchoolAssetId(value);
  const workEnabled = useWindowWorkEnabled();
  const cachedPreview =
    quality === 'preview' && assetId && usesDesktopStorage
      ? getCachedDesktopPhotoPreview(assetId)
      : undefined;
  const query = useQuery({
    queryKey: [quality === 'original' ? 'studio-photo-original' : 'studio-photo-preview', assetId],
    queryFn: () =>
      quality === 'original' ? loadDesktopPhotoOriginal(assetId!) : loadCachedDesktopPhotoPreview(assetId!),
    initialData: cachedPreview,
    enabled: workEnabled && Boolean(assetId) && usesDesktopStorage,
    subscribed: workEnabled,
    retry: false,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  if (!value) return '';
  if (!assetId) return value;
  return query.data ?? cachedPreview ?? '';
}

