import { expect, test, vi } from 'vitest';
import { formatPhotoSize, importPhotoSelection, preparePhotoSelection } from './photoImport';

test.each([
  [33, 5_000_000, 165_000_000, '165 MB'],
  [33, 8_000_000, 264_000_000, '264 MB'],
  [150, 8_000_000, 1_200_000_000, '1,2 GB'],
])('calculates the total of %i selected photos of %i bytes without reading them', (count, bytes, total, label) => {
  const files = Array.from({ length: count }, (_, index) => ({ name: `${index}.jpg`, size: bytes }) as File);
  expect(preparePhotoSelection(files).totalBytes).toBe(total);
  expect(formatPhotoSize(total)).toBe(label);
});

test('preserves natural filename order across chunks and reports the partial commit', async () => {
  const bytes = new Uint8Array(8_000_000);
  bytes.set([0xff, 0xd8, 0xff]);
  const selection = preparePhotoSelection(['11.jpg', '10.jpg', '2.jpg'].map((name) => new File([bytes], name)));
  const save = vi.fn()
    .mockResolvedValueOnce({ imported: 2, matched: 1, unmatched: 1 })
    .mockRejectedValueOnce(new Error('Disk dolu.'));
  const progress = vi.fn();
  await expect(importPhotoSelection(selection, true, save, progress)).rejects
    .toThrow('2 fotoğraf kaydedildi, 1 fotoğraf aktarılmadı');
  expect(save.mock.calls.map(([batch]) => batch.map((item: { fileName: string }) => item.fileName)))
    .toEqual([['2.jpg', '10.jpg'], ['11.jpg']]);
  expect(progress).toHaveBeenLastCalledWith({ imported: 2, matched: 1, unmatched: 1 }, 16_000_000);
});
