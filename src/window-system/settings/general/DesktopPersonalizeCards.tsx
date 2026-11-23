import React, { useRef, useState } from 'react';
import {
  removeCustomWallpaper,
  selectBuiltinWallpaper,
  selectCustomWallpaper,
  toggleDesktopWidget,
  uploadAndSelectCustomWallpaper,
  useDesktopPersonalization,
} from '../../../system/desktop/desktopPersonalization';
import { notifyStudio } from '../../../system/desktop/studioToast';
import { BUILTIN_WALLPAPERS } from '../../../system/desktop/wallpaperPresets';
import { DESKTOP_WIDGET_CATALOG } from '../../desktop/DesktopWidgetsLayer';
import { formErrorMessage } from '../../sheet/formErrorMessage';

export function DesktopPersonalizeCards() {
  const { wallpaper, customWallpapers, enabledWidgets } = useDesktopPersonalization();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const saved = await uploadAndSelectCustomWallpaper(file);
      notifyStudio(`"${saved.name}" duvar kağıdı olarak ayarlandı.`, 'success');
    } catch (err) {
      const message = formErrorMessage(err);
      setUploadError(message);
      notifyStudio(message, 'error');
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <>
      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Masaüstü Duvar Kağıdı</h4>
          <span>Sağ tık menüsünden de anında değiştirilebilir</span>
        </div>

        <div className="os-book-wallpaper-grid" role="radiogroup" aria-label="Yerleşik duvar kağıtları">
          {BUILTIN_WALLPAPERS.map((preset) => {
            const active = wallpaper.kind === 'builtin' && wallpaper.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`os-book-wallpaper-card ${active ? 'is-active' : ''}`}
                onClick={() => selectBuiltinWallpaper(preset.id)}
              >
                <span className="os-book-wallpaper-swatch" style={{ background: preset.swatchCss }} aria-hidden="true" />
                <strong>{preset.title}</strong>
                <small>{preset.subtitle}</small>
              </button>
            );
          })}
        </div>

        {customWallpapers.length > 0 && (
          <div className="os-book-custom-wallpapers">
            {customWallpapers.map((item) => {
              const active = wallpaper.kind === 'custom' && wallpaper.customId === item.id;
              return (
                <div key={item.id} className={`os-book-custom-wp-chip ${active ? 'is-active' : ''}`}>
                  <button
                    type="button"
                    className="os-book-custom-wp-select"
                    onClick={() => selectCustomWallpaper(item.id)}
                  >
                    {item.name}
                  </button>
                  <button
                    type="button"
                    className="os-book-custom-wp-del"
                    aria-label={`${item.name} duvar kağıdını sil`}
                    onClick={() => removeCustomWallpaper(item.id)}
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="os-book-card-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="os-book-hidden-input"
            aria-label="Bilgisayardan duvar kağıdı dosyası seç"
            onChange={(e) => void handleUpload(e)}
          />
          <button
            type="button"
            className="os-book-action-btn"
            disabled={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadBusy ? 'Görsel Doğrulanıyor...' : 'Bilgisayardan Fotoğraf Ekle'}
          </button>
          <span className="os-book-note">JPEG, PNG veya WebP · en fazla 10 MB</span>
        </div>
        {uploadError && (
          <p className="os-book-inline-error" role="alert">
            {uploadError}
          </p>
        )}
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Masaüstü Widgetları</h4>
          <span>{enabledWidgets.length} / {DESKTOP_WIDGET_CATALOG.length} etkin</span>
        </div>

        <div className="os-book-widget-grid">
          {DESKTOP_WIDGET_CATALOG.map((widget) => {
            const enabled = enabledWidgets.includes(widget.id);
            return (
              <button
                key={widget.id}
                type="button"
                role="switch"
                aria-checked={enabled}
                className={`os-book-widget-toggle ${enabled ? 'is-active' : ''}`}
                onClick={() => toggleDesktopWidget(widget.id)}
              >
                <div className="os-book-widget-copy">
                  <strong>{widget.title}</strong>
                  <small>{widget.description}</small>
                </div>
                <span className="os-book-switch-track" aria-hidden="true">
                  <span className="os-book-switch-thumb" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

