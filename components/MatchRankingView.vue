<script setup lang="ts">
import type { Match, RankingResponse } from '~/types/api';

// Tournament-wide match companion. Responsibilities are split so the heavy ranking
// query doesn't run for viewers sitting on another tab:
//  • the hero/score (header, shown on EVERY tab) owns the match fetch → always live;
//  • the "bolão" tab owns the global ranking → refetched only while it's on screen.
// Both feed the shared MatchRankingBoard. Rendered standalone (/matches/:id) and
// inside the tournament layout (/tournaments/:id/matches/:matchId).
const props = withDefaults(
  defineProps<{ matchId: string; backLabel?: string; hideBack?: boolean }>(),
  { backLabel: 'Voltar', hideBack: false },
);
const emit = defineEmits<{ back: [] }>();
const api = useApi();

// Hero/score: the header is visible on every tab, so its stream stays always-on.
const { data: match, pending, error, refresh: refreshMatch } = await useAsyncData(
  `match-${props.matchId}`,
  () => api<Match>(`/matches/${props.matchId}`),
);
useRealtime(() => [`match:${props.matchId}`], () => refreshMatch());

// Ranking: a heavy aggregate (every prediction) — only live while "bolão" is open.
const bolaoActive = ref(true);
const { data: ranking, refresh: refreshRanking } = await useAsyncData(
  `ranking-${props.matchId}`,
  () => api<RankingResponse>(`/matches/${props.matchId}/ranking`),
);
useRealtime(
  () => (bolaoActive.value ? [`match:${props.matchId}`] : []),
  () => refreshRanking(),
);
watch(bolaoActive, (a) => {
  if (a) refreshRanking();
});

// A user-driven change (saving a palpite) updates the ranking; refresh both so the
// header (provisional points) and the table stay in sync.
function onRefresh() {
  refreshMatch();
  refreshRanking();
}

// Dynamic SEO from the fetched match (covers /futebol/agenda/:id and the
// tournament-scoped match route, both of which render this component).
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const seoMatchup = computed(() => {
  const m = match.value;
  if (!m) return null;
  const home = m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir';
  const away = m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir';
  return `${home} x ${away}`;
});
// The same match is reachable from /futebol/agenda/:id and the tournament-scoped
// route → one canonical (tournament-scoped when it has a season) so search engines
// don't see duplicate content.
const canonicalUrl = computed(() => {
  const m = match.value;
  if (!m) return siteUrl;
  return m.seasonId
    ? `${siteUrl}/futebol/torneios/${m.seasonId}/jogos/${m.id}`
    : `${siteUrl}/futebol/agenda/${m.id}`;
});
const seoTitle = computed(() => (seoMatchup.value ? `${seoMatchup.value} — Cravei` : 'Partida — Cravei'));
const seoDesc = computed(() =>
  seoMatchup.value
    ? `Palpite em ${seoMatchup.value}, veja o placar ao vivo, escalações, estatísticas e o ranking do bolão.`
    : 'Palpites, placar ao vivo e ranking da partida.',
);
useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDesc.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDesc.value,
  ogUrl: () => canonicalUrl.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDesc.value,
});
// Structured data: SportsEvent (rich event result — teams, kickoff, venue) +
// BreadcrumbList (Início › Torneio › Jogo).
const matchJsonLd = computed(() => {
  const m = match.value;
  if (!m) return '';
  const home = m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir';
  const away = m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir';
  const statusMap: Record<string, string> = {
    POSTPONED: 'EventPostponed',
    CANCELLED: 'EventCancelled',
  };
  const event: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${home} x ${away}`,
    sport: 'Soccer',
    startDate: m.kickoffAt,
    eventStatus: `https://schema.org/${statusMap[m.status] ?? 'EventScheduled'}`,
    url: canonicalUrl.value,
    homeTeam: { '@type': 'SportsTeam', name: home, ...(m.homeTeam?.logoUrl ? { logo: m.homeTeam.logoUrl } : {}) },
    awayTeam: { '@type': 'SportsTeam', name: away, ...(m.awayTeam?.logoUrl ? { logo: m.awayTeam.logoUrl } : {}) },
  };
  if (m.stadium) {
    event.location = {
      '@type': 'Place',
      name: m.stadium.name,
      address: [m.stadium.city, m.stadium.country].filter(Boolean).join(', '),
    };
  }
  if (m.season?.name) event.superEvent = { '@type': 'SportsEvent', name: m.season.name };
  const crumbs: Record<string, unknown>[] = [
    { '@type': 'ListItem', position: 1, name: 'Início', item: siteUrl },
  ];
  if (m.seasonId && m.season?.name) {
    crumbs.push({
      '@type': 'ListItem',
      position: 2,
      name: m.season.name,
      item: `${siteUrl}/futebol/torneios/${m.seasonId}`,
    });
  }
  crumbs.push({
    '@type': 'ListItem',
    position: crumbs.length + 1,
    name: `${home} x ${away}`,
    item: canonicalUrl.value,
  });
  return JSON.stringify([event, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs }]);
});
useHead({
  link: [{ rel: 'canonical', key: 'canonical', href: () => canonicalUrl.value }],
  // Keyed 'ld-graph' to replace the tournament shell's breadcrumb on match routes.
  script: [{ key: 'ld-graph', type: 'application/ld+json', innerHTML: () => matchJsonLd.value }],
});
</script>

<template>
  <div class="mfill">
    <SkeletonList v-if="pending && !match" variant="match" :count="1" />
    <p v-else-if="error || !match" class="muted load">Partida não encontrada.</p>
    <MatchRankingBoard
      v-else
      :match="match"
      :ranking="ranking"
      title="Ranking da partida"
      :back-label="backLabel"
      :hide-back="hideBack"
      @back="emit('back')"
      @refresh="onRefresh"
      @tab="bolaoActive = $event === 'bolao'"
    >
      <template v-if="$slots.classificacao" #classificacao>
        <slot name="classificacao" />
      </template>
    </MatchRankingBoard>
  </div>
</template>

<style scoped>
.load { padding: 2rem 0; }
</style>
