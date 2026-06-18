<script setup lang="ts">
// Tournament-scoped match view. The shell's slim header is hidden on match
// routes (tournaments/[id].vue), so the board shows its own back — at the
// top-left of the score. Back goes to the previous page (this match is reachable
// from many entry points), falling back to the tournament home if there's none.
// Key by matchId (not the full path) so switching the tab segment
// (…/escalacao, …/tempo) reuses this page instead of remounting it.
definePageMeta({ key: (route) => route.params.matchId as string });
const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const matchId = route.params.matchId as string;

function goBack() {
  if (router.options.history.state.back) router.back();
  else navigateTo(`/futebol/torneios/${id}`);
}
</script>

<template>
  <div class="mfill">
    <!-- The shell header is hidden on match routes; the board shows its own back.
         The group table / bracket goes into the board's "Classificação" tab. -->
    <MatchRankingView :match-id="matchId" @back="goBack">
      <template #classificacao>
        <MatchPhaseContext
          :season-id="id"
          :match-id="matchId"
          :active="route.params.aba === 'classificacao'"
        />
      </template>
    </MatchRankingView>
  </div>
</template>
