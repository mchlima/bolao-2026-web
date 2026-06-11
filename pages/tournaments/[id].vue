<script setup lang="ts">
import type { Match, Paginated, Prediction, Tournament } from '~/types/api';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;

const { data, pending, error } = await useAsyncData(
  `tournament-${id}`,
  async () => {
    const api = useApi();
    const [tournament, p1, p2] = await Promise.all([
      api<Tournament>(`/tournaments/${id}`),
      api<Paginated<Match>>(`/matches?tournamentId=${id}&page=1&pageSize=100`),
      api<Paginated<Match>>(`/matches?tournamentId=${id}&page=2&pageSize=100`),
    ]);
    const matches = [...p1.data, ...p2.data];
    let predictions: Prediction[] = [];
    if (auth.token) {
      predictions = await api<Prediction[]>(
        `/predictions/me?tournamentId=${id}`,
      );
    }
    return { tournament, matches, predictions };
  },
);

// Editable prediction map (matchId → prediction), updated on save.
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

// Group matches into labelled sections, preserving fixture order.
const sections = computed(() => {
  const out: Array<{ title: string; matches: Match[] }> = [];
  for (const m of data.value?.matches ?? []) {
    const title = m.groupName
      ? `Grupo ${m.groupName}`
      : (m.phaseLabel ?? 'Partidas');
    let section = out[out.length - 1];
    if (!section || section.title !== title) {
      section = { title, matches: [] };
      out.push(section);
    }
    section.matches.push(m);
  }
  return out;
});
</script>

<template>
  <section>
    <p><NuxtLink to="/" class="muted">← Torneios</NuxtLink></p>
    <p v-if="pending" class="muted">Carregando…</p>
    <p v-else-if="error || !data" class="muted">Torneio não encontrado.</p>
    <template v-else>
      <div class="head">
        <h1>{{ data.tournament.name }}</h1>
        <NuxtLink :to="`/tournaments/${id}/ranking`" class="btn">🏆 Ranking</NuxtLink>
      </div>

      <div v-for="sec in sections" :key="sec.title" class="section">
        <h2 class="section-title">{{ sec.title }}</h2>
        <div class="matches">
          <MatchCard
            v-for="m in sec.matches"
            :key="m.id"
            :match="m"
            :prediction="predMap[m.id] ?? null"
            @saved="onSaved"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.head h1 {
  margin: 0;
  font-size: 1.3rem;
}
.section {
  margin-top: 1.5rem;
}
.section-title {
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.6rem;
}
.matches {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
</style>
