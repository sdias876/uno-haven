import { useEffect, useState } from 'react';

// Captures the browser's "install this app" prompt so we can offer a simple button.
let deferred = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()); });
}

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** { canInstall, iosHint, install } — iosHint: Safari has no prompt, so we show instructions instead. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  const installed = isStandalone();
  return {
    installed,
    canInstall: !installed && !!deferred,
    iosHint: !installed && !deferred && isIOS(),
    async install() {
      if (!deferred) return false;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      subs.forEach((f) => f());
      return outcome === 'accepted';
    },
  };
}
