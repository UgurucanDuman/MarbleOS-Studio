import { usesDesktopStorage } from '../system/desktop/desktopStorage';
import {
  DockIconAlbumDesigner,
  DockIconExcel,
  DockIconPhotoStudio,
  DockIconPrintCenter,
} from './StudioDockIcons';
import type { StudioAppDefinition } from './types';

export const STUDIO_APPS: StudioAppDefinition[] = [
  {
    appId: 'excel-list',
    code: '01',
    title: 'Excel & Sınıf Listeleri',
    shortLabel: 'Sınıf Listesi',
    subtitle: usesDesktopStorage
      ? 'Okul, sınıf ve öğrenci kayıtları · Yerel'
      : 'Okul, sınıf ve öğrenci kayıtları · Tarayıcı prototipi',
    accentHex: '#10b981',
    defaultGeometry: { x: 28, y: 84, width: 730, height: 550 },
    icon: <DockIconExcel />,
  },
  {
    appId: 'photo-studio',
    code: '02',
    title: 'Fotoğraf Eşleştirme & Stüdyo',
    shortLabel: 'Fotoğraf Stüdyo',
    subtitle: 'Kadraj ve ışık önizlemesi; öğrenci eşleştirme',
    accentHex: '#e4e4e7',
    defaultGeometry: { x: 774, y: 84, width: 640, height: 550 },
    icon: <DockIconPhotoStudio />,
  },
  {
    appId: 'album-designer',
    code: '03',
    title: 'Albüm & Kimlik Tasarımı',
    shortLabel: 'Albüm Tasarım',
    subtitle: 'Sınıf çizelgesi, yıllık albüm ve PVC öğrenci kimliği',
    accentHex: '#a855f7',
    defaultGeometry: { x: 160, y: 96, width: 710, height: 530 },
    icon: <DockIconAlbumDesigner />,
  },
  {
    appId: 'print-center',
    code: '04',
    title: 'Baskı & Çıktı Merkezi',
    shortLabel: 'Baskı Merkezi',
    subtitle: '300 DPI fiziksel dizgi, doğrudan yazıcı motoru, kimlik & albüm çıktısı',
    accentHex: '#06b6d4',
    defaultGeometry: { x: 120, y: 74, width: 1080, height: 640 },
    icon: <DockIconPrintCenter />,
  },
];

