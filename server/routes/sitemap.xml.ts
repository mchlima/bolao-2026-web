// Dynamic sitemap of the PUBLIC (logged-out) pages only. Mirrors the access gate
// in middleware/guard.global.ts: the marketing/howto home plus everything under
// /futebol/* (agenda, tournaments, matches) is public; pools, profile, settings,
// notifications and admin require a token and are deliberately left out. Login/
// register are reachable but are utility pages (not indexable content), so they
// are excluded here and disallowed in robots.txt.
//
// Tournaments and matches are dynamic, so we pull them from the public API at
// request time (kept fresh) and fall back to the static URLs if the API is
// unreachable. <lastmod> uses the real updatedAt (the only sitemap field Google
// honors); <image:image> lists the crests / competition logo / stadium photo that
// appear on each page (helps image search). Served at /sitemap.xml.

type SitemapUrl = {
  loc: string;
  priority: number;
  changefreq: string;
  lastmod?: string;
  images?: string[];
};

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const base = String(config.public.siteUrl).replace(/\/$/, '');
  const api = String(config.public.apiBase).replace(/\/$/, '');

  const urls: SitemapUrl[] = [
    { loc: '/', priority: 1.0, changefreq: 'daily' },
    { loc: '/como-funciona', priority: 0.8, changefreq: 'monthly' },
    { loc: '/futebol/agenda', priority: 0.8, changefreq: 'hourly' },
    { loc: '/futebol/torneios', priority: 0.7, changefreq: 'daily' },
    { loc: '/noticias', priority: 0.8, changefreq: 'daily' },
    { loc: '/noticias/categoria', priority: 0.6, changefreq: 'weekly' },
    { loc: '/noticias/assunto', priority: 0.5, changefreq: 'weekly' },
  ];

  // Tournaments → each public hub + its standings / matches / ranking tabs.
  try {
    const seasons = await $fetch<{
      data: {
        id: string;
        updatedAt?: string;
        logoUrl?: string | null;
        competition?: { logoUrl?: string | null } | null;
      }[];
    }>(`${api}/seasons?pageSize=100`);
    for (const s of seasons.data ?? []) {
      const logo = s.competition?.logoUrl ?? s.logoUrl ?? null;
      urls.push(
        {
          loc: `/futebol/torneios/${s.id}`,
          priority: 0.7,
          changefreq: 'daily',
          lastmod: s.updatedAt,
          images: logo ? [logo] : undefined,
        },
        { loc: `/futebol/torneios/${s.id}/classificacao`, priority: 0.6, changefreq: 'daily', lastmod: s.updatedAt },
        { loc: `/futebol/torneios/${s.id}/jogos`, priority: 0.6, changefreq: 'daily', lastmod: s.updatedAt },
        { loc: `/futebol/torneios/${s.id}/ranking`, priority: 0.5, changefreq: 'daily', lastmod: s.updatedAt },
      );
    }
  } catch {
    /* API down — keep the static URLs above. */
  }

  // Matches → the canonical match URL (tournament-scoped when the match belongs to
  // a season, matching MatchList's link), with crests + stadium photo as images.
  try {
    const agenda = await $fetch<{
      days: {
        matches: {
          id: string;
          seasonId?: string | null;
          updatedAt?: string;
          homeTeam?: { logoUrl?: string | null } | null;
          awayTeam?: { logoUrl?: string | null } | null;
          stadium?: { photoUrl?: string | null } | null;
        }[];
      }[];
    }>(`${api}/agenda?scope=all`);
    for (const day of agenda.days ?? []) {
      for (const m of day.matches ?? []) {
        const images = [m.homeTeam?.logoUrl, m.awayTeam?.logoUrl, m.stadium?.photoUrl].filter(
          (u): u is string => !!u,
        );
        urls.push({
          loc: m.seasonId
            ? `/futebol/torneios/${m.seasonId}/jogos/${m.id}`
            : `/futebol/agenda/${m.id}`,
          priority: 0.5,
          changefreq: 'hourly',
          lastmod: m.updatedAt,
          images: images.length ? images : undefined,
        });
      }
    }
  } catch {
    /* keep what we have. */
  }

  // News → each published article (organic-traffic surface). lastmod = updatedAt
  // (reflete edições/republicação), com fallback p/ publishedAt.
  try {
    const news = await $fetch<{
      data: { slug: string; publishedAt?: string; updatedAt?: string }[];
    }>(`${api}/content/news?pageSize=100`);
    for (const n of news.data ?? []) {
      if (!n.slug) continue;
      urls.push({
        loc: `/noticias/${n.slug}`,
        priority: 0.6,
        changefreq: 'weekly',
        lastmod: n.updatedAt ?? n.publishedAt,
      });
    }
  } catch {
    /* keep what we have. */
  }

  // Categorias e tags com matéria publicada → páginas de agregação (SEO).
  try {
    const [cats, tags] = await Promise.all([
      $fetch<{ slug: string }[]>(`${api}/content/categories`),
      $fetch<{ slug: string }[]>(`${api}/content/tags`),
    ]);
    for (const c of cats ?? []) {
      if (c.slug) urls.push({ loc: `/noticias/categoria/${c.slug}`, priority: 0.5, changefreq: 'weekly' });
    }
    for (const t of tags ?? []) {
      if (t.slug) urls.push({ loc: `/noticias/assunto/${t.slug}`, priority: 0.4, changefreq: 'weekly' });
    }
  } catch {
    /* keep what we have. */
  }

  // De-dupe by loc and render.
  const seen = new Set<string>();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls
      .filter((u) => (seen.has(u.loc) ? false : seen.add(u.loc)))
      .map((u) => {
        const imgs = (u.images ?? [])
          .map((i) => `<image:image><image:loc>${xmlEscape(i)}</image:loc></image:image>`)
          .join('');
        return (
          `  <url><loc>${base}${u.loc}</loc>` +
          (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '') +
          `<changefreq>${u.changefreq}</changefreq>` +
          `<priority>${u.priority.toFixed(1)}</priority>` +
          imgs +
          `</url>`
        );
      }),
    '</urlset>',
    '',
  ].join('\n');

  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=3600, s-maxage=3600');
  return body;
});
