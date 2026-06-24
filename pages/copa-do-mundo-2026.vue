<script setup lang="ts">
import type { Match, NewsCard, Paginated, Tournament } from '~/types/api';

// Hub editorial da Copa — página-ímã de tráfego orgânico ("tudo sobre a Copa"):
// agrega jogos de hoje, grupos, tabela, seleções, onde assistir e as últimas
// notícias. Distinta da landing de bolão (conversão) e do hub de DADOS do torneio
// (/futebol/campeonato/...). Self-canonical, fortemente cross-linkada.
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const url = `${siteUrl}/copa-do-mundo-2026`;

// Resolve a edição da Copa (por slug; fallback p/ torneio ONGOING ou que casa "copa").
const { data: copa } = await useAsyncData('copa-hub-season', async () => {
  const api = useApi();
  const bySlug = await api<Paginated<Tournament>>('/seasons?slug=copa-do-mundo-2026')
    .then((r) => r.data[0] ?? null)
    .catch(() => null);
  if (bySlug) return bySlug;
  const list = await api<Paginated<Tournament>>('/seasons?pageSize=20').then((r) => r.data).catch(() => []);
  return list.find((t) => t.status === 'ONGOING') ?? list.find((t) => /copa/i.test(t.name)) ?? null;
});
const seasonId = computed(() => copa.value?.id ?? '');
// Hub do campeonato pela COMPETIÇÃO (urlSlug persistido ou derivado do nome).
const hubBase = computed(() => competitionHref(copa.value?.competition) ?? '/futebol/campeonato/copa-do-mundo');
const cleanName = computed(() => (copa.value?.name ?? 'Copa do Mundo 2026').replace(/\bFIFA\b/gi, '').replace(/\s+/g, ' ').trim());
const broadcasters = computed(() => copa.value?.broadcasters ?? []);

const { data: matchesData } = await useAsyncData('copa-hub-matches', () =>
  seasonId.value
    ? useApi()<Paginated<Match>>(`/matches?seasonId=${seasonId.value}&page=1&pageSize=100`).then((r) => r.data).catch(() => [] as Match[])
    : Promise.resolve([] as Match[]),
);
const { data: newsData } = await useAsyncData('copa-hub-news', () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=7').then((r) => r.data).catch(() => [] as NewsCard[]),
);
const news = computed<NewsCard[]>(() => newsData.value ?? []);

const now = useNow();
const games = computed<Match[]>(() => {
  const all = matchesData.value ?? [];
  const live = all.filter((m) => m.status === 'LIVE');
  const upcoming = all
    .filter((m) => m.status === 'SCHEDULED' && new Date(m.kickoffAt).getTime() >= now.value - 2 * 3600_000)
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  return [...live, ...upcoming].slice(0, 6);
});

const shortcuts = computed(() => [
  { label: 'Jogos de hoje', to: '/futebol/jogos-de-hoje' },
  { label: 'Jogos', to: `${hubBase.value}/jogos` },
  { label: 'Tabela', to: `${hubBase.value}/tabela` },
  { label: 'Seleções', to: '/futebol/selecoes' },
]);

const seoTitle = 'Copa do Mundo 2026: jogos de hoje, grupos, tabela e onde assistir | Cravei';
const seoDesc =
  'Tudo sobre a Copa do Mundo 2026: jogos de hoje e ao vivo, grupos, tabela de classificação, seleções, onde assistir e as últimas notícias — e o bolão pra palpitar com os amigos.';
useSeoMeta({
  title: seoTitle, description: seoDesc,
  ogTitle: seoTitle, ogDescription: seoDesc, ogUrl: url, ogType: 'website',
  twitterTitle: seoTitle, twitterDescription: seoDesc,
});
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [
    {
      key: 'ld-copa-hub',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Copa do Mundo 2026',
          url,
          inLanguage: 'pt-BR',
          isPartOf: { '@type': 'WebSite', name: 'Cravei', url: siteUrl },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
              { '@type': 'ListItem', position: 2, name: 'Copa do Mundo 2026', item: url },
            ],
          },
        }),
    },
  ],
});
</script>

<template>
  <div class="copa">
    <header class="copa-hero">
      <span class="eyebrow">Copa do Mundo</span>
      <h1 class="font-display">{{ cleanName }}</h1>
      <p class="lead">
        Jogos de hoje e ao vivo, grupos, tabela, seleções e onde assistir — tudo num lugar.
        E crave seus palpites no bolão.
      </p>

      <nav class="sc-links">
        <NuxtLink v-for="s in shortcuts" :key="s.to" :to="s.to" class="sc-chip">{{ s.label }}</NuxtLink>
      </nav>

      <div v-if="broadcasters.length" class="watch">
        <span class="watch-lbl">Onde assistir:</span>
        <template v-for="(b, i) in broadcasters" :key="i">
          <a v-if="b.url" :href="b.url" target="_blank" rel="noopener" class="watch-link">{{ b.name }}</a>
          <span v-else class="watch-name">{{ b.name }}</span>
        </template>
      </div>
    </header>

    <section v-if="games.length" class="copa-sec">
      <div class="sec-head">
        <h2 class="font-display">Jogos</h2>
        <NuxtLink to="/futebol/jogos-de-hoje" class="sec-all">Jogos de hoje <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <MatchCard :matches="games" />
    </section>

    <section v-if="news.length" class="copa-sec">
      <div class="sec-head">
        <h2 class="font-display">Notícias da Copa</h2>
        <NuxtLink to="/noticias" class="sec-all">Todas as notícias <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <NewsCardList :items="news" featured />
    </section>

    <section class="copa-sec">
      <BolaoCtaBand
        headline="Bolão da Copa do Mundo 2026 com a galera"
        sub="Palpite nos 104 jogos, pontue pela precisão do placar e dispute o ranking ao vivo. Grátis."
      />
    </section>
  </div>
</template>

<style scoped>
.copa { width: 100%; padding: 8px 16px 40px; }
.copa-hero {
  border: 1px solid color-mix(in srgb, var(--emerald) 24%, var(--border));
  border-radius: 22px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 9%, var(--bg-surface)), color-mix(in srgb, var(--azure) 7%, var(--bg-surface)) 75%);
  padding: clamp(22px, 4vw, 36px);
  margin-bottom: 24px;
}
.eyebrow { font-size: var(--fs-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--azure); }
.copa-hero h1 { font-size: clamp(1.875rem, 6vw, 3rem); font-weight: 700; line-height: 1; text-transform: uppercase; margin: 8px 0 10px; }
.lead { color: var(--muted); font-size: var(--fs-base); line-height: 1.55; max-width: 62ch; margin: 0 0 16px; }
.sc-links { display: flex; flex-wrap: wrap; gap: 8px; }
.sc-chip {
  font-size: var(--fs-sm); font-weight: 700; color: var(--text);
  background: var(--bg-surface); border: 1px solid var(--border); border-radius: 999px;
  padding: 8px 15px; text-decoration: none; transition: border-color 0.14s, color 0.14s;
}
.sc-chip:hover { border-color: var(--emerald); color: var(--emerald); }
.watch { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--fs-sm); }
.watch-lbl { font-weight: 700; color: var(--muted); }
.watch-link { color: var(--azure); font-weight: 700; text-decoration: none; }
.watch-link:hover { text-decoration: underline; }
.watch-name { font-weight: 700; }

.copa-sec { margin: 26px 0; }
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.sec-head h2 { font-weight: 600; font-size: clamp(1.1875rem, 3vw, 1.625rem); text-transform: uppercase; }
.sec-all { display: inline-flex; align-items: center; gap: 2px; font-size: var(--fs-sm); font-weight: 700; color: var(--azure); white-space: nowrap; }
</style>
