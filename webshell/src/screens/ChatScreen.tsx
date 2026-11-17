import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DaemonSessionProvider,
  useActions,
  useConnection,
  useStreamingState,
  usePendingPermissions,
  useTranscriptBlocks,
} from '@qwen-code/web-shell/daemon-react-sdk';
import TranscriptBlock from '../components/TranscriptBlock';
import Composer, { type SlashCommand } from '../components/Composer';

interface Props {
  sessionId?: string;
  onSessionCreated: (id: string) => void;
  onNewChat: () => void;
}

export default function ChatScreen({ sessionId, onSessionCreated, onNewChat }: Props) {
  return (
    <DaemonSessionProvider sessionId={sessionId}>
      <ChatBody onSessionCreated={onSessionCreated} onNewChat={onNewChat} />
    </DaemonSessionProvider>
  );
}

function ChatBody({ onSessionCreated, onNewChat }: Omit<Props, 'sessionId'>) {
  const connection = useConnection();
  const blocks = useTranscriptBlocks();
  const streaming = useStreamingState();
  const pending = usePendingPermissions();
  const actions = useActions();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const activeSessionId = connection.sessionId;
  useEffect(() => {
    if (activeSessionId) onSessionCreated(activeSessionId);
  }, [activeSessionId, onSessionCreated]);

  // Sigue la conversación: baja al final cuando llegan bloques nuevos.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blocks.length, streaming]);

  const commands: SlashCommand[] = useMemo(
    () => [
      { name: 'nueva', hint: 'Empezar una conversación nueva', run: onNewChat },
      {
        name: 'renombrar',
        hint: 'Cambiar el nombre de esta sesión',
        run: () => setRenaming(true),
      },
      { name: 'detener', hint: 'Detener la respuesta en curso', run: () => void actions.cancel() },
      { name: 'ayuda', hint: 'Ver atajos y comandos', run: () => setHelpOpen((o) => !o) },
    ],
    [actions, onNewChat],
  );

  const handleError = (message: string) => setError(message);

  return (
    <section className="chat">
      <header className="topbar">
        <div className="topbar-text">
          <h2 className="topbar-title">
            {activeSessionId ? `Conversación ${activeSessionId.slice(0, 8)}` : 'Nueva conversación'}
          </h2>
          <p className="topbar-sub">
            {connection.status === 'connected' ? 'Conectado' : 'Conectando…'}
            {streaming !== 'idle' ? ` · ${streaming === 'thinking' ? 'pensando' : 'respondiendo'}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onNewChat}>
          Nueva
        </button>
      </header>

      {renaming && <RenameBar onDone={() => setRenaming(false)} onError={handleError} />}

      {helpOpen && (
        <div className="card help">
          <h3 className="card-title">Atajos</h3>
          <ul className="help-list">
            <li><span className="mono">/</span> comandos (nueva, renombrar, detener, ayuda)</li>
            <li><span className="mono">!</span> comando de shell directo, por ejemplo <span className="mono">!git status</span></li>
            <li><span className="mono">Enter</span> envía · <span className="mono">Shift+Enter</span> salto de línea</li>
          </ul>
        </div>
      )}

      <div className="transcript" ref={transcriptRef}>
        {blocks.length === 0 && (
          <div className="empty">
            <h3>¿En qué trabajamos?</h3>
            <p>Escribe una instrucción para el agente. Los cambios propuestos aparecerán aquí para que los apruebes.</p>
          </div>
        )}

        {blocks.map((block) => (
          <TranscriptBlock key={block.id} block={block} />
        ))}

        {pending.length > 0 && (
          <p className="pending-note">
            {pending.length === 1 ? 'Hay 1 permiso pendiente.' : `Hay ${pending.length} permisos pendientes.`}
          </p>
        )}
      </div>

      {error && (
        <p className="error inline" role="alert">
          {error}
        </p>
      )}

      <Composer commands={commands} onError={handleError} onSent={() => setError(null)} />
    </section>
  );
}

function RenameBar({ onDone, onError }: { onDone: () => void; onError: (m: string) => void }) {
  const actions = useActions();
  const [name, setName] = useState('');
  return (
    <form
      className="card rename"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = name.trim();
        if (!value) return;
        try {
          await actions.renameSession(value);
          onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : 'No se pudo renombrar la sesión.');
        }
      }}
    >
      <label className="field">
        <span className="field-label">Nuevo nombre</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="stack-row">
        <button type="button" className="btn btn-ghost" onClick={onDone}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Guardar</button>
      </div>
    </form>
  );
}
