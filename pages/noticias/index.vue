<script setup lang="ts">
import type { NewsCard, Paginated } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const listUrl = `${siteUrl}/noticias`;

const { data } = await useAsyncData('public-news', () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=30'),
);
const items = computed(() => data.value?.data ?? []);

useSeoMeta({
  title: 'Notícias do futebol — Cravei',
  description: 'Resumos de jogos, análises e notícias do futebol: Copa do Mundo, Brasileirão e mais. Acompanhe e dê seus palpites no bolão Cravei.',
  ogTitle: 'Notícias do futebol — Cravei',
  ogDescription: 'Resumos de jogos, análises e notícias do futebol. Acompanhe e palpite no bolão.',
  ogUrl: listUrl,
  ogType: 'website',
});
useHead({
  link: [{ rel: 'canonical', href: listUrl }],
  script: [
    {
      key: 'ld-news-list',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Notícias do futebol',
          url: listUrl,
          isPartOf: { '@type': 'WebSite', name: 'Cravei', url: siteUrl },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Notícias', item: listUrl },
            ],
          },
        }),
    },
  ],
});
</script>

<template>
  <div class="news-page">
    <header class="news-hero">
      <h1>Notícias</h1>
      <p>Resumos de jogos, análises e o que rolou no futebol.</p>
    </header>

    <NewsCardList v-if="items.length" :items="items" />
    <div v-else class="news-empty">
      <p>Ainda não há notícias publicadas. Volte em breve!</p>
    </div>
  </div>
</template>

<style scoped>
.news-page { max-width: 960px; margin: 0 auto; padding: 8px 0 32px; }
.news-hero { margin-bottom: 22px; }
.news-hero h1 { font-family: 'Oswald', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 4px; }
.news-hero p { color: var(--muted); font-size: 14.5px; margin: 0; }
.news-empty { padding: 60px 20px; text-align: center; color: var(--muted); }
</style>
