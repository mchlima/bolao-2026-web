<script setup lang="ts">
// Tournament shell: a contextual header (back + badge + tournament name) with the
// section tabs (Jogos / Tabela / Bolão) as pill tags, then <NuxtPage>. Each tab is
// a nested route, so switching one swaps ONLY the page content — the header and
// tabs stay mounted. The base route redirects to Jogos (see index.vue), so there
// is no separate overview; the active tag marks the section instead of the title.
import type { Paginated, Tournament } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data: tournaments } = await useAsyncData('tournaments-list', () =>
  useApi()<Paginated<Tournament>>('/seasons?pageSize=100').then((r) => r.data),
  { getCachedData: cachedPayload },
);
const current = computed(
  () => (tournaments.value ?? []).find((t) => t.id === id) ?? null,
);
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const hubUrl = `${siteUrl}/futebol/torneios/${id}`;
useSeoMeta({
  title: () => (current.value ? `${current.value.name} — Cravei` : 'Torneio — Cravei'),
  description: () =>
    current.value
      ? `Jogos, tabela de classificação e ranking do bolão de ${current.value.name}. Palpite e acompanhe ao vivo.`
      : 'Jogos, tabela e ranking do torneio.',
  ogTitle: () => (current.value ? `${current.value.name} — Cravei` : 'Torneio — Cravei'),
  ogDescription: () =>
    current.value ? `Jogos, tabela e ranking de ${current.value.name}.` : 'Jogos, tabela e ranking do torneio.',
  ogUrl: hubUrl,
  twitterTitle: () => (current.value ? `${current.value.name} — Cravei` : 'Torneio — Cravei'),
  twitterDescription: () =>
    current.value ? `Jogos, tabela e ranking de ${current.value.name}.` : 'Jogos, tabela e ranking do torneio.',
});
// Breadcrumb: Início › Torneios › Nome. Keyed 'ld-graph' so the match view
// (rendered inside this shell) replaces it with its own SportsEvent + breadcrumb
// — avoids two BreadcrumbLists on a match page.
useHead({
  script: [
    {
      key: 'ld-graph',
      type: 'application/ld+json',
      innerHTML: () =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
            { '@type': 'ListItem', position: 2, name: 'Torneios', item: `${siteUrl}/futebol/torneios` },
            ...(current.value
              ? [{ '@type': 'ListItem', position: 3, name: current.value.name, item: hubUrl }]
              : []),
          ],
        }),
    },
  ],
});

// Active section from the route. The base path and /jogos both resolve to 'jogos',
// so the Jogos tag stays lit on the listing. A match detail (/jogos/<matchId>)
// resolves to 'match' (the shell header is hidden there).
const section = computed<string>(() => {
  const p = route.path;
  if (/\/jogos\/[^/]+/.test(p)) return 'match';
  if (p.endsWith('/classificacao')) return 'classificacao';
  if (p.endsWith('/ranking')) return 'ranking';
  return 'jogos';
});
const isMatch = computed(() => section.value === 'match');

// The Bolão tab stays visible when logged out — tapping it surfaces the login
// gate (a conversion prompt). The data itself is members-only: the route shows
// the gate and the API requires auth (see ranking.vue + rankings.controller).
const tabs = computed(() => [
  { key: 'jogos', label: 'Jogos', to: `/futebol/torneios/${id}` },
  { key: 'classificacao', label: 'Tabela', to: `/futebol/torneios/${id}/classificacao` },
  { key: 'ranking', label: 'Bolão', to: `/futebol/torneios/${id}/ranking` },
]);

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return (w[0]?.[0] ?? '') + (w[1]?.[0] ?? '');
}
</script>

<template>
  <div class="page" :class="{ 'page--flush': isMatch }">
    <header v-if="!isMatch" class="thead">
      <div class="trow">
        <NuxtLink :to="isMatch ? `/futebol/torneios/${id}` : '/futebol/torneios'" class="back" aria-label="Voltar">
          <AppIcon name="arrowLeft" :size="18" :stroke="2.4" />
        </NuxtLink>
        <TournamentBadge
          v-if="current && !isMatch"
          :name="current.name"
          :logo-url="current.competition?.logoUrl"
          :logo-url-dark="current.competition?.logoUrlDark"
          :size="38"
        />
        <div class="htitle">
          <span class="ht-main font-display">{{ current?.name ?? 'Torneio' }}</span>
        </div>
      </div>

      <!-- Section tabs: route-based pill tags; clicking swaps only <NuxtPage>. -->
      <nav v-if="!isMatch" class="ttabs" aria-label="Seções do torneio">
        <NuxtLink
          v-for="t in tabs"
          :key="t.key"
          :to="t.to"
          class="ttag"
          :class="{ on: section === t.key }"
          :aria-current="section === t.key ? 'page' : undefined"
        >
          {{ t.label }}
        </NuxtLink>
      </nav>
    </header>

    <NuxtPage />
  </div>
</template>

<style scoped>
.page {
  padding: 10px;
}
/* The match screen is full-bleed (the board paints edge-to-edge), so it opts out
   of the standardized page gutter. */
.page--flush {
  padding: 0;
}
.thead {
  position: sticky;
  /* <main> is the scroll container (app-shell), so stick at the top of its
     scrollport — the global header is outside <main>, above it. */
  top: 0;
  z-index: 30;
  background: var(--bg-base);
  /* Side gutter comes from .page; keep a small top inset so the bar still has
     breathing room once it sticks to the top. */
  padding: 6px 0 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.trow {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.back {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-left: -8px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.13s;
}
.back:hover {
  color: var(--text);
}
.brandmark {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--grad-pitch);
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}
.htitle {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ht-main {
  font-weight: 700;
  font-size: clamp(17px, 4.4vw, 24px);
  text-transform: uppercase;
  line-height: 1.05;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Section tabs — small pill tags. Active uses the pitch gradient, matching the
   tournament badge so the lit tag reads as "you're in this section". */
.ttabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  /* Side gutter comes from .page; tags scroll within it. */
}
.ttabs::-webkit-scrollbar {
  display: none;
}
.ttag {
  flex: none;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ttag:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.ttag.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
</style>
