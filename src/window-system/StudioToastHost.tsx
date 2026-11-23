import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  dismissStudioToast,
  notifyStudio,
  type StudioToastKind,
  useStudioToasts,
} from '../system/desktop/studioToast';
import { easeAppleGenieClose, springWindowFluid } from '../system/motion/macosMotion';

function ToastKindIcon({ kind }: { kind: StudioToastKind }) {
  if (kind === 'success') {
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="1.5" />
        <path
          d="M6.6 10.3l2.2 2.2 4.7-4.8"
          stroke="#34d399"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="rgba(244, 63, 94, 0.2)" stroke="#f43f5e" strokeWidth="1.5" />
        <path
          d="M10 6.4v4.4M10 13.6h.01"
          stroke="#fb7185"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="rgba(56, 189, 248, 0.2)" stroke="#0ea5e9" strokeWidth="1.5" />
      <path
        d="M10 9.2v4.4M10 6.5h.01"
        stroke="#38bdf8"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function toastTitleFor(kind: StudioToastKind): string {
  if (kind === 'success') return 'İşlem Tamamlandı';
  if (kind === 'error') return 'Stüdyo Uyarısı';
  return 'Stüdyo Bildirimi';
}

export const StudioToastHost: React.FC<{ persistenceError?: string | null }> = ({
  persistenceError,
}) => {
  const toasts = useStudioToasts();

  useEffect(() => {
    if (persistenceError) {
      notifyStudio(persistenceError, 'error');
    }
  }, [persistenceError]);

  const content = (
    <div className="os-toast-stack" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <motion.aside
            key={item.id}
            layout
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={`os-toast-card is-${item.kind}`}
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -14,
              scale: 0.94,
              transition: { duration: 0.22, ease: easeAppleGenieClose },
            }}
            transition={springWindowFluid}
          >
            <span className="os-toast-icon">
              <ToastKindIcon kind={item.kind} />
            </span>
            <div className="os-toast-body">
              <strong className="os-toast-title">{toastTitleFor(item.kind)}</strong>
              <p className="os-toast-message">{item.message}</p>
            </div>
            <button
              type="button"
              className="os-toast-close"
              aria-label="Bildirimi kapat"
              onClick={() => dismissStudioToast(item.id)}
            >
              ×
            </button>
            <span
              key={item.createdAt}
              className="os-toast-progress"
              style={{ animationDuration: `${item.durationMs}ms` }}
              aria-hidden="true"
            />
          </motion.aside>
        ))}
      </AnimatePresence>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

