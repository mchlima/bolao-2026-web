<script setup lang="ts">
import type { Match, RankingEntry, RankingResponse } from '~/types/api';

// Shared live match companion: result + your prediction vs the score + your
// points + the live ranking. Used by MatchRankingView (tournament-wide) and
// PoolMatchView (pool members). Data is fetched by the wrapper and passed in;
// the prediction editor is global (POST /predictions) and emits `refresh`.
const props = withDefaults(
  defineProps<{
    match: Match;
    ranking: RankingResponse | null;
    title?: string;
    backLabel?: string;
    hideBack?: boolean;
  }>(),
  { title: 'Ranking da partida', backLabel: 'Voltar', hideBack: false },
);
const emit = defineEmits<{ back: []; refresh: [] }>();

const auth = useAuthStore();
const ui = useUiStore();

const MEDALS = ['var(--gold)', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['66px', '50px', '40px'];

const match = computed(() => props.match);
const ranking = computed(() => props.ranking);

// Tabs: "Bolão" (this ranking) vs "Escalação" (the live lineup). The lineup tab
// only appears once lineups exist (MatchLineup reports availability) — before
// that the board renders exactly as before, with no tab bar. The active tab is
// driven by the URL (?aba=escalacao) so it's linkable and survives back/forward.
const route = useRoute();
const lineupAvailable = ref(false);
const timelineAvailable = ref(false);
const statsAvailable = ref(false);
const matchTabs = computed(() => {
  const tabs = [{ key: 'bolao', label: 'Bolão' }];
  if (lineupAvailable.value) tabs.push({ key: 'escalacao', label: 'Escalação' });
  if (timelineAvailable.value) tabs.push({ key: 'tempo', label: 'Linha do tempo' });
  if (statsAvailable.value) tabs.push({ key: 'stats', label: 'Estatísticas' });
  return tabs;
});
const activeTab = computed(() => {
  const aba = route.query.aba;
  if (aba === 'escalacao' && lineupAvailable.value) return 'escalacao';
  if (aba === 'tempo' && timelineAvailable.value) return 'tempo';
  if (aba === 'stats' && statsAvailable.value) return 'stats';
  return 'bolao';
});
function tabTo(key: string) {
  const query = { ...route.query };
  if (key === 'bolao') delete query.aba;
  else query.aba = key;
  return { query };
}
const playing = computed(
  () => match.value.status === 'LIVE' || match.value.status === 'FINISHED',
);
const isLive = computed(() => match.value.status === 'LIVE');
const shownHome = computed(() => (playing.value ? (match.value.homeScore ?? 0) : '–'));
const shownAway = computed(() => (playing.value ? (match.value.awayScore ?? 0) : '–'));
const homeWins = computed(
  () => playing.value && (match.value.homeScore ?? 0) > (match.value.awayScore ?? 0),
);
const awayWins = computed(
  () => playing.value && (match.value.awayScore ?? 0) > (match.value.homeScore ?? 0),
);
const homeName = computed(() => match.value.homeTeam?.name ?? match.value.homeSourceLabel ?? 'A definir');
const awayName = computed(() => match.value.awayTeam?.name ?? match.value.awaySourceLabel ?? 'A definir');

const me = computed(() => ranking.value?.currentUser ?? null);
const hasResult = computed(() => !!ranking.value?.result);
const provisional = computed(() => !!ranking.value?.provisional);
const revealed = computed(() => ranking.value?.revealed !== false);
const entries = computed(() => ranking.value?.entries ?? []);
const myPred = computed(() => me.value?.prediction ?? null);
const myTier = computed(() => me.value?.tier ?? null);
const myPoints = computed(() => me.value?.points ?? 0);
const scored = computed(() => provisional.value || hasResult.value); // points exist
// Current result is a draw — drives the "Acertou o empate" vs "Acertou o vencedor" label.
const resultIsDraw = computed(
  () => scored.value && (match.value.homeScore ?? 0) === (match.value.awayScore ?? 0),
);

// Editable prediction (same reactive rule as MatchCard). Palpite is global.
const isOpen = useMatchOpen(() => match.value);
const editable = computed(() => isOpen.value && auth.isAuthenticated);
const clampScore = (n: number) => Math.max(0, Math.min(99, n));
const ph = ref(0);
const pa = ref(0);
const saving = ref(false);
watchEffect(() => {
  ph.value = me.value?.prediction?.home ?? 0;
  pa.value = me.value?.prediction?.away ?? 0;
});
async function savePrediction() {
  saving.value = true;
  try {
    await useApi()('/predictions', {
      method: 'POST',
      body: { matchId: match.value.id, homeScore: ph.value, awayScore: pa.value },
    });
    ui.toast('success', 'Palpite salvo ✓');
    emit('refresh');
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar.');
  } finally {
    saving.value = false;
  }
}

const stateMeta = computed(() => {
  if (!ranking.value) return { label: 'Aguardando', color: 'var(--muted)', live: false };
  if (provisional.value) return { label: 'Ao vivo · parcial', color: 'var(--scarlet)', live: true };
  if (hasResult.value) return { label: 'Resultado final', color: 'var(--emerald)', live: false };
  return { label: 'Aguardando resultado', color: 'var(--muted)', live: false };
});

const top3 = computed(() =>
  hasResult.value && entries.value.length >= 3 ? entries.value.slice(0, 3) : [],
);
const rest = computed(() => (top3.value.length ? entries.value.slice(3) : entries.value));
const inTop = computed(
  () => !!me.value && entries.value.some((e) => e.user.id === me.value!.user.id),
);
const podium = computed(() =>
  [top3.value[1], top3.value[0], top3.value[2]]
    .map((e, i) => ({ e, slot: [1, 0, 2][i] }))
    .filter((x) => x.e),
);

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
function color(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 42%)`;
}
function guess(e: { prediction?: { home: number; away: number } }): string {
  return e.prediction ? `${e.prediction.home}:${e.prediction.away}` : '—';
}
const isMe = (e: RankingEntry) => !!me.value && e.user.id === me.value.user.id;
</script>

<template>
  <div>
    <button v-if="!hideBack" class="back" @click="emit('back')"><AppIcon name="arrowLeft" :size="14" :stroke="2.2" />{{ backLabel }}</button>

    <div class="card detail" :class="{ live: isLive }">
      <div v-if="isLive" class="live-glow" aria-hidden="true" />

      <!-- Score + tabs stick together below the (sticky) tournament header. -->
      <div class="msticky">
      <!-- RESULTADO -->
      <div class="result-head">
        <div class="rhead-top">
          <span class="rlabel">{{ match.phaseLabel }}<span v-if="match.groupName"> · Grupo {{ match.groupName }}</span></span>
          <div class="rhead-r">
            <span class="state" :class="{ live: stateMeta.live }" :style="{ color: stateMeta.color, borderColor: stateMeta.color }">
              <span v-if="stateMeta.live" class="dot" />{{ stateMeta.live ? (match.liveClock || 'Ao vivo') : stateMeta.label }}
            </span>
            <ShareMatch v-if="myPred && scored" :match="match" :me="me" />
          </div>
        </div>
        <div class="result">
          <div class="side" :class="{ win: homeWins, lose: awayWins }">
            <TeamBadge :team="match.homeTeam" :placeholder="match.homeSourceLabel" :size="58" />
            <span class="tname">{{ homeName }}</span>
          </div>
          <div class="font-numeric big">
            <span>{{ shownHome }}</span><span class="colon">:</span><span>{{ shownAway }}</span>
          </div>
          <div class="side" :class="{ win: awayWins, lose: homeWins }">
            <TeamBadge :team="match.awayTeam" :placeholder="match.awaySourceLabel" :size="58" />
            <span class="tname">{{ awayName }}</span>
          </div>
        </div>
        <div v-if="match.stadium" class="venue">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>
          {{ match.stadium.name }} · {{ match.stadium.city }}
        </div>
      </div>

      <nav v-if="matchTabs.length > 1" class="ttabs" aria-label="Seções da partida">
        <NuxtLink
          v-for="t in matchTabs"
          :key="t.key"
          :to="tabTo(t.key)"
          class="ttag"
          :class="{ on: activeTab === t.key }"
          :aria-current="activeTab === t.key ? 'page' : undefined"
        >
          {{ t.label }}
        </NuxtLink>
      </nav>
      </div>

      <div v-show="activeTab === 'bolao'" class="body">
        <!-- editável: stepper -->
        <div v-if="editable" class="mypred">
          <div class="mp-head">
            <span class="mp-title">Seu palpite</span>
            <span class="mp-hint">use +/− para ajustar</span>
          </div>
          <div class="mp-stepper">
            <div class="mp-col">
              <button class="mp-step" @click="ph = clampScore(ph - 1)">−</button>
              <span class="font-numeric mp-num">{{ ph }}</span>
              <button class="mp-step" @click="ph = clampScore(ph + 1)">+</button>
            </div>
            <span class="font-numeric colon mp-colon">:</span>
            <div class="mp-col">
              <button class="mp-step" @click="pa = clampScore(pa - 1)">−</button>
              <span class="font-numeric mp-num">{{ pa }}</span>
              <button class="mp-step" @click="pa = clampScore(pa + 1)">+</button>
            </div>
          </div>
          <button class="btn btn-gold btn-block mp-save" :disabled="saving" @click="savePrediction">
            {{ me?.prediction ? 'Atualizar palpite' : 'Confirmar palpite' }}
          </button>
        </div>

        <!-- aberto, deslogado -->
        <NuxtLink v-else-if="isOpen && !auth.isAuthenticated" to="/login" class="btn btn-block login-cta">Entre para palpitar <AppIcon name="arrowRight" :size="15" :stroke="2.4" /></NuxtLink>

        <!-- seu palpite × placar → pontos (o coração do acompanhamento ao vivo) -->
        <div v-else-if="myPred" class="pred-vs" :class="{ live: provisional, settled: hasResult && !provisional }">
          <span class="pv-item">
            <svg class="pv-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/></svg>
            <span class="pv-lbl">Seu palpite</span>
            <b class="pv-score font-numeric">{{ myPred.home }}:{{ myPred.away }}</b>
          </span>
          <template v-if="scored">
            <svg class="pv-arrow" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <span class="pv-item pts">
              <svg class="pv-ic" :style="{ color: myTier ? TIER_COLOR[myTier] : 'var(--muted)' }" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>
              <span class="pv-lbl">{{ provisional ? 'Ganhando' : 'Você fez' }}</span>
              <b class="pv-pts font-numeric" :style="{ color: myTier ? TIER_COLOR[myTier] : 'var(--muted)' }">+{{ myPoints }}</b>
              <span v-if="myTier" class="tier sm ignite" :style="{ color: TIER_COLOR[myTier], borderColor: TIER_COLOR[myTier] }">{{ tierLabel(myTier, resultIsDraw) }}</span>
            </span>
          </template>
          <span v-else class="pv-wait">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            vale quando a bola rolar
          </span>
        </div>

        <!-- jogando/encerrado, deslogado: convida a entrar (já passou o kickoff) -->
        <NuxtLink v-else-if="!auth.isAuthenticated" to="/login" class="btn btn-block login-cta">Entre para palpitar nos próximos jogos <AppIcon name="arrowRight" :size="15" :stroke="2.4" /></NuxtLink>

        <!-- jogando, logado, sem palpite -->
        <div v-else-if="playing" class="nopred">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          Você não palpitou nesta partida.
        </div>

        <!-- RANKING -->
        <div class="mrank">
          <div class="mr-head">
            <span class="mr-title">{{ title }}</span>
            <span class="mr-count">{{ ranking?.totalParticipants ?? 0 }} palpite(s)</span>
          </div>
          <p v-if="provisional" class="mr-note">Pontuação provisória — muda a cada gol.</p>

          <p v-if="ranking && !revealed" class="locknote">
            🔒 Os palpites aparecem quando a partida começar.
          </p>

          <div v-if="podium.length" class="podium">
            <div v-for="{ e, slot } in podium" :key="e.user.id" class="pcol" :class="{ me: isMe(e) }">
              <div class="pav" :style="{ background: color(e.user.id), borderColor: MEDALS[slot], boxShadow: `0 0 18px -4px ${MEDALS[slot]}` }">{{ initials(e.user.name) }}</div>
              <div class="pname">{{ e.user.name }}</div>
              <div class="font-numeric pscore">{{ guess(e) }}</div>
              <div class="ppts" :style="{ color: MEDALS[slot] }">+{{ e.points }}</div>
              <div class="pbar" :style="{ height: HEIGHTS[slot], background: `linear-gradient(180deg, ${MEDALS[slot]}, transparent)` }">
                <span class="font-numeric prank">{{ e.rank }}º</span>
              </div>
            </div>
          </div>

          <div class="rows">
            <div v-for="e in rest" :key="e.user.id" class="row" :class="{ me: isMe(e) }">
              <span class="font-numeric pos" :class="{ gold: isMe(e) }">{{ e.rank }}</span>
              <div class="who">
                <span class="av" :class="{ pitch: isMe(e) }" :style="isMe(e) ? undefined : { background: color(e.user.id) }">{{ initials(e.user.name) }}</span>
                <span class="nm">{{ e.user.name }}</span>
                <span v-if="isMe(e)" class="youtag">Você</span>
              </div>
              <div class="rscore">
                <span class="font-numeric gscore">{{ guess(e) }}</span>
                <span v-if="e.tier && scored" class="tier sm" :style="{ color: TIER_COLOR[e.tier], borderColor: TIER_COLOR[e.tier] }">{{ tierLabel(e.tier, resultIsDraw) }}</span>
                <span v-if="scored" class="rp" :style="{ color: e.tier ? TIER_COLOR[e.tier] : 'var(--muted)' }">+{{ e.points }}</span>
              </div>
            </div>
            <p v-if="revealed && !entries.length" class="empty">Ninguém palpitou nesta partida ainda.</p>
          </div>

          <div v-if="me && !inTop && revealed" class="sticky">
            <div class="sticky-cap">Sua posição</div>
            <div class="row me big">
              <span class="font-numeric pos gold">{{ me.rank }}º</span>
              <div class="who">
                <span class="av pitch">{{ initials(me.user.name) }}</span>
                <span class="nm">{{ me.user.name }}</span>
                <span class="youtag">Você</span>
              </div>
              <div class="rscore">
                <span class="font-numeric gscore">{{ guess(me) }}</span>
                <span v-if="scored" class="rp gold">+{{ me.points }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'escalacao'" class="lntab">
        <MatchLineup :match="match" @available="lineupAvailable = $event" />
      </div>
      <div v-show="activeTab === 'tempo'" class="lntab">
        <MatchTimeline :match="match" @available="timelineAvailable = $event" />
      </div>
      <div v-show="activeTab === 'stats'" class="lntab">
        <MatchStats :match="match" @available="statsAvailable = $event" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  color: var(--muted);
  font: inherit;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 14px;
  padding: 0;
}
.back:hover {
  color: var(--text);
}
.detail {
  position: relative;
  /* Full-bleed: cancel the container side padding so the content spans the full
     width (no side radius → nothing to clip, so sticky children work). */
  margin-inline: -16px;
  border-radius: 0;
  overflow: visible;
}
@media (max-width: 420px) {
  .detail {
    margin-inline: -13px;
  }
}
.detail.live {
  border-color: rgba(232, 54, 43, 0.5);
}
.live-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(80% 50% at 50% 0%, rgba(232, 54, 43, 0.12), transparent 70%);
  pointer-events: none;
  z-index: 1;
}

/* RESULTADO */
.msticky {
  position: sticky;
  top: 46px; /* just below the sticky tournament header */
  z-index: 20;
  background: var(--bg-base);
}
.result-head {
  position: relative;
  z-index: 2;
  padding: 16px 20px 20px;
  background-image: linear-gradient(135deg, rgba(15, 179, 107, 0.16), rgba(30, 127, 240, 0.14));
}
.detail.live .result-head {
  background: linear-gradient(135deg, rgba(232, 54, 43, 0.14), rgba(224, 33, 138, 0.1));
}
.rhead-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}
.rhead-r {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.rlabel {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid;
  border-radius: 999px;
  padding: 4px 10px;
  white-space: nowrap;
  flex: none;
}
.state.live {
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
@keyframes liveDot { 50% { opacity: 0.3; } }
.result {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  min-width: 0;
  transition: opacity 0.2s;
}
.side.lose { opacity: 0.5; }
.tname {
  font-size: 13.5px;
  font-weight: 700;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side.win .tname { font-weight: 800; }
.big {
  font-size: 56px;
  line-height: 0.8;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.colon { color: var(--muted); }
.venue {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}

.body {
  position: relative;
  z-index: 2;
  padding: 18px 20px 20px;
}

/* editor */
.mypred {
  background: linear-gradient(180deg, color-mix(in srgb, var(--gold) 12%, var(--bg-base)), var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--gold) 30%, var(--border));
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
}
.mp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.mp-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); }
.mp-hint { font-size: 10.5px; font-weight: 600; color: var(--muted); }
.mp-stepper { display: flex; align-items: center; justify-content: center; gap: 16px; }
.mp-col { display: flex; align-items: center; gap: 10px; }
.mp-step { width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text); font-size: 19px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
.mp-step:active { transform: scale(0.92); }
.mp-num { font-size: 48px; line-height: 0.85; min-width: 30px; text-align: center; }
.mp-colon { font-size: 40px; color: var(--muted); }
.mp-save { margin-top: 14px; font-size: 14px; padding: 11px; }
.login-cta { margin-bottom: 20px; }

/* seu palpite × pontos — uma linha só, espalhada pra ocupar a largura */
.pred-vs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 14px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 11px 16px;
  margin-bottom: 20px;
}
.pred-vs.live {
  border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border));
  background: linear-gradient(135deg, color-mix(in srgb, var(--scarlet) 7%, var(--bg-base)), var(--bg-base));
}
.pred-vs.settled {
  border-color: color-mix(in srgb, var(--emerald) 35%, var(--border));
}
.pv-item { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.pv-ic { flex: none; color: var(--muted); }
.pv-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.pv-score { font-size: 22px; line-height: 1; letter-spacing: 0.03em; }
.pv-arrow { flex: none; color: var(--muted); }
.pv-pts { font-size: 24px; line-height: 1; }
.pred-vs.live .pv-pts { animation: ignite 0.5s ease both; }
.pv-wait { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--muted); }

.nopred {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-base);
  border: 1px dashed var(--border);
  border-radius: 14px;
  padding: 13px 16px;
  margin-bottom: 20px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}

.tier {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1.5px solid;
  border-radius: 999px;
  padding: 4px 11px;
}
.tier.ignite { animation: ignite 0.6s ease both; }
.tier.sm { font-size: 9.5px; padding: 3px 8px; border-width: 1px; }

/* ranking */
.mr-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.mr-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
.mr-count { font-size: 11px; font-weight: 700; color: var(--muted); flex: none; }
.mr-note { font-size: 11.5px; color: var(--scarlet); font-weight: 600; margin-bottom: 14px; }
.locknote { font-size: 13px; font-weight: 600; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 14px; text-align: center; }

.podium { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin: 8px 0 18px; }
.pcol { flex: 1; max-width: 130px; display: flex; flex-direction: column; align-items: center; }
.pav { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 14px; border: 3px solid; }
.pname { font-size: 12px; font-weight: 700; margin-top: 7px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pcol.me .pname { color: var(--gold); }
.pscore { font-size: 18px; letter-spacing: 0.04em; }
.ppts { font-size: 11px; font-weight: 800; }
.pbar { width: 100%; margin-top: 7px; border-radius: 11px 11px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; }
.prank { font-size: 26px; color: #0a0e14; }

.rows { display: flex; flex-direction: column; gap: 7px; }
.row { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; padding: 9px 12px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 13px; }
.row.me { border-color: var(--gold); background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--bg-surface)), var(--bg-surface)); }
.pos { font-size: 17px; color: var(--muted); text-align: center; }
.pos.gold { color: var(--gold); }
.who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.av { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 11px; flex: 0 0 auto; }
.av.pitch { background: var(--grad-pitch); }
.nm { font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.youtag { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0a0e14; background: var(--gold); border-radius: 5px; padding: 2px 6px; flex: 0 0 auto; }
.rscore { display: flex; align-items: center; gap: 9px; flex: 0 0 auto; }
.gscore { font-size: 18px; letter-spacing: 0.04em; }
.rp { font-size: 12px; font-weight: 800; min-width: 36px; text-align: right; }
.rp.gold { color: var(--gold); }
.empty { font-size: 12.5px; color: var(--muted); text-align: center; padding: 14px; }

.sticky { position: sticky; bottom: 14px; margin-top: 12px; z-index: 15; }
.sticky-cap { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); text-align: center; margin-bottom: 6px; }
.row.big { box-shadow: 0 12px 30px -10px rgba(244, 184, 30, 0.5); }

@media (max-width: 420px) {
  .pv-score { font-size: 26px; }
  .pv-pts { font-size: 30px; }
}
/* Mobile: hide the tier tag (ex.: "Não pontuou") in the ranking rows — keep them compact. */
@media (max-width: 560px) {
  .rscore .tier { display: none; }
}

/* Bolão / Escalação tabs — same pill format as the tournament section tabs. */
.ttabs {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.ttabs::-webkit-scrollbar {
  display: none;
}
.ttag {
  flex: none;
  display: inline-flex;
  align-items: center;
  padding: 7px 15px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ttag:hover {
  color: var(--text);
  border-color: color-mix(in srgb, var(--gold) 45%, var(--border));
}
.ttag.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
.lntab {
  position: relative;
  z-index: 2;
  padding: 8px 20px 22px;
}
</style>
