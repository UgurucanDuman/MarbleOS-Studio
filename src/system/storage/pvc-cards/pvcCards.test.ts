import { describe, expect, test } from 'vitest';
import { pvcAlbumConfigFieldsShape, pvcCustomDesignSchema } from '../../schemas/pvcCardSchemas';
import { createBlankPvcCustomDesign } from './builtInTemplatesB';
import {
  cloneDesignToCustom,
  PVC_BUILT_IN_TEMPLATES,
  resolvePvcCardDesign,
} from './catalog';
import { encodeCode128B } from './code128Encoder';
import { resolvePvcFieldValue } from './fieldResolver';
import { resolveElementsForMedia } from './mediaLayoutAdjust';
import { encodeQrMatrix, qrMatrixToSvgPath } from './qrCodeEncoder';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('PVC Kimlik Kartı Çekirdek Motoru', () => {
  test('ISO/IEC 15417 Code128B barkod üreticisi geçerli sessiz bölge ve çubuk üretir', () => {
    const encoded = encodeCode128B('783');
    expect(encoded.displayValue).toBe('783');
    expect(encoded.bars.length).toBeGreaterThan(10);
    expect(encoded.bars[0]!.x).toBeGreaterThanOrEqual(10);
    expect(encoded.totalModules).toBeGreaterThan(60);

    const trEncoded = encodeCode128B('ŞĞÜİÖÇ-101');
    expect(trEncoded.displayValue).toBe('SGUIOC-101');
    expect(trEncoded.bars.length).toBeGreaterThan(18);
  });

  test('ISO/IEC 18004 QR kod üreticisi 3 bulucu desenli geçerli kare matris üretir', () => {
    const mat = encodeQrMatrix('Atatürk Lisesi | TUĞÇE YILMAZ | 1-A / 783');
    expect(mat.size).toBeGreaterThanOrEqual(21);
    expect((mat.size - 17) % 4).toBe(0);
    expect(mat.modules.length).toBe(mat.size * mat.size);
    // Sol üst, sağ üst ve sol alt 7x7 bulucu desen merkezleri (3,3) dolu olmalıdır
    expect(mat.modules[3 * mat.size + 3]).toBe(1);
    expect(mat.modules[3 * mat.size + (mat.size - 4)]).toBe(1);
    expect(mat.modules[(mat.size - 4) * mat.size + 3]).toBe(1);

    const svg = qrMatrixToSvgPath(mat);
    expect(svg.viewBoxSize).toBe(mat.size + 4);
    expect(svg.d.startsWith('M')).toBe(true);
  });

  test('5 hazır PVC şablonu T.C. MEB başlığı, stüdyo arkası, kod geçişi ve portre kadrajını eksiksiz destekler', () => {
    expect(PVC_BUILT_IN_TEMPLATES).toHaveLength(5);

    for (const tpl of PVC_BUILT_IN_TEMPLATES) {
      const resolved = resolvePvcCardDesign({ pvcTemplateId: tpl.id });
      expect(resolved.isCustom).toBe(false);
      if (tpl.id === 'vertical-lanyard') {
        expect(resolved.widthMm).toBe(54);
        expect(resolved.heightMm).toBe(85.6);
      } else {
        expect(resolved.widthMm).toBe(85.6);
        expect(resolved.heightMm).toBe(54);
      }
      expect(resolved.front.elements.some((e) => e.id === 'header-top' && e.text?.includes('T.C.'))).toBe(true);
      expect(resolved.front.elements.some((e) => e.kind === 'photo')).toBe(true);
      expect(resolved.back.elements.some((e) => e.kind === 'studio-logo')).toBe(true);
      expect(resolved.back.elements.some((e) => e.fieldKey === 'studioName')).toBe(true);
      expect(resolved.back.elements.some((e) => e.fieldKey === 'studioPhone')).toBe(true);
      expect(resolved.back.elements.some((e) => e.fieldKey === 'studioAddress')).toBe(true);
    }

    // Akıllı Kampüs · Tech QR varsayılan QR, Barkod seçilince Code128, Yok seçilince çerçeve dahil gizli
    const mpDefault = resolvePvcCardDesign({ pvcTemplateId: 'minimal-pro' });
    expect(mpDefault.front.elements.find((e) => e.id === 'primary-code')?.kind).toBe('qrcode');

    const mpBarcode = resolvePvcCardDesign({ pvcTemplateId: 'minimal-pro', pvcCodeType: 'barcode' });
    expect(mpBarcode.front.elements.find((e) => e.id === 'primary-code')?.kind).toBe('barcode');

    const mpNone = resolvePvcCardDesign({ pvcTemplateId: 'minimal-pro', pvcCodeType: 'none' });
    expect(mpNone.front.elements.find((e) => e.id === 'primary-code')).toBeUndefined();
    expect(mpNone.front.elements.find((e) => e.id === 'mp-qr-frame')).toBeUndefined();

    // Portre sığdırma/yakınlaştırma/kadraj ve T.C. üst başlık geçersiz kılma
    const customFramed = resolvePvcCardDesign({
      pvcTemplateId: 'official-classic',
      pvcPhotoFit: 'contain',
      pvcPhotoZoom: 1.35,
      pvcPhotoPosX: 40,
      pvcPhotoPosY: 20,
      pvcPhotoShape: 'circle',
      pvcHeaderTopText: '',
    });
    const photoEl = customFramed.front.elements.find((e) => e.kind === 'photo');
    expect(photoEl?.imageFit).toBe('contain');
    expect(photoEl?.photoZoom).toBe(1.35);
    expect(photoEl?.photoPosX).toBe(40);
    expect(photoEl?.photoPosY).toBe(20);
    expect(photoEl?.photoShape).toBe('circle');
    expect(customFramed.front.elements.find((e) => e.id === 'header-top')).toBeUndefined();
  });

  test('Okul veya stüdyo logosu yokken başlık ve künye metinleri boşluk bırakmadan tam kenara hizalanır', () => {
    const mp = resolvePvcCardDesign({ pvcTemplateId: 'minimal-pro' });
    const mpNoLogo = resolveElementsForMedia(mp.front.elements, {
      hasSchoolLogo: false,
      hasStudioLogo: false,
      cardWidthMm: mp.widthMm,
    });
    expect(mpNoLogo.find((e) => e.id === 'mp-school')?.xMm).toBe(7.2);
    expect(mpNoLogo.find((e) => e.id === 'header-top')?.xMm).toBe(7.2);

    const vl = resolvePvcCardDesign({ pvcTemplateId: 'vertical-lanyard' });
    const vlNoLogo = resolveElementsForMedia(vl.front.elements, {
      hasSchoolLogo: false,
      hasStudioLogo: false,
      cardWidthMm: vl.widthMm,
    });
    expect(vlNoLogo.find((e) => e.id === 'vl-school')?.align).toBe('center');
    expect(vlNoLogo.find((e) => e.id === 'vl-school')?.xMm).toBe(3.6);

    const backNoStudioLogo = resolveElementsForMedia(mp.back.elements, {
      hasSchoolLogo: true,
      hasStudioLogo: false,
      cardWidthMm: mp.widthMm,
    });
    expect(backNoStudioLogo.find((e) => e.id === 'studio-name')?.xMm).toBe(7.2);
  });

  test('Dinamik alan çözücü gerçek öğrenci + stüdyo bilgilerini yinelemesiz üretir', () => {
    const val = resolvePvcFieldValue('classAndNumber', {
      schoolName: 'Atatürk İlkokulu',
      className: '1-A',
      isStaffCard: false,
      student: { id: 's1', studentNumber: '783', firstName: 'Tuğçe', lastName: 'Yılmaz' },
      studio: { companyName: 'Foto Ufuk', phone: '0532 000 00 00', address: 'Merkez' },
    });
    expect(val).toBe('1-A · 783');
  });

  test('Zod güvenlik şeması geçerli özel tasarımı kabul eder; SVG, formül ve Bidi saldırılarını reddeder', () => {
    const blank = createBlankPvcCustomDesign('Stüdyo Özel Kart', 'landscape');
    blank.front.elements[1] = {
      ...blank.front.elements[1]!,
      imageFit: 'contain',
      photoZoom: 1.25,
      photoPosX: 48,
      photoPosY: 22,
    };
    blank.front.backgroundDataUrl = TINY_PNG;
    expect(pvcCustomDesignSchema.safeParse(blank).success).toBe(true);

    // SVG data URL engellenir
    const withSvg = structuredClone(blank);
    withSvg.front.backgroundDataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(pvcCustomDesignSchema.safeParse(withSvg).success).toBe(false);

    // CSV/Excel formül enjeksiyonu engellenir
    const withFormula = structuredClone(blank);
    withFormula.name = '=CMD|calc';
    expect(pvcCustomDesignSchema.safeParse(withFormula).success).toBe(false);

    // Bidi spoofing karakteri engellenir
    const withBidi = structuredClone(blank);
    withBidi.front.elements[0]!.text = 'Normal\u202EMetin';
    expect(pvcCustomDesignSchema.safeParse(withBidi).success).toBe(false);

    // Klonlama + 15 tasarım üst sınırı ve tekil kimlik denetimi
    const cloned = cloneDesignToCustom(resolvePvcCardDesign({ pvcTemplateId: 'official-classic' }), 'Kopya 1');
    expect(pvcAlbumConfigFieldsShape.pvcCustomDesigns.safeParse([cloned, cloned]).success).toBe(false);
  });
});
