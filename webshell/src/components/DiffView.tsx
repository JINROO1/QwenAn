import { useMemo } from 'react';

interface DiffLine {
  type: 'add' | 'del' | 'ctx' | 'hunk';
  text: string;
}

interface Props {
  patch?: string;
  oldText?: string;
  newText?: string;
  path: string;
}

/** Diff unificado con colores. Usa el parche del daemon cuando existe; si no, calcula uno. */
export default function DiffView({ patch, oldText, newText, path }: Props) {
  const lines = useMemo<DiffLine[]>(() => {
    if (patch && patch.trim()) return parsePatch(patch);
    return computeDiff(oldText ?? '', newText ?? '');
  }, [patch, oldText, newText]);

  const adds = lines.filter((l) => l.type === 'add').length;
  const dels = lines.filter((l) => l.type === 'del').length;

  return (
    <div className="diff">
      <header className="diff-head">
        <span className="diff-path">{path}</span>
        <span className="diff-stat">
          <span className="stat-add">+{adds}</span> <span className="stat-del">−{dels}</span>
        </span>
      </header>
      {lines.length === 0 ? (
        <p className="diff-empty">Sin cambios de contenido.</p>
      ) : (
        <div className="diff-body" role="region" aria-label={`Diff de ${path}`}>
          {lines.map((line, index) => (
            <div key={index} className={`diff-line diff-${line.type}`}>
              <span className="diff-sign" aria-hidden="true">
                {line.type === 'add' ? '+' : line.type === 'del' ? '−' : line.type === 'hunk' ? '@' : ' '}
              </span>
              <span className="diff-text">{line.text || ' '}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parsePatch(patch: string): DiffLine[] {
  const out: DiffLine[] = [];
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('diff ') || raw.startsWith('index ')) continue;
    if (raw.startsWith('@@')) out.push({ type: 'hunk', text: raw });
    else if (raw.startsWith('+')) out.push({ type: 'add', text: raw.slice(1) });
    else if (raw.startsWith('-')) out.push({ type: 'del', text: raw.slice(1) });
    else if (raw.startsWith(' ')) out.push({ type: 'ctx', text: raw.slice(1) });
  }
  return out;
}

/** Diff por LCS. Para entradas muy grandes cae a reemplazo completo para no bloquear la UI. */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText ? oldText.split('\n') : [];
  const b = newText ? newText.split('\n') : [];
  if (a.length * b.length > 250_000) {
    return [
      ...a.map((text) => ({ type: 'del' as const, text })),
      ...b.map((text) => ({ type: 'add' as const, text })),
    ];
  }

  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'ctx', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i++] });
    } else {
      out.push({ type: 'add', text: b[j++] });
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}
