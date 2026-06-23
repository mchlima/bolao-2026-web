<script setup lang="ts">
import type { NewsCard, Paginated } from '~/types/api';

// Capa editorial de notícias (tipográfica — o pipeline não tem imagem): manchete +
// chamadas, faixas por categoria (só com volume — degradação graciosa) e a grade
// "últimas" com carregar mais. Cor por categoria + tempo relativo dão a hierarquia.
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const listUrl = `${siteUrl}/noticias`;

const { data } = await useAsyncData('public-news', () =>
  useApi()<Paginated<NewsCard>>('/content/news?pageSize=40'),
);
const items = computed<NewsCard[]>(() => data.value?.data ?? []);

// Manchete (1ª — featured-first vindo da API) + chamadas (próximas 4).
const lead = computed<NewsCard | null>(() => items.value[0] ?? null);
const secondary = computed<NewsCard[]>(() => items.value.slice(1, 5));

// Faixas por categoria a partir do que SOBRA (sem repetir manchete/chamadas): só
// categorias com ≥4 matérias viram editoria; o resto cai em "Últimas".
const RAIL_MIN = 4;
const RAIL_TAKE = 4;
const MAX_RAILS = 3;
const rails = computed(() => {
  const shown = new Set([lead.value?.slug, ...secondary.value.map((s) => s.slug)].filter(Boolean));
  const pool = items.value.filter((i) => !shown.has(i.slug));
  const groups = new Map<string, { name: string; slug: string; items: NewsCard[] }>();
  for (const it of pool) {
    if (!it.category) continue;
    const g = groups.get(it.category.slug) ?? { name: it.category.name, slug: it.category.slug, items: [] };
    g.items.push(it);
    groups.set(it.category.slug, g);
  }
  return [...groups.values()]
    .filter((g) => g.items.length >= RAIL_MIN)
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, MAX_RAILS)
    .map((g) => ({ ...g, items: g.items.slice(0, RAIL_TAKE) }));
});

// Últimas = tudo que sobrou (fora da manchete/chamadas/faixas), com carregar mais.
const latest = computed<NewsCard[]>(() => {
  const shown = new Set<string>([lead.value?.slug, ...secondary.value.map((s) => s.slug)].filter(Boolean) as string[]);
  for (const r of rails.value) for (const it of r.items) shown.add(it.slug);
  return items.value.filter((i) => !shown.has(i.slug));
});
const shownCount = ref(9);
const latestShown = computed(() => latest.value.slice(0, shownCount.value));
const hasMore = computed(() => latest.value.length > shownCount.value);

// Cor de acento por categoria (hash estável → paleta da marca).
const PALETTE = ['var(--azure)', 'var(--emerald)', 'var(--gold)', 'var(--magenta)', 'var(--scarlet)'];
function catColor(slug?: string | null): string {
  if (!slug) return 'var(--azure)';
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
// Tempo relativo ("há 2 h"), caindo pra data quando passa de uma semana.
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 7) return `há ${d} d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
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
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: items.value.slice(0, 20).map((it, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${siteUrl}/noticias/${it.slug}`,
              name: it.title,
            })),
          },
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
    <!-- MANCHETE + CHAMADAS -->
    <section v-if="lead" class="lead" :class="{ solo: !secondary.length }">
      <NuxtLink :to="`/noticias/${lead.slug}`" class="lead-main" :class="{ 'has-img': lead.coverUrl }" :style="{ '--c': catColor(lead.category?.slug) }">
        <div v-if="lead.coverUrl" class="lead-img"><img :src="lead.coverUrl" :alt="lead.imageAlt || lead.title" /></div>
        <div class="lead-top">
          <span v-if="lead.category" class="ncat">{{ lead.category.name }}</span>
          <span class="nbadge">Destaque</span>
        </div>
        <h2 class="lead-title">{{ lead.title }}</h2>
        <p v-if="lead.dek" class="lead-dek">{{ lead.dek }}</p>
        <div class="nfoot">
          <time :datetime="lead.publishedAt">{{ ago(lead.publishedAt) }}</time>
          <span v-if="lead.source" class="nsrc">· {{ lead.source }}</span>
          <span v-for="t in lead.tags.slice(0, 3)" :key="t.slug" class="ntag">{{ t.name }}</span>
        </div>
      </NuxtLink>

      <aside v-if="secondary.length" class="lead-side">
        <NuxtLink
          v-for="s in secondary"
          :key="s.slug"
          :to="`/noticias/${s.slug}`"
          class="side-item"
          :style="{ '--c': catColor(s.category?.slug) }"
        >
          <span v-if="s.category" class="ncat sm">{{ s.category.name }}</span>
          <h3 class="side-title">{{ s.title }}</h3>
          <time class="side-time" :datetime="s.publishedAt">{{ ago(s.publishedAt) }}</time>
        </NuxtLink>
      </aside>
    </section>

    <!-- EDITORIAS POR CATEGORIA (só com volume) -->
    <section v-for="rail in rails" :key="rail.slug" class="rail">
      <div class="rail-head">
        <h2 class="rail-title" :style="{ '--c': catColor(rail.slug) }">{{ rail.name }}</h2>
        <NuxtLink :to="`/noticias/categoria/${rail.slug}`" class="rail-all">Ver mais <AppIcon name="chevronRight" :size="14" :stroke="2.5" /></NuxtLink>
      </div>
      <div class="cardgrid">
        <NuxtLink
          v-for="a in rail.items"
          :key="a.slug"
          :to="`/noticias/${a.slug}`"
          class="ncard"
          :style="{ '--c': catColor(a.category?.slug) }"
        >
          <div v-if="a.coverUrl" class="ncard-img"><img :src="a.coverUrl" :alt="a.imageAlt || a.title" loading="lazy" /></div>
          <span v-if="a.category" class="ncat">{{ a.category.name }}</span>
          <h3 class="ncard-title">{{ a.title }}</h3>
          <p v-if="a.dek" class="ncard-dek">{{ a.dek }}</p>
          <time class="ncard-time" :datetime="a.publishedAt">{{ ago(a.publishedAt) }}</time>
        </NuxtLink>
      </div>
    </section>

    <!-- ÚLTIMAS -->
    <section v-if="latestShown.length" class="latest">
      <h2 class="latest-h">Últimas</h2>
      <div class="cardgrid">
        <NuxtLink
          v-for="a in latestShown"
          :key="a.slug"
          :to="`/noticias/${a.slug}`"
          class="ncard"
          :style="{ '--c': catColor(a.category?.slug) }"
        >
          <div v-if="a.coverUrl" class="ncard-img"><img :src="a.coverUrl" :alt="a.imageAlt || a.title" loading="lazy" /></div>
          <span v-if="a.category" class="ncat">{{ a.category.name }}</span>
          <h3 class="ncard-title">{{ a.title }}</h3>
          <p v-if="a.dek" class="ncard-dek">{{ a.dek }}</p>
          <time class="ncard-time" :datetime="a.publishedAt">{{ ago(a.publishedAt) }}</time>
        </NuxtLink>
      </div>
      <button v-if="hasMore" class="more" @click="shownCount += 9">Carregar mais</button>
    </section>

    <div v-if="!lead" class="news-empty">
      <AppIcon name="inbox" :size="34" :stroke="1.6" />
      <h2>Ainda não há notícias publicadas</h2>
      <p>Estamos preparando os primeiros resumos e análises. Volte em breve.</p>
      <NuxtLink to="/futebol/agenda" class="btn btn-primary">Ver a agenda de jogos</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.news-page { width: 100%; padding: 8px 16px 48px; }

/* etiqueta de categoria (acento por --c) e badge destaque */
.ncat { align-self: flex-start; font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c, var(--azure)); }
.ncat.sm { font-size: 11px; }
.nbadge { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold); border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent); border-radius: 20px; padding: 1px 8px; }

/* MANCHETE + CHAMADAS */
.lead { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; margin-bottom: 30px; }
.lead.solo { grid-template-columns: 1fr; }
@media (max-width: 820px) { .lead { grid-template-columns: 1fr; } }
.lead-main { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 26px 28px; border: 1px solid var(--border); border-left: 4px solid var(--c, var(--azure)); border-radius: 16px; background: var(--bg-elevated, var(--bg-surface)); text-decoration: none; color: var(--text); transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
.lead-main:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.lead-main.has-img { padding-top: 0; }
.lead-img { margin: 0 -28px 10px; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 14px 14px 0 0; background: var(--bg-base); }
.lead-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lead-top { display: flex; align-items: center; gap: 10px; }
.lead-title { font-family: 'Oswald', sans-serif; font-size: clamp(22px, 3.4vw, 34px); font-weight: 700; line-height: 1.16; letter-spacing: -0.01em; margin: 0; }
.lead-dek { font-size: 15.5px; line-height: 1.55; color: var(--muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nfoot { margin-top: auto; padding-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.nsrc { opacity: 0.8; }
.ntag { font-size: 11px; font-weight: 600; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 1px 9px; }

.lead-side { display: flex; flex-direction: column; gap: 10px; }
.side-item { display: flex; flex-direction: column; gap: 5px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 13px; background: var(--bg-surface); text-decoration: none; color: var(--text); transition: border-color 0.15s, transform 0.15s; }
.side-item:hover { border-color: color-mix(in srgb, var(--c, var(--azure)) 45%, var(--border)); transform: translateY(-1px); }
.side-title { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 600; line-height: 1.25; margin: 0; }
.side-time { font-size: 11.5px; color: var(--muted); }

/* FAIXAS + GRADE */
.rail { margin: 30px 0; }
.rail-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.rail-title { font-family: 'Oswald', sans-serif; font-size: clamp(18px, 2.6vw, 23px); font-weight: 700; text-transform: uppercase; margin: 0; padding-left: 12px; border-left: 4px solid var(--c, var(--azure)); }
.rail-all { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 700; color: var(--azure); white-space: nowrap; }

.cardgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.ncard { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 18px 18px 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-surface); text-decoration: none; color: var(--text); overflow: hidden; transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }
.ncard::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--c, var(--azure)); transform: scaleY(0); transform-origin: top; transition: transform 0.18s ease; }
.ncard:hover { border-color: color-mix(in srgb, var(--c, var(--azure)) 45%, var(--border)); transform: translateY(-2px); box-shadow: var(--shadow); }
.ncard:hover::before { transform: scaleY(1); }
.ncard-img { margin: -18px -18px 8px; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 13px 13px 0 0; background: var(--bg-base); }
.ncard-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ncard-title { font-family: 'Oswald', sans-serif; font-size: 17px; font-weight: 600; line-height: 1.25; margin: 0; }
.ncard-dek { font-size: 13px; line-height: 1.5; color: var(--muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ncard-time { margin-top: auto; font-size: 11.5px; color: var(--muted); }

.latest { margin-top: 34px; }
.latest-h { font-family: 'Oswald', sans-serif; font-size: clamp(18px, 2.6vw, 23px); font-weight: 700; text-transform: uppercase; margin: 0 0 14px; }
.more { display: block; margin: 24px auto 0; padding: 11px 26px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-surface); color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.more:hover { border-color: var(--azure); color: var(--azure); }

.news-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 64px 24px; text-align: center; color: var(--muted); border: 1px dashed var(--border); border-radius: 18px; }
.news-empty h2 { font-family: 'Oswald', sans-serif; font-size: 21px; font-weight: 700; color: var(--text); margin: 4px 0 0; }
.news-empty p { font-size: 14px; margin: 0; max-width: 42ch; }
.news-empty .btn { margin-top: 8px; }
</style>
