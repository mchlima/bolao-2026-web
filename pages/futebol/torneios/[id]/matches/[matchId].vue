<script setup lang="ts">
// Tournament-scoped match view — rendered inside the tournament shell
// (tournaments/[id].vue: slim header stays). Its own back returns to the
// tournament home (the shell omits its back on this route).
const route = useRoute();
const id = route.params.id as string;
const matchId = route.params.matchId as string;
</script>

<template>
  <div>
    <MatchRankingView
      :match-id="matchId"
      back-label="Voltar ao torneio"
      @back="navigateTo(`/futebol/torneios/${id}`)"
    />
    <!-- Phase slice for this match: group (classification + rounds) or knockout tie. -->
    <MatchPhaseContext :season-id="id" :match-id="matchId" />
  </div>
</template>
