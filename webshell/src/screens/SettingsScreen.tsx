import type { DaemonConfig } from '../config';

interface Props {
  config: DaemonConfig;
  onEdit: () => void;
  onDisconnect: () => void;
}

export default function SettingsScreen({ config, onEdit, onDisconnect }: Props) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Ajustes</h2>
          <p className="page-sub">Conexión y preferencias de la aplicación.</p>
        </div>
      </header>

      <div className="card">
        <dl className="kv">
          <dt>Daemon</dt>
          <dd className="mono">{config.baseUrl}</dd>
          <dt>Workspace</dt>
          <dd className="mono">{config.workspaceCwd || 'Por defecto del daemon'}</dd>
          <dt>Token</dt>
          <dd>{config.token ? 'Configurado' : 'No configurado'}</dd>
        </dl>
      </div>

      <div className="stack">
        <button type="button" className="btn btn-block" onClick={onEdit}>
          Editar conexión
        </button>
        <button type="button" className="btn btn-danger btn-block" onClick={onDisconnect}>
          Desconectar y borrar datos locales
        </button>
      </div>
    </section>
  );
}
