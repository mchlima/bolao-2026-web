// App-wide access gate + legacy-route redirects. The sporting content (hub,
// agenda, tournaments, matches) is PUBLIC under /futebol/*; predictions, pools
// and admin stay private. The personal home was merged into the portal home (/).
// Runs SSR + client (token in cookie).

// Public sporting content + the landing/auth/howto pages + the news section.
// Everything else private.
const PUBLIC_EXACT = new Set(['/', '/entrar', '/cadastro', '/como-funciona']);
const isPublicPath = (path: string): boolean =>
  PUBLIC_EXACT.has(path) ||
  path === '/futebol' ||
  path.startsWith('/futebol/') ||
  path === '/noticias' ||
  path.startsWith('/noticias/');

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
  // News moved out of the sport namespace: /futebol/noticias → /noticias (the
  // section already has its own "Futebol" category, so the prefix was redundant).
  if (to.path === '/futebol/noticias' || to.path.startsWith('/futebol/noticias/')) {
    return navigateTo(to.fullPath.replace('/futebol/noticias', '/noticias'), {
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
  // English routes translated to Portuguese — keep old links, bookmarks and
  // already-shared invite links working. Preserve the query (e.g. ?redirect=).
  const PT_ALIAS: Record<string, string> = {
    '/login': '/entrar',
    '/register': '/cadastro',
    '/howto': '/como-funciona',
  };
  if (PT_ALIAS[to.path]) {
    return navigateTo({ path: PT_ALIAS[to.path], query: to.query }, { redirectCode: 301 });
  }
  // Pools became "boloes", with translated sub-segments (members→membros,
  // invites→convites, matches→jogos, join→convite). Map the whole subtree.
  if (to.path === '/pools' || to.path.startsWith('/pools/')) {
    const path = to.path
      .replace(/^\/pools\/join\//, '/boloes/convite/')
      .replace(/^\/pools/, '/boloes')
      .replace(/\/members(?=\/|$)/, '/membros')
      .replace(/\/invites(?=\/|$)/, '/convites')
      .replace(/\/matches(?=\/|$)/, '/jogos');
    return navigateTo({ path, query: to.query }, { redirectCode: 301 });
  }
  // Tournament match detail moved from .../matches/<id> to .../jogos/<id>.
  if (to.path.startsWith('/futebol/torneios/') && to.path.includes('/matches/')) {
    return navigateTo(
      { path: to.path.replace('/matches/', '/jogos/'), query: to.query },
      { redirectCode: 301 },
    );
  }
  // Personal home merged into the portal home — keep old links/bookmarks working.
  if (to.path === '/home') return navigateTo('/');

  const auth = useAuthStore();

  // No dead-ends: a logged-out visitor on a private route goes to login keeping
  // the destination, so they land back where they were after authenticating.
  if (!auth.token && !isPublicPath(to.path)) {
    return navigateTo(`/entrar?redirect=${encodeURIComponent(to.fullPath)}`);
  }
  if (auth.token && (to.path === '/entrar' || to.path === '/cadastro')) {
    return navigateTo('/');
  }
});
