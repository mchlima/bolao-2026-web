<script setup lang="ts">
// Tournament-scoped match view — rendered inside the tournament layout
// (tournaments/[id].vue: header + tabs stay), mirroring the pool match view.
const route = useRoute();
const id = route.params.id as string;
const matchId = route.params.matchId as string;
</script>

<template>
  <div>
    <MatchRankingView
      :match-id="matchId"
      back-label="Voltar às partidas"
      @back="navigateTo(`/tournaments/${id}`)"
    />
    <!-- Phase slice for this match: group (classification + rounds) or knockout tie. -->
    <MatchPhaseContext :season-id="id" :match-id="matchId" />
  </div>
</template>
