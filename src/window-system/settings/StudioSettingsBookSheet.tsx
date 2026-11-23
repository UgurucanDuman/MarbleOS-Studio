import { useCallback, useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { StudioBrandLogo } from '../../system/brand/StudioBrandLogo';
import { AppleCrossfadeSlot } from '../../system/motion/AppleCrossfadeSlot';
import type { CompanyProfile } from '../../system/schemas/desktopPersonalizationSchemas';
import { useStudioSnapshotQuery } from '../../system/query/useStudioQueries';
import type { ColorPaletteId, ResolvedTheme, ThemePreference } from '../../system/theme/useStudioTheme';
import { OriginSheet } from '../sheet/OriginSheet';
import type { OriginSheetController } from '../sheet/useOriginSheet';
import { GeneralAppearancePage } from './general/GeneralAppearancePage';
import { GeneralBackupPage } from './general/GeneralBackupPage';
import { GeneralCompanyPage } from './general/GeneralCompanyPage';
import { GeneralVaultPage } from './general/GeneralVaultPage';
import { BookIconAppearance, BookIconPrivacyShield } from './icons/SettingsBookIcons';
import { LegalPrivacyPage } from './legal/LegalPrivacyPage';
import { LegalRegistrationPage } from './legal/LegalRegistrationPage';
import {
  GENERAL_CHAPTERS,
  LEGAL_CHAPTERS,
  type BookChapterId,
  type SettingsVolumeId,
} from './settingsChapters';
import './settings-book.css';
import './settings-pages.css';
import './settings-personalize.css';
import './settings-palettes.css';

export interface SettingsOpenTarget {
  volume: SettingsVolumeId;
  chapterId: BookChapterId;
  seq: number;
}

export function StudioSettingsBookSheet({
  controller,
  company,
  companyLogoUrl,
  themePreference,
  resolvedTheme,
  activePalette,
  openTarget,
  onChangeTheme,
  onChangePalette,
}: {
  controller: OriginSheetController;
  company: CompanyProfile;
  companyLogoUrl: string | null;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  activePalette: ColorPaletteId;
  openTarget?: SettingsOpenTarget | null;
  onChangeTheme: (pref: ThemePreference) => void;
  onChangePalette: (palette: ColorPaletteId) => void;
}) {
  const { data: db } = useStudioSnapshotQuery(controller.phase !== 'closed');
  const bookUid = useId();
  const reduced = useReducedMotion() ?? false;
  const [volume, setVolume] = useState<SettingsVolumeId>('general');
  const [[pageIndex, direction], setPageState] = useState<[number, number]>([0, 1]);
  const [wasOpen, setWasOpen] = useState(false);
  const [handledSeq, setHandledSeq] = useState(0);

  if (openTarget && openTarget.seq !== handledSeq) {
    setHandledSeq(openTarget.seq);
    const targetList = openTarget.volume === 'general' ? GENERAL_CHAPTERS : LEGAL_CHAPTERS;
    const idx = Math.max(0, targetList.findIndex((c) => c.id === openTarget.chapterId));
    setVolume(openTarget.volume);
    setPageState([idx, 1]);
    setWasOpen(controller.isOpen);
  } else if (controller.isOpen !== wasOpen) {
    setWasOpen(controller.isOpen);
    if (controller.isOpen) {
      setVolume('general');
      setPageState([0, 1]);
    }
  }

  const chapters = volume === 'general' ? GENERAL_CHAPTERS : LEGAL_CHAPTERS;

  const switchVolume = useCallback((nextVol: SettingsVolumeId) => {
    setVolume((curr) => {
      if (curr === nextVol) return curr;
      setPageState([0, nextVol === 'legal' ? 1 : -1]);
      return nextVol;
    });
  }, []);

  const goToPage = useCallback(
    (nextIndex: number) => {
      setPageState(([curr]) => {
        const clamped = Math.max(0, Math.min(chapters.length - 1, nextIndex));
        if (clamped === curr) return [curr, 1];
        return [clamped, clamped > curr ? 1 : -1];
      });
    },
    [chapters.length],
  );

  useEffect(() => {
    if (!controller.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(pageIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(pageIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller.isOpen, goToPage, pageIndex]);

  const activeChapter = chapters[pageIndex] ?? chapters[0];
  const prevChapter = pageIndex > 0 ? chapters[pageIndex - 1] : null;
  const nextChapter = pageIndex < chapters.length - 1 ? chapters[pageIndex + 1] : null;
  const volumeLabel = volume === 'general' ? 'SİSTEM AYARLARI' : 'GİZLİLİK VE RESMİ TESCİL';
  const brandTitle = company.companyName ? `MarbleOS · ${company.companyName}` : 'MarbleOS';

  return (
    <OriginSheet
      controller={controller}
      title="MarbleOS Sistem Ayarları ve El Kitabı"
      width={880}
      hideHeader
      hideFooter
      bodyClassName="os-book-sheet-body"
    >
      <div className="os-book-spread">
        <aside className="os-book-index" aria-label="Sistem el kitabı bölümleri">
          <div className="os-book-index-top">
            <div className="os-book-brand">
              <StudioBrandLogo size="sm" variant="icon" logoUrl={companyLogoUrl} />
              <div>
                <strong>{brandTitle}</strong>
                <span>Sistem Ayarları ve El Kitabı</span>
              </div>
            </div>

            <div className="os-book-volume-tabs" role="tablist" aria-label="Ayar kategorisi">
              {(
                [
                  { id: 'general', label: 'Sistem Ayarları', icon: <BookIconAppearance size={16} /> },
                  { id: 'legal', label: 'Gizlilik & Tescil', icon: <BookIconPrivacyShield size={16} /> },
                ] as const
              ).map((item) => {
                const active = volume === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`os-book-volume-tab ${active ? 'is-active' : ''}`}
                    onClick={() => switchVolume(item.id)}
                  >
                    {active && (
                      <motion.span
                        layoutId={`${bookUid}-volume-pill`}
                        className="os-book-volume-pill"
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 36 }}
                      />
                    )}
                    <span className="os-book-volume-tab-inner">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <nav className="os-book-chapters" aria-label="Bölüm sayfaları">
            <span className="os-book-group-title">{volumeLabel}</span>
            {chapters.map((chapter, idx) => {
              const isActive = idx === pageIndex;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  className={`os-book-chapter-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => goToPage(idx)}
                >
                  {isActive && (
                    <motion.span
                      layoutId={`${bookUid}-bookmark`}
                      className="os-book-bookmark"
                      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }}
                    />
                  )}
                  <span className="os-book-chapter-icon">{chapter.icon}</span>
                  <span className="os-book-chapter-text">
                    <strong>
                      <span className="os-book-chapter-num">{chapter.folio} · </span>
                      {chapter.title}
                    </strong>
                    <small>{chapter.subtitle}</small>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="os-book-colophon">
            <strong>Eser ve Marka Sahibi · Uğurcan Duman</strong>
            <span>Telif Tescil: 2026/20687 · Marka: 2026/996447</span>
          </div>
        </aside>

        <div className="os-book-spine" aria-hidden="true" />

        <div className="os-book-right">
          <header className="os-book-leaf-header">
            <span className="os-book-running-head">
              {volumeLabel} · {activeChapter.title}
            </span>
            <span className="os-book-folio-count">
              SAYFA {activeChapter.folio} / 0{chapters.length}
            </span>
          </header>

          <div className="os-book-leaf-stage">
            <AppleCrossfadeSlot
              activeKey={`${volume}:${activeChapter.id}`}
              direction={direction}
              variant="page"
            >
              <article
                className="os-book-leaf"
                aria-label={`${activeChapter.folio} ${activeChapter.title}`}
              >
                {activeChapter.id === 'appearance' && (
                  <GeneralAppearancePage
                    db={db}
                    themePreference={themePreference}
                    resolvedTheme={resolvedTheme}
                    activePalette={activePalette}
                    onChangeTheme={onChangeTheme}
                    onChangePalette={onChangePalette}
                  />
                )}
                {activeChapter.id === 'company' && <GeneralCompanyPage />}
                {activeChapter.id === 'vault' && <GeneralVaultPage />}
                {activeChapter.id === 'backup' && (
                  <GeneralBackupPage db={db} onCloseBook={controller.close} />
                )}
                {activeChapter.id === 'privacy' && <LegalPrivacyPage />}
                {activeChapter.id === 'registration' && <LegalRegistrationPage />}
              </article>
            </AppleCrossfadeSlot>
          </div>

          <footer className="os-book-folio-bar">
            <button
              type="button"
              className="os-book-turn-btn"
              disabled={!prevChapter}
              onClick={() => goToPage(pageIndex - 1)}
            >
              ← Önceki Sayfa
            </button>

            <div className="os-book-dots" role="tablist" aria-label="Sayfa numaraları">
              {chapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === pageIndex}
                  aria-label={`Sayfa ${ch.folio}: ${ch.title}`}
                  className={`os-book-dot ${idx === pageIndex ? 'is-active' : ''}`}
                  onClick={() => goToPage(idx)}
                >
                  {ch.folio}
                </button>
              ))}
            </div>

            <div className="os-book-folio-right">
              <button
                type="button"
                className="os-book-turn-btn"
                disabled={!nextChapter}
                onClick={() => goToPage(pageIndex + 1)}
              >
                Sonraki Sayfa →
              </button>
              <button type="button" className="os-book-close-btn" onClick={controller.close}>
                Kapat
              </button>
            </div>
          </footer>
        </div>
      </div>
    </OriginSheet>
  );
}
