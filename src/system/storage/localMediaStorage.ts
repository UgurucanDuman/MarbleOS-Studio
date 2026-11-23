/**
 * Planned local desktop folders, not an implemented filesystem service.
 * Native code must resolve LOCALAPPDATA at runtime; do not hardcode a Windows user name.
 */

export interface LocalStorageLayout {
  rootDir: string;
  originalsDir: string;
  previewsDir: string;
  albumsDir: string;
  printOutboxDir: string;
}

export const DEFAULT_LOCAL_STORAGE_LAYOUT: LocalStorageLayout = {
  rootDir: 'AppData/Local/MarbleOS-Studio',
  originalsDir: 'AppData/Local/MarbleOS-Studio/media/originals',
  previewsDir: 'AppData/Local/MarbleOS-Studio/media/previews',
  albumsDir: 'AppData/Local/MarbleOS-Studio/projects/albums',
  printOutboxDir: 'AppData/Local/MarbleOS-Studio/exports/print-ready',
};

