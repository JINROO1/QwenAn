import { useState } from 'react';
import { useUsageDashboard } from '@qwen-code/web-shell/daemon-react-sdk';
import { Notice, Page, errorText } from '../../components/Page';

type Range = 'today' | 'week' | 'month';

const RANGES: Array<{ id: Range; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: '7 días' },
  { id: 'month', label: '30 días' },
];

export default function UsageScreen({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<Range>('month');
  const { dashboard, loading, error } = useUsageDashboard({ range });
  const s = dashboard?.summary;

  return (
    <Page title="Uso" subtitle="Consumo de tokens y actividad" onBack={onBack}>
      <div className="segmented" role="tablist" aria-label="Rango">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`seg ${range === r.id ? 'is-active' : ''}`}
            onClick={() => setRange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading && <p className="tool-meta">Cargando…</p>}
      {error && <Notice tone="error">{errorText(error)}</Notice>}

      {s && (
        <>
          <div className="stat-grid">
            <Stat label="Tokens totales" value={fmt(s.totalTokens)} />
            <Stat label="Entrada" value={fmt(s.inputTokens)} />
            <Stat label="Salida" value={fmt(s.outputTokens)} />
            <Stat label="Caché leída" value={`${Math.round(s.cacheReadRate * 100)}%`} />
            <Stat label="Peticiones" value={fmt(s.requests)} />
            <Stat label="Sesiones" value={fmt(s.sessions)} />
            <Stat label="Herramientas" value={fmt(s.toolCalls)} />
            <Stat label="Líneas +/−" value={`+${fmt(s.linesAdded)} / −${fmt(s.linesRemoved)}`} />
          </div>

          {dashboard && dashboard.models.length > 0 && (
            <div className="card">
              <h3 className="card-title">Modelos</h3>
              <ul className="bars">
                {dashboard.models.map((m) => (
                  <li key={m.model} className="bar-row">
                    <div className="bar-head">
                      <span className="bar-label">{m.model}</span>
                      <span className="tool-meta">{fmt(m.totalTokens)}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(100, Math.round(m.share * 100))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return String(n);
}
