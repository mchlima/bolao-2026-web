<script setup lang="ts">
import type { BracketStage, BracketTie, Match, StageStandings } from '~/types/api';

// The phase "slice" for a match: its group (classification + round card) or its
// knockout tie. Reuses StandingsTable / GroupRoundCard / BracketTieCard.
// `active` gates this tab: its payload is heavy (standings + bracket + every
// season match) and the tournament room fires on ANY match update, so while the
// "Classificação" tab is hidden it neither subscribes nor refetches; it refetches
// once when opened. Defaults on for standalone use.
const props = defineProps<{ seasonId: string; matchId: string; active?: boolean }>();

const { data, refresh } = await useAsyncData(`match-phase-${props.matchId}`, async () => {
  const api = useApi();
  const [match, standings, bracket, groupMatches] = await Promise.all([
    api<Match>(`/matches/${props.matchId}`),
    api<StageStandings[]>(`/seasons/${props.seasonId}/standings`),
    api<BracketStage[]>(`/seasons/${props.seasonId}/bracket`),
    fetchAllMatches(api, props.seasonId),
  ]);
  return { match, standings, bracket, groupMatches };
});

// Standings, bracket and the round card all depend on every match in the season,
// so resync on any update in the tournament room (not just this match's) — but
// only while the tab is on screen.
useRealtime(
  () => (props.active !== false ? [`tournament:${props.seasonId}`] : []),
  () => refresh(),
);
watch(() => props.active, (a) => {
  if (a) refresh();
});

const match = computed(() => data.value?.match ?? null);
const isGroup = computed(() => !!match.value?.groupName);

// ── Group context ──
const groupStage = computed(() =>
  data.value?.standings.find((s) => s.groups.some((g) => g.groupName === match.value?.groupName)) ?? null,
);
const group = computed(
  () => groupStage.value?.groups.find((g) => g.groupName === match.value?.groupName) ?? null,
);
const rounds = computed(() =>
  match.value?.groupName ? buildGroupRounds(data.value!.groupMatches, match.value.groupName) : [],
);
const bestThirds = computed(() => (groupStage.value?.groups.length === 12 ? 8 : 0));

// A LEAGUE stage (pontos corridos, e.g. Brasileirão) is a single table coloured
// by the persisted classification zones (Libertadores/Pré-Liber/Sul-Americana/Z4
// from ge.globo). A GROUP stage keeps the WC bands (direct-qualifiers green,
// best-third yellow).
const isLeague = computed(() => groupStage.value?.format === 'LEAGUE');
const zones = computed(() => (isLeague.value ? (groupStage.value?.zones ?? []) : []));
const contextTitle = computed(() =>
  isLeague.value
    ? (groupStage.value?.stageName ?? 'Classificação')
    : `${groupStage.value?.stageName ?? 'Fase de Grupos'} · Grupo ${match.value?.groupName ?? ''}`,
);
const standingsTitle = computed(() =>
  isLeague.value ? 'Classificação' : `Grupo ${match.value?.groupName ?? ''}`,
);

// ── Knockout context ──
const knockout = computed(() => {
  if (isGroup.value || !data.value) return null;
  for (const st of data.value.bracket) {
    for (const r of st.rounds) {
      const tie = r.ties.find((t) => t.legs.some((l) => l.id === props.matchId));
      if (tie) {
        const variant: 'normal' | 'final' | 'third' =
          r.name === 'Final' ? 'final' : r.name === 'Disputa de 3º lugar' ? 'third' : 'normal';
        return { roundName: r.name ?? 'Mata-mata', tie: tie as BracketTie, legs: r.legs, variant };
      }
    }
  }
  return null;
});

const hasContext = computed(() => (isGroup.value && !!group.value) || !!knockout.value);
</script>

<template>
  <section v-if="hasContext" class="mpc">
    <!-- Group: classification + round card -->
    <template v-if="isGroup && group">
      <h3 class="mpc-title font-display">{{ contextTitle }}</h3>
      <div class="grp">
        <StandingsTable
          :title="standingsTitle"
          :rows="group.rows"
          :zones="zones"
          :qualify-count="isLeague ? 0 : 2"
          :yellow-from="!isLeague && bestThirds > 0 ? 3 : 0"
          :yellow-to="!isLeague && bestThirds > 0 ? 3 : 0"
          yellow-label="Pode avançar (melhor 3º)"
          :show-legend="isLeague"
          movement
          compact
        />
        <GroupRoundCard
          v-if="rounds.length"
          :season-id="seasonId"
          :rounds="rounds"
          :initial-round-id="match!.roundId ?? undefined"
        />
      </div>
    </template>

    <!-- Knockout: the tie (confronto) of this match's round -->
    <template v-else-if="knockout">
      <h3 class="mpc-title font-display">{{ knockout.roundName }}</h3>
      <BracketTieCard :tie="knockout.tie" :legs="knockout.legs" :variant="knockout.variant" />
    </template>
  </section>
</template>

<style scoped>
.mpc {
  margin-top: 24px;
}
.mpc-title {
  font-weight: 700;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 12px;
}
.grp {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;
}
@media (min-width: 900px) {
  .grp {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  }
}
</style>
