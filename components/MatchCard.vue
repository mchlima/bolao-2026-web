<script setup lang="ts">
import type { Match, Prediction } from '~/types/api';

const props = defineProps<{
  match: Match;
  prediction?: Prediction | null;
  // When inside a pool, the footer "Ranking" link points at the pool-scoped
  // match view instead of the global one. Predictions stay global (single).
  poolId?: string;
}>();
const emit = defineEmits<{ saved: [Prediction] }>();
const auth = useAuthStore();
const tz = useTz();

const isLive = computed(() => props.match.status === 'LIVE');
const isCancelled = computed(() => props.match.status === 'CANCELLED');
// LIVE/FINISHED show a scoreline; a null side counts as 0 (e.g. 1-0 mid-match).
const hasResult = computed(
  () => props.match.status === 'LIVE' || props.match.status === 'FINISHED',
);
const shownHome = computed(() => props.match.homeScore ?? 0);
const shownAway = computed(() => props.match.awayScore ?? 0);
// Winner emphasis on LIVE/FINISHED (loser is dimmed, winner bold).
const homeWins = computed(() => hasResult.value && shownHome.value > shownAway.value);
const awayWins = computed(() => hasResult.value && shownAway.value > shownHome.value);
const homeName = computed(() => props.match.homeTeam?.name ?? props.match.homeSourceLabel ?? 'A definir');
const awayName = computed(() => props.match.awayTeam?.name ?? props.match.awaySourceLabel ?? 'A definir');
// Effective prediction window (reactive; mirrors the backend rule and locks at
// kickoff even without a refetch). See composables/useMatchOpen.
const isOpen = useMatchOpen(() => props.match);
const editable = computed(() => isOpen.value && auth.isAuthenticated);
const hasPrediction = computed(() => !!props.prediction);
const needsPrediction = computed(() => editable.value && !props.prediction);

const statusMeta = computed(() => {
  switch (props.match.status) {
    case 'LIVE':
      return { label: 'Ao vivo', color: 'var(--scarlet)', live: true };
    case 'FINISHED':
      return { label: 'Encerrada', color: 'var(--muted)', live: false };
    case 'CANCELLED':
      return { label: 'Cancelada', color: 'var(--muted)', live: false };
    case 'POSTPONED':
      return { label: 'Adiada', color: 'var(--muted)', live: false };
    default:
      return { label: 'Agendada', color: 'var(--azure)', live: false };
  }
});

// Postponed games have no real date yet (placeholder kickoff) → show "a definir".
const kickoffText = computed(() =>
  props.match.status === 'POSTPONED' ? 'Data a definir' : formatKickoff(props.match.kickoffAt, tz.value),
);

const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  WINNER_GOALS: 'var(--azure)',
  GOAL_DIFF: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  LOSER_GOALS: 'var(--scarlet)',
  NONE: 'var(--muted)',
};
const tierColor = computed(() =>
  props.prediction?.score ? TIER_COLOR[props.prediction.score.tier] : 'var(--muted)',
);

// Ranking link target — opens the match view inside the matching tabbed shell:
// pool-scoped when in a pool, else tournament-scoped (same behavior). Falls back
// to the standalone page only if the match has no tournament.
const rankTo = computed(() => {
  if (props.poolId) return `/pools/${props.poolId}/matches/${props.match.id}`;
  if (props.match.seasonId)
    return `/tournaments/${props.match.seasonId}/matches/${props.match.id}`;
  return `/matches/${props.match.id}`;
});

// editable prediction state
const home = ref<number>(props.prediction?.homeScore ?? 0);
const away = ref<number>(props.prediction?.awayScore ?? 0);
const saving = ref(false);
const ui = useUiStore();
const clamp = (n: number) => Math.max(0, Math.min(99, n));

// Keep the steppers in sync if the prediction loads/changes from outside.
watch(
  () => props.prediction,
  (p) => {
    home.value = p?.homeScore ?? 0;
    away.value = p?.awayScore ?? 0;
  },
);

// Dirty = steppers differ from the saved prediction (or nothing saved yet).
const dirty = computed(
  () =>
    !props.prediction ||
    home.value !== props.prediction.homeScore ||
    away.value !== props.prediction.awayScore,
);

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    const saved = await useApi()<Prediction>('/predictions', {
      method: 'POST',
      body: { matchId: props.match.id, homeScore: home.value, awayScore: away.value },
    });
    ui.toast('success', 'Palpite salvo ✓');
    emit('saved', saved);
  } catch (e) {
    ui.toast(
      'error',
      (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar.',
    );
  } finally {
    saving.value = false;
  }
}

const leftLabel = computed(() =>
  props.match.groupName
    ? `Grupo ${props.match.groupName}`
    : (props.match.phaseLabel ?? ''),
);
</script>

<template>
  <div class="match" :class="{ live: isLive, predicted: hasPrediction, pending: needsPrediction }">
    <div v-if="isLive" aria-hidden="true" class="live-glow" />

    <!-- header line -->
    <div class="top">
      <span class="lbl">{{ leftLabel }}<template v-if="leftLabel"> · </template>{{ kickoffText }}</span>
      <span
        class="status"
        :class="{ pulse: statusMeta.live }"
        :style="{ color: statusMeta.color, borderColor: statusMeta.color }"
      >
        <span v-if="statusMeta.live" class="dot" />{{ statusMeta.label }}
      </span>
    </div>

    <!-- main row: home · center · away (single line, uniform height) -->
    <div class="row">
      <div class="side home" :class="{ win: homeWins, lose: awayWins }">
        <span class="tname" :title="homeName">{{ homeName }}</span>
        <TeamBadge :team="match.homeTeam" :placeholder="match.homeSourceLabel" :size="46" />
      </div>

      <div class="center">
        <!-- editable: compact prediction stepper + icon save beside the score -->
        <template v-if="editable">
          <div class="edit">
            <div class="col">
              <button class="step" aria-label="menos" @click="home = clamp(home - 1)">−</button>
              <span class="font-numeric num">{{ home }}</span>
              <button class="step" aria-label="mais" @click="home = clamp(home + 1)">+</button>
            </div>
            <span class="font-numeric colon">:</span>
            <div class="col">
              <button class="step" aria-label="menos" @click="away = clamp(away - 1)">−</button>
              <span class="font-numeric num">{{ away }}</span>
              <button class="step" aria-label="mais" @click="away = clamp(away + 1)">+</button>
            </div>
            <button
              class="save"
              :class="{ dirty }"
              :disabled="saving || !dirty"
              :title="hasPrediction ? 'Atualizar palpite' : 'Confirmar palpite'"
              :aria-label="hasPrediction ? 'Atualizar palpite' : 'Confirmar palpite'"
              @click="save"
            >
              <svg v-if="!saving" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <span v-else class="spin" />
            </button>
          </div>
          <span class="cap">{{ hasPrediction ? 'Seu palpite' : 'Faça seu palpite' }}</span>
        </template>

        <!-- live / finished: actual scoreline -->
        <template v-else-if="hasResult">
          <div class="score">
            <span>{{ shownHome }}</span><span class="colon">:</span><span>{{ shownAway }}</span>
          </div>
        </template>

        <!-- cancelled -->
        <div v-else-if="isCancelled" class="score off">— : —</div>

        <!-- scheduled, not editable (logged out / locked) -->
        <div v-else class="vs">×</div>
      </div>

      <div class="side away" :class="{ win: awayWins, lose: homeWins }">
        <TeamBadge :team="match.awayTeam" :placeholder="match.awaySourceLabel" :size="46" />
        <span class="tname" :title="awayName">{{ awayName }}</span>
      </div>
    </div>

    <!-- footer line: prediction summary / context + ranking link (uniform) -->
    <div class="foot">
      <div class="foot-main">
        <!-- locked prediction: guess + tier/points -->
        <span
          v-if="!editable && prediction"
          class="chip"
          :style="{ color: tierColor, borderColor: tierColor }"
        >
          Palpite {{ prediction.homeScore }}:{{ prediction.awayScore }}
          <template v-if="prediction.score"> · {{ tierLabel(prediction.score.tier, hasResult && shownHome === shownAway) }} +{{ prediction.score.points }}</template>
        </span>

        <!-- editable + already has a saved guess -->
        <span v-else-if="editable && prediction" class="muted-mini">
          salvo {{ prediction.homeScore }}:{{ prediction.awayScore }}
        </span>

        <!-- open, not logged in -->
        <NuxtLink v-else-if="isOpen && !auth.isAuthenticated" to="/login" class="cta-mini">
          Entre para palpitar <AppIcon name="arrowRight" :size="13" :stroke="2.4" />
        </NuxtLink>

        <!-- cancelled note -->
        <span v-else-if="isCancelled" class="muted-mini">Cancelada — não pontua</span>

        <!-- venue fallback (keeps the line populated) -->
        <span v-else-if="match.stadium" class="muted-mini venue">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          {{ match.stadium.name }}
        </span>
      </div>

      <NuxtLink
        v-if="match.homeTeam && match.awayTeam"
        :to="rankTo"
        class="rank-link"
      >
        Ranking
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.match {
  position: relative;
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px 15px;
  box-shadow: var(--shadow);
}
.match.live {
  border-color: rgba(232, 54, 43, 0.55);
}
.match.predicted {
  box-shadow: inset 4px 0 0 0 var(--emerald), var(--shadow);
  border-color: color-mix(in srgb, var(--emerald) 32%, var(--border));
}
.match.pending {
  box-shadow: inset 4px 0 0 0 var(--gold), var(--shadow);
  border-color: color-mix(in srgb, var(--gold) 42%, var(--border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 6%, transparent), transparent), var(--bg-surface);
}
.live-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(70% 90% at 50% 0%, rgba(232, 54, 43, 0.1), transparent 70%);
  pointer-events: none;
}

/* header */
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  position: relative;
}
.lbl {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex: none;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 9px;
}
.status.pulse {
  background: rgba(232, 54, 43, 0.12);
  animation: livePulse 1.8s infinite;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--scarlet);
  animation: liveDot 1.2s infinite;
}

/* main row — centered match cluster (home ▸ score ◂ away) */
.row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  position: relative;
  max-width: 560px;
  margin: 2px auto 0;
}
.side {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
/* Flags sit next to the score (inner), names fill outward — so the badges stay
   aligned regardless of name length. Home name hugs its flag on the right, away
   on the left. */
.side .tname {
  flex: 1;
  min-width: 0;
}
.side.home .tname {
  text-align: right;
}
.side.away .tname {
  text-align: left;
}
.tname {
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.2s, font-weight 0.2s;
}
/* winner emphasis on settled/live results */
.side.win .tname {
  font-weight: 800;
  color: var(--text);
}
.side.lose {
  opacity: 0.5;
}
.center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 92px;
}
.score {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 42px;
  line-height: 0.85;
  letter-spacing: 0.01em;
}
.score.off {
  color: var(--muted);
  letter-spacing: 0.06em;
  font-size: 26px;
}
.colon {
  color: var(--muted);
}
.vs {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  color: var(--muted);
  font-weight: 800;
  font-size: 14px;
}

/* editable inline stepper + icon save */
.edit {
  display: flex;
  align-items: center;
  gap: 8px;
}
.col {
  display: flex;
  align-items: center;
  gap: 5px;
}
.step {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.step:active {
  transform: scale(0.92);
}
.num {
  font-size: 30px;
  line-height: 0.85;
  min-width: 22px;
  text-align: center;
}
.edit .colon {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 26px;
}
.save {
  margin-left: 2px;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--muted);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.save.dirty {
  background: var(--gold);
  border-color: transparent;
  color: #0a0e14;
  box-shadow: 0 4px 12px -4px rgba(244, 184, 30, 0.6);
}
.save:disabled {
  cursor: default;
}
.save:not(.dirty):disabled {
  opacity: 0.6;
}
.spin {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.cap {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
}
.match.pending .cap {
  color: var(--gold);
}

/* footer */
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
  min-height: 20px;
}
.foot-main {
  min-width: 0;
  display: flex;
  align-items: center;
}
.chip {
  font-size: 11px;
  font-weight: 800;
  border: 1px solid;
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.muted-mini {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.muted-mini.venue {
  max-width: 220px;
}
.cta-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--gold);
}
.rank-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
}
.rank-link:hover {
  color: var(--text);
}
</style>
