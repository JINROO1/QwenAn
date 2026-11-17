import { useState } from 'react';
import { useMcp } from '@qwen-code/web-shell/daemon-react-sdk';
import { Empty, Notice, Page, Toggle, errorText } from '../../components/Page';

export default function McpScreen({ onBack }: { onBack: () => void }) {
  const mcp = useMcp();
  const servers = mcp.status?.servers ?? [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: 'ok', text: label });
    } catch (err) {
      setMessage({ tone: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Servidores MCP"
      subtitle={mcp.status?.initialized ? 'Herramientas externas conectadas' : 'Pendiente de inicializar'}
      onBack={onBack}
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => void run('Configuración de MCP recargada.', () => mcp.reloadConfig())}
        >
          Recargar
        </button>
      }
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {mcp.error && <Notice tone="error">{errorText(mcp.error)}</Notice>}

      {servers.length === 0 ? (
        <Empty title="No hay servidores MCP">Añade servidores desde la configuración del proyecto o desde la CLI.</Empty>
      ) : (
        <ul className="list">
          {servers.map((server) => (
            <li key={server.name} className="card row-card">
              <div className="row-main">
                <span className="list-title">{server.name}</span>
                <span className="list-meta">
                  {server.transport}
                  {server.source ? ` · ${sourceLabel(server.source)}` : ''}
                  {server.description ? ` · ${server.description}` : ''}
                </span>
                {server.disabledReason && <span className="list-meta">Desactivado ({server.disabledReason})</span>}
                {server.authenticationError && <span className="error-text">{server.authenticationError}</span>}
              </div>
              <Toggle
                label={`Activar ${server.name}`}
                checked={!server.disabled}
                disabled={busy}
                onChange={(next) =>
                  void run(`${server.name} ${next ? 'activado' : 'desactivado'}.`, () =>
                    mcp.setConfigServerEnabled(server.name, 'workspace', next),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = { user: 'usuario', project: 'proyecto', extension: 'extensión' };
  return map[source] ?? source;
}
