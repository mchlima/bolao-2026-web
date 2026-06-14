<script setup lang="ts">
import type { Match, Prediction, StageStandings } from '~/types/api';

// Tournament hub (Visão geral): aggregates the interesting bits of this
// tournament — live + next matches and a standings teaser — with links into the
// Jogos / Classificação tabs. The header + tabs live in the layout ([id].vue).
const route = useRoute();
const auth = useAuthStore();
const id = route.params.id as string;

interface AgendaResp {
  days: { date: string; matches: Match[] }[];
}

const { data, pending, error, refresh } = await useAsyncData(
  `tournament-hub-${id}`,
  async () => {
    const api = useApi();
    const [upcoming, live, standings, preds] = await Promise.all([
      api<AgendaResp>(`/agenda?seasonId=${id}&scope=upcoming`),
      api<AgendaResp>(`/agenda?seasonId=${id}&scope=live`),
      api<StageStandings[]>(`/seasons/${id}/standings`),
      // Seed the palpite cards with the user's existing predictions.
      auth.token ? api<Prediction[]>(`/predictions/me?seasonId=${id}`) : Promise.resolve([] as Prediction[]),
    ]);
    return { upcoming, live, standings, preds };
  },
);
useRealtime(() => [`tournament:${id}`], () => refresh());

// Prediction map for the live/next cards (matchId → prediction); updated on save.
const predMap = ref<Record<string, Prediction>>({});
watchEffect(() => {
  const m: Record<string, Prediction> = {};
  for (const p of data.value?.preds ?? []) m[p.matchId] = p;
  predMap.value = m;
});
function onPredSaved(p: Prediction) {
  predMap.value = { ...predMap.value, [p.matchId]: p };
}

const liveMatches = computed<Match[]>(() =>
  (data.value?.live.days ?? []).flatMap((d) => d.matches).slice(0, 4),
);
const nextMatches = computed<Match[]>(() =>
  (data.value?.upcoming.days ?? [])
    .flatMap((d) => d.matches)
    .filter((m) => m.status !== 'POSTPONED')
    .slice(0, 4),
);
// First non-empty group → standings teaser (the league table, or group A in a cup).
const miniGroup = computed(() => {
  for (const st of data.value?.standings ?? []) {
    for (const g of st.groups) if (g.rows.length) return { stage: st, group: g };
  }
  return null;
});
const miniRows = computed(() => (miniGroup.value?.group.rows ?? []).slice(0, 5));
const isLeague = computed(() => miniGroup.value?.stage.format === 'LEAGUE');
const groupCount = computed(() =>
  (data.value?.standings ?? []).reduce((n, s) => n + s.groups.length, 0),
);
const empty = computed(
  () => !liveMatches.value.length && !nextMatches.value.length && !miniRows.value.length,
);
</script>

<template>
  <div>
    <SkeletonList v-if="pending && !data" variant="match" :count="3" />
    <p v-else-if="error || !data" class="muted load">Torneio não encontrado.</p>
    <div v-else class="hub">
      <!-- MENU do torneio: cada entrada abre uma página com espaço total -->
      <nav class="tnav">
        <NuxtLink :to="`/futebol/torneios/${id}/jogos`" class="tnav-tile">
          <span class="tn-ic" style="--c: var(--azure)"><AppIcon name="calendar" :size="20" :stroke="2" /></span>
          <span class="tn-txt"><b>Jogos</b><small>Agenda e palpites</small></span>
          <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="tn-go" />
        </NuxtLink>
        <NuxtLink :to="`/futebol/torneios/${id}/classificacao`" class="tnav-tile">
          <span class="tn-ic" style="--c: var(--gold)"><AppIcon name="trophy" :size="20" :stroke="2" /></span>
          <span class="tn-txt"><b>Tabela</b><small>Classificação, grupos e fases</small></span>
          <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="tn-go" />
        </NuxtLink>
        <NuxtLink :to="`/futebol/torneios/${id}/ranking`" class="tnav-tile">
          <span class="tn-ic" style="--c: var(--emerald)"><AppIcon name="users" :size="20" :stroke="2" /></span>
          <span class="tn-txt"><b>Bolão</b><small>Ranking dos palpiteiros</small></span>
          <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="tn-go" />
        </NuxtLink>
      </nav>

      <!-- AO VIVO -->
      <section v-if="liveMatches.length" class="hb-sec">
        <div class="hb-head">
          <h2 class="font-display"><span class="livedot" />Ao vivo</h2>
          <NuxtLink :to="`/futebol/torneios/${id}/jogos`" class="hb-all">Todos os jogos <AppIcon name="chevronRight" :size="13" :stroke="2.5" /></NuxtLink>
        </div>
        <div class="hb-matches">
          <MatchCard v-for="m in liveMatches" :key="m.id" :match="m" :prediction="predMap[m.id] ?? null" @saved="onPredSaved" />
        </div>
      </section>

      <!-- PRÓXIMOS JOGOS -->
      <section v-if="nextMatches.length" class="hb-sec">
        <div class="hb-head">
          <h2 class="font-display">Próximos jogos</h2>
          <NuxtLink :to="`/futebol/torneios/${id}/jogos`" class="hb-all">Todos os jogos <AppIcon name="chevronRight" :size="13" :stroke="2.5" /></NuxtLink>
        </div>
        <div class="hb-matches">
          <MatchCard v-for="m in nextMatches" :key="m.id" :match="m" :prediction="predMap[m.id] ?? null" @saved="onPredSaved" />
        </div>
      </section>

      <!-- CLASSIFICAÇÃO RESUMIDA -->
      <section v-if="miniRows.length" class="hb-sec">
        <div class="hb-head">
          <h2 class="font-display">Tabela<span v-if="!isLeague && miniGroup" class="hb-grp"> · {{ miniGroup.group.groupName }}</span></h2>
          <NuxtLink :to="`/futebol/torneios/${id}/classificacao`" class="hb-all">Tabela completa <AppIcon name="chevronRight" :size="13" :stroke="2.5" /></NuxtLink>
        </div>
        <StandingsTable :rows="miniRows" :zones="miniGroup?.stage.zones ?? []" compact :show-legend="false" />
        <NuxtLink v-if="!isLeague && groupCount > 1" :to="`/futebol/torneios/${id}/classificacao`" class="hb-more">
          + outros {{ groupCount - 1 }} grupo(s) na tabela completa
        </NuxtLink>
      </section>

      <p v-if="empty" class="muted load">Ainda não há jogos ou classificação para este torneio.</p>
    </div>
  </div>
</template>

<style scoped>
.load {
  padding: 2rem 0;
}
/* tournament menu tiles (Jogos / Tabela / Bolão) */
.tnav {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 560px) {
  .tnav {
    grid-template-columns: repeat(3, 1fr);
  }
}
.tnav-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-surface);
  transition: border-color 0.14s, transform 0.14s;
}
.tnav-tile:hover {
  border-color: color-mix(in srgb, var(--azure) 40%, var(--border));
  transform: translateY(-1px);
}
.tn-ic {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent);
}
.tn-txt {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.tn-txt b {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: 15px;
}
.tn-txt small {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tn-go {
  margin-left: auto;
  flex: none;
  color: var(--muted);
}
.hub {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.hb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.hb-head h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 600;
  font-size: 17px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.hb-grp {
  color: var(--muted);
  font-weight: 600;
}
.livedot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--scarlet);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--scarlet) 22%, transparent);
  animation: liveDot 1.1s ease-in-out infinite;
}
.hb-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--azure);
  white-space: nowrap;
}
.hb-matches {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hb-more {
  display: inline-block;
  margin-top: 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--azure);
}
</style>
