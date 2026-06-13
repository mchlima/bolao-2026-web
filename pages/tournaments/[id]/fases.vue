<script setup lang="ts">
import type { BracketStage, StageStandings } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `phases-${id}`,
  async () => {
    const api = useApi();
    const [standings, bracket] = await Promise.all([
      api<StageStandings[]>(`/seasons/${id}/standings`),
      api<BracketStage[]>(`/seasons/${id}/bracket`),
    ]);
    return { standings, bracket };
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
    />
  </div>
</template>

<style scoped>
.load {
  padding: 2rem 0;
}
</style>
