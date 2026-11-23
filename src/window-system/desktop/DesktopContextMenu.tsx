import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  BuiltinWallpaperId,
  DesktopPersonalizationState,
  DesktopWidgetId,
} from '../../system/schemas/desktopPersonalizationSchemas';
import { BUILTIN_WALLPAPERS } from '../../system/desktop/wallpaperPresets';
import { STUDIO_COLOR_PALETTES } from '../../system/theme/themePalettes';
import type { ColorPaletteId, ThemePreference } from '../../system/theme/useStudioTheme';
import { DESKTOP_WIDGET_CATALOG } from './DesktopWidgetsLayer';
import './desktop-context-menu.css';

interface DesktopContextMenuProps {
  position: { x: number; y: number } | null;
  personalization: DesktopPersonalizationState;
  themePreference: ThemePreference;
  activePalette: ColorPaletteId;
  visibleWindowCount: number;
  canSmartTile: boolean;
  onClose: () => void;
  onToggleWidget: (id: DesktopWidgetId) => void;
  onResetWidgetPositions?: () => void;
  onSelectBuiltinWallpaper: (id: BuiltinWallpaperId) => void;
  onSelectCustomWallpaper: (id: string) => void;
  onRequestUploadWallpaper: () => void;
  onOpenAppearanceSettings: () => void;
  onOpenCompanySettings: () => void;
  onChangeTheme: (pref: ThemePreference) => void;
  onChangePalette: (palette: ColorPaletteId) => void;
  onShowDesktop: () => void;
  onSmartTileWindows: () => void;
}

const THEME_LABELS: Array<{ id: ThemePreference; label: string }> = [
  { id: 'dark', label: 'Antrasit Karanlık' },
  { id: 'light', label: 'Alabaster Aydınlık' },
  { id: 'system', label: 'Sistem Teması' },
];

export const DesktopContextMenu: React.FC<DesktopContextMenuProps> = ({
  position,
  personalization,
  themePreference,
  activePalette,
  visibleWindowCount,
  canSmartTile,
  onClose,
  onToggleWidget,
  onResetWidgetPositions,
  onSelectBuiltinWallpaper,
  onSelectCustomWallpaper,
  onRequestUploadWallpaper,
  onOpenAppearanceSettings,
  onOpenCompanySettings,
  onChangeTheme,
  onChangePalette,
  onShowDesktop,
  onSmartTileWindows,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 16, top: 84 });

  useLayoutEffect(() => {
    if (!position) return;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const rect = menuRef.current?.getBoundingClientRect();
    const w = rect?.width || 276;
    const h = rect?.height || 460;
    const left = Math.max(12, Math.min(position.x, vw - w - 12));
    const top = Math.max(12, Math.min(position.y, vh - h - 12));
    setCoords({ left, top });
  }, [position]);

  useEffect(() => {
    if (!position) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onWindowBlur = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [onClose, position]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Masaüstü menüsü"
      className="os-desktop-context-menu"
      style={{ left: coords.left, top: coords.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="os-ctx-section">
        <span className="os-ctx-heading">Widget Ekle / Kaldır</span>
        {DESKTOP_WIDGET_CATALOG.map((widget) => {
          const checked = personalization.enabledWidgets.includes(widget.id);
          return (
            <button
              key={widget.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              className={`os-ctx-item ${checked ? 'is-selected' : ''}`}
              onClick={() => {
                onToggleWidget(widget.id);
                onClose();
              }}
            >
              <span className="os-ctx-mark" aria-hidden="true">{checked ? '✓' : ''}</span>
              <span className="os-ctx-label">{widget.title} Widget&apos;ı</span>
            </button>
          );
        })}
        {personalization.enabledWidgets.length > 0 &&
          Object.keys(personalization.widgetPositions).length > 0 &&
          onResetWidgetPositions && (
            <button
              type="button"
              role="menuitem"
              className="os-ctx-item"
              onClick={() => {
                onResetWidgetPositions();
                onClose();
              }}
            >
              <span className="os-ctx-mark" aria-hidden="true">↺</span>
              <span className="os-ctx-label">Widget Konumlarını Sıfırla</span>
            </button>
          )}
      </div>

      <div className="os-ctx-divider" role="separator" />

      <div className="os-ctx-section">
        <span className="os-ctx-heading">Duvar Kağıdı Değiştir</span>
        {BUILTIN_WALLPAPERS.map((preset) => {
          const active =
            personalization.wallpaper.kind === 'builtin' &&
            personalization.wallpaper.presetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className={`os-ctx-item ${active ? 'is-selected' : ''}`}
              onClick={() => {
                onSelectBuiltinWallpaper(preset.id);
                onClose();
              }}
            >
              <span className="os-ctx-swatch" style={{ background: preset.swatchCss }} aria-hidden="true" />
              <span className="os-ctx-label">{preset.title}</span>
              {active && <span className="os-ctx-tail" aria-hidden="true">Etkin</span>}
            </button>
          );
        })}
        {personalization.customWallpapers.slice(0, 3).map((item) => {
          const active =
            personalization.wallpaper.kind === 'custom' &&
            personalization.wallpaper.customId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className={`os-ctx-item ${active ? 'is-selected' : ''}`}
              onClick={() => {
                onSelectCustomWallpaper(item.id);
                onClose();
              }}
            >
              <span className="os-ctx-mark" aria-hidden="true">{active ? '●' : ''}</span>
              <span className="os-ctx-label">{item.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          role="menuitem"
          className="os-ctx-item"
          onClick={() => {
            onClose();
            onRequestUploadWallpaper();
          }}
        >
          <span className="os-ctx-mark" aria-hidden="true">+</span>
          <span className="os-ctx-label">Bilgisayardan Duvar Kağıdı Ekle...</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="os-ctx-item"
          onClick={() => {
            onClose();
            onOpenAppearanceSettings();
          }}
        >
          <span className="os-ctx-mark" aria-hidden="true" />
          <span className="os-ctx-label">Duvar Kağıdı &amp; Görünüm Ayarları...</span>
        </button>
      </div>

      <div className="os-ctx-divider" role="separator" />

      <div className="os-ctx-section">
        <span className="os-ctx-heading">Şirket &amp; Tema</span>
        <button
          type="button"
          role="menuitem"
          className="os-ctx-item"
          onClick={() => {
            onClose();
            onOpenCompanySettings();
          }}
        >
          <span className="os-ctx-mark" aria-hidden="true" />
          <span className="os-ctx-label">Şirket &amp; Adres Bilgilerini Düzenle...</span>
        </button>
        <div className="os-ctx-theme-row" role="group" aria-label="Hızlı tema seçimi">
          {THEME_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemradio"
              aria-checked={themePreference === item.id}
              className={`os-ctx-pill-btn ${themePreference === item.id ? 'is-active' : ''}`}
              onClick={() => {
                onChangeTheme(item.id);
                onClose();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="os-ctx-palette-dots" role="group" aria-label="Hızlı renk paleti seçimi">
          {STUDIO_COLOR_PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              role="menuitemradio"
              aria-label={palette.title}
              aria-checked={activePalette === palette.id}
              title={palette.title}
              className={`os-ctx-palette-dot ${activePalette === palette.id ? 'is-active' : ''}`}
              style={{ background: palette.swatchCss }}
              onClick={() => {
                onChangePalette(palette.id);
                onClose();
              }}
            />
          ))}
        </div>
      </div>

      {(visibleWindowCount > 0 || canSmartTile) && (
        <>
          <div className="os-ctx-divider" role="separator" />
          <div className="os-ctx-section">
            {visibleWindowCount > 0 && (
              <button
                type="button"
                role="menuitem"
                className="os-ctx-item"
                onClick={() => {
                  onShowDesktop();
                  onClose();
                }}
              >
                <span className="os-ctx-mark" />
                <span className="os-ctx-label">Masaüstünü Göster</span>
              </button>
            )}
            {canSmartTile && (
              <button
                type="button"
                role="menuitem"
                className="os-ctx-item"
                onClick={() => {
                  onSmartTileWindows();
                  onClose();
                }}
              >
                <span className="os-ctx-mark" />
                <span className="os-ctx-label">Pencereleri Akıllı Böl</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
