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

// Light is the default theme; the toggle flips data-theme on <html>.
if (!document.documentElement.dataset.theme) {
  document.documentElement.dataset.theme = 'light';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
