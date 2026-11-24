import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Auto-recover if the browser tab is running a stale cached JS bundle after a server rebuild
if (typeof window !== 'undefined') {
  // Prevent mouse wheel from inadvertently stepping or resetting numbers, dates, and times when scrolling forms/modals
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        active.tagName === 'INPUT' &&
        ['number', 'date', 'datetime-local', 'time', 'month', 'week'].includes(
          (active as HTMLInputElement).type
        )
      ) {
        active.blur();
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.tagName === 'INPUT' &&
        ['number', 'date', 'datetime-local', 'time', 'month', 'week'].includes(
          (target as HTMLInputElement).type
        )
      ) {
        target.blur();
      }
    },
    { capture: true, passive: true }
  );

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
