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
  },
});
