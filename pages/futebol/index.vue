<script setup lang="ts">
// Hub da seção Futebol — a "home" do pilar. Snapshot curado: Ao vivo + Hoje no
// topo, depois os CAMPEONATOS como cards (cada um deep-linka pra temporada vigente
// via activeSeason) + Seleções, e "Agenda completa" pro feed inteiro. É o ímã de
// links internos da seção (SEO) e a porta do fluxo "ver jogos do campeonato X".
import type { Competition, Match, Paginated } from '~/types/api';

const siteUrl = String(useRuntimeConfig().public.siteUrl);
const seoTitle = 'Futebol — jogos, campeonatos e tabelas | Cravei';
const seoDesc =
  'Acompanhe o futebol no Cravei: jogos de hoje e ao vivo, a agenda completa, os campeonatos (Copa do Mundo 2026, Brasileirão e mais), tabelas e seleções.';
useSeoMeta({
  title: seoTitle,
  description: seoDesc,
  ogTitle: seoTitle,
  ogDescription: seoDesc,
  ogUrl: `${siteUrl}/futebol`,
  twitterTitle: seoTitle,
  twitterDescription: seoDesc,
});
useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/futebol` }],
  script: [
    {
      key: 'ld-futebol',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Futebol',
        description: seoDesc,
        url: `${siteUrl}/futebol`,
      }),
    },
  ],
});

// Ao vivo + Hoje (snapshot leve, não o feed inteiro).
const { data: live, refresh: refreshLive } = await useAsyncData('fut-live', () =>
  useApi()<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=live'),
);
const { data: today, refresh: refreshToday } = await useAsyncData('fut-today', () =>
  useApi()<{ days: { date: string; matches: Match[] }[] }>('/agenda?scope=today'),
);
const liveMatches = computed<Match[]>(() => (live.value?.days ?? []).flatMap((d) => d.matches));
const liveIds = computed(() => new Set(liveMatches.value.map((m) => m.id)));
const todayMatches = computed<Match[]>(() =>
  (today.value?.days ?? []).flatMap((d) => d.matches).filter((m) => !liveIds.value.has(m.id)),
);

// Campeonatos (data-driven). Só os que têm temporada pública resolvível; ONGOING
// primeiro, depois por nome. activeSeason.slug é o deep-link do hub do campeonato.
const { data: comps } = await useAsyncData('fut-comps', () =>
  useApi()<Paginated<Competition>>('/competitions?pageSize=100'),
);
const championships = computed(() => {
  const list = (comps.value?.data ?? []).filter((c) => c.activeSeason?.slug);
  const rank = (c: Competition) => (c.activeSeason?.status === 'ONGOING' ? 0 : c.activeSeason?.status === 'UPCOMING' ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR'));
});
function statusLabel(s?: string | null): string {
  if (s === 'ONGOING') return 'Em andamento';
  if (s === 'UPCOMING') return 'Em breve';
  if (s === 'FINISHED') return 'Encerrado';
  return '';
}

// Reflete mudanças ao vivo dos jogos do topo.
const channels = computed(() =>
  [...new Set([...liveMatches.value, ...todayMatches.value].map((m) => m.seasonId).filter(Boolean))].map(
    (id) => `tournament:${id}`,
  ),
);
useRealtime(
  () => channels.value,
  () => {
    refreshLive();
    refreshToday();
  },
);
</script>

<template>
  <div class="fut">
    <FutebolSectionNav />
    <PageHero
      pillar="Futebol"
      title="Futebol"
      subtitle="Jogos, campeonatos e tabelas — tudo num lugar."
      :crumbs="[{ name: 'Início', to: '/' }, { name: 'Futebol' }]"
    />

    <!-- AO VIVO -->
    <section v-if="liveMatches.length" class="fsec">
      <header class="fhead"><span class="lvdot" />Ao vivo</header>
      <MatchCard :matches="liveMatches" show-season />
    </section>

    <!-- HOJE -->
    <section v-if="todayMatches.length" class="fsec">
      <header class="fhead">
        <span class="fh-main">Jogos de hoje</span>
        <NuxtLink to="/futebol/agenda" class="fh-link">Agenda completa →</NuxtLink>
      </header>
      <MatchCard :matches="todayMatches" show-season />
    </section>
    <section v-else class="fsec">
      <header class="fhead">
        <span class="fh-main">Agenda</span>
      </header>
      <NuxtLink to="/futebol/agenda" class="fbig">
        <AppIcon name="calendar" :size="20" :stroke="2" />
        <span>
          <strong>Agenda completa</strong>
          <small>Todos os jogos, dia a dia</small>
        </span>
        <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="fbig-go" />
      </NuxtLink>
    </section>

    <!-- CAMPEONATOS -->
    <section class="fsec">
      <header class="fhead">
        <span class="fh-main">Campeonatos</span>
        <NuxtLink to="/futebol/campeonato" class="fh-link">Ver todos →</NuxtLink>
      </header>
      <div class="cgrid">
        <NuxtLink
          v-for="c in championships"
          :key="c.id"
          :to="`/futebol/campeonato/${c.urlSlug}`"
          class="ccard"
        >
          <TournamentBadge :name="c.name" :logo-url="c.logoUrl" :logo-url-dark="c.logoUrlDark" :size="40" />
          <span class="cc-body">
            <strong class="cc-name">{{ c.activeSeason!.name }}</strong>
            <span class="cc-status" :class="c.activeSeason!.status?.toLowerCase()">
              {{ statusLabel(c.activeSeason!.status) }}
            </span>
          </span>
          <AppIcon name="chevronRight" :size="17" :stroke="2.4" class="cc-go" />
        </NuxtLink>

        <!-- Seleções -->
        <NuxtLink to="/futebol/selecoes" class="ccard">
          <span class="cc-emoji">🌎</span>
          <span class="cc-body">
            <strong class="cc-name">Seleções</strong>
            <span class="cc-status">Times nacionais</span>
          </span>
          <AppIcon name="chevronRight" :size="17" :stroke="2.4" class="cc-go" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fut {
  width: 100%;
  padding: 10px 16px 40px;
}
.fsec {
  margin-bottom: 26px;
}
.fhead {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.fh-main {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: var(--fs-base);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--text);
}
.fh-link {
  margin-left: auto;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--azure);
  text-decoration: none;
}
.fhead .lvdot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--scarlet) 22%, transparent);
  animation: liveDot 1.1s ease-in-out infinite;
}
.fhead:has(.lvdot) {
  color: var(--scarlet);
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.fbig {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--bg-surface);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.fbig:hover {
  border-color: color-mix(in srgb, var(--azure) 45%, var(--border));
  box-shadow: var(--shadow);
}
.fbig > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fbig strong {
  font-size: var(--fs-base);
  font-weight: 700;
}
.fbig small {
  font-size: var(--fs-xs);
  color: var(--muted);
}
.fbig-go {
  margin-left: auto;
  color: var(--muted);
}
.cgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.ccard {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--bg-surface);
  color: var(--text);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.ccard:hover {
  border-color: color-mix(in srgb, var(--azure) 45%, var(--border));
  box-shadow: var(--shadow);
}
.cc-emoji {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  font-size: var(--fs-2xl);
  border-radius: 11px;
  background: var(--bg-base);
  border: 1px solid var(--border);
}
.cc-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cc-name {
  font-size: var(--fs-sm);
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-status {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.cc-status.ongoing {
  color: var(--emerald);
}
.cc-go {
  flex: none;
  color: var(--muted);
}
</style>
