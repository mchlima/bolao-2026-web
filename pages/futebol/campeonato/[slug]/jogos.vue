<script setup lang="ts">
// Todos os jogos do campeonato = agenda COMPLETA da temporada (scope=all), via
// AgendaFeed escopado por seasonId. Acessada pelo menu. Header leve com volta pro hub.
import type { ActiveSeason, Competition } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const { data: comp } = useNuxtData<Competition & { activeSeason: ActiveSeason | null }>(`campeonato-${slug}`);
const season = computed(() => comp.value?.activeSeason ?? null);
const seasonId = computed(() => season.value?.id);
const compName = computed(() => comp.value?.name ?? season.value?.name ?? 'Campeonato');

useSeoMeta({
  title: () => (season.value ? `Jogos de ${season.value.name} — Cravei` : 'Jogos do campeonato — Cravei'),
  description: () =>
    season.value
      ? `Todos os jogos de ${season.value.name}, dia a dia: horários, placar ao vivo e palpites.`
      : 'Todos os jogos do campeonato.',
});
</script>

<template>
  <div class="cpg">
    <CompetitionHubHeader :comp="comp ?? null" :comp-name="compName" :slug="slug" current="Jogos" />
    <AgendaFeed v-if="seasonId" :key="seasonId" :season-id="seasonId" />
  </div>
</template>

<style scoped>
.cpg {
  padding: 8px 16px 40px;
}
</style>
