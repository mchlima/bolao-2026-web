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
    <p v-if="ranking" class="count muted">
      {{ ranking.totalParticipants }}
      {{ ranking.totalParticipants === 1 ? 'participante' : 'participantes' }}
      com palpites
    </p>
    <RankingBoard v-if="ranking" :data="ranking" />
    <p v-else class="muted load">Ranking indisponível.</p>
  </section>
</template>

<style scoped>
.count {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}
.load {
  padding: 2rem 0;
}
</style>
