import { useConnection, useStatusReport } from '@qwen-code/web-shell/daemon-react-sdk';

export default function StatusScreen() {
  const connection = useConnection();
  const report = useStatusReport();

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Estado</h2>
          <p className="page-sub">Salud del daemon y del workspace.</p>
        </div>
      </header>

      <div className="card">
        <dl className="kv">
          <dt>Conexión</dt>
          <dd>{connection?.status === 'connected' ? 'Conectado' : 'Sin conexión'}</dd>
          {connection?.error && (
            <>
              <dt>Error</dt>
              <dd className="error-text">{String(connection.error)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="card">
        <h3 className="card-title">Informe del daemon</h3>
        <pre className="raw">{report?.data ? JSON.stringify(report.data, null, 2) : 'Cargando…'}</pre>
      </div>
    </section>
  );
}
