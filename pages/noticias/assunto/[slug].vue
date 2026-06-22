<script setup lang="ts">
import type { NewsCard, Paginated, TermPage } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/noticias/assunto/${slug}`;

const { data: term, error } = await useAsyncData(`tag-${slug}`, () =>
  useApi()<TermPage>(`/content/tags/${slug}`),
);
if (error.value || !term.value) {
  throw createError({ statusCode: 404, statusMessage: 'Tag não encontrada', fatal: true });
}
const { data: list } = await useAsyncData(`tag-news-${slug}`, () =>
  useApi()<Paginated<NewsCard>>(`/content/news?tag=${encodeURIComponent(slug)}&pageSize=30`),
);
const items = computed(() => list.value?.data ?? []);
const t = term.value;
const seo = t.seo ?? {};
const heading = seo.heading || t.name;
const faq = seo.faq ?? [];

useSeoMeta({
  title: seo.metaTitle || `${t.name} — Notícias | Cravei`,
  description: seo.metaDescription || t.description || `Tudo sobre ${t.name}: notícias, resumos de jogos e análises. Acompanhe e palpite no bolão Cravei.`,
  ogTitle: seo.metaTitle || `${t.name} — Notícias`,
  ogDescription: seo.metaDescription || t.description || `Notícias sobre ${t.name}.`,
  ogUrl: url,
  ogType: 'website',
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-tag',
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
            { '@type': 'ListItem', position: 3, name: t.name, item: url },
          ],
        },
      }),
    },
    ...(faq.length
      ? [
          {
            key: 'ld-tag-faq',
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
    <nav class="crumbs">
      <NuxtLink to="/noticias">Notícias</NuxtLink>
      <span>›</span>
      <span>#{{ t.name }}</span>
    </nav>
    <header class="term-hero">
      <span class="term-kind">Assunto</span>
      <h1>{{ heading }}</h1>
      <p v-if="t.description">{{ t.description }}</p>
      <p class="term-count">{{ t.total }} {{ t.total === 1 ? 'matéria' : 'matérias' }}</p>
    </header>

    <NewsSectionNav />

    <p v-if="seo.intro" class="term-intro">{{ seo.intro }}</p>

    <NewsCardList v-if="items.length" :items="items" featured />
    <div v-else class="term-empty"><p>Nenhuma matéria publicada com esta tag ainda.</p></div>

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
.crumbs { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); margin-bottom: 14px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.term-hero { margin-bottom: 16px; }
.term-kind { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); }
.term-hero h1 { font-family: 'Oswald', sans-serif; font-size: clamp(26px, 5vw, 32px); font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 4px; }
.term-hero p { color: var(--muted); font-size: 14.5px; margin: 0; }
.term-count { font-size: 12.5px; margin-top: 6px !important; opacity: 0.8; }
.term-intro { font-size: 15px; line-height: 1.65; color: var(--text); margin: 0 0 22px; max-width: 70ch; }
.term-empty { padding: 60px 20px; text-align: center; color: var(--muted); }
.term-faq { margin-top: 34px; border-top: 1px solid var(--border); padding-top: 22px; }
.term-faq h2 { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; margin: 0 0 12px; }
.term-faq details { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; }
.term-faq summary { font-weight: 700; font-size: 14.5px; cursor: pointer; }
.term-faq details p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 8px 0 0; }
</style>
