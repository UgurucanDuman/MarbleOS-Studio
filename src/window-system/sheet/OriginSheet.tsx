import { useCallback, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { springOriginSheet } from '../../system/motion/macosMotion';
import { cloneSafeSvg } from './safeSvgClone';
import { SheetAutoIcon } from './SheetFieldIcons';
import { useSheetFocusTrap } from './useSheetFocusTrap';
import { useSheetMorph } from './useSheetMorph';
import type { OriginSheetController } from './useOriginSheet';
import { useWindowSheetHost } from './windowSheetHost';
import './origin-sheet.css';
import './sheet-switch.css';

interface OriginSheetProps {
  controller: OriginSheetController;
  title: string;
  description?: string;
  width?: number;
  submitLabel?: string;
  hideHeader?: boolean;
  hideFooter?: boolean;
  bodyClassName?: string;
  showCancel?: boolean;
  canSubmit?: boolean;
  secondaryAction?: { label: string; onClick: () => void };
  busy?: boolean;
  error?: string | null;
  onSubmit?: () => void;
  children: ReactNode;
}

/**
 * Butondan büyüyerek açılan, kapanırken yarı yoldan itibaren butona dönüşerek
 * aynı butona geri oturan Apple tarzı form kartı.
 */
export function OriginSheet(props: OriginSheetProps) {
  const host = useWindowSheetHost();
  const layer = (
    <AnimatePresence onExitComplete={props.controller.onExitComplete}>
      {props.controller.isOpen && <SheetLayer key={props.controller.openSeq} {...props} />}
    </AnimatePresence>
  );
  return host ? createPortal(layer, host) : layer;
}

/** Butonun ikonu, HTML metni olarak değil temizlenmiş DOM kopyası olarak yerleştirilir. */
function GhostIcon({ source }: { source: SVGSVGElement }) {
  const mount = useCallback((node: HTMLSpanElement | null) => {
    node?.replaceChildren(cloneSafeSvg(source));
  }, [source]);
  return <span ref={mount} className="os-icon-inline" />;
}

function SheetLayer({
  controller, title, description, width = 440, submitLabel = 'Kaydet',
  hideHeader = false, hideFooter = false, bodyClassName,
  showCancel = true, secondaryAction, busy = false, canSubmit = true, error, onSubmit, children,
}: OriginSheetProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const panelRef = useRef<HTMLFormElement | null>(null);
  const { close, triggerRef } = controller;
  const sessionTriggerRef = useRef<HTMLElement | null>(triggerRef.current);
  const dismiss = useCallback(() => {
    if (!busy) close();
  }, [busy, close]);
  const { layerRef, contentRef, ghostRef, controls, closedVariant, handleUpdate, look } = useSheetMorph(
    sessionTriggerRef,
    width,
    reduced,
  );

  useSheetFocusTrap(panelRef, true, dismiss, sessionTriggerRef);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && canSubmit && onSubmit) onSubmit();
  };

  return (
    <div ref={layerRef} className="os-sheet-layer">
      <div className="os-sheet-backdrop" onClick={dismiss} />
      <motion.form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : titleId}
        aria-label={hideHeader ? title : undefined}
        className="os-sheet-panel"
        initial={false}
        animate={controls}
        variants={{ closed: closedVariant }}
        exit="closed"
        transition={reduced ? { duration: 0.12 } : springOriginSheet}
        onUpdate={handleUpdate}
        onSubmit={handleSubmit}
        noValidate
      >
        {(look?.label || look?.svg) && !reduced && (
          <span
            ref={ghostRef}
            aria-hidden="true"
            className="os-sheet-ghost"
            style={{ color: 'var(--os-text-primary)', ...look.font }}
          >
            {look.svg && <GhostIcon source={look.svg} />}
            {look.label && <span>{look.label}</span>}
          </span>
        )}
        <div ref={contentRef} className="os-sheet-content">
          {!hideHeader && (
            <header className="os-sheet-header">
              <h2 id={titleId} className="os-icon-inline">
                <SheetAutoIcon text={title} size={15} />
                <span>{title}</span>
              </h2>
              {description && <p>{description}</p>}
            </header>
          )}
          <div className={bodyClassName ? `os-sheet-body ${bodyClassName}` : 'os-sheet-body'}>
            {children}
          </div>
          {error && <p role="alert" className="os-sheet-error">{error}</p>}
          {!hideFooter && (
            <footer className="os-sheet-footer">
              {showCancel && (
                <button type="button" className="os-sheet-btn" disabled={busy} onClick={dismiss}>
                  <SheetAutoIcon text="Vazgeç" />
                  Vazgeç
                </button>
              )}
              {secondaryAction && (
                <button type="button" className="os-sheet-btn" disabled={busy} onClick={secondaryAction.onClick}>
                  <SheetAutoIcon text={secondaryAction.label} />
                  {secondaryAction.label}
                </button>
              )}
              <button type="submit" className="os-sheet-btn os-sheet-btn-primary" disabled={busy || !canSubmit}>
                <SheetAutoIcon text={submitLabel} />
                {busy ? 'Kaydediliyor…' : submitLabel}
              </button>
            </footer>
          )}
        </div>
      </motion.form>
    </div>
  );
}
