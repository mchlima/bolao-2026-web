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
  const auth = useAuthStore();
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };

  const send = (route: RouteLocationNormalized) => {
    if (!isTracked(route.path)) return;
    // Admin logado NÃO gera page_view — não infla as métricas de tráfego.
    if (auth.isAdmin) return;
    w.gtag?.('event', 'page_view', {
      page_path: route.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    });
  };

  let lastPath = router.currentRoute.value.fullPath;

  // O 1º page_view ESPERA o /auth/me resolver. Numa sessão ativa, disparar antes
  // de saber que é admin deixaria essa page view escapar do corte (a causa do
  // "page_view de admin contando"). Fallback de 4s caso o /me trave.
  let firstSent = false;
  const sendFirst = () => {
    if (firstSent) return;
    firstSent = true;
    send(router.currentRoute.value);
  };
  if (auth.isAuthenticated && !auth.user) {
    const stop = watch(
      () => auth.user,
      (u) => {
        if (u) {
          stop();
          sendFirst();
        }
      },
    );
    setTimeout(() => {
      stop();
      sendFirst();
    }, 4000);
  } else {
    sendFirst();
  }

  router.afterEach((to) => {
    if (to.fullPath === lastPath) return;
    lastPath = to.fullPath;
    send(to);
  });
});
