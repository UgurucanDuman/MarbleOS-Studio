import { describe, expect, test } from 'vitest';
import { fitStudentLabelPoints, layoutStudentNameLines } from './tabularPrintLayout';

describe('layoutStudentNameLines (Çizelge Akıllı Çok Satırlı İsim Yerleşimi)', () => {
  test('kısa isimleri temiz 2 satırda tutarken uzun çok kelimeli isimleri 3-4 satıra bölüp büyütür', () => {
    const shortRes = layoutStudentNameLines({
      studentNumber: '702',
      firstName: 'ZEYNEP',
      lastName: 'GÜNEŞ',
      showStudentNumbers: true,
      targetPoints: 10,
      availableLengthMm: 17.7,
      availableThicknessMm: 10.7,
    });
    expect(shortRes.lines.length).toBeLessThanOrEqual(2);
    expect(shortRes.fontPt).toBeGreaterThan(7.8);

    const longOld2LinePt = fitStudentLabelPoints('711 DURU SENA NUR', 'KABLANOĞLU YILMAZ', 10, 17.7);
    const longSmart = layoutStudentNameLines({
      studentNumber: '711',
      firstName: 'DURU SENA NUR',
      lastName: 'KABLANOĞLU YILMAZ',
      showStudentNumbers: true,
      targetPoints: 10,
      availableLengthMm: 17.7,
      availableThicknessMm: 10.7,
    });
    expect(longSmart.lines.length).toBeGreaterThanOrEqual(3);
    expect(longSmart.fontPt).toBeGreaterThan(longOld2LinePt + 1.5);
    expect(longSmart.fontPt).toBeGreaterThanOrEqual(6.5);
  });

  test('tek parça aşırı uzun kelimede dahi okunaklı puntoda kırılım üretir ve 8→10 pt ölçeğini korur', () => {
    const pt8 = layoutStudentNameLines({
      studentNumber: '711',
      firstName: 'DURU',
      lastName: 'KARAKABLANOĞULLARI',
      showStudentNumbers: true,
      targetPoints: 8,
      availableLengthMm: 17.7,
      availableThicknessMm: 10.7,
    });
    const pt10 = layoutStudentNameLines({
      studentNumber: '711',
      firstName: 'DURU',
      lastName: 'KARAKABLANOĞULLARI',
      showStudentNumbers: true,
      targetPoints: 10,
      availableLengthMm: 17.7,
      availableThicknessMm: 10.7,
    });
    expect(pt10.fontPt).toBeGreaterThan(pt8.fontPt);
    expect(pt10.fontPt).toBeGreaterThanOrEqual(6.8);
  });
});
