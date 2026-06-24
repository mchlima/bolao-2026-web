<script setup lang="ts">
import type { Competition, NewsCard, Paginated, TermPage } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/noticias/categoria/${slug}`;

const { data: term, error } = await useAsyncData(`cat-${slug}`, () =>
  useApi()<TermPage>(`/content/categories/${slug}`),
);
if (error.value || !term.value) {
  throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada', fatal: true });
}
const { data: list } = await useAsyncData(`cat-news-${slug}`, () =>
  useApi()<Paginated<NewsCard>>(`/content/news?category=${encodeURIComponent(slug)}&pageSize=30`),
);
const items = computed(() => list.value?.data ?? []);
const t = term.value;
const seo = t.seo ?? {};
const heading = seo.heading || t.name;
const faq = seo.faq ?? [];

// DESTAQUE da Copa do Mundo (fileira de cards quadrados) — mesmo componente da
// home. Monta a season a partir da competição vigente da Copa. Falha silenciosa.
const { data: comps } = await useAsyncData('copa-spotlight', () =>
  useApi()<Paginated<Competition>>('/competitions?pageSize=100')
    .then((r) => r.data ?? [])
    .catch(() => [] as Competition[]),
);
const spotlightSeason = computed(() => {
  const c = (comps.value ?? []).find((x) => /copa do mundo/i.test(x.name));
  const s = c?.activeSeason;
  if (!c || !s) return null;
  return { id: s.id, name: s.name, slug: s.slug, status: s.status, competition: { name: c.name, urlSlug: c.urlSlug } };
});

// Mesma trilha das páginas de Futebol (Início › Notícias › … categoria).
const crumbs = computed(() => {
  const path = t.path ?? [{ name: t.name, slug: t.slug }];
  return [
    { name: 'Início', to: '/' },
    { name: 'Notícias', to: '/noticias' },
    ...path.map((p, i) => ({
      name: p.name,
      to: i < path.length - 1 ? `/noticias/categoria/${p.slug}` : undefined,
    })),
  ];
});

useSeoMeta({
  title: seo.metaTitle || `${t.name} — Notícias | Cravei`,
  description: seo.metaDescription || t.description || `Notícias e resumos de jogos de ${t.name}. Acompanhe e palpite no bolão Cravei.`,
  ogTitle: seo.metaTitle || `${t.name} — Notícias`,
  ogDescription: seo.metaDescription || t.description || `Notícias de ${t.name}.`,
  ogUrl: url,
  ogType: 'website',
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-cat',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seo.metaTitle || `${t.name} — Notícias`,
        url,
        ...(seo.intro || t.description ? { description: seo.intro || t.description } : {}),
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Notícias', item: `${siteUrl}/noticias` },
            ...(t.path ?? [{ name: t.name, slug: t.slug }]).map((p, i) => ({
              '@type': 'ListItem',
              position: 3 + i,
              name: p.name,
              item: `${siteUrl}/noticias/categoria/${p.slug}`,
            })),
          ],
        },
      }),
    },
    ...(faq.length
      ? [
          {
            key: 'ld-cat-faq',
            type: 'application/ld+json',
            innerHTML: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faq.map((q) => ({
                '@type': 'Question',
                name: q.question,
                acceptedAnswer: { '@type': 'Answer', text: q.answer },
              })),
            }),
          },
        ]
      : []),
  ],
});
</script>

<template>
  <div class="term-page">
    <PageHero pillar="Notícias" :title="heading" :crumbs="crumbs" />

    <section v-if="spotlightSeason" class="spot-sec">
      <EventSpotlight :season="spotlightSeason" />
    </section>

    <p v-if="seo.intro" class="term-intro">{{ seo.intro }}</p>

    <NewsCardList v-if="items.length" :items="items" featured />
    <div v-else class="term-empty"><p>Nenhuma matéria publicada nesta categoria ainda.</p></div>

    <section v-if="faq.length" class="term-faq">
      <h2>Perguntas frequentes</h2>
      <details v-for="(q, i) in faq" :key="i">
        <summary>{{ q.question }}</summary>
        <p>{{ q.answer }}</p>
      </details>
    </section>
  </div>
</template>

<style scoped>
.term-page { width: 100%; padding: 8px 16px 40px; }
.spot-sec { margin-bottom: 24px; }
.term-intro { font-size: var(--fs-base); line-height: 1.65; color: var(--text); margin: 0 0 22px; max-width: 70ch; }
.term-empty { padding: 60px 20px; text-align: center; color: var(--muted); }
.term-faq { margin-top: 34px; border-top: 1px solid var(--border); padding-top: 22px; }
.term-faq h2 { font-family: 'Oswald', sans-serif; font-size: var(--fs-2xl); font-weight: 700; margin: 0 0 12px; }
.term-faq details { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; }
.term-faq summary { font-weight: 700; font-size: var(--fs-sm); cursor: pointer; }
.term-faq details p { color: var(--muted); font-size: var(--fs-sm); line-height: 1.6; margin: 8px 0 0; }
</style>
