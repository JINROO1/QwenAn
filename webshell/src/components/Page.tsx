import type { ReactNode } from 'react';

interface PageProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

/** Contenedor de página con cabecera, botón de volver y área de contenido desplazable. */
export function Page({ title, subtitle, onBack, actions, children }: PageProps) {
  return (
    <section className="page">
      <header className="page-head">
        <div className="page-head-main">
          {onBack && (
            <button type="button" className="btn btn-ghost btn-sm back" onClick={onBack} aria-label="Volver">
              ←
            </button>
          )}
          <div className="page-head-text">
            <h2 className="page-title">{title}</h2>
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="head-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  return (
    <p className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Ha ocurrido un error inesperado.';
}
