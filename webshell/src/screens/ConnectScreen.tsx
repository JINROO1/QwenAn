import { useState } from 'react';
import { DEFAULT_CONFIG, validateBaseUrl, type DaemonConfig } from '../config';

interface Props {
  initial: DaemonConfig | null;
  onConnect: (config: DaemonConfig) => void;
}

export default function ConnectScreen({ initial, onConnect }: Props) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? DEFAULT_CONFIG.baseUrl);
  const [token, setToken] = useState(initial?.token ?? '');
  const [workspaceCwd, setWorkspaceCwd] = useState(initial?.workspaceCwd ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateBaseUrl(baseUrl);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onConnect({
      baseUrl: new URL(baseUrl.trim()).origin,
      token: token.trim(),
      workspaceCwd: workspaceCwd.trim(),
    });
  };

  return (
    <div className="screen connect">
      <header className="hero">
        <div className="logo" aria-hidden="true">Q</div>
        <h1>QwenAn</h1>
        <p className="lede">
          Conecta con tu daemon de Qwen Code para chatear, revisar cambios y administrar tu
          workspace desde el móvil.
        </p>
      </header>

      <form className="card form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">Dirección del daemon</span>
          <span className="field-hint">Origen completo, por ejemplo http://127.0.0.1:4170</span>
          <input
            className="input"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:4170"
          />
        </label>

        <label className="field">
          <span className="field-label">Token de acceso</span>
          <span className="field-hint">Opcional si el daemon no exige autenticación.</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bearer token"
          />
        </label>

        <label className="field">
          <span className="field-label">Carpeta de trabajo</span>
          <span className="field-hint">Ruta del workspace en el servidor. Vacío usa el valor por defecto.</span>
          <input
            className="input"
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={workspaceCwd}
            onChange={(e) => setWorkspaceCwd(e.target.value)}
            placeholder="/ruta/a/mi-proyecto"
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block">
          Conectar
        </button>
      </form>
    </div>
  );
}
