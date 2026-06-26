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
    const params: Record<string, unknown> = {
      page_path: route.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    };
    // Admin → marca `traffic_type:'internal'`; o filtro "Internal Traffic" do GA4
    // exclui (mesmo parâmetro/filtro que os eventos — controle no painel).
    if (auth.isAdmin) params.traffic_type = 'internal';
    w.gtag?.('event', 'page_view', params);
  };

  let lastPath = router.currentRoute.value.fullPath;

  // O 1º page_view ESPERA o /auth/me resolver. Numa sessão de admin, disparar
  // antes de saber que é admin mandaria a page view SEM a marca interna (a causa
  // de o page_view de admin escapar do filtro). Fallback de 4s caso o /me trave.
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
