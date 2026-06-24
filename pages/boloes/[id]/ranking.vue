<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const pools = usePools();

// ?run=<id> views a past temporada's (frozen) ranking; default is the current.
const runId = computed(() => (route.query.run as string) || undefined);
const viewingPast = computed(() => !!runId.value);

const pool = usePoolData(id);
const { data: ranking, refresh } = await useAsyncData(
  `pool-rank-${id}-${runId.value ?? 'current'}`,
  () => pools.ranking(id, runId.value).catch(() => null as RankingResponse | null),
);

// Live updates only matter for the current temporada (past ones are frozen).
useRealtime(
  () => {
    const t = pool.value?.tournament;
    return t && !viewingPast.value ? [`tournament:${t.id}`] : [];
  },
  () => refresh(),
);
</script>

<template>
  <section>
    <NuxtLink v-if="viewingPast" :to="`/boloes/${id}/temporadas`" class="back-temp">
      <AppIcon name="arrowLeft" :size="15" :stroke="2.4" /> Temporadas
    </NuxtLink>
    <RankingBoard
      v-if="ranking"
      :data="ranking"
      :title="pool?.name ?? 'Bolão'"
      :subtitle="pool?.tournament?.name"
    />
    <p v-else class="muted load">Ranking indisponível.</p>
  </section>
</template>

<style scoped>
.load {
  padding: 2rem 0;
}
.back-temp {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--muted);
}
.back-temp:hover {
  color: var(--text);
}
</style>
