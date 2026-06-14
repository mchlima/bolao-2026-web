<script setup lang="ts">
// Standalone match view (e.g. opened from the predictions list). The tournament
// and pool match screens render MatchRankingView / PoolMatchView inside their
// own tabbed shells instead.
const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
</script>

<template>
  <div class="page">
    <MatchRankingView :match-id="id" back-label="Voltar" @back="router.back()" />
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
  max-width: 660px;
  margin: 0 auto;
}
</style>
