# QwenAn Web Shell

Interfaz web propia, móvil y vertical, para hablar con el daemon `qwen serve` de Qwen Code.
Usa `@qwen-code/web-shell` (capa de hooks headless del daemon) y `@qwen-code/sdk`; el diseño visual es propio.

## Ejecutar

```bash
cd webshell
npm install
npm run dev        # desarrollo en 0.0.0.0:5174
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/ en 0.0.0.0:5174
```

Conexión: en la primera pantalla se indica la URL del daemon (por defecto `http://127.0.0.1:4170`),
el token y la carpeta de trabajo. Se guarda solo en el almacenamiento local del dispositivo
(clave `qwenan.daemon.v1`).

Daemon de referencia para pruebas:

```bash
npx @qwen-code/qwen-code serve --port 4170 --hostname 127.0.0.1 \
  --workspace /ruta/al/proyecto --token <token> \
  --allow-origin http://127.0.0.1:5174
```

## Versiones

| Paquete | Versión | Notas |
| --- | --- | --- |
| `@qwen-code/web-shell` | 0.28.0 | última publicada; compila con `tsc` |
| `@qwen-code/sdk` | 0.1.34 | última publicada |
| daemon de prueba (`@qwen-code/qwen-code`) | 0.27.4 | la 0.28.0 aparece en el registro pero su tarball devuelve 404 |
| React / Vite / TypeScript | 19.3.1 / 8.3.8 / 7.0.2 | |

## Qué está verificado

- `tsc --noEmit` y `vite build` sin errores.
- En Chromium headless con viewport de 390×844 (móvil), las 14 pantallas (conexión, chat, sesiones,
  workspace y sus 9 subpantallas, ajustes y estado): sin texto ni botones fuera de la pantalla,
  sin botones por debajo de 44 px y sin errores de consola.
- Contra el daemon real: `/workspace/settings`, `/workspace/extensions/refresh`, `/runtime/mcp/reload`
  y el listado de directorios responden correctamente.
- Primer envío: la app crea la sesión y el daemon devuelve su error real de autenticación
  (no hay modelo configurado en el entorno de pruebas).

## Qué no está verificado

- Una respuesta real del agente, streaming, aprobación de permisos y `/rollback`:
  requieren un modelo configurado en el daemon.
- Diseño en dispositivos Android reales (solo se probó con Chromium en Linux, con la fuente sin emojis).

## Paridad con la CLI

| Función | Estado | Detalle |
| --- | --- | --- |
| Chat, transcript (mensajes, razonamiento, herramientas, shell, errores) | Hecho | Vistas de herramienta: comando, diff, lectura, web, MCP, preguntas |
| Permisos | Hecho | Botones por opción del daemon |
| Comandos `/` y `!` | Hecho | `!` ejecuta shell directo |
| Selector de modelo y modo de aprobación | Hecho | El modo se guarda en la app; el SDK no expone su lectura |
| Adjuntos (imagen y texto) | Hecho | Límite de 10 MB por archivo |
| Sesiones: renombrar, archivar, exportar (md), eliminar | Hecho | |
| Archivos, uso, MCP, skills, herramientas, memoria, proveedores, ajustes, estado | Hecho | Ajustes: solo los que el daemon permite modificar |
| `/rollback` | Hecho (sin probar en vivo) | Lista turnos con snapshot; vuelve con o sin archivos |
| `/monthly [AAAA-MM]` | Parcial | Resumen del mes en curso y descarga CSV. Un mes concreto no está disponible: el daemon solo acepta hoy, 7 o 30 días (requiere parche en `/usage/dashboard`) |
| `/expand-now` | Hecho | Expande razonamiento y herramientas |
| `/reload-plugins` | Hecho | Probado contra el daemon |
| `/cd` | Parcial | Muestra el directorio; el daemon está vinculado a un único workspace |
| `/output-style`, `/collapse-on-resume`, `/expand-on-resume` | Hecho con parche en el daemon | Requieren el parche `patches/qwen-code/0001-…`; sin él el daemon responde `disallowed_key` |
| `/curator`, `/peers`, `/cpu-profile` | No disponible | Sin ruta en el daemon (`/peers` usa sockets locales de la CLI) |

Los tres comandos dependen del parche `patches/qwen-code/0001-web-shell-allow-output-style-and-history-settings.patch`, verificado sobre el bundle del daemon 0.27.4. Falta aplicarlo al fork y publicarlo.

## Limitaciones conocidas

- Bundle de ~1.4 MB (≈400 KB comprimido). Casi todo viene del SDK de UI de `@qwen-code/web-shell`
  (traducciones de todos los idiomas y componentes de editor). Reducirlo implica usar solo
  `@qwen-code/sdk/daemon` con hooks propios.
- Las pestañas Sesiones, Workspace y Ajustes se cargan al primer uso.
- Los iconos del menú de Workspace son emojis: dependen de la fuente del sistema.
