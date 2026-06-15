<script setup lang="ts">
import type { Match, RankingResponse } from '~/types/api';

// Tournament-wide match companion: fetches the match + global ranking and hands
// them to the shared MatchRankingBoard. Rendered standalone (/matches/:id) and
// inside the tournament layout (/tournaments/:id/matches/:matchId).
const props = withDefaults(
  defineProps<{ matchId: string; backLabel?: string }>(),
  { backLabel: 'Voltar' },
);
const emit = defineEmits<{ back: [] }>();

const { data, pending, error, refresh } = await useAsyncData(
  `match-${props.matchId}`,
  async () => {
    const api = useApi();
    const [match, ranking] = await Promise.all([
      api<Match>(`/matches/${props.matchId}`),
      api<RankingResponse>(`/matches/${props.matchId}/ranking`),
    ]);
    return { match, ranking };
  },
);
useRealtime(() => [`match:${props.matchId}`], () => refresh());

// Dynamic SEO from the fetched match (covers /futebol/jogos/:id and the
// tournament-scoped match route, both of which render this component).
const seoMatchup = computed(() => {
  const m = data.value?.match;
  if (!m) return null;
  const home = m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir';
  const away = m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir';
  return `${home} x ${away}`;
});
useSeoMeta({
  title: () => (seoMatchup.value ? `${seoMatchup.value} — Cravei` : 'Partida — Cravei'),
  description: () =>
    seoMatchup.value
      ? `Palpites, placar ao vivo e ranking da partida ${seoMatchup.value}.`
      : 'Palpites, placar ao vivo e ranking da partida.',
  ogTitle: () => (seoMatchup.value ? `${seoMatchup.value} — Cravei` : 'Partida — Cravei'),
  ogDescription: () =>
    seoMatchup.value
      ? `Placar ao vivo e ranking dos palpites de ${seoMatchup.value}.`
      : 'Placar ao vivo e ranking dos palpites.',
});
</script>

<template>
  <div>
    <SkeletonList v-if="pending && !data" variant="match" :count="1" />
    <p v-else-if="error || !data?.match" class="muted load">Partida não encontrada.</p>
    <MatchRankingBoard
      v-else
      :match="data.match"
      :ranking="data.ranking"
      title="Ranking da partida"
      :back-label="backLabel"
      @back="emit('back')"
      @refresh="refresh"
    />
  </div>
</template>

<style scoped>
.load { padding: 2rem 0; }
</style>
