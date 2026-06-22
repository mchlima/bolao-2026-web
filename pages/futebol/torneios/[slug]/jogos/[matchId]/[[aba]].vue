<script setup lang="ts">
// Tournament-scoped match view. The shell's slim header is hidden on match
// routes (tournaments/[slug].vue), so the board shows its own back — at the
// top-left of the score. Back goes to the previous page (this match is reachable
// from many entry points), falling back to the tournament home if there's none.
// Key by matchId (not the full path) so switching the tab segment
// (…/escalacao, …/tempo) reuses this page instead of remounting it.
import type { Tournament } from '~/types/api';
definePageMeta({ key: (route) => route.params.matchId as string });
const route = useRoute();
const router = useRouter();
const slug = route.params.slug as string;
const matchId = route.params.matchId as string;
// seasonId real (p/ o MatchPhaseContext) sai da lista que o shell já carregou.
const { data: tlist } = useNuxtData<Tournament[]>('tournaments-list');
const seasonId = computed(() => (tlist.value ?? []).find((t) => t.slug === slug)?.id ?? '');

function goBack() {
  if (router.options.history.state.back) router.back();
  else navigateTo(`/futebol/torneios/${slug}`);
}
</script>

<template>
  <div class="mfill">
    <!-- The shell header is hidden on match routes; the board shows its own back.
         The group table / bracket goes into the board's "Classificação" tab. -->
    <MatchRankingView :match-id="matchId" @back="goBack">
      <template #classificacao>
        <MatchPhaseContext
          :season-id="seasonId"
          :match-id="matchId"
          :active="route.params.aba === 'classificacao'"
        />
      </template>
    </MatchRankingView>
  </div>
</template>
