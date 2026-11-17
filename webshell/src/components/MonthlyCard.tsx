import { useEffect, useState } from 'react';
import { useUsageDashboard } from '@qwen-code/web-shell/daemon-react-sdk';
import type { DaemonUsageDashboard } from '@qwen-code/sdk/daemon';
import { loadConfig } from '../config';
import { errorText } from './Page';

type Dashboard = DaemonUsageDashboard;

/**
 * Resumen de uso (/monthly). Sin mes: el mes en curso vía el hook del SDK.
 * Con mes (AAAA-MM): petición directa a /usage/dashboard?month=…, que requiere
 * el parche del daemon (patches/qwen-code/0002-…).
 */
export default function MonthlyCard({ onClose, month }: { onClose: () => void; month?: string }) {
  const current = useUsageDashboard({ range: 'month', enabled: !month });
  const [past, setPast] = useState<Dashboard>();
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState<string>();

  useEffect(() => {
    if (!month) return;
    const cfg = loadConfig();
    if (!cfg) return;
    let cancelled = false;
    setPastLoading(true);
    setPastError(undefined);
    setPast(undefined);
    fetch(`${cfg.baseUrl}/usage/dashboard?range=month&month=${encodeURIComponent(month)}`, {
      headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
        if (!cancelled) setPast(body as unknown as Dashboard);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPastError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setPastLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const dashboard = month ? past : current.dashboard;
  const loading = month ? pastLoading : current.loading;
  const error = month ? pastError : current.error;
  const s = dashboard?.summary;

  return (
    <div className="card help">
      <div className="sheet-head">
        <h3 className="card-title">{month ? `Uso de ${month}` : 'Uso del mes'}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cerrar</button>
      </div>
      {loading && <p className="tool-meta">Cargando…</p>}
      {error && <p className="error-text">{typeof error === 'string' ? error : errorText(error)}</p>}
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
        <button type="button" className="btn btn-block" onClick={() => downloadCsv(dashboard, month)}>
          Descargar CSV del mes
        </button>
      )}
    </div>
  );
}

function downloadCsv(dashboard: Dashboard, month?: string) {
  const rows = [['modelo', 'tokens_totales', 'participacion', 'cache_leida']];
  for (const m of dashboard.models) rows.push([m.model, String(m.totalTokens), String(m.share), String(m.cacheReadRate)]);
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `qwen-uso-${month ?? dashboard.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
