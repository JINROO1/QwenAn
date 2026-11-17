import { useActions } from '@qwen-code/web-shell/daemon-react-sdk';
import type { DaemonTranscriptBlock } from '@qwen-code/sdk/daemon';

interface Props {
  block: DaemonTranscriptBlock;
}

/** Renderiza un bloque de transcripción. Los tipos no tratados explícitamente se muestran como texto neutro. */
export default function TranscriptBlock({ block }: Props) {
  switch (block.kind) {
    case 'user':
      return (
        <article className="msg msg-user">
          <p className="msg-text">{block.text}</p>
        </article>
      );
    case 'assistant':
      return (
        <article className="msg msg-assistant">
          <p className="msg-text">{block.text}</p>
        </article>
      );
    case 'thought':
      return (
        <details className="msg msg-thought">
          <summary>Razonamiento</summary>
          <p className="msg-text">{block.text}</p>
        </details>
      );
    case 'tool':
      return (
        <article className="card tool" data-status={block.status}>
          <header className="tool-head">
            <span className="tool-title">{block.title}</span>
            <span className="badge">{statusLabel(block.status)}</span>
          </header>
          {block.toolName && <p className="tool-meta">{block.toolName}</p>}
        </article>
      );
    case 'permission':
      return <PermissionCard block={block} />;
    default:
      return (
        <article className="card muted">
          <p className="msg-text">{kindLabel(block.kind)}</p>
        </article>
      );
  }
}

function PermissionCard({
  block,
}: {
  block: Extract<DaemonTranscriptBlock, { kind: 'permission' }>;
}) {
  const actions = useActions();
  const resolved = Boolean(block.resolved);

  return (
    <article className="card permission">
      <h4 className="permission-title">{block.title}</h4>
      {block.toolName && <p className="tool-meta">{block.toolName}</p>}
      {resolved ? (
        <p className="tool-meta">Resuelto: {block.resolved}</p>
      ) : (
        <div className="permission-actions">
          {block.options.map((option) => (
            <button
              key={option.optionId}
              type="button"
              className="btn btn-block"
              onClick={() => void actions.submitPermission(block.requestId, option.optionId)}
            >
              <span className="btn-label">{option.label}</span>
              {option.description && <span className="btn-desc">{option.description}</span>}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    running: 'En curso',
    success: 'Completado',
    error: 'Error',
    cancelled: 'Cancelado',
  };
  return map[status] ?? status;
}

function kindLabel(kind: string): string {
  return `Bloque no mostrado todavía: ${kind}`;
}
