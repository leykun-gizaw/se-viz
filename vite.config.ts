/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Python mode (Phase 29): the Pyodide worker is an ES module worker (it code-splits), and Vite's
  // dependency pre-bundling must leave Pyodide's loader alone (it resolves its own assets).
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['pyodide'] },
  server: {
    // Local Live Coding loop: the tracer backend has no CORS yet (its Phase 04), so the browser
    // can't call http://localhost:8080 cross-origin. Setting VITE_TRACER_URL=/tracer-api makes the
    // app call same-origin and the dev server forward it here. Dev-only; unused unless that path
    // is requested. See docs/LOCAL_LIVE_CODING.md.
    proxy: {
      '/tracer-api': {
        target: process.env.TRACER_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tracer-api/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
