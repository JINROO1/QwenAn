import { useSessions } from '@qwen-code/web-shell/daemon-react-sdk';

interface Props {
  activeSessionId?: string;
  onOpen: (id: string) => void;
  onNew: () => void;
}

export default function SessionsScreen({ activeSessionId, onOpen, onNew }: Props) {
  const { sessions, reload } = useSessions();

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Sesiones</h2>
          <p className="page-sub">Conversaciones guardadas en este workspace.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void reload()}>
            Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            Nueva
          </button>
        </div>
      </header>

      {sessions.length === 0 ? (
        <div className="empty">
          <h3>Sin sesiones todavía</h3>
          <p>Cuando envíes tu primer mensaje, la conversación aparecerá aquí.</p>
        </div>
      ) : (
        <ul className="list">
          {sessions.map((s) => {
            const id = s.sessionId;
            const active = id === activeSessionId;
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`list-item ${active ? 'is-active' : ''}`}
                  onClick={() => onOpen(id)}
                >
                  <span className="list-title">{s.displayName || `Sesión ${id.slice(0, 8)}`}</span>
                  <span className="list-meta">
                    {formatDate(s.updatedAt ?? s.createdAt)}
                    {s.hasActivePrompt ? ' · en curso' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatDate(value: string | number | undefined): string {
  if (value === undefined) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}
