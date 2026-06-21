<script setup lang="ts">
import type { NewsCard, Paginated, TermPage } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/futebol/noticias/tag/${slug}`;

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

useSeoMeta({
  title: `${t.name} — Notícias | Cravei`,
  description: t.description || `Tudo sobre ${t.name}: notícias, resumos de jogos e análises. Acompanhe e palpite no bolão Cravei.`,
  ogTitle: `${t.name} — Notícias`,
  ogDescription: t.description || `Notícias sobre ${t.name}.`,
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
        name: `${t.name} — Notícias`,
        url,
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Notícias', item: `${siteUrl}/futebol/noticias` },
            { '@type': 'ListItem', position: 3, name: t.name, item: url },
          ],
        },
      }),
    },
  ],
});
</script>

<template>
  <div class="term-page">
    <nav class="crumbs">
      <NuxtLink to="/futebol/noticias">Notícias</NuxtLink>
      <span>›</span>
      <span>#{{ t.name }}</span>
    </nav>
    <header class="term-hero">
      <span class="term-kind">Tag</span>
      <h1>{{ t.name }}</h1>
      <p v-if="t.description">{{ t.description }}</p>
      <p class="term-count">{{ t.total }} {{ t.total === 1 ? 'matéria' : 'matérias' }}</p>
    </header>

    <NewsCardList v-if="items.length" :items="items" />
    <div v-else class="term-empty"><p>Nenhuma matéria publicada com esta tag ainda.</p></div>
  </div>
</template>

<style scoped>
.term-page { max-width: 960px; margin: 0 auto; padding: 8px 0 32px; }
.crumbs { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); margin-bottom: 16px; }
.crumbs a { color: var(--azure); text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.term-hero { margin-bottom: 22px; }
.term-kind { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); }
.term-hero h1 { font-family: 'Oswald', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 4px; }
.term-hero p { color: var(--muted); font-size: 14.5px; margin: 0; }
.term-count { font-size: 12.5px; margin-top: 6px !important; opacity: 0.8; }
.term-empty { padding: 60px 20px; text-align: center; color: var(--muted); }
</style>
