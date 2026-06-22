<script setup lang="ts">
// "Casca-zero" do campeonato: só RESOLVE a competição pelo slug PÚBLICO da competição
// (cache lido pelos filhos via useNuxtData) e dá 404 quando não existe. Sem fallback de
// slug antigo de temporada — todos os links internos já apontam direto pro slug da
// competição. Sem header/abas — a rota-base é um HUB editorial (index.vue); Jogos e
// Tabela são sub-rotas acessadas pelo menu.
import type { ActiveSeason, Competition } from '~/types/api';

type CompetitionWithSeason = Competition & { urlSlug: string; activeSeason: ActiveSeason | null };

const route = useRoute();
const slug = route.params.slug as string;

const { data: comp } = await useAsyncData(`campeonato-${slug}`, () =>
  useApi()<CompetitionWithSeason>(`/competitions/slug/${slug}`).catch(() => null),
);
if (!comp.value || !comp.value.activeSeason) {
  throw createError({ statusCode: 404, statusMessage: 'Campeonato não encontrado', fatal: true });
}
</script>

<template>
  <NuxtPage />
</template>
