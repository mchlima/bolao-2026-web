<script setup lang="ts">
// Aba TABELA do hub do campeonato: classificação completa (com grupos + chave,
// quando há) via TournamentPhasesView, escopada na temporada vigente. seasonId vem
// do cache do shell.
import type { ActiveSeason, BracketStage, Competition, StageStandings } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;
const { data: comp } = useNuxtData<Competition & { activeSeason: ActiveSeason | null }>(`campeonato-${slug}`);
const season = computed(() => comp.value?.activeSeason ?? null);
const id = computed(() => season.value?.id ?? '');
const compName = computed(() => comp.value?.name ?? season.value?.name ?? 'Campeonato');

useSeoMeta({
  title: () => (season.value ? `Tabela · ${season.value.name} — Cravei` : 'Tabela — Cravei'),
  description: () =>
    season.value
      ? `Tabela de classificação de ${season.value.name}: pontos, jogos, saldo de gols — atualizada ao vivo.`
      : 'Tabela de classificação do campeonato.',
});

const { data, pending, error, refresh } = await useAsyncData(`tabela-${id.value}`, async () => {
  if (!id.value) return null;
  const api = useApi();
  const [standings, bracket, matches] = await Promise.all([
    api<StageStandings[]>(`/seasons/${id.value}/standings`),
    api<BracketStage[]>(`/seasons/${id.value}/bracket`),
    fetchAllMatches(api, id.value),
  ]);
  return { standings, bracket, matches };
});
useRealtime(
  () => (id.value ? [`tournament:${id.value}`] : []),
  () => refresh(),
);

const hasData = computed(() => {
  const d = data.value;
  if (!d) return false;
  return (
    d.standings.some((s) => s.groups.some((g) => g.rows.length)) ||
    d.bracket.some((s) => s.rounds.some((r) => r.ties.length))
  );
});
</script>

<template>
  <div class="cpg">
    <CompetitionHubHeader :comp="comp ?? null" :comp-name="compName" :slug="slug" current="Tabela" />

    <SkeletonList v-if="pending && !data" variant="row" :count="6" />
    <p v-else-if="error || !hasData" class="muted load">Tabela indisponível para este campeonato.</p>
    <TournamentPhasesView
      v-else
      :standings="data!.standings"
      :bracket-stages="data!.bracket"
      :matches="data!.matches"
      :season-id="id"
    />
  </div>
</template>

<style scoped>
.cpg {
  padding: 8px 16px 40px;
}
.load {
  padding: 2rem 0;
}
</style>
