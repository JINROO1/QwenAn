import { useState } from 'react';
import { useSessions, useWorkspaceActions } from '@qwen-code/web-shell/daemon-react-sdk';
import type { DaemonSessionSummary } from '@qwen-code/sdk/daemon';

interface Props {
  activeSessionId?: string;
  onOpen: (id: string) => void;
  onNew: () => void;
}

export default function SessionsScreen({ activeSessionId, onOpen, onNew }: Props) {
  const { sessions, reload } = useSessions();
  const actions = useWorkspaceActions();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setMessage(null);
    try {
      await fn();
      setMessage(`${label} completado.`);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `No se pudo completar: ${label.toLowerCase()}.`);
    }
    setMenuId(null);
  };

  const exportSession = (id: string) =>
    run('Exportación', async () => {
      const result = await actions.exportSession(id, 'md');
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Sesiones</h2>
          <p className="page-sub">Conversaciones de este workspace.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()}>
            Actualizar
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onNew}>
            Nueva
          </button>
        </div>
      </header>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {sessions.length === 0 ? (
        <div className="empty">
          <h3>Sin sesiones todavía</h3>
          <p>Cuando envíes tu primer mensaje, la conversación aparecerá aquí.</p>
        </div>
      ) : (
        <ul className="list">
          {sessions.map((s: DaemonSessionSummary) => {
            const id = s.sessionId;
            const active = id === activeSessionId;
            const open = menuId === id;
            return (
              <li key={id} className="session-row">
                <button
                  type="button"
                  className={`list-item ${active ? 'is-active' : ''}`}
                  onClick={() => onOpen(id)}
                >
                  <span className="list-title">{s.displayName || `Sesión ${id.slice(0, 8)}`}</span>
                  <span className="list-meta">
                    {formatDate(s.updatedAt ?? s.createdAt)}
                    {s.hasActivePrompt ? ' · en curso' : ''}
                    {s.parentSessionId ? ' · subsesión' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm session-more"
                  aria-expanded={open}
                  aria-label={`Acciones de ${s.displayName || id}`}
                  onClick={() => setMenuId(open ? null : id)}
                >
                  ⋯
                </button>
                {open && (
                  <div className="session-actions">
                    <button type="button" className="btn btn-block" onClick={() => void run('Archivado', () => actions.archiveSession(id))}>
                      Archivar
                    </button>
                    <button type="button" className="btn btn-block" onClick={() => void exportSession(id)}>
                      Exportar a Markdown
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-block"
                      onClick={() => void run('Eliminación', () => actions.deleteSession(id))}
                    >
                      Eliminar sesión
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}
