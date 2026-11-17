# QwenAn Web Shell

Interfaz web propia para Qwen Code, con diseño móvil vertical. Reutiliza la **lógica headless** de la Web Shell oficial (`@qwen-code/web-shell/daemon-react-sdk`) y el cliente del daemon (`@qwen-code/sdk/daemon`). La presentación es nueva: no se copian los componentes originales.

## Versiones

| Paquete | Versión | Motivo |
|---|---|---|
| `@qwen-code/web-shell` | 0.27.4 | Igual que el daemon, para evitar desajustes de protocolo |
| `@qwen-code/sdk` | 0.1.34 | Cliente del daemon |
| `react` / `react-dom` | 19.3.x | Última estable |
| `vite` | 8.x | Última estable |
| `typescript` | 7.x | Última estable |

Cuando se actualice el daemon, actualiza `@qwen-code/web-shell` a la misma versión.

## Comandos

```bash
npm install
npm run dev        # http://0.0.0.0:5174
npm run typecheck
npm run build      # genera dist/ (estático, rutas relativas)
```

## Conexión con el daemon

El daemon es `qwen serve` (paquete `@qwen-code/qwen-code`). Para usar esta UI desde otro origen, el daemon debe permitirlo:

```bash
qwen serve --port 4170 --token "$QWEN_SERVER_TOKEN" \
  --allow-origin http://127.0.0.1:5174 --allow-origin http://localhost:5174
```

Sin token, el daemon solo acepta conexiones desde loopback. Fuera de loopback, `--token` es obligatorio.

## Estado de funcionalidad

Implementado en esta versión:

- Conexión configurable (origen, token, carpeta de trabajo), validada antes de guardar.
- Chat con transcripción en vivo: mensajes del usuario y del asistente, razonamiento, herramientas y permisos.
- Aprobación de permisos desde tarjetas con opciones.
- Detener una respuesta en curso.
- Lista de sesiones del workspace y apertura de una sesión.
- Estado del daemon (informe `/daemon/status`).
- Ajustes de conexión y borrado de datos locales.

Pendiente, para igualar la Web Shell original:

- Bloques de transcripción no tratados todavía (archivos, shell, diffs, subagentes, workflows, herramientas con resultado).
- Comandos slash y selector de modelo, modo de aprobación y lenguaje.
- Explorador de archivos y edición, git (diff, log, ramas, worktrees), PRs de GitHub.
- MCP, skills, extensiones, memoria, hooks, agentes, canales, voz, Live, programación, uso y métricas.
- Sesiones: renombrar, archivar, exportar, bifurcar, rebobinar, búsqueda.
- Pruebas visuales en varios tamaños de pantalla (360×800, 390×844, 412×915).

## Diseño móvil

- Altura real con `100dvh` y `safe-area-inset` en cabecera, barra inferior y compositor, para que los controles del sistema no tapen contenido.
- Textos con ajuste de línea (`overflow-wrap`), sin truncar descripciones ni botones.
- Objetivos táctiles de al menos 44 px.
- Vertical por defecto; a partir de 768 px centra la columna.
