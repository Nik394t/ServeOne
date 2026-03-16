'use client';

import { useEffect } from 'react';

function syncInstallAvailability() {
  window.dispatchEvent(new Event(window.__serveoneDeferredPrompt ? 'serveone:install-available' : 'serveone:install-unavailable'));
}

export function PwaRuntime() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      window.__serveoneDeferredPrompt = promptEvent;
      syncInstallAvailability();
    };

    const onAppInstalled = () => {
      window.__serveoneDeferredPrompt = null;
      window.dispatchEvent(new Event('serveone:installed'));
      syncInstallAvailability();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Service worker registration failed', error);
      });
    }

    syncInstallAvailability();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  return null;
}
