/**
 * GA4 page-view tracking. gtag.js doesn't track client-side route changes on its
 * own, and the nuxt.config loader sets send_page_view:false, so this plugin is the
 * single source of page views: it sends the initial one and one per navigation.
 *
 * The /admin/* back-office is intentionally excluded — it's an internal tool and
 * shouldn't pollute the public-traffic analytics.
 */
import type { RouteLocationNormalized } from 'vue-router';

const isTracked = (path: string) => path !== '/admin' && !path.startsWith('/admin/');

export default defineNuxtPlugin(() => {
  const router = useRouter();
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };

  const send = (route: RouteLocationNormalized) => {
    if (!isTracked(route.path)) return;
    w.gtag?.('event', 'page_view', {
      page_path: route.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    });
  };

  // Initial load (replaces the page view the gtag config call used to auto-send).
  let lastPath = router.currentRoute.value.fullPath;
  send(router.currentRoute.value);

  router.afterEach((to) => {
    if (to.fullPath === lastPath) return;
    lastPath = to.fullPath;
    send(to);
  });
});
