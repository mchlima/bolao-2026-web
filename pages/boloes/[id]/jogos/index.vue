<script setup lang="ts">
import type { Match, Paginated, Prediction } from '~/types/api';
// Pool "Resultados": live + finished matches, each scoped to the pool. View only
// — predicting is global (done on the tournament). Tap a match → the pool's
// ranking for that match (PoolMatchView). The slim header + tabs live in the shell.
const route = useRoute();
const id = route.params.id as string;
const auth = useAuthStore();
const pool = usePoolData(id);

const { data, pending, refresh } = await useAsyncData(
  `pool-results-${id}`,
  async () => {
    const empty = { matches: [] as Match[], predictions: [] as Prediction[] };
    if (!pool.value) return empty;
    const api = useApi();
    const tid = pool.value.tournament.id;
    // The API caps pageSize at 100 — page through to get every match.
    const all: Match[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const res = await api<Paginated<Match>>(
        `/matches?seasonId=${tid}&page=${page}&pageSize=100`,
      );
      all.push(...res.data);
      totalPages = res.pagination.totalPages;
      page++;
    } while (page <= totalPages);
    // The user's (global) predictions, so each card can show their locked
    // palpite + points alongside the result.
    let predictions: Prediction[] = [];
    if (auth.token) {
      predictions = await api<Prediction[]>(`/predictions/me?seasonId=${tid}`);
    }
    return { matches: all, predictions };
  },
);
useRealtime(
  () => (pool.value ? [`tournament:${pool.value.tournament.id}`] : []),
  () => refresh(),
);

const predMap = computed<Record<string, Prediction>>(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  return m;
});

// Only live + finished have a result to scope by pool. Live first, then the most
// recently kicked off.
const RANK: Record<string, number> = { LIVE: 0, FINISHED: 1 };
const results = computed<Match[]>(() =>
  (data.value?.matches ?? [])
    .filter((m) => m.status === 'LIVE' || m.status === 'FINISHED')
    .sort((a, b) => {
      const r = (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9);
      if (r) return r;
      return new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime();
    }),
);
</script>

<template>
  <section>
    <SkeletonList v-if="pending && !data" variant="match" :count="5" />
    <p v-else-if="!results.length" class="empty muted">
      Ainda não há jogos ao vivo ou encerrados. Os resultados do bolão aparecem aqui
      conforme as partidas acontecem — toque num jogo para ver quem cravou.
    </p>
    <div v-else class="matches">
      <MatchList :matches="results" :predictions="predMap" :pool-id="id" />
    </div>
  </section>
</template>

<style scoped>
.matches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  padding: 2.5rem 0.5rem;
  font-size: 14px;
  line-height: 1.55;
  text-align: center;
}
</style>
