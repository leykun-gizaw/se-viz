import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled (no runtime CDN call — satisfies the frontend-only / no-network constraint).
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/700.css';
import './index.css';
import App from './App.tsx';

// The pre-paint script in index.html resolves the theme (dark primary, persisted) before the
// bundle loads. This is a defensive fallback for environments where that script didn't run.
if (!document.documentElement.dataset.theme) {
  document.documentElement.dataset.theme = 'dark';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);

// Phase 29 spike: the Python tracer debug page, at `/?python-debug`, in dev only. `import.meta.env.DEV`
// is a build-time `false` in production, so this branch (and the page, the worker and Pyodide) is
// dropped from the production bundle entirely.
// Phase 30 adds `/?python-preview&trace=<name>` beside it: the committed Python traces in the real
// stage, without Pyodide (also dev only).
const devPage = new URLSearchParams(window.location.search);
if (import.meta.env.DEV && devPage.has('python-preview')) {
  void import('./python/debug/TracePreview.tsx').then(({ TracePreview }) =>
    root.render(
      <StrictMode>
        <TracePreview />
      </StrictMode>,
    ),
  );
} else if (import.meta.env.DEV && devPage.has('python-debug')) {
  void import('./python/debug/PythonDebugPage.tsx').then(({ PythonDebugPage }) =>
    root.render(
      <StrictMode>
        <PythonDebugPage />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
