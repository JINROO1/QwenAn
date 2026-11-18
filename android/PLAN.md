# Qwen Code para Android: plan técnico

Estado: **plan, sin código de producción todavía**.

## Requisitos vigentes

- La app Android es una **shell mínima**: solo muestra la UI web (WebView) y gestiona la descarga inicial.
- El agente se ejecuta **dentro de proot** con una **distro Linux** que permita `apt install` y `apt upgrade`.
- El agente trabaja sobre un **workspace seleccionado por el usuario**.
- Rootfs, Node y dependencias se publican como **assets en GitHub Releases**. La app los descarga en el primer arranque, con **reanudación** tras errores de red (HTTP `Range`, verificación SHA-256 por fragmento).
- La UI es **web, mobile-first y adaptativa en vertical**: textos y botones sin cortes ni amontonamientos.
- **Paridad total con la CLI**. Si hace falta, se modifica `QwenLM/qwen-code`.
- **Versiones más recientes** de Node y de las dependencias. Node: **26.13.1** (última estable). No se usa Node 22.

> Nota: esto reemplaza el requisito anterior de "todo dentro del APK". Ahora el APK es ligero y el contenido pesado se descarga al primer arranque.

## Arquitectura

```
APK (Kotlin, mínimo)
 ├─ Descargador reanudable (rootfs, Node, bundle, herramientas)
 ├─ Lanzador de proot (binario en jniLibs, ejecutable desde nativeLibraryDir)
 ├─ Selector de workspace (SAF) → bind mount dentro de proot
 └─ WebView → http://127.0.0.1:<puerto>  (UI web)

proot (distro Linux, p. ej. Debian arm64)
 ├─ Node 26.13.1 (linux-arm64)
 ├─ qwen serve (daemon de Qwen Code, bundle modificado)
 ├─ Herramientas de desarrollo (git, python, build-essential, …) vía apt
 └─ /workspace  ← carpeta elegida por el usuario
```

### Por qué esta forma
- **Node y el bundle viven en el rootfs**, no como librerías nativas del APK. Así no hay que cross-compilar Node para Android bionic: se usa el build oficial linux-arm64 dentro de una distro glibc.
- **`qwen serve` ya sirve el Web Shell** y expone la API del agente. La app no reimplementa nada: solo abre la UI.
- **proot** da acceso a `apt` sin root real.

## Assets y descarga

| Asset | Contenido aproximado | Notas |
|---|---|---|
| `rootfs-debian-arm64.tar.zst` | Distro base | Construida en CI |
| `node-26.13.1-linux-arm64.tar.xz` | Node oficial | Verificado con SHA-256 |
| `qwen-code-<ver>.tgz` | Bundle modificado + `node_modules` | Construido en CI |
| `manifest.json` | Lista de fragmentos, tamaños, SHA-256 | Lo descarga la app primero |

- Los archivos se dividen en fragmentos. La app guarda progreso en disco y reanuda con `Range`.
- Cada fragmento se verifica antes de unirlo. Un fallo de red no invalida los fragmentos ya buenos.
- Las actualizaciones de la distro se hacen con `apt` dentro de proot, como pide el requisito.

## Modificaciones necesarias a Qwen Code

Identificadas en el análisis del código (`packages/core/src/sandbox`, `packages/core`):

1. **Sandbox**: `bwrap` y Landlock no funcionan dentro de proot. Hay que desactivarlos explícitamente en modo Android y apoyarse en las reglas de permisos.
2. **Nativos**: `sharp` y `@lydell/node-pty` deben compilar para linux-arm64 dentro de la distro. Si `sharp` falla, se hace opcional con fallback.
3. **Rutas**: detección de `$HOME`, `tmp` y del shell en el entorno proot.
4. **Acceso al workspace**: confirmar que las rutas de proyecto y worktrees funcionan con el bind mount.
5. **Dependencias**: actualizar a las últimas versiones con `pnpm update --latest`, y reportar las que rompan build o tests.

## Paridad con la CLI

Medición preliminar (heurística por nombre de comando):
- **99** nombres de comando slash en `packages/cli/src/ui/commands`.
- **88** aparecen en el código del Web Shell.
- **11** sin referencia aparente: `cd`, `collapse-on-resume`, `cpu-profile`, `curator`, `expand-now`, `expand-on-resume`, `monthly`, `output-style`, `peers`, `reload-plugins`, `rollback`.

Esto es solo un indicio. Falta una **matriz de paridad** función por función (comandos, flags, diálogos de permisos, MCP, skills, hooks, subagentes, extensiones, sesiones, modelos, temas e i18n). Cada fila debe tener su ruta en el Web Shell o su endpoint en `qwen serve`. Lo que falte se implementa en el Web Shell o se expone en el daemon.

## Diseño móvil

- Mobile-first, vertical por defecto, adaptativo a tablet y escritorio.
- Textos con `min-width: 0`, saltos de línea controlados y sin truncar descripciones ni botones.
- Objetivos táctiles de al menos 44 px y navegación por bottom sheet o pestañas.
- Verificación con capturas en viewports de 360×800, 390×844 y 412×915.

## Fases

1. **Matriz de paridad** completa y decisiones sobre las 11 funciones sin referencia.
2. **Build de la distro y Node** en GitHub Actions. Verificar `apt update` y `node -v` dentro de proot.
3. **Bundle de Qwen Code** para linux-arm64 con las modificaciones, y arranque de `qwen serve` dentro de proot.
4. **APK mínimo**: descargador reanudable, lanzador de proot, selector de workspace, WebView.
5. **Paridad de UI** y diseño móvil, con pruebas de capturas.
6. **Actualización de dependencias** a las últimas versiones y pruebas de regresión.

## Restricciones del entorno de desarrollo

- El entorno local no alcanza `nodejs.org`, `dl.google.com`, `maven.google.com`, `services.gradle.org` ni las mirrors de distros. Por eso la distro, Node y el APK se construyen en **GitHub Actions**, que sí tiene acceso.
- Sin un dispositivo Android real, la validación final del APK, de proot y del descargador debe hacerse en un teléfono.

## Riesgos

- **Rendimiento de proot**: más lento que un chroot real; afecta a compilaciones y `apt`.
- **Background**: Android puede matar el proceso. Hace falta un servicio en primer plano con notificación.
- **Seguridad**: el agente ejecuta código con los permisos de la app, sin sandbox del kernel. Requiere revisar reglas de permisos por defecto.
- **Almacenamiento**: el rootfs más Node y el bundle ocupan varios GB con herramientas completas.
- **Política de distribución**: descargar código ejecutable tras la instalación puede chocar con las políticas de Google Play. Si se distribuye fuera de Play, no aplica.

## Estado: validación glibc arm64 (verificada)

Workflow `.github/workflows/android-rootfs-spike.yml`, ejecución `success` en la rama:

- Node **26.13.1** `linux-arm64` descargado de nodejs.org y verificado con `SHASUMS256.txt`.
- Corre dentro de `ubuntu:noble` `linux/arm64` (emulado con binfmt): `node -v` → `v26.13.1`, `process.arch` → `arm64`, V8 `14.6`.
- `apt-get update` y `apt-cache` funcionan dentro del contenedor arm64.
- **Dependencia descubierta:** el binario de Node necesita `libatomic1`. Debe ir en el rootfs (`apt-get install libatomic1`).
- glibc: Ubuntu noble es la base glibc de referencia. Sin Ubuntu noble ni `libatomic1`, Node no arranca (`libatomic.so.1: cannot open shared object file`).

Limitación del entorno de desarrollo: los logs y artefactos de Actions no son accesibles desde el sandbox (blobs fuera de la lista permitida). Para depurar se usan **anotaciones** (`::error::`), legibles por `api.github.com`.

## Estado: qwen serve dentro de la distro arm64 (verificado en CI)

Workflow `.github/workflows/android-daemon-spike.yml`, ejecución `success` en la rama:

- Daemon compilado en amd64 desde `v0.28.0` con los parches `0001` y `0002` aplicados.
- Dependencias instaladas en `ubuntu:noble` `linux/arm64` con `pnpm install --frozen-lockfile --ignore-scripts`.
- Dentro de la distro: `arch=aarch64`, `node v26.13.1`, glibc 2.39.
- `qwen serve` arranca. `GET /health` → 200, `POST /workspace/settings` (`general.outputStyle`) → 200, `GET /usage/dashboard?month=2026-10` → 200.

Nativos (misma ejecución, `.github/spike/native.cjs`), con `--ignore-scripts` y los binarios precompilados por plataforma:

- `@lydell/node-pty` → abre una terminal real y devuelve `pty-ok`. Funciona.
- `sharp` → genera un PNG de 97 bytes. Funciona.
- No hizo falta `pnpm rebuild`: ambos usan paquetes `linux-arm64` precompilados.

Sandbox: en el runner `unshare -U` falla y no hay `bwrap`. Confirma que en proot hay que desactivar el sandbox del kernel y apoyarse en las reglas de permisos, como indica el plan.

Pendiente: el sandbox real dentro de proot en un dispositivo, y el envío de prompts con modelo.

Notas de CI: Node 26 no trae `corepack`; el montaje de Node es de solo lectura; pnpm necesita `CI=true` para reinstalar sin TTY. Los logs no son legibles desde el sandbox: todo diagnóstico se emite como anotaciones.

## Estado: rootfs de la distro (verificado en CI)

Workflow `.github/workflows/android-rootfs.yml`, ejecución `success`:

- Base `ubuntu:noble` arm64. Paquetes: `ca-certificates curl git python3 python3-venv libatomic1 build-essential`.
- Verificación del artefacto: se importa de nuevo y dentro: `aarch64`, `apt-get update` y `apt-get upgrade` simulado correctos, `git 2.43.0`, `Python 3.12.3`, `libatomic1` instalado.
- Salida: `qwenan-rootfs-noble-arm64.tar.zst` (~93 MB), troceado en fragmentos de 64 MiB con SHA-256 por fragmento y `manifest.json`. Se publica como artefacto de Actions.

Limitación: los artefactos caducan (14 días) y su descarga exige autenticación de GitHub. Para el teléfono hará falta una publicación estable (release privada con token en la app, que es aceptable porque la app es personal).

## Estado: assets de runtime (verificado en CI)

Workflow `.github/workflows/android-assets.yml`, ejecución `success` (`44207836040`):

- `node-26.13.1-linux-arm64.tar.zst`: 37,5 MB, 1 fragmento. Verificado con `SHASUMS256.txt`.
- `qwen-code-0.28.0-linux-arm64.tar.zst`: 273 MB, 5 fragmentos. Bundle v0.28.0 con parches 0001 y 0002, dependencias de producción instaladas en arm64.
- `manifest.json` con SHA-256 del archivo y de cada fragmento (64 MiB).
- Verificación: reensamblado desde fragmentos (SHA-256 correcto) y arranque de `qwen serve` con el Node empaquetado dentro de la distro: `node v26.13.1`, `aarch64`, `GET /health` → 200.

Tamaño total comprimido de runtime (sin contar el rootfs de ~93 MB): ~310 MB. El tamaño descomprimido aún no está medido.

## Próximos pasos inmediatos

1. ~~Validar `qwen serve` dentro del mismo contenedor glibc~~ (hecho, ver arriba). Siguiente: nativos (`pnpm rebuild sharp @lydell/node-pty`) en arm64.
2. Aplicar la lista de modificaciones (sandbox, nativos, rutas) como parches sobre un commit fijo de `QwenLM/qwen-code`.
3. Completar la matriz de paridad y, con ella, implementar en el Web Shell las funciones que falten.
4. Diseño mobile-first vertical con safe-area insets, sin solapamiento con la barra de navegación del sistema.

## Estado: Web Shell propia (`webshell/`)

Decisión: la UI no se copia de la Web Shell oficial. Se construye una **UI propia** sobre su **capa headless publicada** en npm:

- `@qwen-code/web-shell@0.27.4/daemon-react-sdk`: providers y hooks (sesiones, transcripción, permisos, archivos, MCP, memoria, agentes, herramientas, ajustes, proveedores, canales, uso, estado).
- `@qwen-code/sdk@0.1.34/daemon`: cliente del daemon.

Verificado:

- `tsc --noEmit` sin errores y `vite build` correcto (1.4 MB JS, 393 kB comprimido).
- Daemon `qwen serve` 0.27.4 (npm) en loopback: `/health`, `/capabilities` y `/daemon/status` responden 200. CORS permite el origen de la UI.
- El SDK conecta con el daemon y `listWorkspaceSessions` responde.

No verificado todavía:

- Interacción visual en navegador (no hay navegador disponible en el sandbox; las pruebas irán en CI).
- Envío de prompts y permisos de extremo a extremo (requiere credenciales de modelo).

Siguientes pasos: cubrir el resto de bloques y pantallas de la Web Shell original (ver `webshell/README.md`), dividir el bundle, y pruebas visuales móviles en CI.

## Estado de publicación (paso 3 completado)

- Job `release` de `android-assets.yml` (manual): crea o actualiza el pre-release `runtime-v1` con los 7 archivos (manifest y fragmentos). Verificado en run `44225979023`: release creada.
- Descarga anónima (`github.com/JINROO1/QwenAn/releases/download/runtime-v1/...`): 404 mientras el repo era privado; con el repo público responde 302.
- Decisión del usuario: repo público. La descarga anónima de `runtime-v1` responde 302 (antes 404). La app no necesita token.

## Estado: descarga anónima verificada (CI)

Workflow `android-download-check.yml`, ejecución `44291638879` `success`, sin token:

- `manifest.json` y los 6 fragmentos descargados de `releases/download/runtime-v1`.
- SHA-256 por fragmento comprobado antes de aceptarlo. Reensamblado y SHA-256 del archivo completo:
  - `node-26.13.1-linux-arm64.tar.zst`: 37 505 875 B, OK.
  - `qwen-code-0.28.0-linux-arm64.tar.zst`: 273 152 028 B, 5 fragmentos, OK.
- La lógica de `.github/download/verify-release.py` (reanudación con `Range` y reintentos) es la referencia para el descargador de la app. Reanudación probada (run `44291999922`): corte simulado a 5 000 000 B en el primer fragmento; el reintento usó `Range` y recibió HTTP 206 desde ese byte, y el fragmento verificó su SHA-256. Los 6 fragmentos y ambos archivos pasaron la verificación.

## Estado: proyecto Android mínimo (CI)

- `android/` es un proyecto Gradle (Kotlin, `minSdk 29`, `targetSdk 34`, paquete `dev.qwenan`). Pantalla provisional (`MainActivity`).
- `RuntimeDownloader.kt`: descarga anónima de fragmentos con reanudación `Range`, SHA-256 por fragmento, reintentos con espera creciente, y descarte de fragmentos corruptos de tamaño completo.
- Tests JVM (5): descarga completa, reanudación desde parcial, parcial corrupto, reintento tras 503, fallo tras agotar intentos. Servidor HTTP mínimo en el propio test.
- Workflow `android-app.yml`: `testDebugUnitTest` + `assembleDebug`, APK como artefacto. Run `44293282743` `success`.
- `RuntimeInstaller.kt`: lee `manifest.json`, descarga los fragmentos, los reensambla y verifica el archivo final. Es idempotente: un asset ya válido no se vuelve a bajar. Tests (4): instalación completa, segunda instalación sin descargas, reinstalación si el archivo está corrupto y fallo si el SHA-256 final no coincide. Run `44295515528` `success`.
- Pendiente: extraer los `.tar.zst` (requiere zstd y tar en Android), lanzador de proot (binario arm64 aún no elegido), WebView real y selector de workspace.
