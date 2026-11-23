import React, { useEffect, useMemo, useState } from 'react';
import type { WallpaperSelection } from '../system/schemas/desktopPersonalizationSchemas';
import {
  getCachedPresetWallpaperDataUrl,
  schedulePresetWallpaperDataUrl,
} from '../system/desktop/wallpaperCanvasArt';
import { loadCustomWallpaperDataUrl } from '../system/desktop/wallpaperCustomStore';
import { getBuiltinWallpaper } from '../system/desktop/wallpaperPresets';
import type { ResolvedTheme } from '../system/theme/useStudioTheme';
import './studio-wallpaper.css';

interface StudioWallpaperProps {
  resolvedTheme: ResolvedTheme;
  wallpaper: WallpaperSelection;
}

const BLADE_COUNT = 9;
const APOTHEM = 118;
const T = APOTHEM * Math.tan(Math.PI / BLADE_COUNT);
const BLADE_PATH = [
  `M ${-T} ${-APOTHEM}`,
  `L ${T * 3.4} ${-APOTHEM}`,
  'L 330 -230',
  'L 60 -400',
  'L -230 -300',
  'Z',
].join(' ');
const EDGE_PATH = `M ${-T} ${-APOTHEM} L ${T * 3.4} ${-APOTHEM}`;
const BLADE_INDEXES = Array.from({ length: BLADE_COUNT }, (_, i) => i);

/**
 * MarbleOS Masaüstü Duvar Kağıdı Sahnesi:
 * - MarbleOS Optik Diyafram SVG'si, 4 yerleşik prosedürel mermer/manzara/bokeh duvar kağıdı
 *   ve kullanıcının bilgisayarından eklediği özel duvar kağıtlarını destekler.
 */
export const StudioWallpaper: React.FC<StudioWallpaperProps> = React.memo(
  ({ resolvedTheme, wallpaper }) => {
    const isOpticIris = wallpaper.kind === 'builtin' && wallpaper.presetId === 'optic-iris';
    const [customUrl, setCustomUrl] = useState<string | null>(null);
    const cachedPresetUrl =
      wallpaper.kind === 'builtin' && wallpaper.presetId !== 'optic-iris'
        ? getCachedPresetWallpaperDataUrl(wallpaper.presetId, resolvedTheme)
        : null;
    const [asyncPreset, setAsyncPreset] = useState<{ key: string; url: string | null }>({
      key: '',
      url: null,
    });

    useEffect(() => {
      if (wallpaper.kind !== 'builtin' || wallpaper.presetId === 'optic-iris') {
        return;
      }
      const key = `${wallpaper.presetId}:${resolvedTheme}`;
      if (getCachedPresetWallpaperDataUrl(wallpaper.presetId, resolvedTheme)) {
        return;
      }
      return schedulePresetWallpaperDataUrl(wallpaper.presetId, resolvedTheme, (url) => {
        setAsyncPreset({ key, url });
      });
    }, [resolvedTheme, wallpaper]);

    const presetArtUrl =
      wallpaper.kind === 'builtin' && wallpaper.presetId !== 'optic-iris'
        ? cachedPresetUrl ??
          (asyncPreset.key === `${wallpaper.presetId}:${resolvedTheme}` ? asyncPreset.url : null)
        : null;

    useEffect(() => {
      let active = true;
      if (wallpaper.kind !== 'custom') {
        setCustomUrl(null);
        return () => {
          active = false;
        };
      }
      void loadCustomWallpaperDataUrl(wallpaper.customId).then((url) => {
        if (active) setCustomUrl(url);
      });
      return () => {
        active = false;
      };
    }, [wallpaper]);

    const fallbackBackground = useMemo(() => {
      if (wallpaper.kind === 'custom') {
        return resolvedTheme === 'light' ? '#e4e2dc' : '#131418';
      }
      if (wallpaper.presetId === 'optic-iris') return undefined;
      const preset = getBuiltinWallpaper(wallpaper.presetId);
      return resolvedTheme === 'light' ? preset.fallbackLightCss : preset.fallbackDarkCss;
    }, [resolvedTheme, wallpaper]);

    const photoSrc = wallpaper.kind === 'custom' ? customUrl : presetArtUrl;

    return (
      <div
        className="os-desktop-wallpaper-layer"
        data-wallpaper-theme={resolvedTheme}
        data-wallpaper-kind={wallpaper.kind}
        data-wallpaper-id={wallpaper.kind === 'builtin' ? wallpaper.presetId : wallpaper.customId}
        style={fallbackBackground ? { background: fallbackBackground } : undefined}
        aria-hidden="true"
      >
        {isOpticIris ? (
          <>
            <div className="os-wallpaper-halo" />
            <div className="os-viewfinder">
              <div className="os-viewfinder-grid" />
              <span className="os-vf-corner tl" />
              <span className="os-vf-corner tr" />
              <span className="os-vf-corner bl" />
              <span className="os-vf-corner br" />
            </div>

            <svg viewBox="-500 -500 1000 1000" preserveAspectRatio="xMidYMid meet" className="os-lens-svg">
              <defs>
                <linearGradient id="wpBarrel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--wp-barrel-hi)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--wp-barrel-lo)' }} />
                </linearGradient>
                <radialGradient id="wpHouse" cx="0.38" cy="0.32" r="0.8">
                  <stop offset="0%" style={{ stopColor: 'var(--wp-house-a)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--wp-house-b)' }} />
                </radialGradient>
                <linearGradient id="wpBlade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--wp-blade-hi)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--wp-blade-lo)' }} />
                </linearGradient>
                <radialGradient id="wpGlass" cx="0.4" cy="0.36" r="0.75">
                  <stop offset="0%" style={{ stopColor: 'var(--wp-glass-a)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--wp-glass-b)' }} />
                </radialGradient>
                <clipPath id="wpIrisClip">
                  <circle r="330" />
                </clipPath>
              </defs>

              <g>
                <circle r="470" fill="none" stroke="url(#wpBarrel)" strokeWidth="2.5" />
                <circle r="440" fill="none" stroke="var(--wp-knurl)" strokeWidth="22" strokeDasharray="3 12.36" />
                <circle r="412" fill="none" stroke="var(--wp-ring)" strokeWidth="1.5" />
                <circle r="372" fill="none" stroke="var(--wp-ring)" strokeWidth="8" strokeDasharray="1.5 37.45" />
                <circle r="392" fill="none" stroke="var(--wp-ring)" strokeWidth="1" />
                <circle cx="0" cy="-392" r="4.5" fill="var(--wp-mark)" />

                <circle r="345" fill="none" stroke="var(--wp-ring)" strokeWidth="1.5" />
                <circle r="335" fill="url(#wpHouse)" />
                <circle r="150" fill="url(#wpGlass)" />

                <g className="os-lens-blades">
                  <g clipPath="url(#wpIrisClip)">
                    {BLADE_INDEXES.map((i) => (
                      <g key={i} transform={`rotate(${i * (360 / BLADE_COUNT)})`}>
                        <path
                          d={BLADE_PATH}
                          fill="url(#wpBlade)"
                          stroke="var(--wp-blade-stroke)"
                          strokeWidth="1.2"
                          strokeLinejoin="round"
                        />
                        <path d={EDGE_PATH} stroke="var(--wp-edge-hi)" strokeWidth="1.4" fill="none" />
                      </g>
                    ))}
                  </g>
                </g>

                <ellipse cx="-34" cy="-46" rx="34" ry="13" transform="rotate(-32 -34 -46)" fill="var(--wp-glint)" opacity="0.8" />
                <circle cx="42" cy="38" r="6" fill="var(--wp-glint)" opacity="0.45" />
              </g>
            </svg>
          </>
        ) : (
          <>
            {photoSrc && (
              <img
                src={photoSrc}
                alt=""
                decoding="async"
                className="os-wallpaper-photo-img"
              />
            )}
            <div className="os-wallpaper-scrim" />
          </>
        )}

        <div className="os-desktop-wallpaper-vignette" />
      </div>
    );
  },
);
