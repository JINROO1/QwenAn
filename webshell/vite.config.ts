import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hosts de preview permitidos: el sandbox publica el preview en subdominios de e2b.app.
const previewHosts = ['.e2b.app', 'localhost', '127.0.0.1'];

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: el build puede servirse desde un WebView local.
  base: './',
  server: { host: '0.0.0.0', allowedHosts: previewHosts },
  preview: { host: '0.0.0.0', allowedHosts: previewHosts },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    // El punto de entrada de @qwen-code/web-shell/daemon-react-sdk pesa ~1,7 MB;
    // los visores pesados (diagramas, hojas de cálculo, vista previa) ya son
    // fragmentos diferidos. Partirlo más requiere cambios en el paquete upstream.
    chunkSizeWarningLimit: 1800,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          return undefined;
        },
      },
    },
  },
});
