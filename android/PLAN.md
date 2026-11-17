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
