// App-wide access gate + legacy-route redirects. The sporting content (hub,
// agenda, tournaments, matches) is PUBLIC under /futebol/*; predictions, pools
// and admin stay private. The personal home was merged into the portal home (/).
// Runs SSR + client (token in cookie).

// Public sporting content + the landing/auth/howto pages + the news section.
// Everything else private.
const PUBLIC_EXACT = new Set(['/', '/entrar', '/cadastro', '/como-funciona', '/sobre', '/autor/redacao', '/bolao-da-copa-do-mundo-2026', '/bolao-do-brasileirao', '/bolao-da-libertadores', '/bolao-da-copa-do-brasil', '/bolao-da-sudamericana', '/bolao-do-brasileirao-serie-b', '/copa-do-mundo-2026']);
const isPublicPath = (path: string): boolean =>
  PUBLIC_EXACT.has(path) ||
  path === '/futebol' ||
  path.startsWith('/futebol/') ||
  path === '/noticias' ||
  path.startsWith('/noticias/') ||
  // Ranking público do bolão por competição (BOLÃO > Ranking > <competição>).
  path.startsWith('/boloes/ranking/');

export default defineNuxtRouteMiddleware((to) => {
  // Legacy routes moved under the sport namespace — redirect (keeps old links/SEO).
  if (to.path === '/tournaments' || to.path.startsWith('/tournaments/')) {
    return navigateTo(to.fullPath.replace('/tournaments', '/futebol/torneios'), {
      redirectCode: 301,
    });
  }
  // /matches (lista) → /futebol/agenda; /matches/:id (detalhe) → /futebol/jogo/:id.
  if (to.path === '/matches') {
    return navigateTo({ path: '/futebol/agenda', query: to.query }, { redirectCode: 301 });
  }
  if (to.path.startsWith('/matches/')) {
    return navigateTo(to.fullPath.replace('/matches/', '/futebol/jogo/'), { redirectCode: 301 });
  }
  // News moved out of the sport namespace: /futebol/noticias → /noticias (the
  // section already has its own "Futebol" category, so the prefix was redundant).
  if (to.path === '/futebol/noticias' || to.path.startsWith('/futebol/noticias/')) {
    return navigateTo(to.fullPath.replace('/futebol/noticias', '/noticias'), {
      redirectCode: 301,
    });
  }
  // The agenda list moved from /futebol/jogos to /futebol/agenda; an old match
  // detail under /futebol/jogos/:id goes to the new /futebol/jogo/:id.
  if (to.path === '/futebol/jogos') {
    return navigateTo({ path: '/futebol/agenda', query: to.query }, { redirectCode: 301 });
  }
  if (to.path.startsWith('/futebol/jogos/')) {
    return navigateTo(to.fullPath.replace('/futebol/jogos/', '/futebol/jogo/'), { redirectCode: 301 });
  }
  // O detalhe da partida saiu de /futebol/agenda/:id para /futebol/jogo/:slug (URL
  // de SEO). A própria página de jogo faz o "upgrade" 301 de id→slug; aqui só movemos
  // o segmento. NÃO casa a lista (/futebol/agenda) nem ?scope= (sem subcaminho).
  {
    const am = to.path.match(/^\/futebol\/agenda\/(.+)$/);
    if (am) {
      return navigateTo({ path: `/futebol/jogo/${am[1]}`, query: to.query }, { redirectCode: 301 });
    }
  }
  // "Torneios" (slug de temporada) virou "Campeonato" (slug de competição). O detalhe
  // de partida (id) ainda mapeia direto pra agenda. O hub antigo era keyed por slug de
  // TEMPORADA e não resolve mais (sem fallback de redirect) — manda pra lista de
  // campeonatos em vez de 404, já que não dá pra mapear temporada→competição no client.
  if (to.path === '/futebol/torneios' || to.path.startsWith('/futebol/torneios/')) {
    const md = to.path.match(/^\/futebol\/torneios\/[^/]+\/(?:jogos|matches)\/([^/]+)\/?$/);
    if (md) {
      return navigateTo({ path: `/futebol/jogo/${md[1]}`, query: to.query }, { redirectCode: 301 });
    }
    return navigateTo({ path: '/futebol/campeonato', query: to.query }, { redirectCode: 301 });
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
  // Personal home merged into the portal home — keep old links/bookmarks working.
  if (to.path === '/home') return navigateTo('/');
  // A "posição pessoal" (/boloes/ranking) foi removida — manda pra área de bolões
  // (sem becos sem saída; o ranking público por competição vive em /boloes/ranking/:slug).
  if (to.path === '/boloes/ranking') return navigateTo('/boloes');

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
