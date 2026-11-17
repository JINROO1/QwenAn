import { useCallback, useState } from 'react';
import { DaemonWorkspaceProvider } from '@qwen-code/web-shell/daemon-react-sdk';
import { clearConfig, loadConfig, saveConfig, type DaemonConfig } from './config';
import ConnectScreen from './screens/ConnectScreen';
import Shell from './Shell';

export default function App() {
  const [config, setConfig] = useState<DaemonConfig | null>(() => loadConfig());

  const handleConnect = useCallback((next: DaemonConfig) => {
    saveConfig(next);
    setConfig(next);
  }, []);

  const handleDisconnect = useCallback(() => {
    clearConfig();
    setConfig(null);
  }, []);

  if (!config) {
    return <ConnectScreen initial={null} onConnect={handleConnect} />;
  }

  return (
    <DaemonWorkspaceProvider
      baseUrl={config.baseUrl}
      token={config.token || undefined}
      workspaceCwd={config.workspaceCwd || undefined}
      autoConnect
    >
      <Shell config={config} onEdit={() => setConfig(null)} onDisconnect={handleDisconnect} />
    </DaemonWorkspaceProvider>
  );
}
