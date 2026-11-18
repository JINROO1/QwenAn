import { useEffect, useState, type ReactNode } from 'react';
import { useActions } from '@qwen-code/web-shell/daemon-react-sdk';
import type {
  DaemonStatusTranscriptBlock,
  DaemonTextTranscriptBlock,
  DaemonTranscriptBlock,
} from '@qwen-code/sdk/daemon';
import { Markdown } from '../lib/markdown';
import DiffView from './DiffView';

type Block = DaemonTranscriptBlock;

interface Props {
  block: Block;
  /** Sube cada vez que se pide expandirlo todo (/expand-now). */
  expandVersion?: number;
}

/** Renderiza cada tipo de bloque del transcript del daemon. */
export default function TranscriptBlock({ block, expandVersion = 0 }: Props) {
  switch (block.kind) {
    case 'user': {
      const t = block as DaemonTextTranscriptBlock;
      return (
        <article className="msg msg-user">
          <AttachmentList block={t} />
          {t.text && <p className="msg-text">{t.text}</p>}
        </article>
      );
    }

    case 'assistant':
      return (
        <article className="msg msg-assistant">
          <Markdown text={(block as DaemonTextTranscriptBlock).text} />
        </article>
      );

    case 'thought':
      return (
        <ThoughtCard expandVersion={expandVersion}>
          <div className="msg-thought-body">
            <Markdown text={(block as DaemonTextTranscriptBlock).text} />
          </div>
        </ThoughtCard>
      );

    case 'tool':
      return <ToolCard block={block} expandVersion={expandVersion} />;

    case 'permission':
      return <PermissionCard block={block} />;

    case 'shell':
      return <ShellOutput text={block.text} stream={block.stream} />;

    case 'user_shell':
      return (
        <article className="card shell-card">
          <p className="shell-cmd">
            <span className="shell-prompt">$</span> {block.command}
          </p>
          {block.cwd && <p className="tool-meta">en {block.cwd}</p>}
          {block.text && <ShellOutput text={block.text} stream={block.stream} />}
        </article>
      );

    case 'status':
      return <StatusLine tone="info" text={(block as DaemonStatusTranscriptBlock).text} />;

    case 'error':
      return (
        <StatusLine
          tone="error"
          text={(block as DaemonStatusTranscriptBlock).text}
          code={(block as DaemonStatusTranscriptBlock).code}
        />
      );

    case 'debug':
      return <StatusLine tone="debug" text={(block as DaemonStatusTranscriptBlock).text} />;

    case 'prompt_cancelled':
      return (
        <StatusLine
          tone="info"
          text={
            (block as { reason?: string }).reason
              ? `Respuesta detenida: ${(block as { reason?: string }).reason}`
              : 'Respuesta detenida.'
          }
        />
      );

    default:
      return null;
  }
}

function AttachmentList({ block }: { block: DaemonTextTranscriptBlock }) {
  const images = block.images ?? [];
  const files = (block as { files?: Array<{ name: string }> }).files ?? [];
  if (images.length === 0 && files.length === 0) return null;
  return (
    <div className="attachments">
      {images.map((img, i) => (
        <img
          key={`img-${i}`}
          className="attachment-img"
          src={img.data.startsWith('data:') ? img.data : `data:${img.mimeType};base64,${img.data}`}
          alt="Imagen adjunta"
        />
      ))}
      {files.map((file, i) => (
        <span key={`file-${i}`} className="chip">
          📎 {file.name}
        </span>
      ))}
    </div>
  );
}

function ThoughtCard({ expandVersion, children }: { expandVersion: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (expandVersion > 0) setOpen(true);
  }, [expandVersion]);
  return (
    <details className="msg msg-thought" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Razonamiento</summary>
      {children}
    </details>
  );
}

function ToolCard({ block, expandVersion }: { block: Extract<Block, { kind: 'tool' }>; expandVersion: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (expandVersion > 0) setOpen(true);
  }, [expandVersion]);
  const preview = block.preview;
  const duration = block.durationMs !== undefined ? formatDuration(block.durationMs) : undefined;

  return (
    <article className="card tool" data-status={block.status}>
      <header className="tool-head">
        <span className="tool-title">{block.title}</span>
        <span className={`badge badge-${toneOf(block.status)}`}>{statusLabel(block.status)}</span>
      </header>

      <div className="tool-meta-row">
        {block.toolName && <span className="tool-meta">{block.toolName}</span>}
        {duration && <span className="tool-meta">{duration}</span>}
        {block.agent && <span className="tool-meta">agente: {agentName(block.agent)}</span>}
      </div>

      {preview?.kind === 'command' && (
        <pre className="md-code tool-code">
          <code>{preview.command}</code>
        </pre>
      )}

      {preview?.kind === 'file_diff' && (
        <DiffView path={preview.path} patch={preview.patch} oldText={preview.oldText} newText={preview.newText} />
      )}

      {preview?.kind === 'file_read' && (
        <p className="tool-meta">
          Leído: <span className="mono">{preview.path}</span>
          {preview.range ? ` (líneas ${preview.range[0]}–${preview.range[1]})` : ''}
        </p>
      )}

      {preview?.kind === 'web_fetch' && (
        <p className="tool-meta">
          {preview.method ?? 'GET'} <a href={preview.url} target="_blank" rel="noopener noreferrer">{preview.url}</a>
        </p>
      )}

      {preview?.kind === 'mcp_invocation' && (
        <p className="tool-meta">
          MCP · {preview.serverId} → <span className="mono">{preview.toolName}</span>
        </p>
      )}

      {preview?.kind === 'ask_user_question' && (
        <div className="tool-questions">
          {preview.questions.map((q, i) => (
            <div key={i} className="question">
              {q.header && <p className="question-header">{q.header}</p>}
              <p className="question-text">{q.question}</p>
            </div>
          ))}
        </div>
      )}

      {block.status !== 'pending' && block.status !== 'running' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
      )}
      {open && (
        <pre className="raw">{safeJson({ toolCallId: block.toolCallId, status: block.status, preview })}</pre>
      )}
    </article>
  );
}

function PermissionCard({ block }: { block: Extract<Block, { kind: 'permission' }> }) {
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const resolved = Boolean(block.resolved);
  const preview = block.preview;

  const answer = async (optionId: string) => {
    setBusy(true);
    try {
      await actions.submitPermission(block.requestId, optionId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card permission">
      <h4 className="permission-title">{block.title}</h4>
      {block.toolName && <p className="tool-meta">{block.toolName}</p>}

      {preview?.kind === 'command' && (
        <pre className="md-code tool-code">
          <code>{preview.command}</code>
        </pre>
      )}
      {preview?.kind === 'file_diff' && (
        <DiffView path={preview.path} patch={preview.patch} oldText={preview.oldText} newText={preview.newText} />
      )}
      {preview?.kind === 'web_fetch' && <p className="tool-meta">{preview.url}</p>}

      {resolved ? (
        <p className="tool-meta">Resuelto: {block.resolved}</p>
      ) : (
        <div className="permission-actions">
          {block.options.map((option) => (
            <button
              key={option.optionId}
              type="button"
              className="btn btn-block"
              disabled={busy}
              onClick={() => void answer(option.optionId)}
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

function ShellOutput({ text, stream }: { text: string; stream?: 'stdout' | 'stderr' }) {
  return (
    <pre className={`md-code shell-out ${stream === 'stderr' ? 'is-stderr' : ''}`}>
      <code>{text}</code>
    </pre>
  );
}

function StatusLine({ tone, text, code }: { tone: 'info' | 'error' | 'debug'; text: string; code?: string }) {
  return (
    <p className={`status-line status-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {text}
      {code && <span className="status-code"> · {code}</span>}
    </p>
  );
}

function toneOf(status: string): 'ok' | 'error' | 'warn' | 'neutral' {
  if (status === 'success' || status === 'completed') return 'ok';
  if (status === 'error' || status === 'failed') return 'error';
  if (status === 'cancelled' || status === 'pending') return 'warn';
  return 'neutral';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    running: 'En curso',
    in_progress: 'En curso',
    success: 'Completado',
    completed: 'Completado',
    error: 'Error',
    failed: 'Error',
    cancelled: 'Cancelado',
  };
  return map[status] ?? status;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`;
}

function agentName(agent: unknown): string {
  if (agent && typeof agent === 'object') {
    const a = agent as { name?: string; type?: string; agentId?: string };
    return a.name ?? a.type ?? a.agentId ?? 'subagente';
  }
  return 'subagente';
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
