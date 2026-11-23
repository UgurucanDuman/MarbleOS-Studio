import { useState } from 'react';
import { formatPhotoSize, importPhotoSelection, preparePhotoSelection } from './photoImport';

export function usePhotoImport() {
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const run = async (
    files: File[],
    folder: boolean,
    inSequence: boolean,
    save: Parameters<typeof importPhotoSelection>[2],
  ) => {
    setProgress(null);
    const selection = preparePhotoSelection(files, folder);
    const total = `${selection.photos.length} fotoğraf · ${formatPhotoSize(selection.totalBytes)}`;
    setReading(true);
    try {
      return await importPhotoSelection(selection, inSequence, save, ({ imported, skipped = 0 }, bytes) => {
        setProgress(`${total} · İşlenen: ${imported + skipped} / ${selection.photos.length} (${formatPhotoSize(bytes)}) · Yeni: ${imported} · Atlanan: ${skipped}`);
      });
    } finally {
      setReading(false);
    }
  };

  return { run, progress, reading };
}
