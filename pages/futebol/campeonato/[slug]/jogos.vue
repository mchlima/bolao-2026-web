<script setup lang="ts">
// Todos os jogos do campeonato = agenda COMPLETA da temporada (scope=all), via
// AgendaFeed escopado por seasonId. Acessada pelo menu. Header leve com volta pro hub.
import type { ActiveSeason, Competition, Match } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);
const { data: comp } = useNuxtData<Competition & { activeSeason: ActiveSeason | null }>(`campeonato-${slug}`);
const season = computed(() => comp.value?.activeSeason ?? null);
const seasonId = computed(() => season.value?.id);
const compName = computed(() => comp.value?.name ?? season.value?.name ?? 'Campeonato');

// Jogos da temporada (mesmo endpoint do AgendaFeed) só pra alimentar o bloco SEO/GEO.
const { data: agenda } = await useAsyncData(
  () => `seoblock-${seasonId.value ?? 'none'}`,
  () =>
    seasonId.value
      ? useApi()<{ days: { date: string; matches: Match[] }[] }>(`/agenda?seasonId=${seasonId.value}&scope=all`)
      : Promise.resolve(null),
  { watch: [seasonId] },
);
const seoMatches = computed<Match[]>(() => (agenda.value?.days ?? []).flatMap((d) => d.matches));
const canonical = computed(() => `${siteUrl}/futebol/campeonato/${slug}/jogos`);

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
    <MatchesSeoBlock v-if="seoMatches.length" :matches="seoMatches" scope="competition" :label="compName" :canonical="canonical" />
  </div>
</template>

<style scoped>
.cpg {
  padding: 8px 16px 40px;
}
</style>
