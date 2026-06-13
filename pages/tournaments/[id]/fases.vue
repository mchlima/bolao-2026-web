<script setup lang="ts">
import type { BracketStage, Match, Paginated, StageStandings } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `phases-${id}`,
  async () => {
    const api = useApi();
    const [standings, bracket, matches] = await Promise.all([
      api<StageStandings[]>(`/seasons/${id}/standings`),
      api<BracketStage[]>(`/seasons/${id}/bracket`),
      // Group-stage fixtures for the per-group round cards. pageSize maxes at
      // 100; group matches are numbered before the knockout (matchNumber asc),
      // so the first 100 cover the whole group stage (72 for a World Cup).
      api<Paginated<Match>>(`/matches?seasonId=${id}&pageSize=100`),
    ]);
    return { standings, bracket, matches: matches.data };
  },
);
useRealtime(() => [`tournament:${id}`], () => refresh());

const hasData = computed(() => {
  const d = data.value;
  if (!d) return false;
  return (
    d.standings.some((s) => s.groups.some((g) => g.rows.length)) ||
    d.bracket.some((s) => s.rounds.some((r) => r.ties.length))
  );
});
</script>

<template>
  <div>
    <SkeletonList v-if="pending && !data" variant="row" :count="6" />
    <p v-else-if="error || !hasData" class="muted load">
      Estrutura do torneio indisponível.
    </p>
    <TournamentPhasesView
      v-else
      :standings="data!.standings"
      :bracket-stages="data!.bracket"
      :matches="data!.matches"
      :season-id="id"
    />
  </div>
</template>

<style scoped>
.load {
  padding: 2rem 0;
}
</style>
