/**
 * GA4 SPA page-view tracking. The gtag loader + initial page view live in
 * nuxt.config (app.head, production only); gtag.js doesn't track client-side
 * route changes on its own, so we send a page_view on each navigation after the
 * first (the first is the one already sent by the config call — deduped by path).
 */
export default defineNuxtPlugin(() => {
  const router = useRouter();
  let lastPath = router.currentRoute.value.fullPath;
  router.afterEach((to) => {
    if (to.fullPath === lastPath) return;
    lastPath = to.fullPath;
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    w.gtag?.('event', 'page_view', {
      page_path: to.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    });
  });
});
