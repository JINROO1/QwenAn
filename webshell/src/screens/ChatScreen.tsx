import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DaemonSessionProvider,
  useActions,
  useConnection,
  useStreamingState,
  usePendingPermissions,
  useTranscriptBlocks,
  useWorkspace,
  useWorkspaceActions,
} from '@qwen-code/web-shell/daemon-react-sdk';
import TranscriptBlock from '../components/TranscriptBlock';
import Composer, { type SlashCommand } from '../components/Composer';
import RewindSheet from '../components/RewindSheet';
import MonthlyCard from '../components/MonthlyCard';
import { Notice, errorText } from '../components/Page';

interface Props {
  sessionId?: string;
  onSessionCreated: (id: string) => void;
  onNewChat: () => void;
}

const OUTPUT_STYLES = ['Concise', 'Proactive', 'Explanatory', 'Learning'];

const UNAVAILABLE: Record<string, string> = {
  curator: '/curator',
  peers: '/peers',
  'cpu-profile': '/cpu-profile',
};

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
  const workspaceActions = useWorkspaceActions();
  const workspace = useWorkspace();

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rewindOpen, setRewindOpen] = useState(false);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [monthlyMonth, setMonthlyMonth] = useState<string | undefined>(undefined);
  const [expandVersion, setExpandVersion] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const activeSessionId = connection.sessionId;

  // El daemon no crea sesión hasta que se pide: la creamos en el primer envío.
  const ensureSession = useCallback(async () => {
    if (connection.sessionId) return;
    await actions.createSession({ workspaceCwd: workspace.workspaceCwd });
  }, [actions, connection.sessionId, workspace.workspaceCwd]);

  useEffect(() => {
    if (activeSessionId) onSessionCreated(activeSessionId);
  }, [activeSessionId, onSessionCreated]);

  // Sigue la conversación: baja al final cuando llegan bloques nuevos.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blocks.length, streaming]);

  const report = (text: string) => {
    setError(null);
    setInfo(text);
  };
  const fail = (err: unknown) => {
    setInfo(null);
    setError(errorText(err));
  };

  const commands: SlashCommand[] = useMemo(() => {
    const list: SlashCommand[] = [
      { name: 'nueva', hint: 'Empezar una conversación nueva', run: onNewChat },
      { name: 'renombrar', hint: 'Cambiar el nombre de esta sesión', run: () => setRenaming(true) },
      { name: 'detener', hint: 'Detener la respuesta en curso', run: () => void actions.cancel() },
      { name: 'ayuda', hint: 'Ver atajos y comandos', run: () => setHelpOpen((o) => !o) },
      { name: 'rollback', hint: 'Volver a un punto anterior de la conversación', run: () => setRewindOpen(true) },
      {
        name: 'monthly',
        hint: '[AAAA-MM]: uso del mes en curso o de un mes anterior',
        run: (arg) => {
          const month = arg.trim();
          if (!month) {
            setMonthlyMonth(undefined);
            setMonthlyOpen((o) => !o);
            return;
          }
          if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            setInfo(null);
            setError(`Formato no válido: "${month}". Usa AAAA-MM, por ejemplo 2026-10.`);
            return;
          }
          setInfo(null);
          setError(null);
          setMonthlyMonth(month);
          setMonthlyOpen(true);
        },
      },
      {
        name: 'expand-now',
        hint: 'Expandir razonamiento y herramientas de la conversación',
        run: () => {
          setExpandVersion((v) => v + 1);
          report('Bloques expandidos.');
        },
      },
      {
        name: 'collapse-on-resume',
        hint: 'Colapsar el historial al reanudar sesiones',
        run: () =>
          void workspaceActions
            .setWorkspaceSetting('user', 'ui.history.collapseOnResume', true)
            .then(() => report('El historial se colapsará al reanudar.'), fail),
      },
      {
        name: 'expand-on-resume',
        hint: 'Expandir el historial al reanudar sesiones',
        run: () =>
          void workspaceActions
            .setWorkspaceSetting('user', 'ui.history.collapseOnResume', false)
            .then(() => report('El historial se expandirá al reanudar.'), fail),
      },
      {
        name: 'output-style',
        hint: '<estilo>: Concise, Proactive, Explanatory, Learning o nombre propio',
        run: (arg) => {
          const style = arg.trim();
          if (!style) {
            report(`Estilos disponibles: ${OUTPUT_STYLES.join(', ')}, o un nombre personalizado.`);
            return;
          }
          void workspaceActions
            .setWorkspaceSetting('workspace', 'general.outputStyle', style)
            .then(() => report(`Estilo de salida: ${style}. Se aplica al reiniciar el daemon.`), fail);
        },
      },
      {
        name: 'reload-plugins',
        hint: 'Recargar extensiones, comandos y servidores MCP',
        run: () =>
          void (async () => {
            try {
              const ext = await workspaceActions.refreshExtensions();
              if (connection.sessionId) await actions.refreshCommands();
              await workspaceActions.reloadMcp();
              report(`Extensiones recargadas: ${ext.refreshed} · fallidas: ${ext.failed}.`);
            } catch (err) {
              fail(err);
            }
          })(),
      },
      {
        name: 'cd',
        hint: '<ruta>: ver o cambiar el directorio de trabajo',
        run: (arg) => {
          const path = arg.trim();
          const current = workspace.workspaceCwd ?? '';
          if (!path || path === current) {
            report(`Directorio actual: ${current || 'sin definir'}.`);
            return;
          }
          // El daemon está vinculado a un único workspace y rechaza otras rutas.
          setInfo(null);
          setError(`No se puede cambiar a ${path}: el daemon está vinculado a ${current}. Reinícialo con --workspace.`);
        },
      },
    ];
    for (const [name, cmd] of Object.entries(UNAVAILABLE)) {
      list.push({
        name,
        hint: 'No disponible en la Web Shell (requiere la CLI)',
        run: () => setError(`${cmd} necesita la CLI: el daemon web no expone esta función.`),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, workspaceActions, workspace.workspaceCwd, onNewChat, connection.sessionId]);

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

      {renaming && (
        <RenameBar
          onDone={() => setRenaming(false)}
          onError={(m) => setError(m)}
        />
      )}

      {rewindOpen && <RewindSheet onClose={() => setRewindOpen(false)} onResult={report} />}
      {monthlyOpen && <MonthlyCard key={monthlyMonth ?? 'current'} month={monthlyMonth} onClose={() => { setMonthlyOpen(false); setMonthlyMonth(undefined); }} />}

      {helpOpen && (
        <div className="card help">
          <h3 className="card-title">Atajos</h3>
          <ul className="help-list">
            <li><span className="mono">/</span> comandos, por ejemplo <span className="mono">/rollback</span></li>
            <li><span className="mono">!</span> comando de shell directo, por ejemplo <span className="mono">!git status</span></li>
            <li><span className="mono">Enter</span> envía · <span className="mono">Shift+Enter</span> salto de línea</li>
          </ul>
        </div>
      )}

      {info && <Notice tone="ok">{info}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="transcript" ref={transcriptRef}>
        {blocks.length === 0 && (
          <div className="empty">
            <h3>¿En qué trabajamos?</h3>
            <p>Escribe una instrucción para el agente. Los cambios propuestos aparecerán aquí para que los apruebes.</p>
          </div>
        )}

        {blocks.map((block) => (
          <TranscriptBlock key={block.id} block={block} expandVersion={expandVersion} />
        ))}

        {pending.length > 0 && (
          <p className="pending-note">
            {pending.length === 1 ? 'Hay 1 permiso pendiente.' : `Hay ${pending.length} permisos pendientes.`}
          </p>
        )}
      </div>

      <Composer
        commands={commands}
        ensureSession={ensureSession}
        onError={(m) => {
          setInfo(null);
          setError(m);
        }}
        onSent={() => {
          setError(null);
          setInfo(null);
        }}
      />
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
          onError(errorText(err));
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
