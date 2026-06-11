<script setup lang="ts">
import type { Match, Prediction } from '~/types/api';

const props = defineProps<{ match: Match; prediction?: Prediction | null }>();
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
// Effective prediction window: admin override (predictionsOpen) wins; otherwise
// the automatic rule (SCHEDULED + before kickoff). Terminal states never open.
// Mirrors the backend PredictionsService.acceptsPredictions.
const isOpen = computed(() => {
  const m = props.match;
  if (!m.homeTeam || !m.awayTeam) return false;
  if (m.status === 'FINISHED' || m.status === 'CANCELLED') return false;
  const auto =
    m.status === 'SCHEDULED' && new Date(m.kickoffAt).getTime() > Date.now();
  return m.predictionsOpen ?? auto;
});
const editable = computed(() => isOpen.value && auth.isAuthenticated);
// Visual state: already predicted vs still pending (open + logged in + no guess).
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
    default:
      return { label: 'Agendada', color: 'var(--azure)', live: false };
  }
});

const TIER_COLOR: Record<string, string> = {
  EXACT: 'var(--emerald)',
  ONE_TEAM_SCORE: 'var(--azure)',
  CLOSE: 'var(--gold)',
  OUTCOME: 'var(--magenta)',
  NONE: 'var(--muted)',
};
const tierColor = computed(() =>
  props.prediction?.score ? TIER_COLOR[props.prediction.score.tier] : 'var(--muted)',
);

// editable prediction state
const home = ref<number>(props.prediction?.homeScore ?? 0);
const away = ref<number>(props.prediction?.awayScore ?? 0);
const saving = ref(false);
const ui = useUiStore();
const clamp = (n: number) => Math.max(0, Math.min(99, n));

async function save() {
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

    <div class="top">
      <span class="lbl">{{ leftLabel }} · {{ formatKickoff(match.kickoffAt, tz) }}</span>
      <span
        class="status"
        :class="{ pulse: statusMeta.live }"
        :style="{ color: statusMeta.color, borderColor: statusMeta.color }"
      >
        <span v-if="statusMeta.live" class="dot" />{{ statusMeta.label }}
      </span>
    </div>

    <div class="teams">
      <div class="side">
        <TeamBadge :team="match.homeTeam" :placeholder="match.homeSourceLabel" :size="50" />
        <span class="abbr">{{ teamAbbr(match.homeTeam, match.homeSourceLabel) }}</span>
      </div>
      <div class="center">
        <div v-if="hasResult" class="score">
          <span>{{ shownHome }}</span><span class="colon">:</span><span>{{ shownAway }}</span>
        </div>
        <div v-else-if="isCancelled" class="score off">— : —</div>
        <div v-else class="vs">×</div>
      </div>
      <div class="side">
        <TeamBadge :team="match.awayTeam" :placeholder="match.awaySourceLabel" :size="50" />
        <span class="abbr">{{ teamAbbr(match.awayTeam, match.awaySourceLabel) }}</span>
      </div>
    </div>

    <div v-if="match.stadium" class="venue">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
      <span>{{ match.stadium.name }} · {{ match.stadium.city }}</span>
    </div>

    <!-- editable prediction -->
    <div v-if="editable" class="pred">
      <div class="pred-head">
        <span class="pred-title">Seu palpite</span>
        <span class="pred-hint">use +/− para ajustar</span>
      </div>
      <div class="stepper">
        <div class="col">
          <button class="step" @click="home = clamp(home - 1)">−</button>
          <span class="num">{{ home }}</span>
          <button class="step" @click="home = clamp(home + 1)">+</button>
        </div>
        <span class="num colon">:</span>
        <div class="col">
          <button class="step" @click="away = clamp(away - 1)">−</button>
          <span class="num">{{ away }}</span>
          <button class="step" @click="away = clamp(away + 1)">+</button>
        </div>
      </div>
      <button class="btn btn-gold btn-block save" :disabled="saving" @click="save">
        {{ prediction ? 'Atualizar palpite' : 'Confirmar palpite' }}
      </button>
    </div>

    <!-- locked prediction -->
    <div v-else-if="prediction" class="pred locked">
      <div class="pred-head">
        <span class="pred-title">Seu palpite</span>
        <span
          v-if="prediction.score"
          class="tier"
          :style="{ color: tierColor, borderColor: tierColor }"
        >
          {{ tierLabel(prediction.score.tier) }} · +{{ prediction.score.points }}
        </span>
      </div>
      <div class="locked-score">
        <span class="num">{{ prediction.homeScore }}</span>
        <span class="num colon">:</span>
        <span class="num">{{ prediction.awayScore }}</span>
      </div>
    </div>

    <!-- cancelled -->
    <div v-else-if="isCancelled" class="cancelled">
      Partida cancelada — não gera pontos
    </div>

    <!-- not logged, open -->
    <NuxtLink v-else-if="isOpen" to="/login" class="btn btn-block login-cta">
      Entre para palpitar →
    </NuxtLink>

    <!-- match ranking link (teams defined) -->
    <NuxtLink
      v-if="match.homeTeam && match.awayTeam"
      :to="`/matches/${match.id}`"
      class="rank-btn"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v3a6 6 0 0 1-12 0Z"/><path d="M6 5H3v1a3 3 0 0 0 3 3M18 5h3v1a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
      Ranking da partida
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    </NuxtLink>
  </div>
</template>

<style scoped>
.match {
  position: relative;
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 0;
}
.match.live {
  border-color: rgba(232, 54, 43, 0.55);
}
/* Already predicted: calm green left accent. */
.match.predicted {
  box-shadow: inset 4px 0 0 0 var(--emerald), var(--shadow);
  border-color: color-mix(in srgb, var(--emerald) 32%, var(--border));
}
/* Open and not predicted yet: gold accent + faint tint to draw the eye. */
.match.pending {
  box-shadow: inset 4px 0 0 0 var(--gold), var(--shadow);
  border-color: color-mix(in srgb, var(--gold) 42%, var(--border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 7%, transparent), transparent), var(--bg-surface);
}
.live-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(70% 90% at 50% 0%, rgba(232, 54, 43, 0.12), transparent 70%);
  pointer-events: none;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
  position: relative;
}
.lbl {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
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
.teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  position: relative;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.abbr {
  font-size: 12px;
  font-weight: 700;
}
.center {
  min-width: 90px;
  display: grid;
  place-items: center;
}
.score {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 44px;
  line-height: 0.85;
}
.score.off {
  color: var(--muted);
  letter-spacing: 0.08em;
  font-size: 32px;
}
.colon {
  color: var(--muted);
}
.vs {
  color: var(--muted);
  font-weight: 700;
}
.venue {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}
.venue span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* prediction panel */
.pred {
  margin-top: 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 9%, var(--bg-base)), var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--gold) 28%, var(--border));
  border-radius: 14px;
  padding: 12px 14px;
}
.pred-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.pred-title {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gold);
}
.pred-hint {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
}
.tier {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 9px;
}
.stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.col {
  display: flex;
  align-items: center;
  gap: 9px;
}
.step {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.num {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 46px;
  line-height: 0.85;
  min-width: 26px;
  text-align: center;
}
.save {
  margin-top: 12px;
  font-size: 13px;
  padding: 10px;
}
.msg {
  display: block;
  text-align: center;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted);
  margin-top: 6px;
}
.locked .locked-score {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.cancelled {
  margin-top: 14px;
  background: repeating-linear-gradient(45deg, var(--bg-base), var(--bg-base) 10px, color-mix(in srgb, var(--muted) 7%, var(--bg-base)) 10px, color-mix(in srgb, var(--muted) 7%, var(--bg-base)) 20px);
  border: 1px dashed var(--border);
  border-radius: 14px;
  padding: 14px;
  text-align: center;
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 700;
  font-style: italic;
}
.login-cta {
  margin-top: 12px;
  font-size: 12.5px;
}
.rank-btn {
  margin-top: 11px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  color: var(--text);
  border-radius: 11px;
  font-weight: 700;
  font-size: 12.5px;
}
.rank-btn:hover {
  border-color: color-mix(in srgb, var(--gold) 50%, var(--border));
}
</style>
