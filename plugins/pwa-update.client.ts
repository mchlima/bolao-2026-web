// Make a fresh deploy apply on Android without "clear app cache". The PWA is
// registerType 'autoUpdate', but two things were missing on an installed app:
//
//  1. DETECTION — the browser only re-checks sw.js on a full navigation or the
//     30-min poll. An installed Android PWA resumes the same WebView and routes
//     client-side, so it never re-checked. We force reg.update() on focus /
//     visibility-regain (throttled). We do NOT check on every in-app navigation:
//     that reloaded pages a few seconds into use; the 30-min poll is the backstop.
//
//  2. RELOAD — with skipWaiting the new SW takes control, but the page keeps
//     running the OLD JS in memory until it reloads; without that reload the
//     user still sees the old build (the symptom that "only clearing cache
//     fixed"). We reload exactly once when a NEW worker takes control.
//
// No-op in dev (SW disabled) and offline.
export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return;

  // Reload when an updated SW takes control. `controller` is set on a returning
  // visit (a SW already controls the page) → any later controller swap is an
  // update → reload. On a first-ever install the page starts uncontrolled and
  // the initial claim must NOT reload, so we gate on hadController. `refreshing`
  // guards against a double reload; the swap fires once per activation, so this
  // can't loop.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    // Loop breaker. Right after a deploy the CDN can briefly serve mixed old/new
    // sw.js across edge nodes, so consecutive reg.update() calls each look like a
    // fresh version → controllerchange → reload → repeat, and the page "blinks"
    // every few seconds. One reload is enough to pick up a deploy; refuse to
    // auto-reload again within the window so we can never loop.
    const KEY = 'pwa-last-reload';
    const since = Date.now() - Number(sessionStorage.getItem(KEY) || 0);
    if (since < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    refreshing = true;
    window.location.reload();
  });

  // Check for a new SW only when the app regains focus / visibility — that's when
  // an installed Android PWA resumes the same WebView, the case the 30-min poll
  // (periodicSyncForUpdates) can't catch quickly. We deliberately do NOT check on
  // every in-app navigation: that made pages reload a few seconds after opening,
  // mid-use.
  let last = 0;
  const check = async (): Promise<void> => {
    const now = Date.now();
    if (now - last < 30_000) return; // at most once per 30s
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
});
