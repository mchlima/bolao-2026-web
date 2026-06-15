<script setup lang="ts">
import type { Match, RankingResponse } from '~/types/api';

// Pool-scoped match companion: fetches the match + pool-scoped ranking and hands
// them to the shared MatchRankingBoard. Predicting stays global (the board posts
// to /predictions); the privacy gate (others' guesses hidden before kickoff)
// lives in the API.
const props = defineProps<{ poolId: string; matchId: string }>();
const emit = defineEmits<{ back: [] }>();

const pools = usePools();

const { data, pending, error, refresh } = await useAsyncData(
  `poolmatch-${props.poolId}-${props.matchId}`,
  async () => {
    const api = useApi();
    const [match, ranking] = await Promise.all([
      api<Match>(`/matches/${props.matchId}`),
      pools
        .matchRanking(props.poolId, props.matchId)
        .catch(() => null as RankingResponse | null),
    ]);
    return { match, ranking };
  },
);
useRealtime(() => [`match:${props.matchId}`], () => refresh());
</script>

<template>
  <div>
    <SkeletonList v-if="pending && !data" variant="match" :count="1" />
    <p v-else-if="error || !data?.match" class="muted load">Partida indisponível.</p>
    <template v-else>
      <MatchRankingBoard
        :match="data.match"
        :ranking="data.ranking"
        title="Ranking da partida · membros"
        back-label="Resultados"
        @back="emit('back')"
        @refresh="refresh"
      />
      <MatchLineup :match="data.match" />
    </template>
  </div>
</template>

<style scoped>
.load { padding: 2rem 0; }
</style>
