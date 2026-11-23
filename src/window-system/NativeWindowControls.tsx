import React from 'react';
import {
  closeNativeWindow,
  hasNativeWindowChrome,
  minimizeNativeWindow,
  toggleMaximizeNativeWindow,
  useNativeWindowMaximized,
} from '../system/desktop/nativeWindow';

/**
 * Windows başlık çubuğunun yerine üst bara gömülü küçült / büyüt / kapat düğmeleri.
 * Yalnız masaüstü (Tauri) derlemesinde görünür; tarayıcı önizlemesinde hiç çizilmez.
 */
export const NativeWindowControls: React.FC = React.memo(() => {
  const maximized = useNativeWindowMaximized();
  if (!hasNativeWindowChrome) return null;

  return (
    <div className="os-native-controls" role="group" aria-label="Uygulama penceresi">
      <button type="button" className="os-native-btn" aria-label="Küçült" title="Küçült" onClick={minimizeNativeWindow}>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M2 6.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        className="os-native-btn"
        aria-label={maximized ? 'Önceki boyuta getir' : 'Ekranı kapla'}
        title={maximized ? 'Önceki boyuta getir' : 'Ekranı kapla'}
        onClick={toggleMaximizeNativeWindow}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2">
          {maximized ? (
            <>
              <rect x="2" y="4" width="6" height="6" rx="1.2" />
              <path d="M4.2 2.1h4.5a1.2 1.2 0 0 1 1.2 1.2v4.5" strokeLinecap="round" />
            </>
          ) : (
            <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.4" />
          )}
        </svg>
      </button>
      <button type="button" className="os-native-btn os-native-close" aria-label="Kapat" title="Kapat" onClick={closeNativeWindow}>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
});
