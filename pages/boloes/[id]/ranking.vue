<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;
const pools = usePools();

const pool = usePoolData(id);
const { data: ranking, refresh } = await useAsyncData(`pool-rank-${id}`, () =>
  pools.ranking(id).catch(() => null as RankingResponse | null),
);

useRealtime(
  () => (pool.value ? [`tournament:${pool.value.tournament.id}`] : []),
  () => refresh(),
);
</script>

<template>
  <section>
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
</style>
