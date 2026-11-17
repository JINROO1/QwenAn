import { useEffect, useState } from 'react';
import { useActions } from '@qwen-code/web-shell/daemon-react-sdk';
import { errorText } from './Page';

type Snapshot = {
  promptId: string;
  turnIndex: number;
  timestamp: string;
  diffStats: { filesChanged: number; insertions: number; deletions: number };
};

interface Props {
  onClose: () => void;
  onResult: (message: string) => void;
}

/** Lista los turnos con snapshot y permite volver a un punto de la conversación (/rollback). */
export default function RewindSheet({ onClose, onResult }: Props) {
  const actions = useActions();
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    actions
      .getRewindSnapshots()
      .then((r) => setSnapshots([...r.snapshots].reverse()))
      .catch((err) => setError(errorText(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rewind = async (promptId: string, rewindFiles: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const result = await actions.rewindSession(promptId, { rewindFiles });
      const files = result.filesChanged.length;
      const failed = result.filesFailed.length;
      onResult(
        `Vuelto al turno ${result.targetTurnIndex}` +
          (rewindFiles ? ` · ${files} archivo(s) restaurados${failed ? `, ${failed} con error` : ''}` : ''),
      );
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet" role="dialog" aria-label="Volver a un punto anterior">
      <div className="sheet-head">
        <h3>Volver atrás</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {snapshots === null && !error && <p className="tool-meta">Cargando puntos…</p>}
      {snapshots?.length === 0 && <p className="tool-meta">No hay puntos a los que volver todavía.</p>}
      <ul className="option-list">
        {snapshots?.map((s) => (
          <li key={s.promptId} className="card row-card">
            <div className="row-main">
              <span className="list-title">Turno {s.turnIndex}</span>
              <span className="list-meta">
                {new Date(s.timestamp).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              <span className="list-meta">
                {s.diffStats.filesChanged} archivo(s) · +{s.diffStats.insertions} −{s.diffStats.deletions}
              </span>
            </div>
            <div className="stack-row">
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void rewind(s.promptId, false)}>
                Solo conversación
              </button>
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void rewind(s.promptId, true)}>
                Con archivos
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

