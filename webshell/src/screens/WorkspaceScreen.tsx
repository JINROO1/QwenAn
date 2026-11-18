import { useState } from 'react';
import FilesScreen from './workspace/FilesScreen';
import UsageScreen from './workspace/UsageScreen';
import McpScreen from './workspace/McpScreen';
import SkillsScreen from './workspace/SkillsScreen';
import ToolsScreen from './workspace/ToolsScreen';
import MemoryScreen from './workspace/MemoryScreen';
import ProvidersScreen from './workspace/ProvidersScreen';
import WorkspaceSettingsScreen from './workspace/WorkspaceSettingsScreen';
import StatusScreen from './StatusScreen';

type Section =
  | 'files'
  | 'usage'
  | 'mcp'
  | 'skills'
  | 'tools'
  | 'memory'
  | 'providers'
  | 'settings'
  | 'status';

const SECTIONS: Array<{ id: Section; title: string; desc: string; icon: string }> = [
  { id: 'files', title: 'Archivos', desc: 'Explora y lee archivos del workspace', icon: '📁' },
  { id: 'usage', title: 'Uso', desc: 'Tokens, modelos, herramientas y actividad', icon: '📈' },
  { id: 'mcp', title: 'Servidores MCP', desc: 'Estado, herramientas y activación', icon: '🔌' },
  { id: 'skills', title: 'Skills', desc: 'Habilidades disponibles y su estado', icon: '🧩' },
  { id: 'tools', title: 'Herramientas', desc: 'Activa o desactiva herramientas del agente', icon: '🛠️' },
  { id: 'memory', title: 'Memoria', desc: 'Archivos de contexto del proyecto', icon: '🧠' },
  { id: 'providers', title: 'Modelos y proveedores', desc: 'Proveedor actual y modelos disponibles', icon: '🤖' },
  { id: 'settings', title: 'Ajustes del workspace', desc: 'Configuración de Qwen Code en este proyecto', icon: '🎛️' },
  { id: 'status', title: 'Estado del daemon', desc: 'Salud del servicio y diagnósticos', icon: '📊' },
];

export default function WorkspaceScreen() {
  const [section, setSection] = useState<Section | null>(null);
  const back = () => setSection(null);

  switch (section) {
    case 'files':
      return <FilesScreen onBack={back} />;
    case 'usage':
      return <UsageScreen onBack={back} />;
    case 'mcp':
      return <McpScreen onBack={back} />;
    case 'skills':
      return <SkillsScreen onBack={back} />;
    case 'tools':
      return <ToolsScreen onBack={back} />;
    case 'memory':
      return <MemoryScreen onBack={back} />;
    case 'providers':
      return <ProvidersScreen onBack={back} />;
    case 'settings':
      return <WorkspaceSettingsScreen onBack={back} />;
    case 'status':
      return <StatusScreen onBack={back} />;
    default:
      return (
        <section className="page">
          <header className="page-head">
            <div className="page-head-text">
              <h2 className="page-title">Workspace</h2>
              <p className="page-sub">Todo lo que Qwen Code puede hacer en este proyecto.</p>
            </div>
          </header>
          <ul className="menu">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button type="button" className="menu-item" onClick={() => setSection(s.id)}>
                  <span className="menu-icon" aria-hidden="true">{s.icon}</span>
                  <span className="menu-text">
                    <span className="menu-title">{s.title}</span>
                    <span className="menu-desc">{s.desc}</span>
                  </span>
                  <span className="menu-chevron" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      );
  }
}
