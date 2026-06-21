<script setup lang="ts">
import type { NewsCard, Paginated } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const listUrl = `${siteUrl}/futebol/noticias`;

const { data } = await useAsyncData('public-news', () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=30'),
);
const items = computed(() => data.value?.data ?? []);

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

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

    <div v-if="items.length" class="news-grid">
      <NuxtLink v-for="n in items" :key="n.slug" :to="`/futebol/noticias/${n.slug}`" class="ncard">
        <span v-if="n.category" class="ncat">{{ n.category }}</span>
        <h2 class="ntitle">{{ n.title }}</h2>
        <p v-if="n.dek" class="ndek">{{ n.dek }}</p>
        <div class="nmeta">
          <time :datetime="n.publishedAt">{{ fmtDate(n.publishedAt) }}</time>
          <span v-if="n.source" class="nsrc">· {{ n.source }}</span>
        </div>
      </NuxtLink>
    </div>
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
.news-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.ncard { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-surface); text-decoration: none; color: var(--text); transition: border-color 0.15s, transform 0.15s; }
.ncard:hover { border-color: var(--azure); transform: translateY(-2px); }
.ncat { align-self: flex-start; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); }
.ntitle { font-family: 'Oswald', sans-serif; font-size: 19px; font-weight: 700; line-height: 1.25; margin: 0; }
.ndek { font-size: 13.5px; line-height: 1.5; color: var(--muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nmeta { margin-top: auto; font-size: 12px; color: var(--muted); display: flex; gap: 5px; }
.nsrc { opacity: 0.8; }
.news-empty { padding: 60px 20px; text-align: center; color: var(--muted); }
</style>
