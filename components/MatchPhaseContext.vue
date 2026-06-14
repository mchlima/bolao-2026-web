<script setup lang="ts">
import type { BracketStage, BracketTie, Match, Paginated, StageStandings } from '~/types/api';

// The phase "slice" for a match: its group (classification + round card) or its
// knockout tie. Reuses StandingsTable / GroupRoundCard / BracketTieCard.
const props = defineProps<{ seasonId: string; matchId: string }>();

const { data, refresh } = await useAsyncData(`match-phase-${props.matchId}`, async () => {
  const api = useApi();
  const [match, standings, bracket, matches] = await Promise.all([
    api<Match>(`/matches/${props.matchId}`),
    api<StageStandings[]>(`/seasons/${props.seasonId}/standings`),
    api<BracketStage[]>(`/seasons/${props.seasonId}/bracket`),
    api<Paginated<Match>>(`/matches?seasonId=${props.seasonId}&pageSize=100`),
  ]);
  return { match, standings, bracket, groupMatches: matches.data };
});

// Standings, bracket and the round card all depend on every match in the season,
// so resync on any update in the tournament room (not just this match's).
useRealtime(() => [`tournament:${props.seasonId}`], () => refresh());

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

// A LEAGUE stage (pontos corridos, e.g. Brasileirão) is a single table: mark the
// top 4 green (G4 → Libertadores) and the bottom 4 red (Z4 → rebaixamento). A
// GROUP stage keeps the WC bands (direct-qualifiers green, best-third yellow).
const isLeague = computed(() => groupStage.value?.format === 'LEAGUE');
const rowCount = computed(() => group.value?.rows.length ?? 0);
const contextTitle = computed(() =>
  isLeague.value
    ? (groupStage.value?.stageName ?? 'Classificação')
    : `${groupStage.value?.stageName ?? 'Fase de Grupos'} · Grupo ${match.value?.groupName ?? ''}`,
);
const standingsTitle = computed(() =>
  isLeague.value ? 'Classificação' : `Grupo ${match.value?.groupName ?? ''}`,
);
const bands = computed(() =>
  isLeague.value
    ? {
        qualifyCount: 4,
        qualifyLabel: 'Libertadores (G4)',
        yellowFrom: 0,
        yellowTo: 0,
        yellowLabel: '',
        relegateFrom: Math.max(0, rowCount.value - 3),
        relegateTo: rowCount.value,
        relegateLabel: 'Rebaixamento (Z4)',
        showLegend: true,
      }
    : {
        qualifyCount: 2,
        qualifyLabel: 'Classificação direta',
        yellowFrom: bestThirds.value > 0 ? 3 : 0,
        yellowTo: bestThirds.value > 0 ? 3 : 0,
        yellowLabel: 'Pode avançar (melhor 3º)',
        relegateFrom: 0,
        relegateTo: 0,
        relegateLabel: '',
        showLegend: false,
      },
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
          :qualify-count="bands.qualifyCount"
          :qualify-label="bands.qualifyLabel"
          :yellow-from="bands.yellowFrom"
          :yellow-to="bands.yellowTo"
          :yellow-label="bands.yellowLabel"
          :relegate-from="bands.relegateFrom"
          :relegate-to="bands.relegateTo"
          :relegate-label="bands.relegateLabel"
          :show-legend="bands.showLegend"
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
