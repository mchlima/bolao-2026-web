<script setup lang="ts">
import type { NewsCard, Paginated, TermPage } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const listUrl = `${siteUrl}/noticias`;

const { data } = await useAsyncData('public-news', () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=30'),
);
// categorias para os chips de descoberta (falha silenciosa: descoberta é secundária)
const { data: cats } = await useAsyncData('public-news-cats', () =>
  useApi()<TermPage[]>('/content/categories').catch(() => [] as TermPage[]),
);
const items = computed(() => data.value?.data ?? []);
const topCats = computed(() => (cats.value ?? []).slice(0, 8));

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
      <span class="kicker">Cravei</span>
      <h1>Notícias</h1>
      <p>Resumos de jogos, análises e o que rolou no futebol — direto pra você palpitar.</p>
    </header>

    <NewsSectionNav />

    <div v-if="topCats.length" class="quick-cats">
      <NuxtLink
        v-for="c in topCats"
        :key="c.slug"
        :to="`/noticias/categoria/${c.slug}`"
        class="qc"
      >
        {{ c.name }}<span class="qc-n">{{ c.total }}</span>
      </NuxtLink>
    </div>

    <NewsCardList v-if="items.length" :items="items" featured />

    <div v-else class="news-empty">
      <AppIcon name="inbox" :size="34" :stroke="1.6" />
      <h2>Ainda não há notícias publicadas</h2>
      <p>Estamos preparando os primeiros resumos e análises. Volte em breve.</p>
      <NuxtLink to="/futebol/agenda" class="btn btn-primary">Ver a agenda de jogos</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.news-page { max-width: 980px; margin: 0 auto; padding: 8px 16px 40px; }
.news-hero { margin-bottom: 18px; }
.kicker { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--azure); }
.news-hero h1 { font-family: 'Oswald', sans-serif; font-size: clamp(28px, 6vw, 38px); font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 5px; }
.news-hero p { color: var(--muted); font-size: 14.5px; line-height: 1.5; margin: 0; max-width: 60ch; }

.quick-cats { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.qc {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 13px; font-weight: 700; color: var(--text);
  text-decoration: none; padding: 6px 12px;
  border: 1px solid var(--border); border-radius: 20px; background: var(--bg-surface);
  transition: border-color 0.15s, color 0.15s;
}
.qc:hover { border-color: var(--azure); color: var(--azure); }
.qc-n { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--bg-base); border-radius: 20px; padding: 0 7px; }

.news-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 64px 24px; text-align: center; color: var(--muted);
  border: 1px dashed var(--border); border-radius: 18px;
}
.news-empty h2 { font-family: 'Oswald', sans-serif; font-size: 21px; font-weight: 700; color: var(--text); margin: 4px 0 0; }
.news-empty p { font-size: 14px; margin: 0; max-width: 42ch; }
.news-empty .btn { margin-top: 8px; }
</style>
