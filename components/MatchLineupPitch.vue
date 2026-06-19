<script setup lang="ts">
import type { LineupPlayer, LineupTeam, Team, TimelineEvent } from '~/types/api';

// Tactical pitch view of a lineup: the starting XI of both teams placed on a
// football field by formation. Desktop draws the pitch landscape (home attacks
// right, away left); ≤720px it flips to portrait (home at the bottom attacking
// up, away at the top). Positions are derived from the formation string + each
// player's line/formationPlace — ESPN gives no x/y, so we lay players into rows.
// Match events (from the timeline) decorate each avatar with corner badges.
const props = defineProps<{
  home?: LineupTeam;
  away?: LineupTeam;
  events?: TimelineEvent[];
  homeTeam?: Team | null;
  awayTeam?: Team | null;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
}>();

const homeFlag = computed(() => teamFlag(props.homeTeam));
const awayFlag = computed(() => teamFlag(props.awayTeam));

// A starter placed on the pitch: `a` = attack axis (0 = home goal line, 1 = away
// goal line), `w` = cross axis (0..1). CSS turns these into top/left and handles
// the landscape↔portrait flip, so the math here is orientation-agnostic.
interface Placed {
  p: LineupPlayer;
  a: number;
  w: number;
}

const LINE_RANK: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const jnum = (p: LineupPlayer) => Number(p.jersey ?? 99);

// Players-per-row, GK excluded. Prefer the formation string ("4-3-3" → [4,3,3])
// when it accounts for every outfielder; otherwise fall back to the line buckets.
function rowCounts(formation: string | null | undefined, outs: LineupPlayer[]): number[] {
  if (formation) {
    const nums = formation.split(/[^0-9]+/).map((n) => parseInt(n, 10)).filter((n) => n > 0);
    if (nums.length && nums.reduce((s, n) => s + n, 0) === outs.length) return nums;
  }
  const byLine = (['DEF', 'MID', 'FWD'] as const).map((l) => outs.filter((p) => p.line === l).length);
  const counts = byLine.filter((c) => c > 0);
  return counts.length ? counts : [outs.length];
}

function place(team: LineupTeam | undefined, side: 'home' | 'away'): Placed[] {
  const starters = (team?.players ?? []).filter((p) => p.starter);
  if (!starters.length) return [];
  const gk = starters.filter((p) => p.line === 'GK');
  // Ordered by line then formationPlace then jersey so chunking lands defenders
  // before mids before forwards even when formationPlace is missing (seed data).
  const outs = starters
    .filter((p) => p.line !== 'GK')
    .sort(
      (a, b) =>
        LINE_RANK[a.line] - LINE_RANK[b.line] ||
        (a.formationPlace ?? 99) - (b.formationPlace ?? 99) ||
        jnum(a) - jnum(b),
    );

  const rows: LineupPlayer[][] = gk.length ? [gk] : [];
  let i = 0;
  for (const c of rowCounts(team?.formation, outs)) {
    rows.push(outs.slice(i, i + c));
    i += c;
  }
  if (i < outs.length) rows.push(outs.slice(i)); // safety: never drop a player

  const T = rows.length;
  const out: Placed[] = [];
  rows.forEach((row, k) => {
    const depth = T === 1 ? 0.25 : 0.05 + (0.46 - 0.05) * (k / (T - 1));
    row.forEach((p, j) => {
      out.push({ p, a: side === 'home' ? depth : 1 - depth, w: (j + 1) / (row.length + 1) });
    });
  });
  return out;
}

const homePlayers = computed(() => place(props.home, 'home'));
const awayPlayers = computed(() => place(props.away, 'away'));
const allPlayers = computed(() => [
  ...homePlayers.value.map((x) => ({ ...x, side: 'home' as const, clr: props.homeColor })),
  ...awayPlayers.value.map((x) => ({ ...x, side: 'away' as const, clr: props.awayColor })),
]);

// Per-player event tally, keyed by side+name (both feeds use the same Player.name).
interface Tally {
  goals: number;
  ownGoals: number;
  assists: number;
  penMissed: number;
}
const norm = (n: string | null | undefined) => (n ?? '').trim().toLowerCase();
const ekey = (side: string, name: string | null | undefined) => `${side}|${norm(name)}`;

const tallies = computed(() => {
  const map = new Map<string, Tally>();
  const bump = (side: string, name: string | null | undefined, k: keyof Tally) => {
    if (!name) return;
    const key = ekey(side, name);
    const t = map.get(key) ?? { goals: 0, ownGoals: 0, assists: 0, penMissed: 0 };
    t[k]++;
    map.set(key, t);
  };
  for (const e of props.events ?? []) {
    if (!e.side) continue;
    if (e.type === 'GOAL' || e.type === 'PENALTY_GOAL') {
      bump(e.side, e.player, 'goals');
      bump(e.side, e.related, 'assists'); // related = assist on a goal
    } else if (e.type === 'OWN_GOAL') {
      bump(e.side, e.player, 'ownGoals');
    } else if (e.type === 'PENALTY_MISSED') {
      bump(e.side, e.player, 'penMissed');
    }
  }
  return map;
});

// Corner badges around the avatar — fixed slot per event type so they never
// collide (goal=top, card=top-right, assist=right, sub-off=bottom-right,
// pen-miss=bottom-left, own-goal=top-left). Each: position + render kind + count.
interface Badge {
  pos: string;
  kind: 'goal' | 'owngoal' | 'assist' | 'yellow' | 'red' | 'subout' | 'penmiss';
  count: number;
}
function badges(side: 'home' | 'away', p: LineupPlayer): Badge[] {
  const t = tallies.value.get(ekey(side, p.name));
  const out: Badge[] = [];
  if (t?.goals) out.push({ pos: 't', kind: 'goal', count: t.goals });
  if (t?.ownGoals) out.push({ pos: 'tl', kind: 'owngoal', count: t.ownGoals });
  if (t?.assists) out.push({ pos: 'r', kind: 'assist', count: t.assists });
  const card = cardKind(p);
  if (card) out.push({ pos: 'tr', kind: card, count: 1 });
  if (t?.penMissed) out.push({ pos: 'bl', kind: 'penmiss', count: t.penMissed });
  if (p.subbedOut) out.push({ pos: 'br', kind: 'subout', count: 1 });
  return out;
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

const broken = reactive<Record<string, boolean>>({});
const pkey = (p: LineupPlayer) => `${p.jersey}-${p.name}`;
</script>

<template>
  <div class="pitch-wrap">
    <div class="field">
      <!-- markings -->
      <span class="m-mid" />
      <span class="m-circle" />
      <span class="m-box home" />
      <span class="m-box away" />

      <!-- end labels: which team attacks which goal -->
      <span class="endlbl home">
        <span class="ehd">
          <span v-if="homeFlag" class="eflag" v-html="homeFlag" />
          <span class="enm">{{ homeName }}</span>
        </span>
        <span v-if="home?.formation" class="efm">{{ home.formation }}</span>
      </span>
      <span class="endlbl away">
        <span class="ehd">
          <span v-if="awayFlag" class="eflag" v-html="awayFlag" />
          <span class="enm">{{ awayName }}</span>
        </span>
        <span v-if="away?.formation" class="efm">{{ away.formation }}</span>
      </span>

      <!-- players -->
      <div
        v-for="item in allPlayers"
        :key="`${item.side}-${pkey(item.p)}`"
        class="pp"
        :class="{ out: item.p.subbedOut }"
        :style="{ '--a': item.a, '--w': item.w, '--clr': item.clr }"
      >
        <span class="dot">
          <img
            v-if="item.p.photo && !broken[pkey(item.p)]"
            :src="item.p.photo"
            :alt="item.p.name"
            loading="lazy"
            @error="broken[pkey(item.p)] = true"
          />
          <span v-else class="ini">{{ initials(item.p.name) }}</span>

          <!-- event badges distributed around the avatar -->
          <span
            v-for="b in badges(item.side, item.p)"
            :key="b.kind"
            class="ev"
            :class="[`pos-${b.pos}`, `ev-${b.kind}`]"
            :title="b.kind"
          >
            <span v-if="b.kind === 'goal' || b.kind === 'owngoal'" class="evb">⚽</span>
            <span v-else-if="b.kind === 'assist'" class="evtxt">A</span>
            <span v-else-if="b.kind === 'subout'" class="evtxt">↓</span>
            <span v-else-if="b.kind === 'penmiss'" class="evtxt">✕</span>
            <span v-if="b.count > 1" class="evn">{{ b.count }}</span>
          </span>
        </span>
        <span class="nm">{{ surname(item.p.name) }}</span>
        <span v-if="item.p.jersey" class="nmn">{{ item.p.jersey }}</span>
        <span v-if="item.p.subbedOut && item.p.subFor" class="subin">↑ {{ surname(item.p.subFor) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pitch-wrap {
  margin-top: 4px;
}
.field {
  position: relative;
  width: 100%;
  aspect-ratio: 105 / 66; /* landscape on desktop */
  border-radius: 14px;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 10%, transparent 10% 20%),
    linear-gradient(180deg, #2a9c5c, #1f8a4f);
  border: 1px solid rgba(0, 0, 0, 0.2);
}
/* pitch markings */
.m-mid,
.m-circle,
.m-box {
  position: absolute;
  pointer-events: none;
  border: 2px solid rgba(255, 255, 255, 0.45);
}
.m-mid {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 0;
  border-width: 0 0 0 2px;
  transform: translateX(-50%);
}
.m-circle {
  top: 50%;
  left: 50%;
  width: 20%;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.m-box {
  top: 50%;
  width: 13%;
  height: 56%;
  transform: translateY(-50%);
}
.m-box.home {
  left: 0;
  border-left: 0;
}
.m-box.away {
  right: 0;
  border-right: 0;
}
.endlbl {
  position: absolute;
  top: 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  z-index: 1;
}
.endlbl.home {
  left: 10px;
  align-items: flex-start;
}
.endlbl.away {
  right: 10px;
  align-items: flex-end;
}
.ehd {
  display: flex;
  align-items: center;
  gap: 6px;
}
.eflag {
  flex: none;
  width: 22px;
  height: 15px;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.eflag :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.enm {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #fff;
}
.efm {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.85);
}

/* players — positioned via --a (attack axis) and --w (cross axis) */
.pp {
  position: absolute;
  left: calc(var(--a) * 100%);
  top: calc(var(--w) * 100%);
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 72px;
  text-align: center;
}
/* dim only the subbed-off player's identity — event badges (incl. the ↓) and the
   green swap-in line stay readable. Dimming the whole .pp (or .dot) would flatten
   its badge children too, so we target the avatar content + name/number only. */
.pp.out .dot img,
.pp.out .ini,
.pp.out .nm,
.pp.out .nmn {
  opacity: 0.5;
}
.dot {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: visible;
  background: var(--bg-base);
  border: 2px solid var(--clr);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
  display: grid;
  place-items: center;
}
.dot img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.ini {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
}
/* event badges — one fixed slot per type around the avatar's 8 compass points */
.ev {
  position: absolute;
  z-index: 2;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #fff;
  color: #0b0f16;
  border: 1.5px solid rgba(0, 0, 0, 0.25);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}
.pos-t {
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
}
.pos-tr {
  top: -7px;
  right: -7px;
}
.pos-r {
  top: 50%;
  right: -9px;
  transform: translateY(-50%);
}
.pos-br {
  bottom: -7px;
  right: -7px;
}
.pos-b {
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
}
.pos-bl {
  bottom: -7px;
  left: -7px;
}
.pos-l {
  top: 50%;
  left: -9px;
  transform: translateY(-50%);
}
.pos-tl {
  top: -7px;
  left: -7px;
}
.ev-goal {
  background: #fff;
  color: #0b0f16;
}
.ev-owngoal {
  background: var(--scarlet, #e8362b);
  color: #fff;
}
.ev-assist {
  background: #0b0f16;
  color: #fff;
}
.ev-subout {
  background: #fff;
  color: var(--scarlet, #e8362b);
}
.ev-penmiss {
  background: #fff;
  color: var(--scarlet, #e8362b);
}
/* cards keep their rectangular shape instead of the circular chip */
.ev-yellow,
.ev-red {
  width: 11px;
  height: 15px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.4);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.ev-yellow {
  background: #f5c518;
}
.ev-red {
  background: var(--scarlet, #e8362b);
}
.evtxt {
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}
.evb {
  font-size: 13px;
  line-height: 1;
}
.evn {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 13px;
  height: 13px;
  padding: 0 2px;
  border-radius: 7px;
  background: #0b0f16;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  display: grid;
  place-items: center;
  border: 1px solid #fff;
}
.nm {
  max-width: 72px;
  font-size: 12.5px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.nmn {
  margin-top: -1px;
  font-size: 11px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.85);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
/* who came on for a subbed-off starter */
.subin {
  max-width: 76px;
  font-size: 10.5px;
  font-weight: 700;
  color: #7ef0a8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}

/* ≤720px: portrait pitch — home attacks up from the bottom, away down from top */
@media (max-width: 720px) {
  /* full-bleed: cancel the lineup card's 14px padding so the pitch spans the
     full width on mobile. */
  .pitch-wrap {
    margin-inline: -14px;
  }
  .field {
    /* much taller in portrait: each team only uses its own half, so a near-square
       pitch crams 4–5 rows into ~40% of the height and the markers overlap. */
    aspect-ratio: 9 / 20;
    border-radius: 0;
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 10%, transparent 10% 20%),
      linear-gradient(90deg, #2a9c5c, #1f8a4f);
  }
  .m-mid {
    inset: 50% 0 auto 0;
    top: 50%;
    bottom: auto;
    left: 0;
    right: 0;
    width: auto;
    border-width: 2px 0 0 0;
    transform: translateY(-50%);
  }
  .m-circle {
    width: 34%;
  }
  .m-box {
    top: auto;
    left: 50%;
    width: 56%;
    height: 13%;
    transform: translateX(-50%);
  }
  .m-box.home {
    left: 50%;
    right: auto;
    bottom: 0;
    top: auto;
    border-left: 2px solid rgba(255, 255, 255, 0.45);
    border-bottom: 0;
  }
  .m-box.away {
    left: 50%;
    right: auto;
    top: 0;
    border-right: 2px solid rgba(255, 255, 255, 0.45);
    border-top: 0;
  }
  .endlbl.home {
    top: auto;
    bottom: 8px;
    left: 10px;
  }
  .endlbl.away {
    top: 8px;
    right: auto;
    left: 10px;
    align-items: flex-start;
  }
  /* swap axes: attack axis → vertical (bottom = home goal), cross → horizontal.
     Stretch the cross axis 1.2× around center so players use the full-bleed width
     and spread wider apart (e.g. a back-five goes ~10%→90% instead of 17%→83%). */
  .pp {
    left: calc(50% + (var(--w) - 0.5) * 120%);
    top: calc((1 - var(--a)) * 100%);
    width: 60px;
  }
  /* trim the marker so 5-wide rows don't collide horizontally either */
  .dot {
    width: 36px;
    height: 36px;
  }
  .ev {
    width: 16px;
    height: 16px;
  }
  .nm {
    max-width: 60px;
    font-size: 11px;
  }
  .nmn {
    font-size: 10px;
  }
  .subin {
    max-width: 62px;
    font-size: 9.5px;
  }
}
</style>
