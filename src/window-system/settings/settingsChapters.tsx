import React from 'react';
import {
  BookIconAppearance,
  BookIconBackupArchive,
  BookIconCompanyStudio,
  BookIconOfficialSeal,
  BookIconPrivacyShield,
  BookIconVaultKey,
} from './icons/SettingsBookIcons';

export type SettingsVolumeId = 'general' | 'legal';
export type BookChapterId = 'appearance' | 'company' | 'vault' | 'backup' | 'privacy' | 'registration';

export interface BookChapter {
  id: BookChapterId;
  folio: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

export const GENERAL_CHAPTERS: readonly BookChapter[] = [
  {
    id: 'appearance',
    folio: '01',
    title: 'Görünüm & Masaüstü',
    subtitle: 'Tema, duvar kağıdı, widgetlar ve envanter',
    icon: <BookIconAppearance size={26} />,
  },
  {
    id: 'company',
    folio: '02',
    title: 'Şirket & Adres Bilgileri',
    subtitle: 'İşletme adı, yetkili, telefon ve adres',
    icon: <BookIconCompanyStudio size={26} />,
  },
  {
    id: 'vault',
    folio: '03',
    title: 'Veri Kasası & Kurtarma',
    subtitle: 'DPAPI ve 256-bit kurtarma anahtarı',
    icon: <BookIconVaultKey size={26} />,
  },
  {
    id: 'backup',
    folio: '04',
    title: 'Şifreli Yedekleme',
    subtitle: 'Kasa yedeği (.marbleos-kasa) ve geri yükleme',
    icon: <BookIconBackupArchive size={26} />,
  },
];

export const LEGAL_CHAPTERS: readonly BookChapter[] = [
  {
    id: 'privacy',
    folio: '01',
    title: 'Gizlilik & Veri Politikası',
    subtitle: 'Çevrimdışı mimari ve KVKK güvencesi',
    icon: <BookIconPrivacyShield size={26} />,
  },
  {
    id: 'registration',
    folio: '02',
    title: 'Telif, Marka & Tescil',
    subtitle: 'Bakanlık ve TürkPatent resmi kayıtları',
    icon: <BookIconOfficialSeal size={26} />,
  },
];

