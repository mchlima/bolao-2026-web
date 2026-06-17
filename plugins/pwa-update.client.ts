// Make a fresh deploy apply promptly. The PWA uses registerType 'autoUpdate',
// but the browser only re-checks the service worker on a full navigation or the
// 30-min periodic poll — so an installed app kept open (client-side routing
// only) can sit on the old build for up to half an hour, and a plain reload may
// still be served the old precached bundle until the SW updates. Here we nudge
// the SW to check for a new version whenever the app regains focus and on every
// in-app navigation; autoUpdate then activates it and reloads once. update() is
// a cheap conditional request (304 when unchanged), throttled so rapid
// navigations don't hammer it. No-op in dev (SW disabled) and when offline.
export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return;

  let last = 0;
  const check = async (): Promise<void> => {
    const now = Date.now();
    if (now - last < 10_000) return; // at most once per 10s
    last = now;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    } catch {
      /* offline or no registration yet — ignore */
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.addEventListener('focus', () => void check());
  useRouter().afterEach(() => void check());
});
