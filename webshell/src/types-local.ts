// Tipos de adjuntos del prompt. El SDK no los reexporta desde el entry "daemon",
// así que se declaran aquí con la misma forma que espera `sendPrompt`.
export interface PromptImage {
  data: string;
  mimeType?: string;
}

export interface PromptFile {
  name: string;
  text?: string;
  mimeType?: string;
}
