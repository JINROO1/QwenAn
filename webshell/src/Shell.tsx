import { useState } from 'react';
import type { DaemonConfig } from './config';
import ChatScreen from './screens/ChatScreen';
import SessionsScreen from './screens/SessionsScreen';
import StatusScreen from './screens/StatusScreen';
import SettingsScreen from './screens/SettingsScreen';

export type Tab = 'chat' | 'sessions' | 'status' | 'settings';

interface Props {
  config: DaemonConfig;
  onEdit: () => void;
  onDisconnect: () => void;
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'sessions', label: 'Sesiones', icon: '🗂️' },
  { id: 'status', label: 'Estado', icon: '📊' },
  { id: 'settings', label: 'Ajustes', icon: '⚙️' },
];

export default function Shell({ config, onEdit, onDisconnect }: Props) {
  const [tab, setTab] = useState<Tab>('chat');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  // Cambiar la clave reinicia la sesión de chat (nueva conversación).
  const [chatKey, setChatKey] = useState(0);

  const openSession = (id: string) => {
    setSessionId(id);
    setChatKey((k) => k + 1);
    setTab('chat');
  };

  const newChat = () => {
    setSessionId(undefined);
    setChatKey((k) => k + 1);
    setTab('chat');
  };

  return (
    <div className="app">
      <main className="app-main" aria-live="polite">
        {tab === 'chat' && (
          <ChatScreen
            key={chatKey}
            sessionId={sessionId}
            onSessionCreated={setSessionId}
            onNewChat={newChat}
          />
        )}
        {tab === 'sessions' && (
          <SessionsScreen activeSessionId={sessionId} onOpen={openSession} onNew={newChat} />
        )}
        {tab === 'status' && <StatusScreen />}
        {tab === 'settings' && (
          <SettingsScreen config={config} onEdit={onEdit} onDisconnect={onDisconnect} />
        )}
      </main>

      <nav className="tabbar" aria-label="Navegación principal">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
