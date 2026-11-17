import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  DAEMON_APPROVAL_MODES,
  useActions,
  useProviders,
  useStreamingState,
} from '@qwen-code/web-shell/daemon-react-sdk';
import type { PromptFile, PromptImage } from '../types-local';

export interface SlashCommand {
  name: string;
  hint: string;
  run: () => void;
}

interface Props {
  /** Comandos locales que dependen de la pantalla (nueva conversación, renombrar…). */
  commands: SlashCommand[];
  onSent?: () => void;
  onError: (message: string) => void;
}

const MODE_LABELS: Record<string, string> = {
  plan: 'Plan',
  default: 'Preguntar',
  'auto-edit': 'Auto-editar',
  auto: 'Automático',
  yolo: 'Sin límites',
};

const MODE_HINTS: Record<string, string> = {
  plan: 'Solo planifica, sin modificar archivos',
  default: 'Pide permiso antes de cada acción sensible',
  'auto-edit': 'Aplica ediciones automáticamente, pide permiso para el resto',
  auto: 'Decide con un clasificador qué requiere permiso',
  yolo: 'Ejecuta todo sin pedir permiso',
};

export default function Composer({ commands, onSent, onError }: Props) {
  const actions = useActions();
  const streaming = useStreamingState();
  const { providers, current } = useProviders();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; label: string; image?: PromptImage; file?: PromptFile }>>([]);
  const [panel, setPanel] = useState<'none' | 'model' | 'mode'>('none');
  const [mode, setMode] = useState<string>('default');
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = sending || streaming !== 'idle';
  const isSlash = draft.startsWith('/') && !draft.includes(' ');

  const suggestions = useMemo(() => {
    if (!isSlash) return [];
    const query = draft.slice(1).toLowerCase();
    return commands.filter((c) => c.name.startsWith(query));
  }, [isSlash, draft, commands]);

  const models = useMemo(() => providers.flatMap((p) => p.models ?? []), [providers]);
  const currentModel = current?.modelId ?? '';

  const runSlash = (text: string): boolean => {
    const name = text.slice(1).trim().toLowerCase();
    const cmd = commands.find((c) => c.name === name);
    if (!cmd) return false;
    setDraft('');
    cmd.run();
    return true;
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || busy) return;
    if (text.startsWith('/') && attachments.length === 0 && runSlash(text)) return;

    setSending(true);
    try {
      if (text.startsWith('!') && attachments.length === 0) {
        await actions.sendShellCommand(text.slice(1).trim());
      } else {
        await actions.sendPrompt(text || 'Analiza los adjuntos.', {
          images: attachments.flatMap((a) => (a.image ? [a.image] : [])),
          files: attachments.flatMap((a) => (a.file ? [a.file] : [])),
        });
      }
      setDraft('');
      setAttachments([]);
      onSent?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const next: typeof attachments = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        onError(`«${f.name}» supera 10 MB.`);
        continue;
      }
      const id = `${f.name}-${f.size}-${f.lastModified}`;
      if (f.type.startsWith('image/')) {
        const data = await readAsBase64(f);
        next.push({ id, label: f.name, image: { data, mimeType: f.type } });
      } else {
        const text = await f.text();
        next.push({ id, label: f.name, file: { name: f.name, text, mimeType: f.type || 'text/plain' } });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <div className="composer-wrap">
      {panel === 'model' && (
        <div className="sheet" role="dialog" aria-label="Elegir modelo">
          <div className="sheet-head">
            <h3>Modelo</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel('none')}>Cerrar</button>
          </div>
          {models.length === 0 ? (
            <p className="tool-meta">No hay modelos configurados en el daemon.</p>
          ) : (
            <ul className="option-list">
              {models.map((m) => {
                const id = m.modelId;
                const active = m.isCurrent || id === currentModel;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`option ${active ? 'is-active' : ''}`}
                      onClick={async () => {
                        setPanel('none');
                        try {
                          await actions.setModel(id);
                        } catch (err) {
                          onError(err instanceof Error ? err.message : 'No se pudo cambiar el modelo.');
                        }
                      }}
                    >
                      <span className="option-title">{m.name || id}</span>
                      <span className="option-desc">{id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {panel === 'mode' && (
        <div className="sheet" role="dialog" aria-label="Modo de aprobación">
          <div className="sheet-head">
            <h3>Modo de aprobación</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPanel('none')}>Cerrar</button>
          </div>
          <ul className="option-list">
            {DAEMON_APPROVAL_MODES.map((mode) => (
              <li key={mode}>
                <button
                  type="button"
                  className="option"
                  onClick={async () => {
                    setPanel('none');
                    try {
                      await actions.setApprovalMode(mode);
                      setMode(mode);
                    } catch (err) {
                      onError(err instanceof Error ? err.message : 'No se pudo cambiar el modo.');
                    }
                  }}
                >
                  <span className="option-title">{MODE_LABELS[mode] ?? mode}</span>
                  <span className="option-desc">{MODE_HINTS[mode] ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="suggestions" aria-label="Comandos">
          {suggestions.map((c) => (
            <li key={c.name}>
              <button type="button" className="option" onClick={() => runSlash(`/${c.name}`)}>
                <span className="option-title">/{c.name}</span>
                <span className="option-desc">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="chips-row">
        <button type="button" className="chip chip-action" onClick={() => setPanel(panel === 'model' ? 'none' : 'model')}>
          Modelo{currentModel ? `: ${currentModel}` : ''}
        </button>
        <button type="button" className="chip chip-action" onClick={() => setPanel(panel === 'mode' ? 'none' : 'mode')}>
          Modo: {MODE_LABELS[mode] ?? mode}
        </button>
        <button type="button" className="chip chip-action" onClick={() => fileInput.current?.click()}>
          Adjuntar
        </button>
        {attachments.map((a) => (
          <button
            key={a.id}
            type="button"
            className="chip"
            onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
            aria-label={`Quitar ${a.label}`}
          >
            📎 {a.label} ✕
          </button>
        ))}
        <input ref={fileInput} type="file" multiple hidden onChange={onFiles} accept="image/*,text/*,.md,.json,.ts,.tsx,.js,.py,.go,.rs,.java,.kt,.yaml,.yml,.toml" />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="prompt">Mensaje para el agente</label>
        <textarea
          id="prompt"
          className="composer-input"
          rows={1}
          value={draft}
          placeholder="Escribe una instrucción, / para comandos o ! para shell…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {streaming !== 'idle' ? (
          <button type="button" className="btn btn-danger" onClick={() => void actions.cancel()}>
            Detener
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={busy || (!draft.trim() && attachments.length === 0)}>
            Enviar
          </button>
        )}
      </form>
    </div>
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
