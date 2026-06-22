<script setup lang="ts">
// Standalone match view (e.g. opened from the predictions list). The tournament
// and pool match screens render MatchRankingView / PoolMatchView inside their
// own tabbed shells instead.
// Key by the match id so switching the tab segment reuses this page (no remount).
definePageMeta({ key: (route) => route.params.id as string });
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
  /* O board é full-bleed (immersivo): ocupa 100% da largura do container em vez
     de ficar travado numa coluna estreita centralizada. */
  width: 100%;
}
</style>
