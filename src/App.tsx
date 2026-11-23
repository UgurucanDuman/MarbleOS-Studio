import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { StudioTopBar } from './window-system/StudioTopBar';
import { StudioDock } from './window-system/StudioDock';
import { StudioToastHost } from './window-system/StudioToastHost';
import { StudioWallpaper } from './window-system/StudioWallpaper';
import { WindowFrame } from './window-system/WindowFrame';
import { ModuleErrorBoundary } from './window-system/ModuleErrorBoundary';
import { VaultUnlockGate } from './window-system/VaultUnlockGate';
import { LicenseGate } from './window-system/LicenseGate';
import { StudioSettingsBookSheet, type SettingsOpenTarget } from './window-system/settings/StudioSettingsBookSheet';
import type { BookChapterId, SettingsVolumeId } from './window-system/settings/settingsChapters';
import { DesktopContextMenu } from './window-system/desktop/DesktopContextMenu';
import { DesktopWidgetsLayer } from './window-system/desktop/DesktopWidgetsLayer';
import { useOriginSheet } from './window-system/sheet/useOriginSheet';
import { formErrorMessage } from './window-system/sheet/formErrorMessage';
import { useActiveSchoolName, useStudioPersistenceError, useStudioVaultStatus } from './system/sqlite/studioDatabase';
import { usesDesktopStorage } from './system/desktop/desktopStorage';
import { useStudioLicense } from './system/desktop/desktopLicense';
import { useNativeDesktopGuard } from './system/desktop/useNativeDesktopGuard';
import {
  resetDesktopWidgetPositions, selectBuiltinWallpaper, selectCustomWallpaper,
  toggleDesktopWidget, updateDesktopWidgetPosition, uploadAndSelectCustomWallpaper,
  useCompanyLogoUrl, useDesktopPersonalization,
} from './system/desktop/desktopPersonalization';
import { notifyStudio } from './system/desktop/studioToast';
import { useWindowManager } from './window-system/useWindowManager';
import { STUDIO_APPS } from './window-system/studioApps';
import type { PrintCenterHandoff, StudioAppId } from './window-system/types';
import { StudioBrandLogo } from './system/brand/StudioBrandLogo';
import { useStudioTheme } from './system/theme/useStudioTheme';
import './App.css';

const ExcelListWindow = memo(lazy(() => import('./modules/excel-list/ExcelListWindow').then(
  ({ ExcelListWindow }) => ({ default: ExcelListWindow }),
)));
const PhotoStudioWindow = memo(lazy(() => import('./modules/photo-studio/PhotoStudioWindow').then(
  ({ PhotoStudioWindow }) => ({ default: PhotoStudioWindow }),
)));
const AlbumDesignerWindow = memo(lazy(() => import('./modules/album-designer/AlbumDesignerWindow').then(
  ({ AlbumDesignerWindow }) => ({ default: AlbumDesignerWindow }),
)));
const PrintCenterWindow = memo(lazy(() => import('./modules/print-center/PrintCenterWindow').then(
  ({ PrintCenterWindow }) => ({ default: PrintCenterWindow }),
)));

export function App() {
  useNativeDesktopGuard();
  const activeSchoolName = useActiveSchoolName();
  const persistenceError = useStudioPersistenceError();
  const vaultStatus = useStudioVaultStatus();
  const license = useStudioLicense();
  const isLicenseLocked = usesDesktopStorage && !license.activated;
  const isVaultLocked = isLicenseLocked || (usesDesktopStorage && vaultStatus.locked);
  const settingsBookSheet = useOriginSheet();
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<SettingsOpenTarget | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const personalization = useDesktopPersonalization();
  const companyLogoUrl = useCompanyLogoUrl();
  const { preference, resolvedTheme, activePalette, setPreference, setPalette } = useStudioTheme();
  const {
    windows, activeAppId, bouncingAppId, isSmartLayoutEnabled, visibleCount, windowOrigins,
    triggerDockBounce, focusWindow, toggleDesktop, toggleFromDock,
    closeWindow, minimizeWindow, toggleMaximizeWindow,
    activateSmartTile, resetWindowLayouts, snapWindow,
  } = useWindowManager(STUDIO_APPS);

  useEffect(() => {
    const name = personalization.company.companyName.trim();
    document.title = name ? `MarbleOS · ${name}` : 'MarbleOS — Masaüstü Çalışma Alanı';
  }, [personalization.company.companyName]);

  const activeWindowTitle = isLicenseLocked
    ? 'Lisans Etkinleştirme'
    : isVaultLocked
    ? 'Veri Kasası Kilitli'
    : activeAppId
      ? (windows[activeAppId]?.title ?? 'Masaüstü Hazır')
      : 'Masaüstü Hazır';
  const [departingApps, setDepartingApps] = useState<Partial<Record<StudioAppId, boolean>>>({});
  const departTimersRef = useRef<Partial<Record<StudioAppId, ReturnType<typeof setTimeout>>>>({});
  const [photoClassId, setPhotoClassId] = useState('');
  const [photoFocus, setPhotoFocus] = useState<{ photoId: string; seq: number } | null>(null);
  const [printHandoff, setPrintHandoff] = useState<PrintCenterHandoff | null>(null);

  useEffect(() => () => {
    Object.values(departTimersRef.current).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
  }, []);

  if (settingsTarget && settingsBookSheet.phase === 'closed') {
    setSettingsTarget(null);
  }
  const openPhotoStudio = useCallback((classId: string, photoId?: string) => {
    setPhotoClassId(classId);
    if (photoId) setPhotoFocus((prev) => ({ photoId, seq: (prev?.seq ?? 0) + 1 }));
    focusWindow('photo-studio');
  }, [focusWindow]);

  const openPrintCenterWithHandoff = useCallback(
    (payload: Omit<PrintCenterHandoff, 'seq'>) => {
      setPrintHandoff((prev) => ({ ...payload, seq: (prev?.seq ?? 0) + 1 }));
      focusWindow('print-center');
    },
    [focusWindow],
  );

  const openSettingsChapter = useCallback((volume: SettingsVolumeId, chapterId: BookChapterId) => {
    setSettingsTarget((prev) => ({ volume, chapterId, seq: (prev?.seq ?? 0) + 1 }));
    settingsButtonRef.current?.click();
  }, []);
  const handleOpenCompanySettings = useCallback(() => openSettingsChapter('general', 'company'), [openSettingsChapter]);
  const handleOpenAppearanceSettings = useCallback(() => openSettingsChapter('general', 'appearance'), [openSettingsChapter]);
  const handleToggleWidget = useCallback((id: Parameters<typeof toggleDesktopWidget>[0]) => { toggleDesktopWidget(id); }, []);
  const handleCloseContextMenu = useCallback(() => setContextMenuPos(null), []);
  const handleRequestUploadWallpaper = useCallback(() => wallpaperInputRef.current?.click(), []);
  const settingsTriggerProps = useMemo(
    () => (isVaultLocked ? undefined : settingsBookSheet.trigger('topbar-settings-book')),
    [isVaultLocked, settingsBookSheet.trigger],
  );

  const handleStageContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (isVaultLocked) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.os-window-frame, .os-desktop-context-menu, .os-widget-card, input, textarea, [contenteditable="true"]')) {
        return;
      }
      e.preventDefault();
      setContextMenuPos({ x: e.clientX, y: e.clientY });
    },
    [isVaultLocked],
  );

  const handleDesktopWallpaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const saved = await uploadAndSelectCustomWallpaper(file);
      notifyStudio(`"${saved.name}" duvar kağıdı olarak ayarlandı.`, 'success');
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  const moduleViews: Record<StudioAppId, React.ReactNode> = useMemo(() => ({
    'excel-list': <ExcelListWindow onEditPhotos={openPhotoStudio} />,
    'photo-studio': <PhotoStudioWindow classId={photoClassId} focusPhoto={photoFocus} onSelectClass={setPhotoClassId} />,
    'album-designer': <AlbumDesignerWindow onApproveForPrint={openPrintCenterWithHandoff} />,
    'print-center': <PrintCenterWindow handoff={printHandoff} />,
  }), [openPhotoStudio, openPrintCenterWithHandoff, photoClassId, photoFocus, printHandoff]);

  const clearDeparting = useCallback((appId: StudioAppId) => {
    const prevTimer = departTimersRef.current[appId];
    if (prevTimer) {
      clearTimeout(prevTimer);
      delete departTimersRef.current[appId];
    }
    setDepartingApps((prev) => {
      if (!prev[appId]) return prev;
      const next = { ...prev };
      delete next[appId];
      return next;
    });
  }, []);

  const handleDepartStart = useCallback((appId: StudioAppId) => {
    clearDeparting(appId);
    setDepartingApps((prev) => ({ ...prev, [appId]: true }));
    departTimersRef.current[appId] = setTimeout(() => clearDeparting(appId), 340);
  }, [clearDeparting]);

  const handleToggleDockApp = useCallback(
    (appId: StudioAppId, bounds?: Parameters<typeof toggleFromDock>[1]) => {
      clearDeparting(appId);
      toggleFromDock(appId, bounds);
    },
    [clearDeparting, toggleFromDock],
  );

  const isAnyWindowMaximized = Object.values(windows).some(
    (w) => w.isOpen && !w.isMinimized && w.isMaximized && !departingApps[w.appId],
  );
  const openAppDefs = useMemo(() => STUDIO_APPS.filter((app) => windows[app.appId]?.isOpen), [windows]);
  const excelSnap = windows['excel-list']?.snapPreset;
  const photoSnap = windows['photo-studio']?.snapPreset;
  const albumSnap = windows['album-designer']?.snapPreset;
  const printSnap = windows['print-center']?.snapPreset;
  const smartLayouts = useMemo(() => {
    const entry = (appId: StudioAppId, snapPreset: typeof excelSnap) => ({
      isEnabled: isSmartLayoutEnabled, visibleCount, snapPreset,
      onActivateSmartTile: activateSmartTile, onResetLayout: resetWindowLayouts,
      onSelectPreset: (preset: Parameters<typeof snapWindow>[1]) => snapWindow(appId, preset),
    });
    return {
      'excel-list': entry('excel-list', excelSnap),
      'photo-studio': entry('photo-studio', photoSnap),
      'album-designer': entry('album-designer', albumSnap),
      'print-center': entry('print-center', printSnap),
    };
  }, [activateSmartTile, albumSnap, excelSnap, isSmartLayoutEnabled, photoSnap, printSnap, resetWindowLayouts, snapWindow, visibleCount]);

  return (
    <div className="os-desktop-root">
      <StudioWallpaper resolvedTheme={resolvedTheme} wallpaper={personalization.wallpaper} />

      <StudioTopBar
        activeWindowTitle={activeWindowTitle}
        activeSchoolName={activeSchoolName}
        companyName={personalization.company.companyName}
        companyAddress={personalization.company.address}
        isHidden={isAnyWindowMaximized}
        settingsTriggerProps={settingsTriggerProps}
        settingsButtonRef={settingsButtonRef}
      />

      <main className="os-desktop-stage" onContextMenu={handleStageContextMenu}>
        <div className="os-desktop-watermark" aria-hidden="true">
          <StudioBrandLogo
            size="lg"
            variant="full"
            companyName={personalization.company.companyName}
            companySubtitle={personalization.company.address}
          />
          <p>Okul Fotoğrafçılığı, Albüm Tasarımı ve Baskı İşletim Alanı</p>
        </div>

        {!isVaultLocked && (
          <DesktopWidgetsLayer
            enabledWidgets={personalization.enabledWidgets}
            widgetPositions={personalization.widgetPositions}
            company={personalization.company}
            companyLogoUrl={companyLogoUrl}
            quickNote={personalization.quickNote}
            isObscured={isAnyWindowMaximized}
            onMoveWidget={updateDesktopWidgetPosition}
            onRemoveWidget={handleToggleWidget}
            onOpenCompanySettings={handleOpenCompanySettings}
          />
        )}

        {isLicenseLocked ? (
          <LicenseGate license={license} />
        ) : isVaultLocked ? (
          <VaultUnlockGate vault={vaultStatus} />
        ) : (
          <AnimatePresence>
            {openAppDefs.map((app) => {
              const win = windows[app.appId];
              return (
                <WindowFrame
                  key={app.appId}
                  windowState={win}
                  icon={app.icon}
                  isActive={activeAppId === app.appId}
                  isSharedForeground={isSmartLayoutEnabled || Boolean(win.layoutBounds)}
                  clickOrigin={windowOrigins[app.appId] ?? null}
                  smartLayout={smartLayouts[app.appId]}
                  onFocus={focusWindow}
                  onClose={closeWindow}
                  onMinimize={minimizeWindow}
                  onMaximize={toggleMaximizeWindow}
                  onDockBounce={triggerDockBounce}
                  onDepartStart={handleDepartStart}
                >
                  <ModuleErrorBoundary title={app.title}>
                    <Suspense fallback={null}>{moduleViews[app.appId]}</Suspense>
                  </ModuleErrorBoundary>
                </WindowFrame>
              );
            })}
          </AnimatePresence>
        )}
      </main>

      <input
        ref={wallpaperInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        aria-label="Masaüstü duvar kağıdı dosyası seç"
        onChange={(e) => void handleDesktopWallpaperFile(e)}
      />

      {!isVaultLocked && (
        <DesktopContextMenu
          position={contextMenuPos}
          personalization={personalization}
          themePreference={preference}
          activePalette={activePalette}
          visibleWindowCount={visibleCount}
          canSmartTile={visibleCount >= 2}
          onClose={handleCloseContextMenu}
          onToggleWidget={handleToggleWidget}
          onResetWidgetPositions={resetDesktopWidgetPositions}
          onSelectBuiltinWallpaper={selectBuiltinWallpaper}
          onSelectCustomWallpaper={selectCustomWallpaper}
          onRequestUploadWallpaper={handleRequestUploadWallpaper}
          onOpenAppearanceSettings={handleOpenAppearanceSettings}
          onOpenCompanySettings={handleOpenCompanySettings}
          onChangeTheme={setPreference}
          onChangePalette={setPalette}
          onShowDesktop={toggleDesktop}
          onSmartTileWindows={activateSmartTile}
        />
      )}

      <StudioDock
        apps={STUDIO_APPS}
        windows={windows}
        activeAppId={activeAppId}
        bouncingAppId={bouncingAppId}
        isDesktopActive={visibleCount === 0}
        isHidden={isAnyWindowMaximized || isVaultLocked}
        onToggleDesktop={toggleDesktop}
        onToggleApp={handleToggleDockApp}
      />

      {!isVaultLocked && settingsBookSheet.phase !== 'closed' && (
        <div className="os-desktop-sheet-host">
          <StudioSettingsBookSheet
            controller={settingsBookSheet}
            company={personalization.company}
            companyLogoUrl={companyLogoUrl}
            themePreference={preference}
            resolvedTheme={resolvedTheme}
            activePalette={activePalette}
            openTarget={settingsTarget}
            onChangeTheme={setPreference}
            onChangePalette={setPalette}
          />
        </div>
      )}

      <StudioToastHost persistenceError={persistenceError} />
    </div>
  );
}

export default App;
