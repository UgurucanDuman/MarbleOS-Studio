import { useId, type ReactNode } from 'react';
import { SheetAutoIcon } from './SheetFieldIcons';

interface FieldBase {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  placeholder?: string;
}

function FieldShell({ id, label, hint, required, children }: {
  id: string; label: string; hint?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="os-field">
      <label htmlFor={id}>
        <SheetAutoIcon text={label} />
        <span>
          {label}
          {required && <span className="os-field-required" aria-hidden="true"> *</span>}
        </span>
      </label>
      {children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

/** Tek satırlık giriş. `numeric` yalnız rakam klavyesi ister; doğrulama Zod'dadır. */
export function SheetTextField(props: FieldBase & { numeric?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} label={props.label} hint={props.hint} required={props.required}>
      <input
        id={id}
        className="os-field-input"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        inputMode={props.numeric ? 'numeric' : undefined}
        aria-required={props.required || undefined}
        aria-describedby={props.hint ? `${id}-hint` : undefined}
        data-autofocus={props.autoFocus || undefined}
        autoComplete="off"
      />
    </FieldShell>
  );
}

/** Parola girişi: değer gizlenir, tarayıcı otomatik doldurma/öneri davranışı amaca göre seçilir. */
export function SheetPasswordField(props: FieldBase & { purpose: 'new' | 'current' }) {
  const id = useId();
  return (
    <FieldShell id={id} label={props.label} hint={props.hint} required={props.required}>
      <input
        id={id}
        type="password"
        className="os-field-input"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        aria-required={props.required || undefined}
        aria-describedby={props.hint ? `${id}-hint` : undefined}
        data-autofocus={props.autoFocus || undefined}
        autoComplete={props.purpose === 'new' ? 'new-password' : 'current-password'}
        spellCheck={false}
      />
    </FieldShell>
  );
}

export function SheetTextArea(props: FieldBase & { rows?: number }) {
  const id = useId();
  return (
    <FieldShell id={id} label={props.label} hint={props.hint} required={props.required}>
      <textarea
        id={id}
        className="os-field-input os-field-textarea"
        rows={props.rows ?? 3}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        aria-describedby={props.hint ? `${id}-hint` : undefined}
        data-autofocus={props.autoFocus || undefined}
      />
    </FieldShell>
  );
}

/** Apple tarzı anahtar; native checkbox üzerine kurulu, klavye ve ekran okuyucu uyumlu. */
export function SheetSwitch({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="os-switch-row" htmlFor={id}>
      <span className="os-switch-lead">
        <span className="os-switch-icon-box" aria-hidden="true">
          <SheetAutoIcon text={label} size={15} />
        </span>
        <span className="os-switch-text">
          <strong>{label}</strong>
          {description && <small>{description}</small>}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="os-switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SheetFieldRow({ children }: { children: ReactNode }) {
  return <div className="os-field-row">{children}</div>;
}

export function SheetSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="os-sheet-section">
      {title && (
        <h3 className="os-icon-inline">
          <SheetAutoIcon text={title} />
          <span>{title}</span>
        </h3>
      )}
      {children}
    </section>
  );
}

