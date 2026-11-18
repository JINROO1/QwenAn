import { useState } from 'react';
import { useSkills } from '@qwen-code/web-shell/daemon-react-sdk';
import { Empty, Notice, Page, Toggle, errorText } from '../../components/Page';

export default function SkillsScreen({ onBack }: { onBack: () => void }) {
  const skills = useSkills();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (name: string, enabled: boolean) => {
    setBusy(name);
    setError(null);
    try {
      await skills.setEnabled(name, enabled);
      await skills.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title="Skills" subtitle="Habilidades que el agente puede usar" onBack={onBack}>
      {error && <Notice tone="error">{error}</Notice>}
      {skills.error && <Notice tone="error">{errorText(skills.error)}</Notice>}
      {skills.skills.length === 0 ? (
        <Empty title="No hay skills">Instala skills desde la CLI o colócalas en la carpeta de skills del proyecto.</Empty>
      ) : (
        <ul className="list">
          {skills.skills.map((skill) => {
            const locked = Boolean(skill.lockedScope);
            return (
              <li key={skill.name} className="card row-card">
                <div className="row-main">
                  <span className="list-title">/{skill.name}</span>
                  {skill.description && <span className="list-meta">{skill.description}</span>}
                  {skill.extensionDisplayName && <span className="list-meta">Extensión: {skill.extensionDisplayName}</span>}
                  {skill.disabledReason && <span className="list-meta">Desactivada ({skill.disabledReason})</span>}
                  {locked && <span className="list-meta">Gestionada por {skill.lockedScope}</span>}
                </div>
                <Toggle
                  label={`Activar ${skill.name}`}
                  checked={skill.modelInvocable && !skill.disabledReason}
                  disabled={busy === skill.name || locked}
                  onChange={(next) => void toggle(skill.name, next)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
