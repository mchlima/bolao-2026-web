<script setup lang="ts">
import type { LineupPlayer, LineupTeam, Match, MatchLineup } from '~/types/api';

// Live lineups for a match (ESPN summary feed via /matches/:id/lineup). Two
// teams side by side as lists (number + name + position), with photos when ESPN
// has them; subbed-off players dim with a red ↓, subbed-on with a green ↑. Below:
// the tactical formation per side, then the bench in the same format. Refetches
// on the match realtime channel (+ a 60s poll while live) so subs land on their
// own. Renders nothing until lineups exist (~1h before kickoff).
// `active` is the tab gate: while this tab is hidden it neither subscribes to the
// realtime stream nor polls; it catches up with one refetch when opened. Defaults
// on for standalone use.
const props = defineProps<{ match: Match; active?: boolean }>();
const emit = defineEmits<{ available: [boolean] }>();

const { data, refresh } = await useAsyncData(
  `lineup-${props.match.id}`,
  () => useApi()<MatchLineup>(`/matches/${props.match.id}/lineup`),
);
useRealtime(() => (props.active !== false ? [`match:${props.match.id}`] : []), () => refresh());
watch(() => props.active, (a) => {
  if (a) refresh();
});

// The robot only emits realtime events on score/status/card changes, so poll
// while live too — substitutions don't move the score (endpoint caches 30s).
let pollTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  pollTimer = setInterval(() => {
    if (props.active !== false && props.match.status === 'LIVE') refresh();
  }, 60_000);
});
onBeforeUnmount(() => clearInterval(pollTimer));

const available = computed(() => !!data.value?.available);
watch(available, (v) => emit('available', v), { immediate: true });

const homeName = computed(() => props.match.homeTeam?.shortName ?? props.match.homeTeam?.name ?? 'Casa');
const awayName = computed(() => props.match.awayTeam?.shortName ?? props.match.awayTeam?.name ?? 'Fora');

const LINE_RANK: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
function starters(team: LineupTeam | undefined): LineupPlayer[] {
  return (team?.players ?? [])
    .filter((p) => p.starter)
    .sort((a, b) => (LINE_RANK[a.line] - LINE_RANK[b.line]) || (a.formationPlace ?? 99) - (b.formationPlace ?? 99));
}
function bench(team: LineupTeam | undefined): LineupPlayer[] {
  return (team?.players ?? [])
    .filter((p) => !p.starter)
    .sort((a, b) => Number(a.jersey ?? 99) - Number(b.jersey ?? 99));
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}
function initials(name: string): string {
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] ?? '') + (w[w.length - 1]?.[0] ?? '')).toUpperCase();
}
function cardKind(p: LineupPlayer): 'red' | 'yellow' | null {
  if (p.red > 0 || p.yellow >= 2) return 'red';
  return p.yellow >= 1 ? 'yellow' : null;
}
// Headshots 404 for some players — fall back to initials on error.
const broken = reactive<Record<string, boolean>>({});
const pkey = (p: LineupPlayer) => `${p.jersey}-${p.name}`;
</script>

<template>
  <section v-if="available" class="lineup">
    <div class="heads">
      <span class="thead home">{{ homeName }}</span>
      <span class="thead away">{{ awayName }}</span>
    </div>

    <!-- starters: one team each side -->
    <div class="cols">
      <ul class="col home">
        <li v-for="p in starters(data?.home)" :key="pkey(p)" class="prow" :class="{ out: p.subbedOut }">
          <span class="pav">
            <img v-if="p.photo && !broken[pkey(p)]" :src="p.photo" :alt="p.name" loading="lazy" @error="broken[pkey(p)] = true" />
            <span v-else class="pini">{{ initials(p.name) }}</span>
          </span>
          <span class="pmeta">
            <span class="ptop">
              <span class="pnum">{{ p.jersey }}</span>
              <span class="pname">{{ surname(p.name) }}</span>
              <span v-if="cardKind(p)" class="card" :class="cardKind(p)" />
              <span v-if="p.subbedOut" class="arr down">↓</span>
            </span>
            <span class="ppos">{{ p.position }}</span>
            <span v-if="p.subFor" class="subline" :class="{ green: p.subbedOut, red: p.subbedIn }">
              {{ p.subbedOut ? '↑' : '↓' }} {{ surname(p.subFor) }}
            </span>
          </span>
        </li>
      </ul>
      <ul class="col away">
        <li v-for="p in starters(data?.away)" :key="pkey(p)" class="prow" :class="{ out: p.subbedOut }">
          <span class="pav">
            <img v-if="p.photo && !broken[pkey(p)]" :src="p.photo" :alt="p.name" loading="lazy" @error="broken[pkey(p)] = true" />
            <span v-else class="pini">{{ initials(p.name) }}</span>
          </span>
          <span class="pmeta">
            <span class="ptop">
              <span class="pnum">{{ p.jersey }}</span>
              <span class="pname">{{ surname(p.name) }}</span>
              <span v-if="cardKind(p)" class="card" :class="cardKind(p)" />
              <span v-if="p.subbedOut" class="arr down">↓</span>
            </span>
            <span class="ppos">{{ p.position }}</span>
            <span v-if="p.subFor" class="subline" :class="{ green: p.subbedOut, red: p.subbedIn }">
              {{ p.subbedOut ? '↑' : '↓' }} {{ surname(p.subFor) }}
            </span>
          </span>
        </li>
      </ul>
    </div>

    <!-- coaches + formation. ESPN's feed has no manager name, so we show the -->
    <!-- tactical scheme; the coach line stays "—" until a source provides it.   -->
    <div class="coaches">
      <div class="cch home">
        <span class="cform">{{ data?.home?.formation ?? '—' }}</span>
        <span class="clbl">Técnico não informado</span>
      </div>
      <div class="cch away">
        <span class="cform">{{ data?.away?.formation ?? '—' }}</span>
        <span class="clbl">Técnico não informado</span>
      </div>
    </div>

    <!-- bench -->
    <h3 class="bttl">Reservas</h3>
    <div class="cols">
      <ul class="col home">
        <li v-for="p in bench(data?.home)" :key="pkey(p)" class="prow" :class="{ in: p.subbedIn }">
          <span class="pav sm">
            <img v-if="p.photo && !broken[pkey(p)]" :src="p.photo" :alt="p.name" loading="lazy" @error="broken[pkey(p)] = true" />
            <span v-else class="pini">{{ initials(p.name) }}</span>
          </span>
          <span class="pmeta">
            <span class="ptop">
              <span class="pnum">{{ p.jersey }}</span>
              <span class="pname">{{ surname(p.name) }}</span>
              <span v-if="cardKind(p)" class="card" :class="cardKind(p)" />
              <span v-if="p.subbedIn" class="arr up">↑</span>
            </span>
            <span class="ppos">{{ p.position }}</span>
            <span v-if="p.subFor" class="subline" :class="{ green: p.subbedOut, red: p.subbedIn }">
              {{ p.subbedOut ? '↑' : '↓' }} {{ surname(p.subFor) }}
            </span>
          </span>
        </li>
      </ul>
      <ul class="col away">
        <li v-for="p in bench(data?.away)" :key="pkey(p)" class="prow" :class="{ in: p.subbedIn }">
          <span class="pav sm">
            <img v-if="p.photo && !broken[pkey(p)]" :src="p.photo" :alt="p.name" loading="lazy" @error="broken[pkey(p)] = true" />
            <span v-else class="pini">{{ initials(p.name) }}</span>
          </span>
          <span class="pmeta">
            <span class="ptop">
              <span class="pnum">{{ p.jersey }}</span>
              <span class="pname">{{ surname(p.name) }}</span>
              <span v-if="cardKind(p)" class="card" :class="cardKind(p)" />
              <span v-if="p.subbedIn" class="arr up">↑</span>
            </span>
            <span class="ppos">{{ p.position }}</span>
            <span v-if="p.subFor" class="subline" :class="{ green: p.subbedOut, red: p.subbedIn }">
              {{ p.subbedOut ? '↑' : '↓' }} {{ surname(p.subFor) }}
            </span>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.lineup {
  margin-top: 4px;
}
.heads {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 10px;
}
.thead {
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 7px;
}
.thead::before {
  content: '';
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.thead.home::before {
  background: var(--azure, #2b7fff);
}
.thead.away {
  justify-content: flex-end;
}
.thead.away::before {
  order: 2;
  background: var(--scarlet, #e23744);
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.col {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.prow {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 6px;
  border-radius: 9px;
}
/* dim only the player's own identity — the swap-in line below stays readable */
.prow.out .pav,
.prow.out .ptop,
.prow.out .ppos {
  opacity: 0.42;
}
.prow.in {
  background: color-mix(in srgb, var(--emerald, #16b364) 10%, transparent);
}
/* away side mirrors so each team faces its own edge */
.col.away .prow {
  flex-direction: row-reverse;
  text-align: right;
}
.pav {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-base);
  border: 1px solid var(--border);
  display: grid;
  place-items: center;
}
.pav.sm {
  width: 28px;
  height: 28px;
}
.pav img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pini {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
}
.pmeta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ptop {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.col.away .ptop {
  flex-direction: row-reverse;
}
.pnum {
  flex: none;
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.pname {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ppos {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.subline {
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.subline.green {
  color: var(--emerald, #16b364);
}
.subline.red {
  color: var(--scarlet, #e23744);
}
.card {
  flex: none;
  width: 8px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.35);
}
.card.yellow {
  background: #f5c518;
}
.card.red {
  background: var(--scarlet, #e23744);
}
.arr {
  flex: none;
  font-weight: 900;
  font-size: 13px;
  line-height: 1;
}
.arr.down {
  color: var(--scarlet, #e23744);
}
.arr.up {
  color: var(--emerald, #16b364);
}
.coaches {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0 4px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}
.cch {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cch.away {
  align-items: flex-end;
}
.cform {
  font-weight: 800;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.clbl {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted);
}
.bttl {
  margin: 18px 0 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
</style>
