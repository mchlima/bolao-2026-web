<script setup lang="ts">
import type { StandingsRow, Team } from '~/types/api';

const props = withDefaults(
  defineProps<{
    rows: StandingsRow[];
    title?: string | null;
    // Green zone — highlight the top N positions (direct qualification), e.g. 2 for a WC group.
    qualifyCount?: number;
    // Yellow zone — highlight positions yellowFrom..yellowTo (e.g. the 3rd in a group, or
    // the best-8 thirds). Used for the "may advance / best third-placed" band.
    yellowFrom?: number;
    yellowTo?: number;
    yellowLabel?: string;
    // Compact = group mini-table (fewer columns on small screens).
    compact?: boolean;
    // Render the color legend inside the card. Off when the parent shows a shared one.
    showLegend?: boolean;
  }>(),
  {
    title: null,
    qualifyCount: 0,
    yellowFrom: 0,
    yellowTo: 0,
    yellowLabel: 'Pode avançar (3º)',
    compact: false,
    showLegend: true,
  },
);

const inYellow = (pos: number) =>
  props.yellowFrom > 0 && pos >= props.yellowFrom && pos <= props.yellowTo;

// StandingsTeam is a subset of Team; TeamBadge's helpers only read
// logoUrl/countryCode/shortName/name, which are all present.
const asTeam = (t: StandingsRow['team']) => t as unknown as Team;
</script>

<template>
  <div class="stand">
    <div v-if="title" class="cap font-display">{{ title }}</div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th class="pos">#</th>
            <th class="team">Time</th>
            <th class="num strong">P</th>
            <th class="num">J</th>
            <th class="num">V</th>
            <th class="num">E</th>
            <th class="num">D</th>
            <th class="num hide-sm">GP</th>
            <th class="num hide-sm">GC</th>
            <th class="num">SG</th>
            <th class="num hide-sm">%</th>
            <th v-if="!compact" class="form hide-sm">Últimos</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="row">
          <tr
            v-for="row in rows"
            :key="row.team.id"
            :class="{
              qz: qualifyCount > 0 && row.position <= qualifyCount,
              tz: inYellow(row.position),
            }"
          >
            <td class="pos">
              <span class="pbadge">{{ row.position }}</span>
            </td>
            <td class="team">
              <TeamBadge :team="asTeam(row.team)" :size="22" />
              <span class="tname">{{ row.team.shortName }}</span>
              <span
                v-if="row.live"
                class="rec"
                title="Em jogo agora — classificação provisória"
                aria-label="Em jogo ao vivo"
              />
            </td>
            <td class="num strong">{{ row.points }}</td>
            <td class="num">{{ row.played }}</td>
            <td class="num">{{ row.wins }}</td>
            <td class="num">{{ row.draws }}</td>
            <td class="num">{{ row.losses }}</td>
            <td class="num hide-sm">{{ row.goalsFor }}</td>
            <td class="num hide-sm">{{ row.goalsAgainst }}</td>
            <td class="num">{{ row.goalDiff > 0 ? '+' + row.goalDiff : row.goalDiff }}</td>
            <td class="num hide-sm muted">{{ row.pct.toFixed(0) }}</td>
            <td v-if="!compact" class="form hide-sm">
              <span
                v-for="(r, i) in row.form"
                :key="i"
                class="pill"
                :class="r.toLowerCase()"
                :title="r === 'W' ? 'Vitória' : r === 'D' ? 'Empate' : 'Derrota'"
                >{{ r === 'W' ? 'V' : r === 'D' ? 'E' : 'D' }}</span
              >
            </td>
          </tr>
        </TransitionGroup>
      </table>
    </div>
    <div v-if="showLegend && (qualifyCount > 0 || yellowFrom > 0)" class="legend">
      <span v-if="qualifyCount > 0" class="lg"><span class="dot green" /> Classificação direta</span>
      <span v-if="yellowFrom > 0" class="lg"><span class="dot yellow" /> {{ yellowLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.stand {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
}
.cap {
  font-weight: 700;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 12px 14px 8px;
}
.scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 9px 6px;
  text-align: center;
  white-space: nowrap;
}
th {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
}
tbody tr {
  border-bottom: 1px solid var(--border);
}
tbody tr:last-child {
  border-bottom: none;
}
/* Animated reordering: when positions change (e.g. live results), rows slide to
   their new spot instead of snapping (FLIP via <TransitionGroup>). */
.row-move {
  transition:
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.55s ease;
}
/* A row in transit floats above its neighbours so it slides over, not under. */
.row-move {
  position: relative;
  z-index: 1;
}
/* New rows (first results of the table) fade in rather than pop. */
.row-enter-active {
  transition: opacity 0.4s ease;
}
.row-enter-from {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .row-move,
  .row-enter-active {
    transition: none;
  }
}
.pos {
  width: 34px;
}
.pbadge {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
}
.team {
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 110px;
}
.tname {
  font-weight: 600;
}
/* "Ao vivo" REC dot — pulsing red, marks a team currently playing. */
.rec {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e5484d;
  box-shadow: 0 0 0 0 rgba(229, 72, 77, 0.7);
  animation: rec-pulse 1.4s ease-out infinite;
}
@keyframes rec-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(229, 72, 77, 0.6);
    opacity: 1;
  }
  70% {
    box-shadow: 0 0 0 6px rgba(229, 72, 77, 0);
    opacity: 0.85;
  }
  100% {
    box-shadow: 0 0 0 0 rgba(229, 72, 77, 0);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rec {
    animation: none;
  }
}
.num {
  font-variant-numeric: tabular-nums;
}
.num.strong {
  font-weight: 800;
}
.muted {
  color: var(--muted);
}
/* Qualification zone (green) — left accent bar + tint. */
.qz td:first-child {
  box-shadow: inset 3px 0 0 var(--pitch, #1f9d55);
}
.qz {
  background: rgba(31, 157, 85, 0.07);
}
/* Third-place / best-third band (yellow). */
.tz td:first-child {
  box-shadow: inset 3px 0 0 #e8b007;
}
.tz {
  background: rgba(232, 176, 7, 0.13);
}
.form {
  display: flex;
  gap: 3px;
  justify-content: flex-end;
  padding-right: 12px;
}
.pill {
  display: inline-grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
}
.pill.w {
  background: #1f9d55;
}
.pill.d {
  background: #9aa0a6;
}
.pill.l {
  background: #e5484d;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  font-size: 11px;
  color: var(--muted);
  padding: 8px 14px;
  border-top: 1px solid var(--border);
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.dot.green {
  background: rgba(31, 157, 85, 0.6);
}
.dot.yellow {
  background: rgba(232, 176, 7, 0.75);
}
@media (max-width: 560px) {
  .hide-sm {
    display: none;
  }
}
</style>
