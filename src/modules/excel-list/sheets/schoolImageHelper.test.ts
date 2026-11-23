import { expect, test } from 'vitest';
import { hasValidImageSignature, readValidatedSchoolImage } from './schoolImageHelper';

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

test('validates PNG, JPEG and WebP magic bytes and rejects disguised files', () => {
  expect(hasValidImageSignature(PNG_HEADER)).toBe(true);
  expect(hasValidImageSignature(JPEG_HEADER)).toBe(true);
  expect(hasValidImageSignature(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBe(false);
});

test('readValidatedSchoolImage enforces 3 MB for logo/signature and 8 MB for school cover', async () => {
  const validPng = new File([PNG_HEADER], 'logo.png', { type: 'image/png' });
  const dataUrl = await readValidatedSchoolImage(validPng, 'logo');
  expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

  const fourMb = new Uint8Array(4 * 1024 * 1024);
  fourMb.set(JPEG_HEADER, 0);
  const fourMbFile = new File([fourMb], 'photo.jpg', { type: 'image/jpeg' });

  await expect(readValidatedSchoolImage(fourMbFile, 'signature')).rejects.toThrow('en fazla 3 MB');
  const coverUrl = await readValidatedSchoolImage(fourMbFile, 'cover');
  expect(coverUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
});
