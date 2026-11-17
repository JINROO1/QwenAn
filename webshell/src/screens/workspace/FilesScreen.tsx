import { useEffect, useState } from 'react';
import { useWorkspace, useWorkspaceActions } from '@qwen-code/web-shell/daemon-react-sdk';

type DaemonDirectoryListing = Awaited<ReturnType<ReturnType<typeof useWorkspaceActions>['listDirectory']>>;
type DaemonWorkspaceFile = Awaited<ReturnType<ReturnType<typeof useWorkspaceActions>['readWorkspaceFile']>>;
import { Empty, Notice, Page, errorText } from '../../components/Page';

export default function FilesScreen({ onBack }: { onBack: () => void }) {
  const workspace = useWorkspace();
  const actions = useWorkspaceActions();
  const root = workspace.workspaceCwd ?? '';
  const [dir, setDir] = useState(root);
  const [listing, setListing] = useState<DaemonDirectoryListing | null>(null);
  const [file, setFile] = useState<DaemonWorkspaceFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!root || file) return;
    setLoading(true);
    setError(null);
    actions
      .listDirectory(dir)
      .then(setListing)
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false));
  }, [dir, root, file, actions]);

  const open = async (name: string, kind: string) => {
    const path = joinPath(dir, name);
    if (kind === 'directory') {
      setDir(path);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setFile(await actions.readWorkspaceFile(path));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const up = () => {
    if (dir === root || !dir) return;
    const parent = dir.slice(0, dir.lastIndexOf('/')) || '/';
    setDir(parent.length >= root.length ? parent : root);
  };

  if (file) {
    return (
      <Page title={basename(file.path)} subtitle={file.path} onBack={() => setFile(null)}>
        {file.truncated && <Notice tone="info">Archivo truncado. Se muestra la parte inicial.</Notice>}
        <div className="card">
          <pre className="raw file-view">{file.content}</pre>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Archivos" subtitle={relative(dir, root) || '/'} onBack={onBack}>
      {!root && <Notice tone="error">Este workspace no tiene una carpeta de trabajo definida.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {dir !== root && (
        <button type="button" className="btn btn-ghost btn-block" onClick={up}>
          ↑ Subir un nivel
        </button>
      )}
      {loading && <p className="tool-meta">Cargando…</p>}
      {listing && listing.entries.length === 0 && <Empty title="Carpeta vacía" />}
      {listing && listing.entries.length > 0 && (
        <ul className="list">
          {listing.entries.map((e) => (
            <li key={e.name}>
              <button type="button" className="list-item file-row" onClick={() => void open(e.name, e.kind)}>
                <span className="list-title">
                  {e.kind === 'directory' ? '📁 ' : '📄 '}
                  {e.name}
                </span>
                {e.ignored && <span className="list-meta">ignorado por git</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {listing?.truncated && <Notice tone="info">Lista truncada: hay más elementos.</Notice>}
    </Page>
  );
}

function joinPath(dir: string, name: string): string {
  return `${dir.replace(/\/$/, '')}/${name}`;
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function relative(dir: string, root: string): string {
  if (!root || !dir.startsWith(root)) return dir;
  return dir.slice(root.length) || '/';
}
