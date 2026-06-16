<script setup lang="ts">
import type { LineupPlayer, LineupTeam, Match, MatchLineup } from '~/types/api';

// Live lineups for a match (ESPN summary feed via /matches/:id/lineup). Renders
// both teams on one vertical pitch — home attacking up from the bottom, away
// down from the top — plus a bench/subs list. Refetches on the match realtime
// channel so substitutions land live. Renders nothing until lineups exist
// (~1h before kickoff), so it stays invisible on far-off fixtures.
const props = defineProps<{ match: Match }>();
// Lets the parent (MatchRankingBoard) show the "Escalação" tab only once
// lineups exist; the section itself renders nothing while unavailable.
const emit = defineEmits<{ available: [boolean] }>();

const { data, refresh } = await useAsyncData(
  `lineup-${props.match.id}`,
  () => useApi()<MatchLineup>(`/matches/${props.match.id}/lineup`),
);
useRealtime(() => [`match:${props.match.id}`], () => refresh());

// The robot only emits realtime events on score/status/card changes, so a plain
// substitution wouldn't push an update. Poll while the match is live so subs
// land on their own (the endpoint caches 30s, so this is cheap on ESPN).
let pollTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  pollTimer = setInterval(() => {
    if (props.match.status === 'LIVE') refresh();
  }, 60_000);
});
onBeforeUnmount(() => clearInterval(pollTimer));

const available = computed(() => !!data.value?.available);
watch(available, (v) => emit('available', v), { immediate: true });

const LINE_ORDER = ['GK', 'DEF', 'MID', 'FWD'] as const;
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}
// Worst card to show: a red (or a second yellow = sending-off) beats a single yellow.
function cardKind(p: LineupPlayer): 'red' | 'yellow' | null {
  if (p.red > 0 || p.yellow >= 2) return 'red';
  return p.yellow >= 1 ? 'yellow' : null;
}
function horiz(pos: string | null): number {
  const p = (pos ?? '').toUpperCase();
  if (p.includes('L')) return -1;
  if (p.includes('R')) return 1;
  return 0;
}
// Starters grouped into pitch lines (GK→FWD), each ordered left→right.
function rowsOf(team: LineupTeam | undefined): LineupPlayer[][] {
  const starters = (team?.players ?? []).filter((p) => p.starter);
  return LINE_ORDER.map((line) =>
    starters
      .filter((p) => p.line === line)
      .sort((a, b) => horiz(a.position) - horiz(b.position) || (a.formationPlace ?? 99) - (b.formationPlace ?? 99)),
  ).filter((r) => r.length);
}
// Vertical band per row: home GK at the bottom (95%) climbing to midfield; away
// GK at the top (5%) descending. x spreads the row evenly across the width.
function tokenStyle(side: 'home' | 'away', rowIdx: number, rowCount: number, col: number, cols: number) {
  const span = 45 / Math.max(rowCount - 1, 1);
  const y = side === 'home' ? 95 - rowIdx * span : 5 + rowIdx * span;
  const x = ((col + 1) / (cols + 1)) * 100;
  return { top: `${y}%`, left: `${x}%` };
}
const homeRows = computed(() => rowsOf(data.value?.home));
const awayRows = computed(() => rowsOf(data.value?.away));

function bench(team: LineupTeam | undefined): LineupPlayer[] {
  return (team?.players ?? []).filter((p) => !p.starter);
}
const homeName = computed(() => props.match.homeTeam?.shortName ?? props.match.homeTeam?.name ?? 'Casa');
const awayName = computed(() => props.match.awayTeam?.shortName ?? props.match.awayTeam?.name ?? 'Fora');
</script>

<template>
  <section v-if="available" class="lineup">
    <div class="pitch">
      <div class="midline" />
      <div class="circle" />
      <!-- away (top) -->
      <template v-for="(row, ri) in awayRows" :key="`a${ri}`">
        <div
          v-for="(p, ci) in row"
          :key="p.name + ci"
          class="tok away"
          :class="{ out: p.subbedOut }"
          :style="tokenStyle('away', ri, awayRows.length, ci, row.length)"
        >
          <span class="num">{{ p.jersey ?? '' }}<span v-if="cardKind(p)" class="card" :class="cardKind(p)" /></span>
          <span class="nm">{{ surname(p.name) }}<span v-if="p.subbedOut" class="arr">↓</span></span>
        </div>
      </template>
      <!-- home (bottom) -->
      <template v-for="(row, ri) in homeRows" :key="`h${ri}`">
        <div
          v-for="(p, ci) in row"
          :key="p.name + ci"
          class="tok home"
          :class="{ out: p.subbedOut }"
          :style="tokenStyle('home', ri, homeRows.length, ci, row.length)"
        >
          <span class="num">{{ p.jersey ?? '' }}<span v-if="cardKind(p)" class="card" :class="cardKind(p)" /></span>
          <span class="nm">{{ surname(p.name) }}<span v-if="p.subbedOut" class="arr">↓</span></span>
        </div>
      </template>
    </div>

    <div class="benches">
      <div v-for="t in [{ side: 'home', name: homeName, team: data?.home }, { side: 'away', name: awayName, team: data?.away }]" :key="t.side" class="bench">
        <div class="bhead">
          <span class="dot" :class="t.side" />
          <strong>{{ t.name }}</strong>
          <span v-if="t.team?.formation" class="form">{{ t.team.formation }}</span>
        </div>
        <ul class="blist">
          <li v-for="p in bench(t.team)" :key="p.name" :class="{ in: p.subbedIn }">
            <span class="bnum">{{ p.jersey ?? '–' }}</span>
            <span class="bnm">{{ p.name }}</span>
            <span v-if="cardKind(p)" class="bcard" :class="cardKind(p)" />
            <span v-if="p.subbedIn" class="badge">entrou</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lineup {
  margin-top: 4px;
}
.pitch {
  position: relative;
  width: 100%;
  aspect-ratio: 7 / 10;
  border-radius: 16px;
  border: 1px solid var(--border);
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 9.99%, rgba(255, 255, 255, 0.05) 10% 19.99%),
    var(--grad-pitch, linear-gradient(160deg, #0f2e22, #0a1f18));
  overflow: hidden;
}
.midline {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.18);
}
.circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 22%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
}
.tok {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 64px;
  text-align: center;
}
.tok.out {
  opacity: 0.42;
}
.num {
  position: relative;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-weight: 800;
  font-size: 13px;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
/* card chip on the player token */
.card {
  position: absolute;
  top: -3px;
  right: -4px;
  width: 8px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.5);
}
.card.yellow {
  background: #f5c518;
}
.card.red {
  background: var(--scarlet, #e23744);
}
.tok.home .num {
  background: var(--azure, #2b7fff);
}
.tok.away .num {
  background: var(--scarlet, #e23744);
}
.nm {
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  line-height: 1.1;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arr {
  color: var(--scarlet, #e23744);
  margin-left: 2px;
}
.benches {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
}
@media (max-width: 460px) {
  .benches {
    grid-template-columns: 1fr;
  }
}
.bhead {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  font-size: 14px;
}
.bhead .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.bhead .dot.home {
  background: var(--azure, #2b7fff);
}
.bhead .dot.away {
  background: var(--scarlet, #e23744);
}
.form {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
}
.blist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.blist li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--muted);
}
.blist li.in {
  color: var(--text);
}
.bnum {
  flex: none;
  width: 22px;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.bnm {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bcard {
  flex: none;
  width: 9px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.35);
}
.bcard.yellow {
  background: #f5c518;
}
.bcard.red {
  background: var(--scarlet, #e23744);
}
.badge {
  flex: none;
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--emerald, #16b364);
  background: color-mix(in srgb, var(--emerald, #16b364) 16%, transparent);
  border-radius: 999px;
  padding: 2px 7px;
}
</style>
