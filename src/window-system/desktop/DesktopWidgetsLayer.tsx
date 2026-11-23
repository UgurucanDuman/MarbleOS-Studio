import React, { useEffect, useMemo, useState } from 'react';
import type {
  CompanyProfile,
  DesktopWidgetId,
  DesktopWidgetPosition,
  DesktopWidgetPositions,
} from '../../system/schemas/desktopPersonalizationSchemas';
import { useStudioDatabase } from '../../system/sqlite/studioDatabase';
import { clearDesktopQuickNote, updateDesktopQuickNote } from '../../system/desktop/desktopPersonalization';
import { notifyStudio } from '../../system/desktop/studioToast';
import { formErrorMessage } from '../sheet/formErrorMessage';
import { DraggableWidgetCard } from './DraggableWidgetCard';
import './desktop-widgets.css';

export const DESKTOP_WIDGET_CATALOG: Array<{
  id: DesktopWidgetId;
  title: string;
  description: string;
}> = [
  { id: 'clock-calendar', title: 'Saat & Takvim', description: 'Canlı masaüstü saati ve tarih kartı' },
  { id: 'studio-stats', title: 'Stüdyo İş Özeti', description: 'Okul, şube, kişi ve onaylı kare sayacı' },
  { id: 'quick-note', title: 'Hızlı Çekim Notu', description: 'Masaüstünde anlık çekim ve iş notları' },
  { id: 'company-card', title: 'Şirket Kimlik Kartı', description: 'İşletme adı, yetkili, telefon ve adres' },
];

function ClockCalendarWidget({ paused = false }: { paused?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="os-widget-clock">
      <div className="os-widget-clock-time">
        {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        <span>:{now.toLocaleTimeString('tr-TR', { second: '2-digit' })}</span>
      </div>
      <div className="os-widget-clock-day">
        {now.toLocaleDateString('tr-TR', { weekday: 'long' })}
      </div>
      <div className="os-widget-clock-date">
        {now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  );
}

function StudioStatsWidget({ paused = false }: { paused?: boolean }) {
  const db = useStudioDatabase(!paused);
  const approvedPhotos = useMemo(
    () => db.photos.filter((p) => p.approvedForPrint).length,
    [db.photos],
  );

  return (
    <dl className="os-widget-stats-grid">
      <div>
        <dt>Okul</dt>
        <dd>{db.schools.length}</dd>
      </div>
      <div>
        <dt>Şube</dt>
        <dd>{db.classes.length}</dd>
      </div>
      <div>
        <dt>Kişi</dt>
        <dd>{db.students.length}</dd>
      </div>
      <div>
        <dt>Onaylı Kare</dt>
        <dd>{approvedPhotos}</dd>
      </div>
    </dl>
  );
}

function QuickNoteWidget({ quickNote }: { quickNote: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfirmClear(false);
    try {
      updateDesktopQuickNote(e.target.value);
      setError(null);
    } catch (err) {
      setError(formErrorMessage(err));
    }
  };

  const handleClear = () => {
    if (!quickNote) return;
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearDesktopQuickNote();
    setConfirmClear(false);
    setError(null);
    notifyStudio('Hızlı çekim notu temizlendi.', 'info');
  };

  return (
    <div className="os-widget-note-wrap" onContextMenu={(e) => e.stopPropagation()}>
      <textarea
        className="os-widget-note-input"
        aria-label="Hızlı Çekim Notu"
        placeholder="Çekim sırası, eksik kadraj veya hatırlatma notu yazın..."
        value={quickNote}
        maxLength={600}
        onChange={handleChange}
      />
      <div className="os-widget-note-footer">
        <span className="os-widget-note-count">{quickNote.length}/600</span>
        {quickNote.length > 0 && (
          <button
            type="button"
            className={`os-widget-note-clear ${confirmClear ? 'is-confirming' : ''}`}
            onBlur={() => setConfirmClear(false)}
            onClick={handleClear}
          >
            {confirmClear ? 'Silinsin mi?' : 'Notu Sil'}
          </button>
        )}
      </div>
      {error && <span className="os-widget-error">{error}</span>}
    </div>
  );
}

function CompanyCardWidget({
  company,
  companyLogoUrl,
  onOpenCompanySettings,
}: {
  company: CompanyProfile;
  companyLogoUrl?: string | null;
  onOpenCompanySettings: () => void;
}) {
  const hasInfo = Boolean(
    companyLogoUrl || company.companyName || company.ownerName || company.phone || company.address,
  );

  if (!hasInfo) {
    return (
      <div className="os-widget-company-empty">
        <p>Henüz şirket veya adres bilgisi girilmedi.</p>
        <button type="button" className="os-widget-link-btn" onClick={onOpenCompanySettings}>
          Şirket &amp; Adres Bilgisi Ekle
        </button>
      </div>
    );
  }

  return (
    <div className="os-widget-company-body">
      <div className="os-widget-company-head">
        {companyLogoUrl && (
          <img
            src={companyLogoUrl}
            alt=""
            className="os-widget-company-logo"
            draggable={false}
          />
        )}
        <strong>{company.companyName || 'İşletme Adı Girilmedi'}</strong>
      </div>
      {company.ownerName && <span>Yetkili: {company.ownerName}</span>}
      {company.phone && <span>Tel: {company.phone}</span>}
      {company.address && <p>{company.address}</p>}
      <button type="button" className="os-widget-link-btn" onClick={onOpenCompanySettings}>
        Düzenle
      </button>
    </div>
  );
}

export const DesktopWidgetsLayer: React.FC<{
  enabledWidgets: DesktopWidgetId[];
  widgetPositions: DesktopWidgetPositions;
  company: CompanyProfile;
  companyLogoUrl?: string | null;
  quickNote: string;
  isObscured?: boolean;
  onMoveWidget: (id: DesktopWidgetId, pos: DesktopWidgetPosition) => void;
  onRemoveWidget: (id: DesktopWidgetId) => void;
  onOpenCompanySettings: () => void;
}> = React.memo(
  ({
    enabledWidgets,
    widgetPositions,
    company,
    companyLogoUrl,
    quickNote,
    isObscured = false,
    onMoveWidget,
    onRemoveWidget,
    onOpenCompanySettings,
  }) => {
    if (enabledWidgets.length === 0) return null;

    return (
      <section
        className="os-desktop-widgets-layer"
        aria-label="Masaüstü widgetları"
        style={isObscured ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
      >
        {enabledWidgets.map((widgetId) => {
          const slotIndex = DESKTOP_WIDGET_CATALOG.findIndex((item) => item.id === widgetId);
          const meta = slotIndex >= 0 ? DESKTOP_WIDGET_CATALOG[slotIndex] : undefined;
          if (!meta) return null;

          return (
            <DraggableWidgetCard
              key={widgetId}
              widgetId={widgetId}
              title={meta.title}
              defaultSlotIndex={slotIndex}
              savedPosition={widgetPositions[widgetId]}
              onCommitPosition={onMoveWidget}
              onRemove={onRemoveWidget}
            >
              {widgetId === 'clock-calendar' && <ClockCalendarWidget paused={isObscured} />}
              {widgetId === 'studio-stats' && <StudioStatsWidget paused={isObscured} />}
              {widgetId === 'quick-note' && <QuickNoteWidget quickNote={quickNote} />}
              {widgetId === 'company-card' && (
                <CompanyCardWidget
                  company={company}
                  companyLogoUrl={companyLogoUrl}
                  onOpenCompanySettings={onOpenCompanySettings}
                />
              )}
            </DraggableWidgetCard>
          );
        })}
      </section>
    );
  },
);
