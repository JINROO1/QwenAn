# Parches para qwen-code

Cambios necesarios en el daemon `qwen serve` de `QwenLM/qwen-code` que la Web Shell de este repositorio necesita.
No se aplican automáticamente: son el registro del cambio para llevarlo al fork o a upstream.

## 0001 — Permitir `general.outputStyle` y `ui.history.collapseOnResume` en `/workspace/settings`

- Archivo: `packages/cli/src/serve/routes/workspace-settings.ts` (lista `WEB_SHELL_SETTINGS`).
- Base: tag `v0.28.0` (commit `895dfca8`).
- Motivo: el daemon rechaza escribir esas claves con `disallowed_key` ("no modificable vía esta API").
  Son las claves que usan los comandos `/output-style`, `/collapse-on-resume` y `/expand-on-resume` de la Web Shell.
- Seguridad: no se abre ninguna clave sensible. `tools.approvalMode` sigue bloqueada (comprobado).

### Cómo se aplicó y se verificó

- El parche se aplicó al bundle instalado del daemon de prueba (`@qwen-code/qwen-code` 0.27.4), que
  contiene la misma lista. No se compiló el monorepo completo.
- Resultado con el daemon parcheado:
  - `general.outputStyle` (scope workspace) → guardado, `requiresRestart: true`.
  - `ui.history.collapseOnResume` (scope user) → guardado, `requiresRestart: false`.
  - `tools.approvalMode` → `disallowed_key` (sin cambios).
- Desde la Web Shell: `/output-style Concise` y `/collapse-on-resume` muestran el aviso de éxito.

## 0002 — Filtro por mes en `/usage/dashboard`

- Archivos: `packages/core/src/services/usage-dashboard-service.ts` (opción `month`, función `monthBounds`,
  campo `month` en la respuesta) y `packages/cli/src/serve/routes/usage-stats.ts` (`?month=AAAA-MM`).
- Base: `v0.28.0`. Sin cambios en el SDK: la Web Shell llama al endpoint directamente.
- Comportamiento: `?month=2026-10` devuelve el resumen y la serie diaria de ese mes (hora local).
  El heatmap no cambia. Un mes con formato incorrecto responde 400 `invalid_month`.
- Lo usa `/monthly AAAA-MM` de la Web Shell.

### Estado de compilación

- Compilación completa del monorepo (`node scripts/build.js`) **correcta** con heap de 7 GB y un swap de 8 GB
  añadido al entorno (la RAM física es de 4 GB; el swap es memoria virtual, más lenta).
- El daemon compilado es `packages/cli/dist/index.js` (`qwen 0.28.0`). Probado: `general.outputStyle` → 200,
  `ui.history.collapseOnResume` → 200, `tools.approvalMode` → 400 `disallowed_key`.
- Con el parche 0002 se recompilan `core` y `cli`: correcto.
- Prueba de extremo a extremo (navegador headless, daemon compilado con 0001 y 0002): `/monthly 2026-10` muestra la tarjeta del mes; `/monthly 2026-13` avisa de formato no válido; `/expand-on-resume` y `/collapse-on-resume` muestran su aviso de éxito.

### Pendiente

- Compilar el paquete del daemon en un entorno con más memoria y probar `/expand-on-resume` contra ese daemon.
- Abrir PR en upstream, o mantenerlo en el fork de qwen-code.
