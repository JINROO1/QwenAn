import { useState } from 'react';
import { useMemory } from '@qwen-code/web-shell/daemon-react-sdk';
import { Empty, Notice, Page, errorText } from '../../components/Page';
import { Markdown } from '../../lib/markdown';

export default function MemoryScreen({ onBack }: { onBack: () => void }) {
  const memory = useMemory();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async (path: string) => {
    setError(null);
    try {
      const file = (await memory.readMemoryFile(path)) as { content?: string };
      setOpenPath(path);
      setContent(file.content ?? '');
    } catch (err) {
      setError(errorText(err));
    }
  };

  if (openPath && content !== null) {
    return (
      <Page title={basename(openPath)} subtitle={openPath} onBack={() => setOpenPath(null)}>
        <div className="card">
          <Markdown text={content} />
        </div>
      </Page>
    );
  }

  return (
    <Page title="Memoria" subtitle="Archivos de contexto del proyecto" onBack={onBack}>
      {error && <Notice tone="error">{error}</Notice>}
      {memory.error && <Notice tone="error">{errorText(memory.error)}</Notice>}
      {memory.files.length === 0 ? (
        <Empty title="Sin archivos de memoria">
          Crea un archivo de contexto (por ejemplo QWEN.md) para darle al agente instrucciones del proyecto.
        </Empty>
      ) : (
        <ul className="list">
          {memory.files.map((f) => (
            <li key={f.path}>
              <button type="button" className="list-item" onClick={() => void open(f.path)}>
                <span className="list-title">{basename(f.path)}</span>
                <span className="list-meta">
                  {f.scope} · {formatBytes(f.bytes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
