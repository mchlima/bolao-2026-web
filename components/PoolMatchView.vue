<script setup lang="ts">
import type { Match, RankingResponse } from '~/types/api';

// Pool-scoped match companion. Same split as MatchRankingView: the hero/score owns
// the match fetch (always live, shown on every tab) while the "bolão" tab owns the
// pool-scoped ranking (refetched only while it's on screen). Predicting stays
// global (the board posts to /predictions); the privacy gate (others' guesses
// hidden before kickoff) lives in the API.
const props = defineProps<{ poolId: string; matchId: string }>();
const emit = defineEmits<{ back: [] }>();

const pools = usePools();
const api = useApi();

// Hero/score: visible on every tab → always-on.
const { data: match, pending, error, refresh: refreshMatch } = await useAsyncData(
  `match-${props.matchId}`,
  () => api<Match>(`/matches/${props.matchId}`),
);
useRealtime(() => [`match:${props.matchId}`], () => refreshMatch());

// Pool-scoped ranking: only live while the "bolão" tab is open.
const bolaoActive = ref(true);
const { data: ranking, refresh: refreshRanking } = await useAsyncData(
  `poolmatch-ranking-${props.poolId}-${props.matchId}`,
  () =>
    pools
      .matchRanking(props.poolId, props.matchId)
      .catch(() => null as RankingResponse | null),
);
useRealtime(
  () => (bolaoActive.value ? [`match:${props.matchId}`] : []),
  () => refreshRanking(),
);
watch(bolaoActive, (a) => {
  if (a) refreshRanking();
});

function onRefresh() {
  refreshMatch();
  refreshRanking();
}
</script>

<template>
  <div class="mfill">
    <SkeletonList v-if="pending && !match" variant="match" :count="1" />
    <p v-else-if="error || !match" class="muted load">Partida indisponível.</p>
    <MatchRankingBoard
      v-else
      :match="match"
      :ranking="ranking"
      title="Ranking da partida · membros"
      back-label="Resultados"
      @back="emit('back')"
      @refresh="onRefresh"
      @tab="bolaoActive = $event === 'bolao'"
    />
  </div>
</template>

<style scoped>
.load { padding: 2rem 0; }
</style>
