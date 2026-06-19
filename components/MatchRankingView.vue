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
const seoMatchup = computed(() => {
  const m = match.value;
  if (!m) return null;
  const home = m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir';
  const away = m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir';
  return `${home} x ${away}`;
});
useSeoMeta({
  title: () => (seoMatchup.value ? `${seoMatchup.value} — Cravei` : 'Partida — Cravei'),
  description: () =>
    seoMatchup.value
      ? `Palpites, placar ao vivo e ranking da partida ${seoMatchup.value}.`
      : 'Palpites, placar ao vivo e ranking da partida.',
  ogTitle: () => (seoMatchup.value ? `${seoMatchup.value} — Cravei` : 'Partida — Cravei'),
  ogDescription: () =>
    seoMatchup.value
      ? `Placar ao vivo e ranking dos palpites de ${seoMatchup.value}.`
      : 'Placar ao vivo e ranking dos palpites.',
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
