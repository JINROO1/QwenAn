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

### Pendiente

- Aplicar el parche sobre el código fuente del fork y compilar el paquete del daemon.
- Abrir PR en upstream, o mantenerlo en el fork de qwen-code.
