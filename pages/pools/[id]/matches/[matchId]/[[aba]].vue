<script setup lang="ts">
// Pool-scoped match view. The pool shell hides its chrome on this route, so the
// board owns the screen (its own back returns to Resultados) — it opens "outside"
// the pool shell. Key by matchId so switching the tab segment reuses this page.
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
