/**
 * İZOLE SİSTEM KATMANI: 300 DPI Baskı İçin EXIF-Duyarlı Görsel Çözümleyici
 * `createImageBitmap({ imageOrientation: 'from-image' })` ve eski/gömülü WebView'lar için
 * `HTMLImageElement` yedeği ile sRGB yüksek kaliteli tuval çıktısı üretir.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export interface DecodedFullResSource {
  drawable: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
}

export function dataUrlToImageBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Fotoğraf verisi okunamadı.');
  const mimeMatch = /^data:(image\/(?:jpeg|png|webp));base64$/i.exec(dataUrl.slice(0, comma));
  const mime = mimeMatch ? mimeMatch[1]!.toLowerCase() : 'image/jpeg';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function decodeFullResImage(dataUrl: string): Promise<DecodedFullResSource> {
  const blob = dataUrlToImageBlob(dataUrl);
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        drawable: bmp,
        width: Math.max(1, bmp.width),
        height: Math.max(1, bmp.height),
        dispose: () => {
          if (typeof bmp.close === 'function') bmp.close();
        },
      };
    } catch {
      // Eski/test ortamlarında HTMLImageElement yoluna düş
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Orijinal fotoğraf çözümlenemedi.'));
      el.src = url;
    });
    return {
      drawable: img,
      width: Math.max(1, img.naturalWidth || img.width || 1),
      height: Math.max(1, img.naturalHeight || img.height || 1),
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function decodeImageUrlToCanvas(url: string | undefined): Promise<HTMLCanvasElement | null> {
  if (!url) return null;
  let blob: Blob | null = null;
  try {
    if (url.startsWith('data:image/')) {
      blob = dataUrlToImageBlob(url);
    } else if (url.startsWith('blob:') && typeof fetch === 'function') {
      blob = await fetch(url).then((r) => (r.ok ? r.blob() : null));
    }
  } catch {
    return null;
  }
  if (!blob) return null;

  const paintToCanvas = (drawable: CanvasImageSource, w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    const cctx = c.getContext('2d', { colorSpace: 'srgb' });
    if (cctx) {
      cctx.imageSmoothingEnabled = true;
      cctx.imageSmoothingQuality = 'high';
      cctx.drawImage(drawable, 0, 0, c.width, c.height);
    }
    return c;
  };

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      try {
        return paintToCanvas(bmp, bmp.width, bmp.height);
      } finally {
        if (typeof bmp.close === 'function') bmp.close();
      }
    } catch {
      // Gömülü/eski WebView yolunda HTMLImageElement ile devam et
    }
  }
  const objUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = objUrl;
    });
    return img ? paintToCanvas(img, img.naturalWidth || img.width, img.naturalHeight || img.height) : null;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}
