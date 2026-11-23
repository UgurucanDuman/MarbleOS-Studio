import { expect, test } from 'vitest';
import { centeredSheetRect, relativeTriggerRect, shrinkInPlace } from './sheetOrigin';

test('final card is centered and never touches the window edges', () => {
  expect(centeredSheetRect(800, 600, 440, 300)).toEqual({ left: 180, top: 150, width: 440, height: 300 });
  // Dar pencere: 16 px yan boşluk; uzun form: 12 px üst/alt boşluk, gövde kaydırılır.
  expect(centeredSheetRect(400, 300, 440, 900)).toEqual({ left: 16, top: 12, width: 368, height: 276 });
});

test('card starts exactly on the button, using its resting size', () => {
  const layer = { left: 100, top: 50, width: 800, height: 600 };
  // Basılıyken %97 ölçekli ölçülen buton; merkez korunur, boyut dönüşümsüz değerden gelir.
  const pressed = { left: 671.5, top: 65.45, width: 97, height: 29.1 };
  expect(relativeTriggerRect(pressed, layer, 100, 30)).toEqual({ left: 570, top: 15, width: 100, height: 30 });
  expect(relativeTriggerRect({ left: 0, top: 0, width: 0, height: 0 }, layer, 0, 0)).toBeNull();
});

test('without a button the card shrinks slightly in place and fades', () => {
  const state = shrinkInPlace({ left: 100, top: 100, width: 400, height: 200 });
  expect(state).toEqual({
    left: 108, top: 104, width: 384, height: 192,
    borderRadius: 16, opacity: 0,
  });
});
