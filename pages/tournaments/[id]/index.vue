<script setup lang="ts">
import type { Match, Paginated, Prediction, Tournament } from '~/types/api';

const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
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
      predictions = await api<Prediction[]>(`/predictions/me?tournamentId=${id}`);
    }
    return { tournament, matches, predictions };
  },
);

const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.predictions ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

useRealtime(() => [`tournament:${id}`], () => refresh());

const sections = computed(() => {
  const out: Array<{ title: string; matches: Match[] }> = [];
  for (const m of data.value?.matches ?? []) {
    const title = m.groupName
      ? `Grupo ${m.groupName}`
      : (m.phaseLabel ?? 'Partidas');
    let s = out[out.length - 1];
    if (!s || s.title !== title) {
      s = { title, matches: [] };
      out.push(s);
    }
    s.matches.push(m);
  }
  return out;
});

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return (w[0]?.[0] ?? '') + (w[1]?.[0] ?? '');
}
</script>

<template>
  <div class="page">
    <SkeletonList v-if="pending" variant="match" :count="6" />
    <p v-else-if="error || !data" class="muted load">Torneio não encontrado.</p>
    <template v-else>
      <div class="thead">
        <div class="badge font-display">{{ badge(data.tournament.name) }}</div>
        <div class="meta">
          <h1 class="font-display name">{{ data.tournament.name }}</h1>
          <div class="tags">
            <span class="tag azure">Grupos + mata-mata</span>
            <span class="tag">{{ data.matches.length }} partidas</span>
          </div>
        </div>
      </div>

      <div class="tabs">
        <span class="tab on">Partidas</span>
        <NuxtLink :to="`/tournaments/${id}/ranking`" class="tab">Ranking</NuxtLink>
      </div>

      <div v-for="sec in sections" :key="sec.title" class="section">
        <h2 class="font-display section-title">{{ sec.title }}</h2>
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
  </div>
</template>

<style scoped>
.page {
  padding: 18px 0 40px;
}
.load {
  padding: 2rem 0;
}
.thead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
.badge {
  width: 54px;
  height: 54px;
  border-radius: 15px;
  background: var(--grad-pitch);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fff;
  font-size: 17px;
  flex: 0 0 auto;
}
.meta {
  flex: 1;
  min-width: 200px;
}
.name {
  font-weight: 700;
  font-size: clamp(22px, 4vw, 30px);
  text-transform: uppercase;
  line-height: 1;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.tag {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
}
.tag.azure {
  color: var(--azure);
  background: rgba(30, 127, 240, 0.14);
  border-color: rgba(30, 127, 240, 0.3);
}
.tabs {
  display: flex;
  gap: 5px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 5px;
  margin-bottom: 22px;
  position: sticky;
  top: 70px;
  z-index: 20;
  backdrop-filter: blur(8px);
}
.tab {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13.5px;
  color: var(--muted);
  cursor: pointer;
}
.tab.on {
  background: var(--grad-pitch);
  color: #fff;
}
.section {
  margin-top: 1.5rem;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.7rem;
}
.matches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: 14px;
}
</style>
