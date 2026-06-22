// Google News sitemap: SÓ matérias recentes (últimas 48h), com <news:news> +
// publication_date + título. É o que o Google News / Top stories consome (separado
// do /sitemap.xml geral). Submeta no Search Console e referencie no robots.txt.
// Servido em /news-sitemap.xml. Cache curto (frescor de notícia).

const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;

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

  let items: { slug: string; title: string; publishedAt: string }[] = [];
  try {
    const news = await $fetch<{
      data: { slug: string; title: string; publishedAt?: string }[];
    }>(`${api}/content/news?pageSize=100`);
    const cutoff = Date.now() - NEWS_WINDOW_MS;
    items = (news.data ?? [])
      .filter((n) => n.slug && n.publishedAt && new Date(n.publishedAt).getTime() >= cutoff)
      .map((n) => ({ slug: n.slug, title: n.title, publishedAt: n.publishedAt as string }));
  } catch {
    /* API indisponível → sitemap vazio (válido). */
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ...items.map(
      (n) =>
        `  <url><loc>${base}/noticias/${xmlEscape(n.slug)}</loc>` +
        `<news:news><news:publication><news:name>Cravei</news:name><news:language>pt</news:language></news:publication>` +
        `<news:publication_date>${n.publishedAt}</news:publication_date>` +
        `<news:title>${xmlEscape(n.title)}</news:title></news:news></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');

  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  setHeader(event, 'cache-control', 'public, max-age=300, s-maxage=300');
  return body;
});
