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
    <!-- The tournament shell header provides the back here, so hide the board's own.
         The group table / bracket goes into the board's "Classificação" tab. -->
    <MatchRankingView :match-id="matchId" hide-back>
      <template #classificacao>
        <MatchPhaseContext :season-id="id" :match-id="matchId" />
      </template>
    </MatchRankingView>
  </div>
</template>
