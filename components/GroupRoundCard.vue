<script setup lang="ts">
import type { Match, RoundBlock } from '~/types/api';

const props = defineProps<{
  seasonId: string;
  rounds: RoundBlock[];
  // Open on this round (e.g. a given match's round); falls back to the current one.
  initialRoundId?: string;
}>();
const tz = useTz();

// Default round: the explicit one if given; otherwise the round the competition
// is currently on — the furthest round that already has a played (FINISHED/LIVE)
// match. Using "latest played" rather than "first unplayed" is robust to
// postponed games that linger as SCHEDULED in earlier rounds (common in a
// league). Falls back to the first unplayed round, then the last.
const currentIndex = computed(() => {
  if (props.initialRoundId) {
    const j = props.rounds.findIndex((r) => r.roundId === props.initialRoundId);
    if (j !== -1) return j;
  }
  let latestPlayed = -1;
  props.rounds.forEach((r, i) => {
    if (r.matches.some((m) => m.status === 'FINISHED' || m.status === 'LIVE')) latestPlayed = i;
  });
  if (latestPlayed !== -1) return latestPlayed;
  const firstUnplayed = props.rounds.findIndex((r) =>
    r.matches.some((m) => m.status === 'SCHEDULED' || m.status === 'LIVE'),
  );
  return firstUnplayed === -1 ? Math.max(0, props.rounds.length - 1) : firstUnplayed;
});

const sel = ref(0);
watch(currentIndex, (i) => { sel.value = i; }, { immediate: true });
// Re-clamp if the rounds list changes (realtime refresh).
watch(() => props.rounds.length, (n) => { if (sel.value > n - 1) sel.value = Math.max(0, n - 1); });

const round = computed(() => props.rounds[sel.value] ?? null);
function step(delta: number) {
  const next = sel.value + delta;
  if (next >= 0 && next < props.rounds.length) sel.value = next;
}

function hasResult(m: Match) {
  return m.status === 'LIVE' || m.status === 'FINISHED';
}
</script>

<template>
  <div v-if="rounds.length" class="rcard">
    <div class="rc-head">
      <button class="arrow" :disabled="sel <= 0" aria-label="Rodada anterior" @click="step(-1)">
        <AppIcon name="chevronRight" :size="16" :stroke="2.4" class="flip" />
      </button>
      <span class="rc-title font-display">{{ round?.label }}</span>
      <button class="arrow" :disabled="sel >= rounds.length - 1" aria-label="Próxima rodada" @click="step(1)">
        <AppIcon name="chevronRight" :size="16" :stroke="2.4" />
      </button>
    </div>

    <div class="rc-body">
      <NuxtLink
        v-for="m in round?.matches ?? []"
        :key="m.id"
        :to="`/futebol/jogo/${m.slug || m.id}`"
        class="fix"
        :class="{ live: m.status === 'LIVE' }"
      >
        <div class="fx-top">
          <span class="venue">{{ m.stadium?.name ?? '' }}</span>
          <span class="when">{{ m.status === 'POSTPONED' ? 'A definir' : formatKickoff(m.kickoffAt, tz) }}</span>
        </div>
        <div class="fx-main">
          <span class="t home">
            <span class="ab">{{ teamAbbr(m.homeTeam, m.homeSourceLabel) }}</span>
            <TeamBadge :team="m.homeTeam" :placeholder="m.homeSourceLabel" :size="22" />
          </span>
          <span class="mid">
            <b v-if="hasResult(m)" class="font-numeric score">{{ m.homeScore ?? 0 }}<span class="x">:</span>{{ m.awayScore ?? 0 }}</b>
            <span v-else class="vs">×</span>
          </span>
          <span class="t away">
            <TeamBadge :team="m.awayTeam" :placeholder="m.awaySourceLabel" :size="22" />
            <span class="ab">{{ teamAbbr(m.awayTeam, m.awaySourceLabel) }}</span>
          </span>
        </div>
        <div class="fx-foot">
          <StatusPill v-if="m.status === 'LIVE'" label="Ao vivo" tone="scarlet" live />
          <span v-else-if="m.status === 'POSTPONED'" class="adiada">Adiada</span>
          <span class="detail">Ver detalhes <AppIcon name="chevronRight" :size="11" :stroke="2.4" /></span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.rcard {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-surface);
  overflow: hidden;
  align-self: start;
}
.rc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-base);
}
.arrow {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.13s, opacity 0.13s;
}
.arrow:hover:not(:disabled) {
  color: var(--text);
}
.arrow:disabled {
  opacity: 0.32;
  cursor: default;
}
.flip {
  transform: rotate(180deg);
}
.rc-title {
  flex: 1;
  text-align: center;
  font-weight: 700;
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rc-body {
  display: flex;
  flex-direction: column;
}
.fix {
  display: block;
  padding: 11px 14px;
  transition: background 0.12s;
}
.fix + .fix {
  border-top: 1px solid var(--border);
}
.fix:hover {
  background: color-mix(in srgb, var(--muted) 5%, transparent);
}
.fix.live {
  background: color-mix(in srgb, var(--scarlet) 6%, transparent);
}
.fx-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 7px;
}
.venue {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.when {
  flex: 0 0 auto;
}
.fx-main {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}
.t {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.t.home {
  justify-content: flex-end;
}
.ab {
  font-weight: 700;
  font-size: var(--fs-sm);
  white-space: nowrap;
}
.mid {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  min-width: 36px;
}
.score {
  font-size: var(--fs-lg);
  line-height: 1;
}
.score .x {
  color: var(--muted);
  margin: 0 1px;
}
.vs {
  color: var(--muted);
  font-weight: 700;
  font-size: var(--fs-sm);
}
.fx-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.adiada {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
}
.detail {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--emerald);
}
</style>
