import { useMemo, useState } from 'react';
import { useSettings } from '@qwen-code/web-shell/daemon-react-sdk';
import type { DaemonSettingDescriptor } from '@qwen-code/sdk/daemon';
import { Empty, Notice, Page, Toggle, errorText } from '../../components/Page';

export default function WorkspaceSettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, setValue, reload, error: loadError } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, DaemonSettingDescriptor[]>();
    for (const s of settings) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()];
  }, [settings]);

  const save = async (setting: DaemonSettingDescriptor, value: unknown) => {
    setBusy(setting.key);
    setError(null);
    setNotice(null);
    try {
      await setValue('workspace', setting.key, value);
      setNotice(
        setting.requiresRestart
          ? `${setting.label}: se aplicará al reiniciar el daemon.`
          : `${setting.label} guardado.`,
      );
      await reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title="Ajustes del workspace" subtitle="Se guardan en este proyecto" onBack={onBack}>
      {error && <Notice tone="error">{error}</Notice>}
      {loadError && <Notice tone="error">{errorText(loadError)}</Notice>}
      {notice && <Notice tone="ok">{notice}</Notice>}
      {settings.length === 0 && <Empty title="No hay ajustes disponibles" />}

      {groups.map(([category, items]) => (
        <section key={category} className="settings-group">
          <h3 className="group-title">{category}</h3>
          <ul className="list">
            {items.map((s) => {
              const value = s.values.workspace ?? s.values.effective ?? s.default;
              return (
                <li key={s.key} className="card setting">
                  <div className="row-main">
                    <span className="list-title">{s.label}</span>
                    {s.description && <span className="list-meta">{s.description}</span>}
                    {s.requiresRestart && <span className="list-meta">Requiere reiniciar</span>}
                  </div>
                  <SettingControl
                    setting={s}
                    value={value}
                    disabled={busy === s.key}
                    onSave={(next) => void save(s, next)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}

function SettingControl({
  setting,
  value,
  disabled,
  onSave,
}: {
  setting: DaemonSettingDescriptor;
  value: unknown;
  disabled: boolean;
  onSave: (next: unknown) => void;
}) {
  if (setting.type === 'boolean') {
    return <Toggle label={setting.label} checked={Boolean(value)} disabled={disabled} onChange={(next) => onSave(next)} />;
  }

  if (setting.options && setting.options.length > 0) {
    return (
      <div className="segmented wrap" role="radiogroup" aria-label={setting.label}>
        {setting.options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={disabled}
            className={`seg ${value === opt.value ? 'is-active' : ''}`}
            onClick={() => onSave(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (setting.type === 'number') {
    return (
      <input
        className="input"
        type="number"
        inputMode="numeric"
        defaultValue={typeof value === 'number' ? value : ''}
        disabled={disabled}
        aria-label={setting.label}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n) && n !== value) onSave(n);
        }}
      />
    );
  }

  if (setting.type === 'string') {
    return (
      <input
        className="input"
        type="text"
        defaultValue={typeof value === 'string' ? value : ''}
        disabled={disabled}
        aria-label={setting.label}
        onBlur={(e) => {
          if (e.target.value !== value) onSave(e.target.value);
        }}
      />
    );
  }

  return <p className="mono tool-meta">{JSON.stringify(value)}</p>;
}
