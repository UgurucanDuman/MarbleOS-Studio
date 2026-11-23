import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCachedDesktopPhotoPreview,
  loadCachedDesktopPhotoPreview,
} from '../desktop/desktopPhotoPreview';
import { usesDesktopStorage } from '../desktop/desktopStorage';
import { useWindowWorkEnabled } from '../motion/windowWork';
import type { PhotoAdjustments, PhotoRecord } from '../sqlite/types';
import { getCachedBrowserPhotoPreview, loadBrowserPhotoPreview } from './browserPhotoPreview';
import { isDefaultAdjustments, resolveFullAdjustments } from './photoColorMath';
import { effectivePhotoZoom } from './portraitSmartAlignMath';

type Props = Omit<ComponentProps<'img'>, 'src'> & { photo: PhotoRecord };

let sharedObserver: IntersectionObserver | null = null;
const visibilityCallbacks = new WeakMap<Element, () => void>();

function observeOnceVisible(target: Element, onVisible: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onVisible();
    return () => { };
  }
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          sharedObserver?.unobserve(entry.target);
          const cb = visibilityCallbacks.get(entry.target);
          visibilityCallbacks.delete(entry.target);
          cb?.();
        }
      },
      { rootMargin: '120px' },
    );
  }
  visibilityCallbacks.set(target, onVisible);
  sharedObserver.observe(target);
  return () => {
    visibilityCallbacks.delete(target);
    sharedObserver?.unobserve(target);
  };
}

/**
 * Varsayılan değerlerde gereksiz CSS filter/transform GPU ara katmanı oluşturulmasını önler;
 * hem sıcak (> 0) hem soğuk (< 0) beyaz dengesini, doygunluğu, gölge/parlaklığı ve pan/tilt kadrajını yansıtır.
 */
export function photoAdjustmentStyle(
  adj: PhotoAdjustments,
  includeColor = true,
  keepGpuLayer = false,
): CSSProperties | undefined {
  if (isDefaultAdjustments(adj)) {
    return keepGpuLayer ? { transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' } : undefined;
  }
  const full = resolveFullAdjustments(adj);
  const effZoom = effectivePhotoZoom(full.zoom, full.tilt);

  // WebGL (glDarkroomPipeline) ve 300 DPI Baskı (portraitPrintRenderer) ile birebir aynı matris sırası:
  // scale(zoom) -> rotate(tilt) -> translate(panX%, panY%) -> rotate(rotation)
  const transforms: string[] = [];
  if (effZoom !== 1) {
    const z = Number(effZoom.toFixed(4));
    transforms.push(`scale3d(${z}, ${z}, 1)`);
  }
  if (full.tilt !== 0) transforms.push(`rotate(${full.tilt}deg)`);
  if (full.panX !== 0 || full.panY !== 0) transforms.push(`translate3d(${full.panX}%, ${full.panY}%, 0)`);
  if (full.rotation !== 0) transforms.push(`rotate(${full.rotation}deg)`);
  if (!transforms.length && keepGpuLayer) transforms.push('translate3d(0, 0, 0)');

  const filters: string[] = [];
  const effBright = Math.round((full.brightness + full.shadows * 0.16 + full.highlights * 0.12) * 10) / 10;
  const effContrast = Math.round((full.contrast - full.shadows * 0.08 + full.highlights * 0.08) * 10) / 10;
  if (effBright !== 100) filters.push(`brightness(${effBright}%)`);
  if (effContrast !== 100) filters.push(`contrast(${effContrast}%)`);
  if (includeColor) {
    if (full.warmth > 0) {
      filters.push(`sepia(${Number((full.warmth * 0.85).toFixed(1))}%)`);
    } else if (full.warmth < 0) {
      filters.push(`hue-rotate(${Number((full.warmth * 0.65).toFixed(1))}deg)`);
    }
    const warmSatBoost = full.warmth !== 0 ? Math.abs(full.warmth) * 0.25 : 0;
    const effSat = Math.max(0, Math.round((full.saturation + (full.saturation > 0 ? warmSatBoost : 0)) * 10) / 10);
    if (effSat !== 100) filters.push(`saturate(${effSat}%)`);
  }

  if (!transforms.length && !filters.length) return undefined;
  return {
    transform: transforms.length ? transforms.join(' ') : undefined,
    filter: filters.length ? filters.join(' ') : undefined,
    ...(transforms.length ? { backfaceVisibility: 'hidden' as const } : {}),
  };
}

export function useResolvedPhotoPreviewUrl(photo: PhotoRecord, enabled = true) {
  const workEnabled = useWindowWorkEnabled();
  const inlineUrl = !usesDesktopStorage && photo.dataUrl ? photo.dataUrl : undefined;
  const cached = !inlineUrl
    ? (usesDesktopStorage ? getCachedDesktopPhotoPreview(photo.id) : getCachedBrowserPhotoPreview(photo.id))
    : undefined;
  const query = useQuery({
    queryKey: ['studio-photo-preview', photo.id],
    queryFn: () => (usesDesktopStorage ? loadCachedDesktopPhotoPreview(photo.id) : loadBrowserPhotoPreview(photo.id)),
    initialData: cached,
    enabled: workEnabled && !inlineUrl && (enabled || Boolean(cached)),
    subscribed: workEnabled,
    retry: false,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  return {
    src: inlineUrl ?? query.data ?? cached,
    isError: query.isError,
  };
}

function StoredPhotoImage({ photo, ...props }: Props) {
  const workEnabled = useWindowWorkEnabled();
  const ref = useRef<HTMLImageElement>(null);
  const cached = usesDesktopStorage
    ? getCachedDesktopPhotoPreview(photo.id)
    : getCachedBrowserPhotoPreview(photo.id);
  const [visible, setVisible] = useState(() => Boolean(cached) || props.loading !== 'lazy');
  const { src, isError } = useResolvedPhotoPreviewUrl(photo, visible);

  useEffect(() => {
    if (!workEnabled || visible) return;
    const target = ref.current;
    if (!target) return;
    return observeOnceVisible(target, () => setVisible(true));
  }, [visible, photo.id, workEnabled]);

  return <img {...props} ref={ref} src={src} alt={isError ? 'Fotoğraf okunamadı' : props.alt} />;
}

export function StudioPhotoImage({ photo, ...props }: Props) {
  if (usesDesktopStorage || !photo.dataUrl) return <StoredPhotoImage photo={photo} {...props} />;
  return <img {...props} src={photo.dataUrl} />;
}
