import { DEFAULT_PVC_BACK_NOTE, DEFAULT_PVC_HEADER_TOP_TEXT } from './fieldResolver';
import {
  PVC_DEFAULT_CORNER_RADIUS_MM,
  type PvcBuiltInTemplateSpec,
  type PvcCardOrientation,
  type PvcCustomDesign,
} from './types';

/**
 * İZOLE SİSTEM KATMANI: 5 Stüdyo Sınıfı Hazır PVC Kimlik Tasarımı (Bölüm 2: Dikey Yaka + Akıllı Kampüs QR)
 * 4) Dikey Yaka Kartı · Lanyard Pro (54×85.6 mm — T.C. MEB başlığı, daire portre, Sınıf | No kartuşları)
 * 5) Akıllı Kampüs · Tech QR (85.6×54 mm — T.C. MEB başlığı, hizalı kolonlar, büyük ön QR + arka barkod)
 * Dosya Sınırı Kuralı: .ts <= 240 satır.
 */

export const PVC_TEMPLATES_PART_B: readonly PvcBuiltInTemplateSpec[] = [
  {
    id: 'vertical-lanyard',
    name: 'Dikey Yaka Kartı · Lanyard',
    shortBadge: 'Dikey · 54×85.6',
    subtitle: 'T.C. MEB başlığı, askı boşluklu kavisli taç, daire portre, ikili Sınıf/No kutusu ve stüdyo arkası',
    orientation: 'portrait',
    cardRadiusMm: PVC_DEFAULT_CORNER_RADIUS_MM,
    front: {
      backgroundColor: '#ffffff',
      artworkStyle: 'lanyard-arch',
      elements: [
        { id: 'wm-logo', kind: 'school-logo', xMm: 15.0, yMm: 50.0, wMm: 24.0, hMm: 24.0, opacity: 0.06 },
        { id: 'vl-logo', kind: 'school-logo', xMm: 3.6, yMm: 9.0, wMm: 8.6, hMm: 8.6, radiusMm: 4.3 },
        { id: 'header-top', kind: 'text', text: DEFAULT_PVC_HEADER_TOP_TEXT, xMm: 13.4, yMm: 7.9, wMm: 37.0, hMm: 2.2, fontSizePt: 4.0, fontWeight: 600, textColor: 'onAccent', maxLines: 1 },
        { id: 'vl-school', kind: 'field', fieldKey: 'schoolName', xMm: 13.4, yMm: 10.2, wMm: 37.0, hMm: 5.2, fontSizePt: 6.2, fontWeight: 800, textColor: 'onAccent', uppercase: true, maxLines: 2 },
        { id: 'vl-title', kind: 'field', fieldKey: 'cardTitle', xMm: 13.4, yMm: 15.6, wMm: 37.0, hMm: 3.0, fontSizePt: 4.8, fontWeight: 600, textColor: 'onAccent', maxLines: 1 },
        { id: 'vl-photo', kind: 'photo', photoShape: 'circle', xMm: 14.2, yMm: 20.4, wMm: 25.6, hMm: 31.2, photoPosY: 16, borderColor: 'surface', borderWidthMm: 1.4, shadow: true },
        { id: 'vl-name', kind: 'field', fieldKey: 'fullName', xMm: 3.6, yMm: 53.2, wMm: 46.8, hMm: 5.4, fontSizePt: 9.4, fontWeight: 800, textColor: 'ink', align: 'center', uppercase: true, maxLines: 1 },
        { id: 'vl-cls-box', kind: 'shape', xMm: 4.4, yMm: 59.2, wMm: 21.8, hMm: 8.6, fillColor: 'accentSoft', borderColor: 'accent', borderWidthMm: 0.3, radiusMm: 1.6 },
        { id: 'vl-cls-lbl', kind: 'text', text: 'SINIF', xMm: 4.8, yMm: 60.0, wMm: 21.0, hMm: 2.3, fontSizePt: 4.2, fontWeight: 700, textColor: 'accent', align: 'center', maxLines: 1 },
        { id: 'vl-cls-val', kind: 'field', fieldKey: 'className', xMm: 4.8, yMm: 62.5, wMm: 21.0, hMm: 4.2, fontSizePt: 7.4, fontWeight: 800, textColor: 'ink', align: 'center', maxLines: 1 },
        { id: 'vl-no-box', kind: 'shape', xMm: 27.8, yMm: 59.2, wMm: 21.8, hMm: 8.6, fillColor: 'accent', radiusMm: 1.6 },
        { id: 'vl-no-lbl', kind: 'text', text: 'OKUL NO', xMm: 28.2, yMm: 60.0, wMm: 21.0, hMm: 2.3, fontSizePt: 4.2, fontWeight: 600, textColor: 'onAccent', align: 'center', maxLines: 1 },
        { id: 'vl-no-val', kind: 'field', fieldKey: 'studentNumber', xMm: 28.2, yMm: 62.5, wMm: 21.0, hMm: 4.2, fontSizePt: 7.6, fontWeight: 800, textColor: 'onAccent', align: 'center', maxLines: 1 },
        { id: 'vl-dept', kind: 'field', fieldKey: 'department', prefix: 'Bölümü: ', xMm: 3.6, yMm: 68.4, wMm: 46.8, hMm: 3.0, fontSizePt: 5.3, fontWeight: 600, textColor: 'inkMuted', align: 'center', maxLines: 1 },
        { id: 'primary-code', kind: 'barcode', codeSource: 'studentNumber', showCodeText: true, xMm: 5.4, yMm: 71.8, wMm: 43.2, hMm: 9.0, textColor: 'ink' },
      ],
    },
    back: {
      backgroundColor: '#ffffff',
      artworkStyle: 'lanyard-arch',
      elements: [
        { id: 'vl-b-school', kind: 'field', fieldKey: 'schoolName', xMm: 4.0, yMm: 7.2, wMm: 46.0, hMm: 4.8, fontSizePt: 6.4, fontWeight: 700, textColor: 'onAccent', align: 'center', uppercase: true, maxLines: 1 },
        { id: 'back-code', kind: 'qrcode', codeSource: 'studentSummary', xMm: 16.5, yMm: 19.0, wMm: 21.0, hMm: 21.0, textColor: 'ink' },
        { id: 'vl-b-tc', kind: 'field', fieldKey: 'nationalId', prefix: 'T.C.: ', xMm: 4.5, yMm: 41.2, wMm: 45.0, hMm: 3.1, fontSizePt: 5.5, fontWeight: 600, textColor: 'ink', align: 'center', maxLines: 1 },
        { id: 'vl-b-blood', kind: 'field', fieldKey: 'bloodType', prefix: 'Kan Grubu: ', xMm: 4.5, yMm: 44.5, wMm: 45.0, hMm: 3.1, fontSizePt: 5.6, fontWeight: 700, textColor: 'accent', align: 'center', maxLines: 1 },
        { id: 'vl-b-birth', kind: 'field', fieldKey: 'birthInfo', prefix: 'Doğum: ', xMm: 4.5, yMm: 47.8, wMm: 45.0, hMm: 3.0, fontSizePt: 5.1, fontWeight: 500, textColor: 'inkMuted', align: 'center', maxLines: 1 },
        { id: 'vl-b-addr', kind: 'field', fieldKey: 'schoolAddress', xMm: 4.5, yMm: 51.0, wMm: 45.0, hMm: 5.4, fontSizePt: 5.0, fontWeight: 500, textColor: 'inkMuted', align: 'center', maxLines: 2 },
        { id: 'back-note', kind: 'text', text: DEFAULT_PVC_BACK_NOTE, xMm: 4.2, yMm: 56.8, wMm: 45.6, hMm: 8.6, fontSizePt: 4.8, fontWeight: 500, textColor: 'inkMuted', align: 'center', maxLines: 3 },
        { id: 'studio-logo', kind: 'studio-logo', xMm: 4.2, yMm: 68.4, wMm: 9.6, hMm: 9.6, radiusMm: 1.6 },
        { id: 'studio-name', kind: 'field', fieldKey: 'studioName', xMm: 15.0, yMm: 67.6, wMm: 35.0, hMm: 3.6, fontSizePt: 5.8, fontWeight: 800, textColor: 'accent', uppercase: true, maxLines: 1 },
        { id: 'studio-phone', kind: 'field', fieldKey: 'studioPhone', prefix: 'Tel: ', xMm: 15.0, yMm: 71.2, wMm: 35.0, hMm: 3.2, fontSizePt: 5.4, fontWeight: 700, textColor: 'ink', maxLines: 1 },
        { id: 'studio-addr', kind: 'field', fieldKey: 'studioAddress', xMm: 15.0, yMm: 74.6, wMm: 35.0, hMm: 7.4, fontSizePt: 4.7, fontWeight: 500, textColor: 'inkMuted', maxLines: 2 },
      ],
    },
  },
  {
    id: 'minimal-pro',
    name: 'Akıllı Kampüs · Tech QR',
    shortBadge: 'Yatay · QR',
    subtitle: 'T.C. MEB başlığı, nokta ızgara, sağda büyük ön QR kod, net bilgiler ve arkada tam genişlik barkod',
    orientation: 'landscape',
    cardRadiusMm: PVC_DEFAULT_CORNER_RADIUS_MM,
    front: {
      backgroundColor: '#ffffff',
      artworkStyle: 'swiss-minimal',
      elements: [
        { id: 'wm-logo', kind: 'school-logo', xMm: 34.0, yMm: 18.0, wMm: 22.0, hMm: 22.0, opacity: 0.06 },
        { id: 'mp-logo', kind: 'school-logo', xMm: 7.2, yMm: 3.0, wMm: 9.0, hMm: 9.0, radiusMm: 2.0 },
        { id: 'header-top', kind: 'text', text: DEFAULT_PVC_HEADER_TOP_TEXT, xMm: 17.6, yMm: 2.3, wMm: 40.4, hMm: 2.2, fontSizePt: 4.2, fontWeight: 700, textColor: 'accent', maxLines: 1 },
        { id: 'mp-school', kind: 'field', fieldKey: 'schoolName', xMm: 17.6, yMm: 4.7, wMm: 40.4, hMm: 4.2, fontSizePt: 7.2, fontWeight: 800, textColor: 'ink', uppercase: true, maxLines: 1 },
        { id: 'mp-title', kind: 'field', fieldKey: 'cardTitle', xMm: 17.6, yMm: 9.1, wMm: 40.4, hMm: 3.0, fontSizePt: 5.1, fontWeight: 700, textColor: 'inkMuted', maxLines: 1 },
        { id: 'mp-yr-box', kind: 'shape', xMm: 62.2, yMm: 4.0, wMm: 19.8, hMm: 5.4, fillColor: 'accent', radiusMm: 1.4 },
        { id: 'mp-year', kind: 'field', fieldKey: 'academicYear', xMm: 62.8, yMm: 4.7, wMm: 18.6, hMm: 4.0, fontSizePt: 5.8, fontWeight: 700, textColor: 'onAccent', align: 'center', maxLines: 1 },
        { id: 'mp-hairline', kind: 'shape', shapeVariant: 'line', xMm: 7.2, yMm: 13.6, wMm: 50.8, hMm: 0.35, fillColor: 'border', opacity: 0.5 },
        { id: 'mp-photo', kind: 'photo', photoShape: 'rounded', xMm: 7.2, yMm: 16.0, wMm: 20.8, hMm: 27.8, radiusMm: 2.6, borderColor: 'accent', borderWidthMm: 0.45, shadow: true },
        { id: 'mp-lbl-n', kind: 'text', text: 'ADI SOYADI', xMm: 30.6, yMm: 16.2, wMm: 28.0, hMm: 2.4, fontSizePt: 4.3, fontWeight: 700, textColor: 'accent', maxLines: 1 },
        { id: 'mp-name', kind: 'field', fieldKey: 'fullName', xMm: 30.6, yMm: 18.8, wMm: 28.5, hMm: 7.4, fontSizePt: 8.6, fontWeight: 800, textColor: 'ink', uppercase: true, maxLines: 2 },
        { id: 'mp-cls-lbl', kind: 'text', text: 'SINIF · OKUL NO', xMm: 30.6, yMm: 27.0, wMm: 28.5, hMm: 2.4, fontSizePt: 4.3, fontWeight: 700, textColor: 'inkMuted', maxLines: 1 },
        { id: 'mp-classno', kind: 'field', fieldKey: 'classAndNumber', xMm: 30.6, yMm: 29.5, wMm: 28.5, hMm: 4.2, fontSizePt: 7.2, fontWeight: 800, textColor: 'accent', maxLines: 1 },
        { id: 'mp-dept', kind: 'field', fieldKey: 'department', prefix: 'Bölümü: ', xMm: 30.6, yMm: 34.4, wMm: 28.5, hMm: 3.3, fontSizePt: 5.4, fontWeight: 600, textColor: 'inkMuted', maxLines: 1 },
        { id: 'mp-tc', kind: 'field', fieldKey: 'nationalId', prefix: 'T.C.: ', xMm: 30.6, yMm: 38.0, wMm: 28.5, hMm: 3.2, fontSizePt: 5.3, fontWeight: 500, textColor: 'inkMuted', maxLines: 1 },
        { id: 'mp-blood', kind: 'field', fieldKey: 'bloodType', prefix: 'Kan: ', xMm: 30.6, yMm: 41.4, wMm: 28.5, hMm: 3.2, fontSizePt: 5.5, fontWeight: 700, textColor: 'accent', maxLines: 1 },
        { id: 'mp-qr-frame', kind: 'shape', xMm: 61.6, yMm: 16.0, wMm: 20.6, hMm: 20.6, fillColor: 'surface', borderColor: 'accent', borderWidthMm: 0.35, radiusMm: 2.0, shadow: true },
        { id: 'primary-code', kind: 'qrcode', codeSource: 'studentSummary', xMm: 62.6, yMm: 17.0, wMm: 18.6, hMm: 18.6, textColor: 'ink' },
        { id: 'mp-no-tag', kind: 'field', fieldKey: 'studentNumber', prefix: 'ID · ', fontFamily: 'mono', xMm: 61.6, yMm: 37.8, wMm: 20.6, hMm: 3.6, fontSizePt: 5.8, fontWeight: 700, textColor: 'accent', align: 'center', maxLines: 1 },
        { id: 'front-sig', kind: 'signature', sigRole: 'principal', xMm: 62.0, yMm: 42.0, wMm: 19.6, hMm: 8.2 },
      ],
    },
    back: {
      backgroundColor: '#ffffff',
      artworkStyle: 'swiss-minimal',
      elements: [
        { id: 'mp-b-school', kind: 'field', fieldKey: 'schoolName', xMm: 7.2, yMm: 3.8, wMm: 56.0, hMm: 4.4, fontSizePt: 6.8, fontWeight: 800, textColor: 'ink', uppercase: true, maxLines: 1 },
        { id: 'mp-b-year', kind: 'field', fieldKey: 'academicYear', xMm: 65.0, yMm: 3.8, wMm: 16.8, hMm: 4.0, fontSizePt: 5.8, fontWeight: 600, textColor: 'inkMuted', align: 'right', maxLines: 1 },
        { id: 'mp-b-rule', kind: 'shape', shapeVariant: 'line', xMm: 7.2, yMm: 8.8, wMm: 74.6, hMm: 0.35, fillColor: 'border', opacity: 0.45 },
        { id: 'back-code', kind: 'barcode', codeSource: 'studentNumber', showCodeText: true, xMm: 7.2, yMm: 10.4, wMm: 74.6, hMm: 10.4, textColor: 'ink' },
        { id: 'mp-b-birth', kind: 'field', fieldKey: 'birthInfo', prefix: 'Doğum: ', xMm: 7.2, yMm: 21.4, wMm: 52.0, hMm: 3.0, fontSizePt: 5.1, fontWeight: 500, textColor: 'inkMuted', maxLines: 1 },
        { id: 'mp-b-blood', kind: 'field', fieldKey: 'bloodType', prefix: 'Kan: ', xMm: 60.0, yMm: 21.4, wMm: 21.8, hMm: 3.0, fontSizePt: 5.3, fontWeight: 700, textColor: 'accent', align: 'right', maxLines: 1 },
        { id: 'mp-b-addr', kind: 'field', fieldKey: 'schoolAddress', prefix: 'Okul Adresi: ', xMm: 7.2, yMm: 24.6, wMm: 74.6, hMm: 5.0, fontSizePt: 5.0, fontWeight: 500, textColor: 'inkMuted', maxLines: 2 },
        { id: 'back-note', kind: 'text', text: DEFAULT_PVC_BACK_NOTE, xMm: 7.2, yMm: 29.8, wMm: 74.6, hMm: 7.8, fontSizePt: 4.9, fontWeight: 500, textColor: 'inkMuted', maxLines: 2 },
        { id: 'studio-logo', kind: 'studio-logo', xMm: 7.2, yMm: 40.4, wMm: 10.0, hMm: 10.0, radiusMm: 1.6 },
        { id: 'studio-name', kind: 'field', fieldKey: 'studioName', xMm: 18.8, yMm: 40.2, wMm: 35.0, hMm: 3.8, fontSizePt: 6.0, fontWeight: 800, textColor: 'accent', uppercase: true, maxLines: 1 },
        { id: 'studio-phone', kind: 'field', fieldKey: 'studioPhone', prefix: 'Tel: ', xMm: 54.5, yMm: 40.2, wMm: 27.3, hMm: 3.8, fontSizePt: 5.6, fontWeight: 700, textColor: 'ink', align: 'right', maxLines: 1 },
        { id: 'studio-addr', kind: 'field', fieldKey: 'studioAddress', xMm: 18.8, yMm: 44.3, wMm: 63.0, hMm: 6.4, fontSizePt: 5.0, fontWeight: 500, textColor: 'inkMuted', maxLines: 2 },
      ],
    },
  },
];

export function createBlankPvcCustomDesign(
  name: string,
  orientation: PvcCardOrientation,
): PvcCustomDesign {
  const id = `custom-${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  if (orientation === 'portrait') {
    return {
      id,
      name,
      orientation: 'portrait',
      cardRadiusMm: PVC_DEFAULT_CORNER_RADIUS_MM,
      updatedAt: now,
      front: {
        backgroundColor: '#ffffff',
        artworkStyle: 'none',
        elements: [
          { id: 'header-top', kind: 'text', text: DEFAULT_PVC_HEADER_TOP_TEXT, xMm: 4.0, yMm: 7.2, wMm: 46.0, hMm: 2.3, fontSizePt: 4.2, fontWeight: 600, textColor: 'inkMuted', align: 'center', maxLines: 1 },
          { id: 'c-school', kind: 'field', fieldKey: 'schoolName', xMm: 4.0, yMm: 9.8, wMm: 46.0, hMm: 5.0, fontSizePt: 6.8, fontWeight: 700, textColor: 'ink', align: 'center', uppercase: true, maxLines: 2 },
          { id: 'c-photo', kind: 'photo', photoShape: 'rounded', xMm: 14.2, yMm: 22.0, wMm: 25.6, hMm: 34.1, radiusMm: 2.0, borderColor: 'border', borderWidthMm: 0.35 },
          { id: 'c-name', kind: 'field', fieldKey: 'fullName', xMm: 4.0, yMm: 58.5, wMm: 46.0, hMm: 5.4, fontSizePt: 9.2, fontWeight: 700, textColor: 'ink', align: 'center', uppercase: true, maxLines: 1 },
          { id: 'c-classno', kind: 'field', fieldKey: 'classAndNumber', xMm: 4.0, yMm: 64.5, wMm: 46.0, hMm: 4.0, fontSizePt: 6.8, fontWeight: 600, textColor: 'accent', align: 'center', maxLines: 1 },
        ],
      },
      back: {
        backgroundColor: '#ffffff',
        artworkStyle: 'none',
        elements: [
          { id: 'c-b-note', kind: 'text', text: DEFAULT_PVC_BACK_NOTE, xMm: 4.5, yMm: 54.0, wMm: 45.0, hMm: 10.0, fontSizePt: 5.2, fontWeight: 500, textColor: 'inkMuted', align: 'center', maxLines: 3 },
          { id: 'studio-logo', kind: 'studio-logo', xMm: 4.5, yMm: 69.0, wMm: 9.5, hMm: 9.5, radiusMm: 1.5 },
          { id: 'studio-name', kind: 'field', fieldKey: 'studioName', xMm: 15.5, yMm: 68.5, wMm: 34.0, hMm: 3.6, fontSizePt: 5.8, fontWeight: 700, textColor: 'accent', uppercase: true, maxLines: 1 },
          { id: 'studio-phone', kind: 'field', fieldKey: 'studioPhone', prefix: 'Tel: ', xMm: 15.5, yMm: 72.4, wMm: 34.0, hMm: 3.4, fontSizePt: 5.4, fontWeight: 600, textColor: 'ink', maxLines: 1 },
          { id: 'studio-addr', kind: 'field', fieldKey: 'studioAddress', xMm: 15.5, yMm: 76.0, wMm: 34.0, hMm: 6.4, fontSizePt: 4.8, fontWeight: 500, textColor: 'inkMuted', maxLines: 2 },
        ],
      },
    };
  }
  return {
    id,
    name,
    orientation: 'landscape',
    cardRadiusMm: PVC_DEFAULT_CORNER_RADIUS_MM,
    updatedAt: now,
    front: {
      backgroundColor: '#ffffff',
      artworkStyle: 'none',
      elements: [
        { id: 'header-top', kind: 'text', text: DEFAULT_PVC_HEADER_TOP_TEXT, xMm: 4.0, yMm: 2.2, wMm: 77.6, hMm: 2.3, fontSizePt: 4.4, fontWeight: 600, textColor: 'inkMuted', maxLines: 1 },
        { id: 'c-school', kind: 'field', fieldKey: 'schoolName', xMm: 4.0, yMm: 4.8, wMm: 77.6, hMm: 5.0, fontSizePt: 7.2, fontWeight: 700, textColor: 'ink', uppercase: true, maxLines: 1 },
        { id: 'c-photo', kind: 'photo', photoShape: 'rounded', xMm: 4.0, yMm: 14.0, wMm: 22.8, hMm: 30.4, radiusMm: 1.8, borderColor: 'border', borderWidthMm: 0.35 },
        { id: 'c-name', kind: 'field', fieldKey: 'fullName', xMm: 30.0, yMm: 16.0, wMm: 51.6, hMm: 5.6, fontSizePt: 9.5, fontWeight: 700, textColor: 'ink', uppercase: true, maxLines: 1 },
        { id: 'c-classno', kind: 'field', fieldKey: 'classAndNumber', xMm: 30.0, yMm: 22.5, wMm: 51.6, hMm: 4.0, fontSizePt: 6.8, fontWeight: 600, textColor: 'accent', maxLines: 1 },
      ],
    },
    back: {
      backgroundColor: '#ffffff',
      artworkStyle: 'none',
      elements: [
        { id: 'c-b-note', kind: 'text', text: DEFAULT_PVC_BACK_NOTE, xMm: 5.0, yMm: 24.0, wMm: 75.6, hMm: 10.0, fontSizePt: 5.4, fontWeight: 500, textColor: 'inkMuted', align: 'center', maxLines: 3 },
        { id: 'studio-logo', kind: 'studio-logo', xMm: 4.5, yMm: 39.5, wMm: 10.0, hMm: 10.0, radiusMm: 1.6 },
        { id: 'studio-name', kind: 'field', fieldKey: 'studioName', xMm: 16.2, yMm: 39.5, wMm: 36.0, hMm: 3.8, fontSizePt: 6.0, fontWeight: 700, textColor: 'accent', uppercase: true, maxLines: 1 },
        { id: 'studio-phone', kind: 'field', fieldKey: 'studioPhone', prefix: 'Tel: ', xMm: 53.0, yMm: 39.5, wMm: 28.0, hMm: 3.8, fontSizePt: 5.6, fontWeight: 600, textColor: 'ink', align: 'right', maxLines: 1 },
        { id: 'studio-addr', kind: 'field', fieldKey: 'studioAddress', xMm: 16.2, yMm: 43.6, wMm: 64.8, hMm: 6.5, fontSizePt: 5.0, fontWeight: 500, textColor: 'inkMuted', maxLines: 2 },
      ],
    },
  };
}
