<script setup lang="ts">
import type { LineupPlayer, LineupTeam, Match, MatchLineup, MatchTimeline, TimelineEvent } from '~/types/api';

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
// Timeline feeds the per-player event badges on the pitch (goals/assists/penalty
// misses — cards & subs already live on the lineup payload). Same Player.name on
// both feeds, so events match starters by name+side.
const { data: timeline, refresh: refreshTimeline } = await useAsyncData(
  `lineup-events-${props.match.id}`,
  () => useApi()<MatchTimeline>(`/matches/${props.match.id}/events`),
);
const events = computed<TimelineEvent[]>(() => (timeline.value?.periods ?? []).flatMap((p) => p.events));
function refreshAll() {
  refresh();
  refreshTimeline();
}
useRealtime(() => (props.active !== false ? [`match:${props.match.id}`] : []), () => refreshAll());
watch(() => props.active, (a) => {
  if (a) refreshAll();
});

// The robot only emits realtime events on score/status/card changes, so poll
// while live too — substitutions don't move the score (endpoint caches 30s).
let pollTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  pollTimer = setInterval(() => {
    if (props.active !== false && props.match.status === 'LIVE') refreshAll();
  }, 60_000);
});
onBeforeUnmount(() => clearInterval(pollTimer));

const available = computed(() => !!data.value?.available);
watch(available, (v) => emit('available', v), { immediate: true });

const homeName = computed(() => props.match.homeTeam?.shortName ?? props.match.homeTeam?.name ?? 'Casa');
const awayName = computed(() => props.match.awayTeam?.shortName ?? props.match.awayTeam?.name ?? 'Fora');
// Team colors arrive as bare 6-hex (e.g. "417505") — prepend # so they're valid
// CSS; fall back to the home/away accent when missing.
function teamColor(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return /^[0-9a-f]{3,8}$/i.test(raw) ? `#${raw}` : raw;
}
const homeColor = computed(() => teamColor(props.match.homeTeam?.color, 'var(--azure)'));
const awayColor = computed(() => teamColor(props.match.awayTeam?.color, 'var(--scarlet)'));

// View toggle: the tactical pitch ("campo") is the default; the list stays as the
// alternate. The pitch shows one team at a time, picked by the team toggle.
const view = ref<'campo' | 'lista'>('campo');
const pitchSide = ref<'home' | 'away'>('home');

const LINE_RANK: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
function starters(team: LineupTeam | undefined): LineupPlayer[] {
  return (team?.players ?? [])
    .filter((p) => p.starter)
    .sort((a, b) => (LINE_RANK[a.line] - LINE_RANK[b.line]) || (a.formationPlace ?? 99) - (b.formationPlace ?? 99));
}

// --- Tactical pitch layout ---------------------------------------------------
// ESPN gives no x/y, so we lay the starting XI into rows by formation. The team
// always attacks UP: GK pinned at the bottom (row 0), forwards near the top.
const jnum = (p: LineupPlayer) => Number(p.jersey ?? 99);
// Players-per-row (GK excluded). Prefer the formation string ("4-3-3" → [4,3,3])
// when it accounts for every outfielder; else fall back to the line buckets.
function rowCounts(formation: string | null | undefined, outs: LineupPlayer[]): number[] {
  if (formation) {
    const nums = formation.split(/[^0-9]+/).map((n) => parseInt(n, 10)).filter((n) => n > 0);
    if (nums.length && nums.reduce((s, n) => s + n, 0) === outs.length) return nums;
  }
  const byLine = (['DEF', 'MID', 'FWD'] as const).map((l) => outs.filter((p) => p.line === l).length);
  const counts = byLine.filter((c) => c > 0);
  return counts.length ? counts : [outs.length];
}
// A placed starter: y = 0 (top/attack) … 1 (bottom/goal), x = 0…1 across.
interface Placed { p: LineupPlayer; x: number; y: number }
function placeStarters(team: LineupTeam | undefined): Placed[] {
  const xi = (team?.players ?? []).filter((p) => p.starter);
  if (!xi.length) return [];
  const gk = xi.filter((p) => p.line === 'GK');
  const outs = xi
    .filter((p) => p.line !== 'GK')
    .sort(
      (a, b) =>
        LINE_RANK[a.line] - LINE_RANK[b.line] ||
        (a.formationPlace ?? 99) - (b.formationPlace ?? 99) ||
        jnum(a) - jnum(b),
    );
  // rows ordered goal→attack (defenders first); render top-to-bottom reversed.
  const rows: LineupPlayer[][] = [];
  let i = 0;
  for (const c of rowCounts(team?.formation, outs)) {
    rows.push(outs.slice(i, i + c));
    i += c;
  }
  if (i < outs.length) rows.push(outs.slice(i)); // safety: never drop a player
  if (gk.length) rows.unshift(gk); // GK is the deepest row (bottom)

  const T = rows.length;
  const placed: Placed[] = [];
  rows.forEach((row, k) => {
    // k=0 (GK) at the very bottom (y≈0.94), last row near the top (y≈0.08).
    const y = T <= 1 ? 0.5 : 0.94 - (0.94 - 0.08) * (k / (T - 1));
    row.forEach((p, j) => placed.push({ p, x: (j + 1) / (row.length + 1), y }));
  });
  return placed;
}
const pitchTeam = computed<LineupTeam | undefined>(() =>
  pitchSide.value === 'home' ? data.value?.home : data.value?.away,
);
const pitchPlayers = computed(() => placeStarters(pitchTeam.value));
const pitchFormation = computed(() => pitchTeam.value?.formation ?? null);
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

// Goals/own-goals per player from the timeline (cards & subs already live on the
// lineup payload). Same Player.name on both feeds, so we key by side+name.
const norm = (n: string | null | undefined) => (n ?? '').trim().toLowerCase();
const gkey = (side: string, name: string | null | undefined) => `${side}|${norm(name)}`;
const goalTally = computed(() => {
  const m = new Map<string, { goals: number; ownGoals: number }>();
  const bump = (side: string, name: string | null | undefined, k: 'goals' | 'ownGoals') => {
    if (!name) return;
    const key = gkey(side, name);
    const t = m.get(key) ?? { goals: 0, ownGoals: 0 };
    t[k]++;
    m.set(key, t);
  };
  for (const e of events.value) {
    if (!e.side) continue;
    if (e.type === 'GOAL' || e.type === 'PENALTY_GOAL') bump(e.side, e.player, 'goals');
    else if (e.type === 'OWN_GOAL') bump(e.side, e.player, 'ownGoals');
  }
  return m;
});
function pgoals(side: 'home' | 'away', p: LineupPlayer): { goals: number; ownGoals: number } {
  return goalTally.value.get(gkey(side, p.name)) ?? { goals: 0, ownGoals: 0 };
}
// Headshots 404 for some players — fall back to initials on error.
const broken = reactive<Record<string, boolean>>({});
const pkey = (p: LineupPlayer) => `${p.jersey}-${p.name}`;
</script>

<template>
  <section v-if="available" class="lineup">
    <!-- Campo ↔ Lista segmented control (dark fill = active). -->
    <div class="seg" role="tablist" aria-label="Modo de visualização da escalação">
      <button
        class="segbtn"
        :class="{ on: view === 'campo' }"
        role="tab"
        :aria-selected="view === 'campo'"
        @click="view = 'campo'"
      >
        <AppIcon name="stadium" :size="14" :stroke="2.4" />
        <span>Campo</span>
      </button>
      <button
        class="segbtn"
        :class="{ on: view === 'lista' }"
        role="tab"
        :aria-selected="view === 'lista'"
        @click="view = 'lista'"
      >
        <AppIcon name="list" :size="14" :stroke="2.4" />
        <span>Lista</span>
      </button>
    </div>

    <!-- CAMPO: single-team tactical pitch with a home/away team toggle. -->
    <div v-if="view === 'campo'" class="campo">
      <div class="teampills" role="tablist" aria-label="Selecionar time">
        <button
          class="tpill"
          :class="{ on: pitchSide === 'home' }"
          role="tab"
          :aria-selected="pitchSide === 'home'"
          @click="pitchSide = 'home'"
        >
          <TeamBadge :team="match.homeTeam" :size="18" />
          <span>{{ homeName }}</span>
        </button>
        <button
          class="tpill"
          :class="{ on: pitchSide === 'away' }"
          role="tab"
          :aria-selected="pitchSide === 'away'"
          @click="pitchSide = 'away'"
        >
          <TeamBadge :team="match.awayTeam" :size="18" />
          <span>{{ awayName }}</span>
        </button>
      </div>

      <div class="pitch">
        <!-- markings -->
        <span class="m-mid" />
        <span class="m-circle" />
        <span class="m-box top" />
        <span class="m-box bottom" />

        <!-- starters as dots, laid out by formation (GK at the bottom) -->
        <div
          v-for="item in pitchPlayers"
          :key="pkey(item.p)"
          class="pp"
          :class="{ out: item.p.subbedOut, gk: item.p.line === 'GK' }"
          :style="{ '--x': item.x, '--y': item.y }"
        >
          <span class="dot">
            <span class="dnum">{{ item.p.jersey ?? '–' }}</span>
            <span v-if="cardKind(item.p)" class="dcard" :class="cardKind(item.p)" />
            <span v-if="pgoals(pitchSide, item.p).goals" class="dgoal" title="Gol">⚽</span>
          </span>
          <span class="chip">{{ surname(item.p.name) }}</span>
        </div>
      </div>

      <p v-if="pitchFormation" class="fline">FORMAÇÃO · {{ pitchFormation }}</p>
    </div>

    <!-- LISTA: starters, one team each side -->
    <div v-if="view === 'lista'" class="cols">
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
              <span v-if="pgoals('home', p).goals" class="goal" title="Gol">⚽<span v-if="pgoals('home', p).goals > 1" class="gn">×{{ pgoals('home', p).goals }}</span></span>
              <span v-if="pgoals('home', p).ownGoals" class="goal og" title="Gol contra">⚽<span v-if="pgoals('home', p).ownGoals > 1" class="gn">×{{ pgoals('home', p).ownGoals }}</span></span>
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
              <span v-if="pgoals('away', p).goals" class="goal" title="Gol">⚽<span v-if="pgoals('away', p).goals > 1" class="gn">×{{ pgoals('away', p).goals }}</span></span>
              <span v-if="pgoals('away', p).ownGoals" class="goal og" title="Gol contra">⚽<span v-if="pgoals('away', p).ownGoals > 1" class="gn">×{{ pgoals('away', p).ownGoals }}</span></span>
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
    <!-- In the pitch view the formation already shows at each end, so list-only. -->
    <div v-if="view === 'lista'" class="coaches">
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
              <span v-if="pgoals('home', p).goals" class="goal" title="Gol">⚽<span v-if="pgoals('home', p).goals > 1" class="gn">×{{ pgoals('home', p).goals }}</span></span>
              <span v-if="pgoals('home', p).ownGoals" class="goal og" title="Gol contra">⚽<span v-if="pgoals('home', p).ownGoals > 1" class="gn">×{{ pgoals('home', p).ownGoals }}</span></span>
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
              <span v-if="pgoals('away', p).goals" class="goal" title="Gol">⚽<span v-if="pgoals('away', p).goals > 1" class="gn">×{{ pgoals('away', p).goals }}</span></span>
              <span v-if="pgoals('away', p).ownGoals" class="goal og" title="Gol contra">⚽<span v-if="pgoals('away', p).ownGoals > 1" class="gn">×{{ pgoals('away', p).ownGoals }}</span></span>
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
  /* Panel so the lineup reads as a card on the match surface instead of floating
     transparently (matches the Informações tab's card). */
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
}
/* Campo↔Lista segmented control — pill track, dark fill on the active cell. */
.seg {
  display: flex;
  gap: 0;
  padding: 3px;
  margin-bottom: 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-surface);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}
.segbtn {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
  font-size: var(--fs-xs);
  padding: 7px 16px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}
.segbtn:hover:not(.on) {
  color: var(--text);
}
.segbtn.on {
  background: var(--text);
  color: #fff;
}

/* CAMPO ------------------------------------------------------------------- */
.campo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
/* team toggle pills — active one filled azure */
.teampills {
  display: inline-flex;
  gap: 6px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-surface);
}
.tpill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
  font-size: var(--fs-xs);
  padding: 5px 13px 5px 7px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}
.tpill:hover:not(.on) {
  color: var(--text);
}
.tpill.on {
  background: var(--azure);
  color: #fff;
}
.tpill :deep(img),
.tpill :deep(svg) {
  flex: none;
}

/* the green field */
.pitch {
  position: relative;
  width: 100%;
  aspect-ratio: 0.66;
  border-radius: 14px;
  overflow: hidden;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.045) 0 9%, transparent 9% 18%),
    linear-gradient(180deg, #1faa61 0%, #169152 100%);
  border: 1px solid rgba(0, 0, 0, 0.18);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.12);
}
.m-mid,
.m-circle,
.m-box {
  position: absolute;
  pointer-events: none;
  border: 2px solid rgba(255, 255, 255, 0.4);
}
.m-mid {
  left: 0;
  right: 0;
  top: 50%;
  height: 0;
  border-width: 2px 0 0 0;
  transform: translateY(-50%);
}
.m-circle {
  top: 50%;
  left: 50%;
  width: 32%;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.m-box {
  left: 50%;
  width: 54%;
  height: 13%;
  transform: translateX(-50%);
}
.m-box.top {
  top: 0;
  border-top: 0;
}
.m-box.bottom {
  bottom: 0;
  border-bottom: 0;
}

/* a placed starter */
.pp {
  position: absolute;
  left: calc(var(--x) * 100%);
  top: calc(var(--y) * 100%);
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 64px;
}
.pp.out .dot,
.pp.out .chip {
  opacity: 0.5;
}
.dot {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  display: grid;
  place-items: center;
}
.pp.gk .dot {
  background: var(--gold);
  border-color: rgba(0, 0, 0, 0.18);
}
.dnum {
  font-family: 'Bebas Neue', var(--font-display, sans-serif);
  font-size: var(--fs-base);
  line-height: 1;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--text);
}
.dcard {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 8px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.4);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.dcard.yellow {
  background: #f5c518;
}
.dcard.red {
  background: var(--scarlet, #e8362b);
}
.dgoal {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--fs-xs);
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}
.chip {
  max-width: 64px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  font-size: var(--fs-xs);
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  backdrop-filter: blur(1px);
}
.fline {
  margin: 2px 0 0;
  font-family: 'Oswald', var(--font-display, sans-serif);
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: center;
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
/* dim only the player's own identity (photo/name/number/position) — the event
   icons and the swap-in line stay readable. Targets the text spans individually
   rather than .ptop, since opacity on a parent would flatten its children too. */
.prow.out .pav,
.prow.out .pnum,
.prow.out .pname,
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
  font-size: var(--fs-xs);
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
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.pname {
  font-size: var(--fs-sm);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ppos {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.subline {
  font-size: var(--fs-xs);
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
.goal {
  flex: none;
  display: inline-flex;
  align-items: center;
  font-size: var(--fs-sm);
  line-height: 1;
}
/* own goal reads as a goal against — tag it with a red "GC" so it's unmistakable */
.goal.og::after {
  content: 'GC';
  margin-left: 1px;
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--scarlet, #e8362b);
}
.gn {
  margin-left: 1px;
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
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
  font-size: var(--fs-sm);
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
  font-size: var(--fs-base);
  font-variant-numeric: tabular-nums;
}
.clbl {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
}
.bttl {
  margin: 18px 0 8px;
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
</style>
