import { useMemo, useState } from 'react';
import { useTools } from '@qwen-code/web-shell/daemon-react-sdk';
import { Empty, Notice, Page, Toggle, errorText } from '../../components/Page';

export default function ToolsScreen({ onBack }: { onBack: () => void }) {
  const tools = useTools();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools.tools;
    return tools.tools.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.displayName ?? '').toLowerCase().includes(q),
    );
  }, [tools.tools, query]);

  const toggle = async (name: string, enabled: boolean) => {
    setBusy(name);
    setError(null);
    try {
      await tools.setEnabled(name, enabled);
      await tools.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page
      title="Herramientas"
      subtitle={`${tools.tools.filter((t) => t.enabled).length} de ${tools.tools.length} activas`}
      onBack={onBack}
    >
      {error && <Notice tone="error">{error}</Notice>}
      {tools.error && <Notice tone="error">{errorText(tools.error)}</Notice>}
      <label className="field">
        <span className="sr-only">Buscar herramienta</span>
        <input
          className="input"
          type="search"
          placeholder="Buscar herramienta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {filtered.length === 0 ? (
        <Empty title="Sin resultados" />
      ) : (
        <ul className="list">
          {filtered.map((tool) => (
            <li key={tool.name} className="card row-card">
              <div className="row-main">
                <span className="list-title">{tool.displayName || tool.name}</span>
                {tool.description && <span className="list-meta">{tool.description}</span>}
                <span className="mono tool-meta">{tool.name}</span>
              </div>
              <Toggle
                label={`Activar ${tool.name}`}
                checked={tool.enabled}
                disabled={busy === tool.name}
                onChange={(next) => void toggle(tool.name, next)}
              />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
