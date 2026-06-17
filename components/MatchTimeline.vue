<script setup lang="ts">
import type { Match, MatchTimeline, TimelineEvent } from '~/types/api';

// Event timeline of a match (goals/cards/subs), consumed from OUR backend
// (/matches/:id/events) — grouped by period, home on the left, away on the
// right of a centre spine. Refetches on the match realtime channel so new
// events land live. Renders nothing until events exist.
const props = defineProps<{ match: Match }>();
const emit = defineEmits<{ available: [boolean] }>();

const { data, refresh } = await useAsyncData(
  `timeline-${props.match.id}`,
  () => useApi()<MatchTimeline>(`/matches/${props.match.id}/events`),
);
useRealtime(() => [`match:${props.match.id}`], () => refresh());
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  poll = setInterval(() => {
    if (props.match.status === 'LIVE') refresh();
  }, 60_000);
});
onBeforeUnmount(() => clearInterval(poll));

const available = computed(() => !!data.value?.available);
watch(available, (v) => emit('available', v), { immediate: true });
// The tab is always present once a match is live or finished. When no event has
// landed yet (0:0, no cards/subs — the feed gives only kickoff + delay noise),
// show a state line instead of a blank panel: a live "jogo em andamento" prompt
// while playing, or a "sem lances" note once it has ended. Real rows replace it
// the moment the first goal/card/sub/whistle is ingested.
const isLive = computed(() => props.match.status === 'LIVE');
const isFinished = computed(() => props.match.status === 'FINISHED');

// Keep the newest event visible: when a live update appends events (count grows),
// scroll the end marker into view, clearing the fixed bottom nav via scroll-margin.
const endRef = ref<HTMLElement | null>(null);
const eventCount = computed(() =>
  (data.value?.periods ?? []).reduce((n, p) => n + p.events.length, 0),
);
let prevCount = -1;
watch(
  eventCount,
  async (n) => {
    const grew = prevCount >= 0 && n > prevCount;
    prevCount = n;
    if (!grew || import.meta.server) return;
    await nextTick();
    endRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  },
  { immediate: true },
);

function surname(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}
const isGoal = (t: string) => t.includes('GOAL'); // GOAL / OWN_GOAL / PENALTY_GOAL
// Coloured tag next to the player's name (pênalti/contra, sending-off, miss).
function rowTag(e: TimelineEvent): string | null {
  if (e.type === 'PENALTY_GOAL') return 'pênalti';
  if (e.type === 'OWN_GOAL') return 'contra';
  if (e.type === 'SECOND_YELLOW') return '2º amarelo';
  if (e.type === 'PENALTY_MISSED') return e.detail ?? 'perdeu';
  return null;
}
// The danger-toned tags (red) vs the default gold ones.
const dangerTag = (t: string) => t === 'SECOND_YELLOW' || t === 'PENALTY_MISSED';
// Whistle markers (end of a period): "Intervalo" for the 1st half, "Fim de jogo"
// for the final whistle, else "Fim do <período>".
const lastPeriodNum = computed(() => {
  const ps = data.value?.periods ?? [];
  return ps.length ? ps[ps.length - 1].period : 0;
});
function whistleLabel(period: number, label: string): string {
  if (period === 1) return 'Intervalo';
  if (period === lastPeriodNum.value && props.match.status === 'FINISHED') return 'Fim de jogo';
  return `Fim do ${label}`;
}
</script>

<template>
  <section v-if="available" class="tl">
    <template v-for="per in data?.periods ?? []" :key="per.period">
      <div class="per"><span>{{ per.label }}</span></div>

      <template v-for="(e, i) in per.events" :key="i">
      <!-- referee whistle ending a period -->
      <div v-if="e.type === 'PERIOD_END'" class="whistle">
        <span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13 7a6 6 0 1 0-5.2 8.94l.9 2.56a1 1 0 0 0 .95.68h1a1 1 0 0 0 .95-.69l.78-2.4A6 6 0 0 0 18 11h3a1 1 0 1 0 0-2h-8Zm-5 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" /></svg>
          {{ whistleLabel(per.period, per.label) }}<small v-if="e.minute"> · {{ e.minute }}</small>
        </span>
      </div>

      <!-- VAR ruling tied to a team (a disallowed goal) shows on that team's side
           with the SAME vivid card as a real goal, but red and struck through —
           "a goal, that didn't count". A generic review (no side) stays a chip. -->
      <div v-else-if="e.type === 'VAR' && e.side" class="ev goal void" :class="e.side">
        <span class="min">{{ e.minute }}</span>
        <div class="content">
          <span class="icon goal"><span class="ball">⚽</span></span>
          <span class="body">
            <span class="nm">
              <span class="strike">{{ e.player ? surname(e.player) : (e.detail || 'Revisão do VAR') }}</span>
            </span>
          </span>
        </div>
      </div>

      <!-- VAR review / decision with no team — centred chip -->
      <div v-else-if="e.type === 'VAR'" class="var">
        <span>
          <b class="var-badge">VAR</b>{{ e.detail || 'Revisão do VAR' }}<small v-if="e.minute"> · {{ e.minute }}</small>
        </span>
      </div>

      <!-- stoppage: injury / drinks break / VAR check -->
      <div v-else-if="e.type === 'DELAY'" class="delay">
        <span>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" /></svg>
          {{ e.detail || 'Jogo paralisado' }}<small v-if="e.minute"> · {{ e.minute }}</small>
        </span>
      </div>

      <!-- running play-by-play (foul/offside/corner/shot/penalty) — a lighter
           side row: a coloured dot, the type label and the player when known -->
      <div v-else-if="isMinorEvent(e.type)" class="ev minor" :class="e.side ?? 'home'">
        <span class="min">{{ e.minute }}</span>
        <div class="content">
          <span class="mdot" :class="minorCategory(e.type)" aria-hidden="true" />
          <span class="mbody">
            <span class="mlabel">{{ eventLabel(e.type) }}</span>
            <span v-if="e.player" class="mwho">{{ surname(e.player) }}</span>
          </span>
        </div>
      </div>

      <div v-else class="ev" :class="[e.side ?? 'home', { goal: isGoal(e.type) }]">
        <span class="min">{{ e.minute }}</span>

        <div class="content">
          <!-- icon -->
          <span class="icon" :class="{ goal: isGoal(e.type) }">
            <span v-if="e.type === 'YELLOW'" class="card yellow" />
            <span v-else-if="e.type === 'RED'" class="card red" />
            <span v-else-if="e.type === 'SECOND_YELLOW'" class="card2" aria-hidden="true"><span class="card yellow" /><span class="card red" /></span>
            <span v-else-if="e.type === 'PENALTY_MISSED'" class="miss" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8" /><path d="M6.5 17.5 17.5 6.5" /></svg>
            </span>
            <span v-else-if="e.type === 'SUBSTITUTION'" class="subico">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="up" d="M17 7v12M17 7l-3 3M17 7l3 3" /><path class="down" d="M7 17V5M7 17l-3-3M7 17l3-3" /></svg>
            </span>
            <span v-else-if="isGoal(e.type)" class="ball">⚽</span>
          </span>

          <!-- body -->
          <span class="body">
            <template v-if="e.type === 'SUBSTITUTION'">
              <span class="nm in">{{ surname(e.player) }}</span>
              <span v-if="e.related" class="nm out">{{ surname(e.related) }}</span>
            </template>
            <template v-else>
              <span class="nm">
                {{ surname(e.player) }}<span v-if="rowTag(e)" class="tag" :class="{ danger: dangerTag(e.type) }">{{ rowTag(e) }}</span><span v-if="isGoal(e.type) && e.detail" class="tag muted">{{ e.detail }}</span>
              </span>
              <span v-if="e.related && isGoal(e.type)" class="assist">{{ surname(e.related) }}</span>
            </template>
          </span>
        </div>
      </div>
      </template>
    </template>
    <div ref="endRef" class="tl-end" aria-hidden="true" />
  </section>

  <!-- live or finished, but no event to show — keep the tab meaningful -->
  <div v-else-if="isLive || isFinished" class="tl-wait">
    <span v-if="isLive" class="tl-dot" aria-hidden="true" />
    <svg v-else class="tl-whistle" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M13 7a6 6 0 1 0-5.2 8.94l.9 2.56a1 1 0 0 0 .95.68h1a1 1 0 0 0 .95-.69l.78-2.4A6 6 0 0 0 18 11h3a1 1 0 1 0 0-2h-8Zm-5 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" /></svg>
    <p class="tl-wait-t">{{ isLive ? 'A partida começou.' : 'Partida encerrada.' }}</p>
    <p class="tl-wait-s">
      {{ isLive
        ? 'A narração aparece aqui ao vivo — gols, cartões, faltas, finalizações e mais.'
        : 'Sem lances registrados nesta partida.' }}
    </p>
  </div>
</template>

<style scoped>
.tl {
  position: relative;
  padding: 2px 0 8px;
}
/* centre spine, behind the rows; the minute pills + period chips break it */
.tl::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: var(--border);
  z-index: 0;
}

/* period divider — a centred chip that interrupts the spine */
.per {
  position: relative;
  z-index: 1;
  text-align: center;
  margin: 18px 0 10px;
}
.per span {
  display: inline-block;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 13px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

/* one event row: home in col 1 (hugs centre from the left), minute pill on the
   spine in col 2, away in col 3 (hugs centre from the right) */
.ev {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: 12px;
  padding: 7px 0;
}
.min {
  grid-column: 2;
  min-width: 36px;
  text-align: center;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10.5px;
  font-weight: 800;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.content {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  max-width: 100%;
}

/* GOL — a ação que contagia. The content pops in inside a vivid pill with a
   glow, a one-shot burst ring radiates out, and the ball gets kicked (bounce +
   spin). Each goal row animates once when it mounts — i.e. the moment it lands
   live, and once when you open the tab. Stays distinctive while scrolling. */
.ev.goal .content {
  position: relative;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--emerald) 26%, transparent),
    color-mix(in srgb, var(--azure) 16%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--emerald) 50%, var(--border));
  border-radius: 13px;
  padding: 7px 12px;
  box-shadow: 0 8px 22px -12px color-mix(in srgb, var(--emerald) 85%, transparent);
  animation: goalPop 0.5s cubic-bezier(0.18, 0.9, 0.3, 1.25) both;
}
.ev.goal .content::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  pointer-events: none;
  animation: goalBurst 0.8s ease-out both;
}
.ev.goal .min {
  color: var(--emerald);
  border-color: color-mix(in srgb, var(--emerald) 55%, var(--border));
}
.ev.goal .nm {
  font-size: 14px;
  font-weight: 800;
}
.ev.goal .ball {
  animation: ballKick 0.6s ease 0.08s both;
}

@keyframes goalPop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes goalBurst {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--emerald) 60%, transparent);
  }
  100% {
    box-shadow: 0 0 0 18px transparent;
  }
}
@keyframes ballKick {
  0% {
    transform: rotate(0) scale(1);
  }
  25% {
    transform: rotate(-22deg) scale(1.4);
  }
  55% {
    transform: rotate(14deg) scale(1.12);
  }
  100% {
    transform: rotate(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ev.goal .content,
  .ev.goal .content::after,
  .ev.goal .ball {
    animation: none;
  }
}
.ev.home .content {
  grid-column: 1;
  justify-self: end;
  flex-direction: row-reverse;
  text-align: right;
}
.ev.away .content {
  grid-column: 3;
  justify-self: start;
  text-align: left;
}

.icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
}
.ball {
  display: inline-block;
  font-size: 15px;
  line-height: 1;
}
.card {
  width: 11px;
  height: 14px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.3);
}
.card.yellow {
  background: #f5c518;
}
.card.red {
  background: var(--scarlet, #e23744);
}
.subico {
  display: grid;
  place-items: center;
}
.subico .up {
  stroke: var(--emerald);
}
.subico .down {
  stroke: var(--scarlet, #e23744);
}

.body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: 1px;
}
.nm {
  font-size: 13.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nm.in {
  color: var(--emerald);
}
.nm.out {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.assist {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.assist::before {
  content: '↳ ';
  opacity: 0.7;
}
.tag {
  margin-left: 6px;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--gold);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
  border-radius: 4px;
  padding: 1px 4px;
  vertical-align: middle;
}
/* sending-off / missed-penalty tag (red) and the muted goal-method tag */
.tag.danger {
  color: var(--scarlet, #e23744);
  border-color: color-mix(in srgb, var(--scarlet, #e23744) 45%, transparent);
}
.tag.muted {
  color: var(--muted);
  border-color: var(--border);
  text-transform: none;
  letter-spacing: 0;
}
/* second yellow → two overlapped cards */
.card2 {
  position: relative;
  width: 16px;
  height: 16px;
}
.card2 .card {
  position: absolute;
}
.card2 .yellow {
  top: 0;
  left: 1px;
  transform: rotate(-14deg);
}
.card2 .red {
  bottom: 0;
  right: 1px;
  transform: rotate(10deg);
}
/* missed / saved penalty */
.miss {
  display: grid;
  place-items: center;
  color: var(--scarlet, #e23744);
}
/* referee whistle — end of a period; a filled chip that breaks the spine */
.whistle {
  position: relative;
  z-index: 1;
  text-align: center;
  margin: 12px 0;
}
.whistle span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 13px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text);
}
.whistle svg {
  flex: none;
  color: var(--muted);
}
.whistle small {
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  color: var(--muted);
}

/* disallowed goal — the SAME vivid card as a real goal (.ev.goal), recoloured
   red and with the scorer's name struck through: "a goal, that didn't count" */
.ev.goal.void .content {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--scarlet, #e23744) 24%, transparent),
    color-mix(in srgb, var(--scarlet, #e23744) 10%, transparent)
  );
  border-color: color-mix(in srgb, var(--scarlet, #e23744) 50%, var(--border));
  box-shadow: 0 8px 22px -12px color-mix(in srgb, var(--scarlet, #e23744) 85%, transparent);
}
.ev.goal.void .content::after {
  animation: goalBurstVoid 0.8s ease-out both;
}
.ev.goal.void .min {
  color: var(--scarlet, #e23744);
  border-color: color-mix(in srgb, var(--scarlet, #e23744) 55%, var(--border));
}
.ev.goal.void .ball {
  filter: grayscale(0.35);
}
.ev.goal.void .strike {
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--scarlet, #e23744) 80%, transparent);
  text-decoration-thickness: 2px;
}
@keyframes goalBurstVoid {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--scarlet, #e23744) 55%, transparent);
  }
  100% {
    box-shadow: 0 0 0 18px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ev.goal.void .content,
  .ev.goal.void .content::after,
  .ev.goal.void .ball {
    animation: none;
  }
}

/* VAR + stoppage markers — same centred chip as the whistle, different accents */
.var,
.delay {
  position: relative;
  z-index: 1;
  text-align: center;
  margin: 12px 0;
}
.var span,
.delay span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 13px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text);
}
.var span {
  border-color: color-mix(in srgb, var(--azure, #1e7ff0) 45%, var(--border));
}
.delay span {
  font-weight: 700;
  color: var(--muted);
}
.var svg,
.delay svg {
  flex: none;
  color: var(--muted);
}
.var small,
.delay small {
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
  color: var(--muted);
}
.var-badge {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: #fff;
  background: var(--azure, #1e7ff0);
  border-radius: 4px;
  padding: 2px 5px;
}

/* running play-by-play (minor) rows — lighter than the headline events: a small
   coloured dot + the type label + the player, in a muted single line */
.ev.minor {
  padding: 4px 0;
}
.ev.minor .content {
  gap: 7px;
  align-items: flex-start;
}
.mbody {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: 1px;
}
.mlabel {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text);
}
.mwho {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.mdot {
  flex: none;
  margin-top: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
}
.mdot.shot {
  background: var(--azure, #1e7ff0);
}
.mdot.foul {
  background: var(--gold, #c8a04a);
}
.mdot.offside {
  background: #e07b39;
}
.mdot.pen {
  background: var(--scarlet, #e23744);
}

/* the auto-scroll target; leave room for the fixed bottom nav */
.tl-end {
  scroll-margin-bottom: calc(var(--nav-h, 0px) + 14px);
}

/* live, pre-first-event placeholder */
.tl-wait {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 40px 24px 36px;
}
.tl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--scarlet, #e23744);
  margin-bottom: 6px;
  animation: tlDot 1.2s infinite;
}
.tl-whistle {
  color: var(--muted);
  margin-bottom: 6px;
}
@keyframes tlDot {
  50% { opacity: 0.3; }
}
.tl-wait-t {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}
.tl-wait-s {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  max-width: 26ch;
  line-height: 1.4;
}
@media (prefers-reduced-motion: reduce) {
  .tl-dot { animation: none; }
}
</style>
