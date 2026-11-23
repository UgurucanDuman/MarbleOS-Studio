import { usesDesktopStorage } from '../../../system/desktop/desktopStorage';
import { openStudioManagedDirectory } from '../../../system/desktop/exportFileWriter';
import { notifyStudio } from '../../../system/desktop/studioToast';
import type { StudioDatabaseSnapshot } from '../../../system/sqlite/types';
import { findPaletteMeta, STUDIO_COLOR_PALETTES } from '../../../system/theme/themePalettes';
import type {
  ColorPaletteId,
  ResolvedTheme,
  ThemePreference,
} from '../../../system/theme/useStudioTheme';
import { formErrorMessage } from '../../sheet/formErrorMessage';
import { BookIconAppearance } from '../icons/SettingsBookIcons';
import { DesktopPersonalizeCards } from './DesktopPersonalizeCards';

const THEME_ITEMS: Array<{ id: ThemePreference; title: string; subtitle: string }> = [
  { id: 'system', title: 'Sistem Teması', subtitle: 'Windows görünüm tercihini otomatik izler' },
  { id: 'dark', title: 'Antrasit Karanlık', subtitle: 'Göz yormayan karanlık ve özel koyu paletler' },
  { id: 'light', title: 'Alabaster Aydınlık', subtitle: 'Parlama yapmayan porselen ve ferah aydınlık paletler' },
];

export function GeneralAppearancePage({
  db,
  themePreference,
  resolvedTheme,
  activePalette,
  onChangeTheme,
  onChangePalette,
}: {
  db: StudioDatabaseSnapshot;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  activePalette: ColorPaletteId;
  onChangeTheme: (pref: ThemePreference) => void;
  onChangePalette: (palette: ColorPaletteId) => void;
}) {
  const activeMeta = findPaletteMeta(activePalette);

  const handleOpenFolder = async (target: 'root' | 'exports') => {
    try {
      await openStudioManagedDirectory(target);
    } catch (err) {
      notifyStudio(formErrorMessage(err), 'error');
    }
  };

  return (
    <div className="os-book-page-stack">
      <div className="os-book-lead">
        <span className="os-book-lead-icon"><BookIconAppearance size={38} /></span>
        <div>
          <h3>Görünüm, Duvar Kağıdı ve Masaüstü</h3>
          <p>
            Simsiyah OLED, göz yormayan Antrasit, 12 özel renk paleti, duvar kağıdı ve masaüstü widgetlarını buradan özelleştirin; tüm seçimler yerel veritabanında saklanır.
          </p>
        </div>
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Arayüz Modu</h4>
          <span>Etkin mod: {resolvedTheme === 'dark' ? 'Karanlık' : 'Aydınlık'} · {activeMeta.title}</span>
        </div>
        <div className="os-book-theme-grid" role="radiogroup" aria-label="Masaüstü arayüz teması">
          {THEME_ITEMS.map((item) => {
            const active = themePreference === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`os-book-theme-option ${active ? 'is-active' : ''}`}
                onClick={() => onChangeTheme(item.id)}
              >
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>12 Renk ve Tema Paleti</h4>
          <span>Simsiyah, Renkli ve Prizma seçenekleri</span>
        </div>
        <div className="os-book-palette-grid" role="radiogroup" aria-label="12 renk ve tema paleti">
          {STUDIO_COLOR_PALETTES.map((palette) => {
            const active = activePalette === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`os-book-palette-card ${active ? 'is-active' : ''}`}
                onClick={() => onChangePalette(palette.id)}
              >
                <span
                  className="os-book-palette-swatch"
                  style={{ background: palette.swatchCss }}
                  aria-hidden="true"
                >
                  <span
                    className="os-book-palette-dot"
                    style={{ background: palette.accentHex }}
                  />
                </span>
                <strong>{palette.title}</strong>
                <small>{palette.subtitle}</small>
              </button>
            );
          })}
        </div>
      </div>

      <DesktopPersonalizeCards />

      <div className="os-book-card">
        <div className="os-book-card-head">
          <h4>Yerel Depo ve Envanter Özeti</h4>
          <span>{usesDesktopStorage ? '%LOCALAPPDATA%\\MarbleOS-Studio\\' : 'Tarayıcı IndexedDB Yerel Depo'}</span>
        </div>
        <dl className="os-book-kv-grid">
          <div>
            <dt>Kayıtlı Okul</dt>
            <dd>{db.schools.length}</dd>
          </div>
          <div>
            <dt>Toplam Şube</dt>
            <dd>{db.classes.length}</dd>
          </div>
          <div>
            <dt>Toplam Kişi</dt>
            <dd>{db.students.length}</dd>
          </div>
          <div>
            <dt>Yönetilen Fotoğraf</dt>
            <dd>{db.photos.length}</dd>
          </div>
        </dl>
        {usesDesktopStorage && (
          <div className="os-book-card-actions">
            <button
              type="button"
              className="os-book-action-btn"
              onClick={() => void handleOpenFolder('root')}
            >
              Veri Klasörünü Aç
            </button>
            <button
              type="button"
              className="os-book-action-btn"
              onClick={() => void handleOpenFolder('exports')}
            >
              Çıktı Klasörünü Aç (exports/)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
