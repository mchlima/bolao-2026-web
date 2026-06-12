<script setup lang="ts">
import type { RankingResponse } from '~/types/api';

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(`ranking-${id}`, () =>
  useApi()<RankingResponse>(`/tournaments/${id}/ranking`),
);
useRealtime(() => [`tournament:${id}`], () => refresh());
</script>

<template>
  <div>
    <SkeletonList v-if="pending" variant="row" :count="8" />
    <p v-else-if="error || !data" class="muted load">Ranking indisponível.</p>
    <template v-else>
      <div class="head">
        <h3 class="font-display">Ranking do bolão</h3>
        <span class="sub">Top 100 de {{ data.totalParticipants }} participantes</span>
      </div>

      <RankingBoard :data="data" />
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
.load {
  padding: 2rem 0;
}
.back {
  display: inline-block;
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 16px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 18px;
}
.head h3 {
  font-weight: 600;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sub {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
}
</style>
