import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { StudioBrandLogo } from '../system/brand/StudioBrandLogo';
import { startNativeWindowDrag } from '../system/desktop/nativeWindow';
import { BookIconTopbarSettings } from './settings/icons/SettingsBookIcons';
import { NativeWindowControls } from './NativeWindowControls';
import type { OriginSheetController } from './sheet/useOriginSheet';
import './studio-topbar.css';

interface StudioTopBarProps {
  activeWindowTitle: string;
  activeSchoolName?: string | null;
  companyName?: string;
  companyAddress?: string;
  isHidden?: boolean;
  settingsTriggerProps?: ReturnType<OriginSheetController['trigger']>;
  settingsButtonRef?: React.Ref<HTMLButtonElement>;
}

/**
 * İzole Saat & Tarih Bileşeni: Saniye değişimi yalnızca bu iki küçük kutuyu günceller;
 * üst barın geri kalanını, logoyu veya animasyonları asla yeniden render etmez.
 */
const TopBarClockBoxes: React.FC<{ paused?: boolean }> = React.memo(({ paused = false }) => {
  const [clock, setClock] = useState<{ date: string; time: string }>({ date: '', time: '' });

  useEffect(() => {
    if (paused) return;
    const updateClock = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = new Date();
      setClock({
        date: now.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          weekday: 'long',
        }),
        time: now.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [paused]);

  return (
    <div className="os-topbar-center">
      {clock.date && (
        <div className="os-datetime-box os-date-box">
          <svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2.5" y="3.5" width="13" height="12" rx="2.2" />
            <line x1="2.5" y1="7.2" x2="15.5" y2="7.2" />
            <line x1="6" y1="2" x2="6" y2="4.6" strokeLinecap="round" />
            <line x1="12" y1="2" x2="12" y2="4.6" strokeLinecap="round" />
          </svg>
          <strong>{clock.date}</strong>
        </div>
      )}

      {clock.time && (
        <div className="os-datetime-box os-clock-box">
          <svg viewBox="0 0 18 18" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="9" cy="9" r="6.5" />
            <path d="M9 5.2v3.8l2.4 1.6" strokeLinecap="round" />
          </svg>
          <strong>{clock.time}</strong>
        </div>
      )}
    </div>
  );
});

/** Üst bar ikonu her kurulumda sabit MarbleOS sistem ikonudur; firma logosu yalnız firma kartında görünür. */
export const StudioTopBar: React.FC<StudioTopBarProps> = React.memo(
  ({
    activeWindowTitle,
    activeSchoolName,
    companyName,
    companyAddress,
    isHidden = false,
    settingsTriggerProps,
    settingsButtonRef,
  }) => {
    const cleanCompanyName = companyName?.trim();
    const cleanAddress = companyAddress?.trim();

    return (
      <motion.div
        className="os-banner-wrap"
        initial={{ y: -96, opacity: 0 }}
        animate={{ y: isHidden ? -96 : 0, opacity: isHidden ? 0 : 1 }}
        transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: isHidden ? 'none' : 'auto' }}
      >
        <header className="os-topbar" onMouseDown={startNativeWindowDrag}>
          <div className="os-topbar-identity">
            <div className="os-topbar-logo-box">
              <StudioBrandLogo size="lg" variant="icon" />
            </div>

            <div className="os-topbar-titles">
              <div className="os-topbar-title-row">
                <span className="os-title-marble">MarbleOS</span>
                {cleanCompanyName && <span className="os-title-studio">{cleanCompanyName}</span>}
              </div>
              <div className="os-topbar-subtitle-row">
                <span className="os-topbar-context-label">
                  {activeSchoolName || cleanAddress || 'MASAÜSTÜ ÇALIŞMA ALANI'}
                </span>
                <span className="os-topbar-sep">&bull;</span>
                <strong className="os-active-win-name">{activeWindowTitle}</strong>
              </div>
            </div>
          </div>

          <TopBarClockBoxes paused={isHidden} />

          <div className="os-topbar-actions">
            {settingsTriggerProps && (
              <button
                ref={settingsButtonRef}
                type="button"
                className="os-topbar-settings-btn"
                title="Sistem Ayarları ve El Kitabı"
                aria-label="Ayarlar"
                {...settingsTriggerProps}
              >
                <BookIconTopbarSettings size={17} />
                <span>Ayarlar</span>
              </button>
            )}
            <NativeWindowControls />
          </div>
        </header>
      </motion.div>
    );
  },
);
