import { useProviders } from '@qwen-code/web-shell/daemon-react-sdk';
import { Empty, Notice, Page, errorText } from '../../components/Page';

export default function ProvidersScreen({ onBack }: { onBack: () => void }) {
  const providers = useProviders();
  const current = providers.current;

  return (
    <Page title="Modelos y proveedores" subtitle="Qué modelo usa el agente" onBack={onBack}>
      {providers.loading && <p className="tool-meta">Cargando…</p>}
      {providers.error && <Notice tone="error">{errorText(providers.error)}</Notice>}

      <div className="card">
        <dl className="kv">
          <dt>Proveedor</dt>
          <dd>{current?.authType ?? 'No configurado'}</dd>
          <dt>Modelo</dt>
          <dd className="mono">{current?.modelId ?? '—'}</dd>
          {current?.baseUrl && (
            <>
              <dt>Endpoint</dt>
              <dd className="mono">{current.baseUrl}</dd>
            </>
          )}
          {current?.fastModelId && (
            <>
              <dt>Modelo rápido</dt>
              <dd className="mono">{current.fastModelId}</dd>
            </>
          )}
        </dl>
      </div>

      {providers.providers.length === 0 ? (
        <Empty title="Sin proveedores">
          Configura un proveedor de modelos desde la CLI con <span className="mono">qwen auth</span>.
        </Empty>
      ) : (
        providers.providers.map((p) => (
          <div key={p.authType} className="card">
            <h3 className="card-title">
              {p.authType} {p.current ? <span className="badge badge-ok">Activo</span> : null}
            </h3>
            <ul className="list compact">
              {p.models.map((m) => (
                <li key={m.modelId} className="list-plain">
                  <span className="mono">{m.modelId}</span>
                  {m.name && <span className="list-meta">{m.name}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Page>
  );
}
