<script setup lang="ts">
import type { Match } from '~/types/api';
// Tela de jogo standalone na URL de SEO: /futebol/jogo/:slug (ex.: brasil-x-franca-2026-06-22).
// As telas de torneio/bolão renderizam MatchRankingView / PoolMatchView nos seus próprios shells.
// Key pelo slug pra trocar a aba sem remontar a página.
definePageMeta({ key: (route) => route.params.slug as string });
const route = useRoute();
const router = useRouter();
const param = route.params.slug as string;

// Aceita id (cuid) OU slug — links/redirects antigos chegam por id. Se veio por id e o
// jogo já tem slug, faz "upgrade" 301 pra URL bonita. Compartilha o cache com
// MatchRankingView (mesma key "match-<param>") → sem fetch duplicado.
const { data: m } = await useAsyncData(`match-${param}`, () =>
  useApi()<Match>(`/matches/${param}`),
);
if (m.value?.slug && m.value.slug !== param) {
  const aba = route.params.aba ? `/${route.params.aba as string}` : '';
  await navigateTo(`/futebol/jogo/${m.value.slug}${aba}`, { redirectCode: 301, replace: true });
}
</script>

<template>
  <div class="page">
    <MatchRankingView :match-id="param" back-label="Voltar" @back="router.back()" />
  </div>
</template>

<style scoped>
.page {
  /* Hero/placar full-bleed encostado no topo: padding-top 0 nesta página. */
  padding: 0 0 40px;
  /* O board é full-bleed (imersivo): ocupa 100% da largura do container. */
  width: 100%;
}
</style>
