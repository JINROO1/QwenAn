import { useConnection, useStatusReport } from '@qwen-code/web-shell/daemon-react-sdk';
import { Page } from '../components/Page';

export default function StatusScreen({ onBack }: { onBack?: () => void }) {
  const connection = useConnection();
  const report = useStatusReport();
  const connected = connection?.status === 'connected';

  return (
    <Page title="Estado del daemon" subtitle="Salud del servicio y del workspace" onBack={onBack}>
      <div className="card">
        <dl className="kv">
          <dt>Conexión</dt>
          <dd className={connected ? 'ok-text' : 'error-text'}>{connected ? 'Conectado' : 'Sin conexión'}</dd>
          {connection?.error && (
            <>
              <dt>Error</dt>
              <dd className="error-text">{String(connection.error)}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="card">
        <h3 className="card-title">Informe</h3>
        <pre className="raw">{report?.data ? JSON.stringify(report.data, null, 2) : 'Cargando…'}</pre>
      </div>
    </Page>
  );
}
