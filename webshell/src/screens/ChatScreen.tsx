import { useEffect, useState } from 'react';
import {
  DaemonSessionProvider,
  useActions,
  useConnection,
  useStreamingState,
  usePendingPermissions,
  useTranscriptBlocks,
} from '@qwen-code/web-shell/daemon-react-sdk';
import TranscriptBlock from '../components/TranscriptBlock';

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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando el daemon crea la sesión tras el primer prompt, la guardamos en la app.
  const activeSessionId = connection.sessionId;
  useEffect(() => {
    if (activeSessionId) onSessionCreated(activeSessionId);
  }, [activeSessionId, onSessionCreated]);

  const busy = sending || streaming !== 'idle';

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setSending(true);
    setError(null);
    try {
      await actions.sendPrompt(text);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const cancel = () => {
    void actions.cancel();
  };

  return (
    <section className="chat">
      <header className="topbar">
        <div className="topbar-text">
          <h2 className="topbar-title">
            {activeSessionId ? `Conversación ${activeSessionId.slice(0, 8)}` : 'Nueva conversación'}
          </h2>
          <p className="topbar-sub">
            {connection?.status === 'connected' ? 'Conectado' : 'Conectando…'}
            {streaming !== 'idle' ? ` · ${streaming === 'thinking' ? 'pensando' : 'respondiendo'}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onNewChat}>
          Nueva
        </button>
      </header>

      <div className="transcript">
        {blocks.length === 0 && (
          <div className="empty">
            <h3>¿En qué trabajamos?</h3>
            <p>Escribe una instrucción para el agente. Los cambios propuestos aparecerán aquí para que los apruebes.</p>
          </div>
        )}

        {blocks.map((block, index) => (
          <TranscriptBlock key={`${index}-${block.kind}`} block={block} />
        ))}

        {pending.length > 0 && (
          <p className="pending-note">
            Hay {pending.length} {pending.length === 1 ? 'permiso pendiente' : 'permisos pendientes'}: revísalos arriba.
          </p>
        )}
      </div>

      {error && (
        <p className="error inline" role="alert">
          {error}
        </p>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="prompt">
          Mensaje para el agente
        </label>
        <textarea
          id="prompt"
          className="composer-input"
          rows={1}
          value={draft}
          placeholder="Escribe una instrucción…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {streaming !== 'idle' ? (
          <button type="button" className="btn btn-danger" onClick={cancel}>
            Detener
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!draft.trim() || busy}>
            Enviar
          </button>
        )}
      </form>
    </section>
  );
}
