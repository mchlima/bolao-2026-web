<script setup lang="ts">
// Pool-scoped match view at its own URL (deep-linkable). Mirrors the tournament
// match ranking, scoped to the pool's members (privacy gate lives in the API).
const route = useRoute();
const poolId = route.params.id as string;
const matchId = route.params.matchId as string;
</script>

<template>
  <div class="page">
    <PoolMatchView
      :pool-id="poolId"
      :match-id="matchId"
      @back="navigateTo(`/pools/${poolId}?tab=matches`)"
    />
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
  max-width: 660px;
  margin: 0 auto;
}
</style>
