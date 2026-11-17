// Configuración de conexión al daemon `qwen serve`.
// Se guarda solo en el almacenamiento local del dispositivo.

export interface DaemonConfig {
  baseUrl: string;
  token: string;
  workspaceCwd: string;
}

const KEY = 'qwenan.daemon.v1';

export const DEFAULT_CONFIG: DaemonConfig = {
  baseUrl: 'http://127.0.0.1:4170',
  token: '',
  workspaceCwd: '',
};

export function loadConfig(): DaemonConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DaemonConfig>;
    if (!parsed.baseUrl) return null;
    return { ...DEFAULT_CONFIG, ...parsed } as DaemonConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: DaemonConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  localStorage.removeItem(KEY);
}

/** Valida que la URL sea un origen HTTP(S) sin ruta, consulta ni credenciales. */
export function validateBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return 'La URL no es válida. Ejemplo: http://127.0.0.1:4170';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'Usa http:// o https://';
  }
  if (url.username || url.password) {
    return 'No incluyas usuario ni contraseña en la URL.';
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    return 'Introduce solo el origen, sin ruta ni parámetros.';
  }
  return null;
}
