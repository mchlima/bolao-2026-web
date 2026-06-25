<script setup lang="ts">
import type { Match, Paginated, Prediction } from '~/types/api';
// Pool "Jogos": TODOS os jogos da temporada (ao vivo → próximos → encerrados),
// cada um escopado ao bolão. View only — palpitar é global (no torneio). Tocar num
// jogo → ranking do bolão naquela partida (PoolMatchView) + abas, inclusive Chat.
const route = useRoute();
const id = route.params.id as string;
const auth = useAuthStore();
const pool = usePoolData(id);

const { data, pending, refresh } = await useAsyncData(
  `pool-results-${id}`,
  async () => {
    const empty = { matches: [] as Match[], predictions: [] as Prediction[] };
    // Bolão sem temporada → sem torneio, nada a listar.
    if (!pool.value?.tournament) return empty;
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
  () => (pool.value?.tournament ? [`tournament:${pool.value.tournament.id}`] : []),
  () => refresh(),
);

// "Como pontuar" — níveis de acerto e pontos (modelo por níveis da API; defaults
// 25/18/15/12/10, mata-mata multiplica). Do maior pro menor.
const SCORE_STEPS = [
  { n: 1, icon: 'star', color: 'var(--gold)', tag: '25 pts', title: 'Cravou o placar', desc: 'Acertou o <strong>placar exato</strong> — a pontuação máxima.', ex: 'Ex.: você cravou 2 a 1 e o jogo terminou 2 a 1.' },
  { n: 2, icon: 'check', color: 'var(--emerald)', tag: '18 pts', title: 'Vencedor + gols do vencedor', desc: 'Acertou quem ganhou <strong>e quantos gols</strong> o vencedor fez.', ex: 'Ex.: palpite 2 a 0; saiu 2 a 1 — acertou o 2 do vencedor.' },
  { n: 3, icon: 'check', color: 'var(--azure)', tag: '15 pts', title: 'Vencedor + saldo de gols', desc: 'Acertou quem ganhou e a <strong>diferença de gols</strong> (o saldo).', ex: 'Ex.: palpite 2 a 1 (saldo 1); saiu 3 a 2 (saldo 1).' },
  { n: 4, icon: 'check', color: 'var(--azure)', tag: '12 pts', title: 'Vencedor + gols do perdedor', desc: 'Acertou quem ganhou e <strong>quantos gols</strong> o perdedor fez.', ex: 'Ex.: palpite 3 a 1; saiu 2 a 1 — acertou o 1 do perdedor.' },
  { n: 5, icon: 'check', color: 'var(--azure)', tag: '10 pts', title: 'Só o vencedor (ou empate)', desc: 'Acertou só <strong>quem ganhou</strong> — ou que daria empate.', ex: 'Ex.: apostou no mandante e ele venceu de qualquer placar.' },
  { n: 6, icon: 'close', color: 'var(--muted)', tag: '0 pts', title: 'Errou o resultado', desc: 'Errou quem ganhou (ou o empate). Nessa não pontua.', ex: 'O importante é acertar pelo menos o vencedor.' },
];

const predMap = computed<Record<string, Prediction>>(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  return m;
});

// TODOS os jogos da temporada do bolão (não só os que já pontuaram), na ordem
// "agora & a seguir": AO VIVO primeiro, depois os PRÓXIMOS (mais cedo primeiro) e
// por fim os ENCERRADOS (mais recentes primeiro). A janela de pontuação
// (kickoffAt > startAt, <= endAt) ainda delimita quais jogos são DESTE run — mesma
// janela do ranking (rankings.service). Temporada não iniciada (DRAFT/sem startAt)
// não tem jogos a listar.
// Grupos de status: 0 = ao vivo · 1 = a jogar (agendado/adiado) · 2 = encerrado.
const STATUS_GROUP = (s: string): number =>
  s === 'LIVE' ? 0 : s === 'FINISHED' || s === 'CANCELLED' ? 2 : 1;
const results = computed<Match[]>(() => {
  const run = pool.value?.currentRun ?? null;
  if (!run || run.status === 'DRAFT' || !run.startAt) return [];
  const start = new Date(run.startAt).getTime();
  const end = run.endAt ? new Date(run.endAt).getTime() : null;
  return (data.value?.matches ?? [])
    .filter((m) => {
      const k = new Date(m.kickoffAt).getTime();
      return k > start && (end === null || k <= end);
    })
    .sort((a, b) => {
      const ga = STATUS_GROUP(a.status);
      const gb = STATUS_GROUP(b.status);
      if (ga !== gb) return ga - gb;
      const ka = new Date(a.kickoffAt).getTime();
      const kb = new Date(b.kickoffAt).getTime();
      // encerrados: mais recente primeiro; ao vivo e a jogar: mais cedo primeiro.
      return ga === 2 ? kb - ka : ka - kb;
    });
});
</script>

<template>
  <section>
    <HowItWorks
      title="Como pontuar"
      storage-key="jogos-howto-open"
      lead="A cada jogo, todo mundo do bolão pontua conforme o palpite. Quanto <strong>mais perto do placar real</strong>, mais pontos — acertar o vencedor é o mínimo pra pontuar."
      :steps="SCORE_STEPS"
      example="<b>Mata-mata:</b> nas fases eliminatórias os pontos valem mais — cada rodada multiplica o valor (até 3×)."
    />

    <SkeletonList v-if="pending && !data" variant="match" :count="5" />

    <!-- sem temporada: nada a pontuar ainda -->
    <EmptyState
      v-else-if="!pool?.currentRun"
      icon="trophy"
      title="Este bolão ainda não tem temporada"
      description="Os jogos pontuados aparecem aqui assim que uma temporada começar. Abra a Visão geral para criar ou acompanhar a temporada."
    >
      <template #action>
        <NuxtLink :to="`/boloes/${id}`" class="btn btn-gold">Ir para a Visão geral</NuxtLink>
      </template>
    </EmptyState>

    <!-- com temporada, mas nenhum jogo pontuou ainda -->
    <EmptyState
      v-else-if="!results.length"
      icon="ball"
      title="Nenhum jogo nesta temporada ainda"
      description="Os jogos do bolão aparecem aqui — ao vivo e próximos no topo, encerrados embaixo. Crave os placares dos próximos jogos para pontuar com a galera."
    >
      <template #action>
        <NuxtLink to="/boloes/palpites" class="btn btn-gold">Fazer meus palpites</NuxtLink>
      </template>
    </EmptyState>

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
</style>
