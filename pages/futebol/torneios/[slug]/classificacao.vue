<script setup lang="ts">
import type { BracketStage, StageStandings, Tournament } from '~/types/api';

const route = useRoute();
const slug = route.params.slug as string;

// Nome + seasonId vêm da lista que o shell já carregou ('tournaments-list').
const { data: seoTournaments } = useNuxtData<Tournament[]>('tournaments-list');
const season = computed(() => seoTournaments.value?.find((t) => t.slug === slug) ?? null);
const id = season.value?.id ?? '';
const seoName = computed(() => season.value?.name ?? null);
useSeoMeta({
  title: () => (seoName.value ? `Classificação · ${seoName.value} — Cravei` : 'Classificação do torneio — Cravei'),
  description: () =>
    seoName.value
      ? `Tabela de classificação de ${seoName.value}: pontos, jogos, saldo de gols e a disputa por vaga — atualizada ao vivo.`
      : 'Tabela de classificação do torneio, atualizada ao vivo.',
});

const { data, pending, error, refresh } = await useAsyncData(
  `phases-${id}`,
  async () => {
    const api = useApi();
    const [standings, bracket, matches] = await Promise.all([
      api<StageStandings[]>(`/seasons/${id}/standings`),
      api<BracketStage[]>(`/seasons/${id}/bracket`),
      // All fixtures, for the per-group / per-round cards. A league (Brasileirão)
      // has 380 matches across 38 rounds, so this pages past the 100 cap.
      fetchAllMatches(api, id),
    ]);
    return { standings, bracket, matches };
  },
);
useRealtime(() => [`tournament:${id}`], () => refresh());

const hasData = computed(() => {
  const d = data.value;
  if (!d) return false;
  return (
    d.standings.some((s) => s.groups.some((g) => g.rows.length)) ||
    d.bracket.some((s) => s.rounds.some((r) => r.ties.length))
  );
});
// Há fase de grupos? → mostra o atalho pro hub /grupos (jogos por grupo).
const hasGroups = computed(() =>
  (data.value?.standings ?? []).some((s) => s.format === 'GROUP' && s.groups.some((g) => g.rows.length)),
);
</script>

<template>
  <div>
    <SkeletonList v-if="pending && !data" variant="row" :count="6" />
    <p v-else-if="error || !hasData" class="muted load">
      Estrutura do torneio indisponível.
    </p>
    <template v-else>
      <NuxtLink v-if="hasGroups" :to="`/futebol/torneios/${slug}/grupos`" class="grp-link">
        Jogos por grupo <AppIcon name="arrowRight" :size="14" :stroke="2.4" />
      </NuxtLink>
      <TournamentPhasesView
        :standings="data!.standings"
        :bracket-stages="data!.bracket"
        :matches="data!.matches"
        :season-id="id"
      />
    </template>
  </div>
</template>

<style scoped>
.load {
  padding: 2rem 0;
}
.grp-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--azure);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 7px 14px;
  transition: border-color 0.14s;
}
.grp-link:hover {
  border-color: color-mix(in srgb, var(--azure) 45%, var(--border));
}
</style>
