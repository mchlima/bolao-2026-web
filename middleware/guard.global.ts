// App-wide access gate + legacy-route redirects. The sporting content (hub,
// agenda, tournaments, matches) is PUBLIC under /futebol/*; predictions, pools
// and admin stay private. The personal home was merged into the portal home (/).
// Runs SSR + client (token in cookie).

// Public sporting content + the landing/auth/howto pages. Everything else private.
const PUBLIC_EXACT = new Set(['/', '/login', '/register', '/howto']);
const isPublicPath = (path: string): boolean =>
  PUBLIC_EXACT.has(path) || path === '/futebol' || path.startsWith('/futebol/');

export default defineNuxtRouteMiddleware((to) => {
  // Legacy routes moved under the sport namespace — redirect (keeps old links/SEO).
  if (to.path === '/tournaments' || to.path.startsWith('/tournaments/')) {
    return navigateTo(to.fullPath.replace('/tournaments', '/futebol/torneios'), {
      redirectCode: 301,
    });
  }
  if (to.path === '/matches' || to.path.startsWith('/matches/')) {
    return navigateTo(to.fullPath.replace('/matches', '/futebol/agenda'), {
      redirectCode: 301,
    });
  }
  // The agenda moved from /futebol/jogos to /futebol/agenda — keep old links,
  // bookmarks and already-sent notification deep-links working.
  if (to.path === '/futebol/jogos' || to.path.startsWith('/futebol/jogos/')) {
    return navigateTo(to.fullPath.replace('/futebol/jogos', '/futebol/agenda'), {
      redirectCode: 301,
    });
  }
  // Personal home merged into the portal home — keep old links/bookmarks working.
  if (to.path === '/home') return navigateTo('/');

  const auth = useAuthStore();

  // No dead-ends: a logged-out visitor on a private route goes to login keeping
  // the destination, so they land back where they were after authenticating.
  if (!auth.token && !isPublicPath(to.path)) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`);
  }
  if (auth.token && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/');
  }
});
