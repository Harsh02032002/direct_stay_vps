import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Auto-recover if the browser tab is running a stale cached JS bundle after a server rebuild
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = String(event?.message || '');
    if (
      msg.includes('is not defined') ||
      msg.includes('before initialization') ||
      msg.includes('Failed to fetch dynamically imported module')
    ) {
      const lastReload = Number(sessionStorage.getItem('ds_stale_bundle_reload') || '0');
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem('ds_stale_bundle_reload', String(Date.now()));
        window.location.reload();
      }
    }
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    React.createElement(StrictMode, null, React.createElement(App))
  );
}
