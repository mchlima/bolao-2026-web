<script setup lang="ts">
// Pool-scoped match view — rendered inside the pool layout (header + tabs stay).
// Key by matchId so switching the tab segment reuses this page (no remount).
definePageMeta({ key: (route) => route.params.matchId as string });
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
