import type { PvcCardElement } from './types';

/**
 * İZOLE SİSTEM YARDIMCISI: Eksik Okul/Stüdyo Logosu Hizalama Düzeltici
 * Okul logosu veya fotoğrafhane logosu henüz yüklenmediğinde başlık/künye metinlerinin
 * boşlukta asılı kalmasını önler; hem canlı kartta hem 300 DPI baskıda aynı milimetrik hizayı korur.
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export function resolveElementsForMedia(
  elements: readonly PvcCardElement[],
  options: {
    hasSchoolLogo: boolean;
    hasStudioLogo: boolean;
    cardWidthMm: number;
  },
): readonly PvcCardElement[] {
  const { hasSchoolLogo, hasStudioLogo, cardWidthMm } = options;
  if (hasSchoolLogo && hasStudioLogo) return elements;

  const schoolLogo = !hasSchoolLogo
    ? elements.find((e) => e.kind === 'school-logo' && e.visible !== false && (e.opacity ?? 1) >= 0.4)
    : undefined;
  const studioLogo = !hasStudioLogo
    ? elements.find((e) => e.kind === 'studio-logo' && e.visible !== false)
    : undefined;

  if (!schoolLogo && !studioLogo) return elements;

  return elements.map((el) => {
    if (el.visible === false) return el;
    const isTextual = el.kind === 'field' || el.kind === 'text';
    if (!isTextual) return el;

    if (schoolLogo) {
      const logoRight = schoolLogo.xMm + schoolLogo.wMm;
      const logoBottom = schoolLogo.yMm + schoolLogo.hMm;
      const inHeaderBand = el.yMm >= schoolLogo.yMm - 2.2 && el.yMm <= logoBottom + 1.5;

      if (inHeaderBand && schoolLogo.xMm < cardWidthMm * 0.35) {
        const startsRightOfLogo = el.xMm >= logoRight - 0.5 && el.xMm <= logoRight + 4.0;
        if (startsRightOfLogo) {
          if (cardWidthMm < 65) {
            return {
              ...el,
              xMm: 3.6,
              wMm: Number((cardWidthMm - 7.2).toFixed(2)),
              align: 'center',
            };
          }
          const delta = el.xMm - schoolLogo.xMm;
          return {
            ...el,
            xMm: schoolLogo.xMm,
            wMm: Number((el.wMm + delta).toFixed(2)),
          };
        }
      }

      if (inHeaderBand && schoolLogo.xMm > cardWidthMm * 0.65) {
        const elRight = el.xMm + el.wMm;
        const stopsBeforeLogo = elRight <= schoolLogo.xMm + 1.0 && elRight >= schoolLogo.xMm - 10.0;
        if (stopsBeforeLogo) {
          const freed = logoRight - elRight;
          if (el.align === 'right') {
            return { ...el, xMm: Number((el.xMm + freed).toFixed(2)) };
          }
          return { ...el, wMm: Number((el.wMm + freed).toFixed(2)) };
        }
      }
    }

    if (studioLogo && studioLogo.xMm < cardWidthMm * 0.35) {
      const logoRight = studioLogo.xMm + studioLogo.wMm;
      const inStudioBand = el.yMm >= studioLogo.yMm - 2.5 && el.yMm <= studioLogo.yMm + studioLogo.hMm + 2.5;
      const startsRightOfStudio = el.xMm >= logoRight - 0.5 && el.xMm <= logoRight + 3.5;
      if (inStudioBand && startsRightOfStudio) {
        const delta = el.xMm - studioLogo.xMm;
        return {
          ...el,
          xMm: studioLogo.xMm,
          wMm: Number((el.wMm + delta).toFixed(2)),
        };
      }
    }

    return el;
  });
}
