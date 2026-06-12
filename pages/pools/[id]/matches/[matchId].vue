<script setup lang="ts">
// Pool-scoped match view — rendered inside the pool layout (header + tabs stay).
const route = useRoute();
const poolId = route.params.id as string;
const matchId = route.params.matchId as string;
</script>

<template>
  <PoolMatchView
    :pool-id="poolId"
    :match-id="matchId"
    @back="navigateTo(`/pools/${poolId}/matches`)"
  />
</template>
