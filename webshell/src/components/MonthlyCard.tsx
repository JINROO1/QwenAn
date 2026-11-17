import { useUsageDashboard } from '@qwen-code/web-shell/daemon-react-sdk';
import { errorText } from './Page';

/** Resumen del mes en curso (/monthly). Reutiliza el dashboard de uso del daemon. */
export default function MonthlyCard({ onClose }: { onClose: () => void }) {
  const { dashboard, loading, error } = useUsageDashboard({ range: 'month' });
  const s = dashboard?.summary;

  return (
    <div className="card help">
      <div className="sheet-head">
        <h3 className="card-title">Uso del mes</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
      </div>
      {loading && <p className="tool-meta">Cargando…</p>}
      {error && <p className="error-text">{errorText(error)}</p>}
      {s && (
        <dl className="kv">
          <dt>Tokens totales</dt><dd>{s.totalTokens.toLocaleString('es')}</dd>
          <dt>Entrada / salida</dt><dd>{s.inputTokens.toLocaleString('es')} / {s.outputTokens.toLocaleString('es')}</dd>
          <dt>Peticiones</dt><dd>{s.requests.toLocaleString('es')}</dd>
          <dt>Sesiones</dt><dd>{s.sessions.toLocaleString('es')}</dd>
          <dt>Herramientas</dt><dd>{s.toolCalls.toLocaleString('es')}</dd>
          <dt>Líneas</dt><dd>+{s.linesAdded} / −{s.linesRemoved}</dd>
        </dl>
      )}
      {dashboard && (
        <button type="button" className="btn btn-block" onClick={() => downloadCsv(dashboard)}>
          Descargar CSV del mes
        </button>
      )}
    </div>
  );
}

function downloadCsv(dashboard: NonNullable<ReturnType<typeof useUsageDashboard>['dashboard']>) {
  const rows = [['modelo', 'tokens_totales', 'participacion', 'cache_leida']];
  for (const m of dashboard.models) rows.push([m.model, String(m.totalTokens), String(m.share), String(m.cacheReadRate)]);
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `qwen-uso-${dashboard.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
