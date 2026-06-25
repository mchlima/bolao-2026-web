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
    // Quando presente, a partida está sendo vista DENTRO de um bolão → habilita a
    // aba "Chat" (sala escopada a esse bolão). Ausente no contexto de torneio.
    poolId?: string;
  }>(),
  { title: 'Ranking da partida', backLabel: 'Voltar', hideBack: false },
);
const emit = defineEmits<{ back: []; refresh: []; tab: [string] }>();

const auth = useAuthStore();
const ui = useUiStore();

// Paint the whole match screen with the card's surface color (see
// body.match-screen in main.css) so short content doesn't leave an empty band
// below the full-bleed card. The class is removed when this board unmounts.
useHead({ bodyAttrs: { class: 'match-screen' } });

const MEDALS = ['var(--gold)', '#C2CAD6', '#CD7F45'];
const HEIGHTS = ['66px', '50px', '40px'];

const match = computed(() => props.match);
const ranking = computed(() => props.ranking);

// Match metadata lives in its own "Informações" tab now (the hero is kept to the
// matchup itself). Each row reuses an existing AppIcon glyph.
const tz = useTz();
const kickoffText = computed(() =>
  props.match.kickoffAt ? formatKickoff(props.match.kickoffAt, tz.value) : '',
);
const stadiumLocation = computed(() => {
  const s = props.match.stadium;
  if (!s) return '';
  return [s.city, s.state, s.country].filter(Boolean).join(', ');
});
// Stadium photo (Wikimedia, mirrored to R2) — painted behind the hero gradient.
const stadiumPhoto = computed(() => props.match.stadium?.photoUrl ?? null);
const stadiumCredit = computed(() => props.match.stadium?.photoCredit ?? null);
// Contexto da partida (torneio · grupo/fase · rodada) — destaque no topo do hero,
// pra dar o enquadramento de imediato (antes só aparecia na aba Informações).
const heroContext = computed(() => {
  const m = props.match;
  const parts: string[] = [];
  if (m.season?.name) parts.push(m.season.name);
  if (m.groupName) parts.push(`Grupo ${m.groupName}`);
  else if (m.phaseLabel) parts.push(m.phaseLabel);
  if (m.round?.number != null) parts.push(`Rodada ${m.round.number}`);
  return parts.join(' · ');
});
// O estádio vira VITRINE (foto protagonista) na aba Informações; os demais campos
// viram um mosaico de tiles. Estádio/Local saem do mosaico (moram na vitrine).
const hasVenue = computed(() => !!props.match.stadium?.name);
const infoRows = computed(() => {
  const m = props.match;
  const rows: Array<{ icon: string; label: string; value: string }> = [];
  if (m.season?.name) rows.push({ icon: 'trophy', label: 'Torneio', value: m.season.name });
  if (m.phaseLabel) rows.push({ icon: 'calendar', label: 'Fase', value: m.phaseLabel });
  if (m.groupName) rows.push({ icon: 'users', label: 'Grupo', value: `Grupo ${m.groupName}` });
  // Matchday (number) only — a knockout round.name would just repeat phaseLabel.
  if (m.round?.number != null) rows.push({ icon: 'refresh', label: 'Rodada', value: `Rodada ${m.round.number}` });
  if (kickoffText.value) rows.push({ icon: 'clock', label: 'Data', value: kickoffText.value });
  // Público SEMPRE presente — mostra "—" enquanto a ESPN não fornece (chega após o jogo).
  rows.push({
    icon: 'users',
    label: 'Público',
    value: m.attendance ? m.attendance.toLocaleString('pt-BR') : '—',
  });
  if (m.referee) rows.push({ icon: 'user', label: 'Árbitro', value: m.referee });
  return rows;
});
// A aba existe sempre que houver vitrine OU qualquer fato (público garante ≥1).
const infoAvailable = computed(() => hasVenue.value || infoRows.value.length > 0);
// At halftime the ESPN robot freezes the clock to "Intervalo" — show a pause
// glyph instead of the pulsing live (rec) dot, since play is stopped.
const atHalftime = computed(() => /intervalo/i.test(props.match.liveClock ?? ''));

// Tabs: "Bolão" (this ranking) vs "Escalação" (the live lineup). The lineup tab
// only appears once lineups exist (MatchLineup reports availability) — before
// that the board renders exactly as before, with no tab bar. The active tab is
// driven by the URL path (…/matches/:id/escalacao) so it's linkable, shareable
// and survives back/forward — the route carries an optional [[aba]] segment.
const route = useRoute();
const authLink = useAuthLink();
// Tab availability comes from the match payload's _count (GET /matches/:id), so
// the tabs are known synchronously on SSR (no waiting for each tab component to
// mount and emit). Refetched on the realtime channel → tabs appear live as the
// first lineup/event/stat lands.
const lineupAvailable = computed(() => (props.match._count?.lineupEntries ?? 0) > 0);
// A LIVE or FINISHED match always exposes the timeline tab — even at 0:0 with no
// goal/card/sub — so it's there the moment the ball is rolling and stays as a
// permanent record once the match ends (consultation always available). It fills
// in as events land; while empty it renders a state line (MatchTimeline). Only a
// not-yet-played match (scheduled) hides it until events actually exist.
const timelineAvailable = computed(
  () =>
    match.value.status === 'LIVE' ||
    match.value.status === 'FINISHED' ||
    (props.match._count?.events ?? 0) > 0,
);
const statsAvailable = computed(() => (props.match._count?.stats ?? 0) > 0);
// The "Classificação" tab exists only when a #classificacao slot is provided
// (the tournament match route fills it with the group table / bracket).
const slots = useSlots();
const hasClassificacao = computed(() => !!slots.classificacao);
// Chat ao vivo da partida: só no contexto de bolão (sala dos membros), logo após
// "Bolão" para dar destaque ao engajamento.
const chatAvailable = computed(() => !!props.poolId);
const matchTabs = computed(() => {
  const tabs = [{ key: 'bolao', label: 'Bolão' }];
  if (chatAvailable.value) tabs.push({ key: 'chat', label: 'Chat' });
  if (lineupAvailable.value) tabs.push({ key: 'escalacao', label: 'Escalação' });
  if (timelineAvailable.value) tabs.push({ key: 'tempo', label: 'Narração' });
  if (statsAvailable.value) tabs.push({ key: 'stats', label: 'Estatísticas' });
  if (infoAvailable.value) tabs.push({ key: 'info', label: 'Informações' });
  if (hasClassificacao.value) tabs.push({ key: 'classificacao', label: 'Classificação' });
  return tabs;
});
const activeTab = computed(() => {
  const aba = route.params.aba;
  if (aba === 'chat' && chatAvailable.value) return 'chat';
  if (aba === 'escalacao' && lineupAvailable.value) return 'escalacao';
  if (aba === 'tempo' && timelineAvailable.value) return 'tempo';
  if (aba === 'stats' && statsAvailable.value) return 'stats';
  if (aba === 'info' && infoAvailable.value) return 'info';
  if (aba === 'classificacao' && hasClassificacao.value) return 'classificacao';
  return 'bolao';
});
// Surface the active tab so the context wrapper can gate its ranking refetch to
// the "bolão" tab (the hero/score stays always-on; the ranking is tab-scoped).
watch(activeTab, (t) => emit('tab', t), { immediate: true });
// O chat é logado/efêmero — não deve ser indexado (ver diretriz de SEO/GEO). Marca
// noindex só enquanto a aba Chat está ativa; as demais abas seguem como estão.
useHead(
  computed(() => ({
    meta: activeTab.value === 'chat' ? [{ name: 'robots', content: 'noindex' }] : [],
  })),
);
// The match path minus any trailing tab segment — the base to build tab links
// from. Works for every route that renders the board (tournament / standalone /
// pool), since it's derived from the current path rather than hard-coded.
const baseTabPath = computed(() => {
  const path = route.path.replace(/\/$/, '');
  const aba = route.params.aba as string | undefined;
  return aba ? path.slice(0, -(aba.length + 1)) : path;
});
function tabTo(key: string) {
  return key === 'bolao' ? baseTabPath.value : `${baseTabPath.value}/${key}`;
}
const playing = computed(
  () => match.value.status === 'LIVE' || match.value.status === 'FINISHED',
);
const isLive = computed(() => match.value.status === 'LIVE');
// Reminders only make sense before kickoff, so the header bell shows only for
// upcoming matches (scheduled / postponed) — not LIVE, finished or cancelled.
const canNotify = computed(
  () => match.value.status === 'SCHEDULED' || match.value.status === 'POSTPONED',
);

// Countdown to kickoff, shown between the hero and the tabs while the match is
// still SCHEDULED. `now` ticks every second on the client (the value is
// client-only to avoid an SSR hydration mismatch on the changing seconds).
const DAY_MS = 86_400_000;
const now = ref(0);
const mounted = ref(false);
let cdTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  mounted.value = true;
  now.value = Date.now();
  cdTimer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(cdTimer));

const msToKickoff = computed(() => {
  if (!match.value.kickoffAt) return null;
  return new Date(match.value.kickoffAt).getTime() - now.value;
});
const showCountdown = computed(
  () =>
    mounted.value &&
    match.value.status === 'SCHEDULED' &&
    msToKickoff.value != null &&
    msToKickoff.value > 0,
);
const countdownSoon = computed(() => (msToKickoff.value ?? Infinity) < DAY_MS);
// < 1 day → HH:MM:SS (live, per-second); otherwise → "Xd HHh".
const countdownText = computed(() => {
  const ms = msToKickoff.value;
  if (ms == null || ms <= 0) return '';
  const t = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  if (d >= 1) return `${d}d ${p(h)}h`;
  return `${p(h)}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
});
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

// The chip is a MATCH-state indicator and the hero shows it on every tab, so it
// must follow the always-fresh match.status — NOT ranking.provisional, whose
// refetch is gated to the "Bolão" tab. On other tabs (Narração/Escalação/…) the
// ranking goes stale, so keying the chip off it left it stuck on "AO VIVO" after
// the final whistle even though the match had finished (match was already fresh).
const stateMeta = computed(() => {
  if (match.value.status === 'LIVE')
    return { label: 'Ao vivo · parcial', color: 'var(--scarlet)', live: true };
  if (match.value.status === 'FINISHED')
    return { label: 'Resultado final', color: 'var(--emerald)', live: false };
  return { label: 'Aguardando', color: 'var(--muted)', live: false };
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
  <div class="mfill">
    <div class="card detail" :class="{ live: isLive, 'has-thead': hideBack }">
      <div v-if="isLive" class="live-glow" aria-hidden="true" />

      <!-- Score + tabs stick together below the (sticky) tournament header. -->
      <div class="msticky">
      <!-- RESULTADO — hero kept to the matchup: teams, score and the live chip.
           Meta/venue/prediction live in the tabs (Informações / Bolão) now. -->
      <div class="result-head" :class="{ 'has-photo': stadiumPhoto }">
        <template v-if="stadiumPhoto">
          <img class="rh-photo" :src="stadiumPhoto" alt="" aria-hidden="true" >
          <div class="rh-grad" aria-hidden="true" />
        </template>
        <div v-if="canNotify" class="rhead-actions">
          <MatchNotifyBell :match="match" :size="17" pill />
        </div>
        <div v-if="heroContext" class="ctx-pill">
          <AppIcon name="trophy" :size="13" :stroke="2" />
          <span>{{ heroContext }}</span>
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
        <!-- live/status chip, centered under the score -->
        <div class="rstate">
          <span class="state" :class="{ live: stateMeta.live && !atHalftime }" :style="{ color: stateMeta.color, borderColor: stateMeta.color }">
            <AppIcon v-if="atHalftime" name="pause" :size="11" :stroke="2.4" class="pause-ic" />
            <span v-else-if="stateMeta.live" class="dot" />{{ stateMeta.live ? (match.liveClock || 'Ao vivo') : stateMeta.label }}
          </span>
        </div>
        <!-- crédito da foto (licença Wikimedia/CC) — discreto no rodapé do hero -->
        <a
          v-if="stadiumPhoto && stadiumCredit"
          class="photo-credit"
          :href="match.stadium?.photoSourceUrl || undefined"
          target="_blank"
          rel="noopener nofollow"
          :title="`Foto: ${stadiumCredit}`"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          {{ stadiumCredit }}
        </a>
      </div>

      <!-- countdown to kickoff (scheduled matches only) — between hero and tabs -->
      <div v-if="showCountdown" class="countdown" :class="{ soon: countdownSoon }">
        <svg class="cd-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" /></svg>
        <span class="cd-label">Começa em</span>
        <span class="cd-value font-numeric">{{ countdownText }}</span>
      </div>

      <nav v-if="matchTabs.length > 1" class="ttabs" aria-label="Seções da partida">
        <NuxtLink
          v-for="t in matchTabs"
          :key="t.key"
          :to="tabTo(t.key)"
          replace
          class="ttag"
          :class="{ on: activeTab === t.key }"
          :aria-current="activeTab === t.key ? 'page' : undefined"
        >
          {{ t.label }}
        </NuxtLink>
      </nav>
      </div>

      <div v-show="activeTab === 'bolao'" class="body">
        <!-- DESLOGADO: em vez do pódio/ranking, um convite simples ao cadastro.
             O herói (placar) continua acima; aqui vendemos o jogo do bolão. -->
        <div v-if="!auth.isAuthenticated" class="join">
          <span class="join-badge"><AppIcon name="trophy" :size="24" /></span>
          <h2 class="join-title font-display">Entre no jogo. Crave o placar.</h2>
          <p class="join-lead">
            Dê seu palpite em <b>{{ homeName }}</b> x <b>{{ awayName }}</b> e veja
            sua posição no ranking se mexer <b>ao vivo</b> a cada gol — junto com a
            galera do seu bolão.
          </p>
          <ul class="join-feats">
            <li><AppIcon name="ball" :size="16" class="jf-ic" /> Palpite nos jogos e dispute o ranking ao vivo</li>
            <li><AppIcon name="users" :size="16" class="jf-ic" /> Bolões privados com seus amigos</li>
            <li><AppIcon name="star" :size="16" class="jf-ic" /> Pontuação que premia quem crava o placar</li>
          </ul>
          <div class="join-cta">
            <NuxtLink :to="authLink('/cadastro')" class="btn btn-gold btn-block">Criar conta grátis</NuxtLink>
            <NuxtLink :to="authLink('/entrar')" class="btn btn-block">Já tenho conta</NuxtLink>
          </div>
          <p class="join-trust">Grátis · sem instalar nada · pronto em 1 minuto</p>
        </div>

        <template v-else>
        <!-- editável: stepper -->
        <div v-if="editable" class="mypred">
          <div class="mp-head">
            <span class="mp-title">Seu palpite</span>
            <span class="mp-hint">use as setas para ajustar</span>
          </div>
          <div class="mp-stepper">
            <div class="mp-col">
              <button class="mp-step" aria-label="menos" @click="ph = clampScore(ph - 1)"><AppIcon name="chevronLeft" :size="22" :stroke="2.4" /></button>
              <span class="font-numeric mp-num">{{ ph }}</span>
              <button class="mp-step" aria-label="mais" @click="ph = clampScore(ph + 1)"><AppIcon name="chevronRight" :size="22" :stroke="2.4" /></button>
            </div>
            <span class="font-numeric colon mp-colon">:</span>
            <div class="mp-col">
              <button class="mp-step" aria-label="menos" @click="pa = clampScore(pa - 1)"><AppIcon name="chevronLeft" :size="22" :stroke="2.4" /></button>
              <span class="font-numeric mp-num">{{ pa }}</span>
              <button class="mp-step" aria-label="mais" @click="pa = clampScore(pa + 1)"><AppIcon name="chevronRight" :size="22" :stroke="2.4" /></button>
            </div>
          </div>
          <button class="btn btn-gold btn-block mp-save" :disabled="saving" @click="savePrediction">
            {{ me?.prediction ? 'Atualizar palpite' : 'Confirmar palpite' }}
          </button>
        </div>

        <!-- seu palpite × placar → pontos (o coração do acompanhamento ao vivo).
             O placar palpitado (antes no hero) e o compartilhamento moram aqui. -->
        <template v-else-if="myPred">
          <div class="rpred">
            <span class="rpred-lbl">Seu palpite</span>
            <b class="rpred-score font-numeric">{{ myPred.home }}:{{ myPred.away }}</b>
          </div>
          <div class="pred-vs" :class="{ live: provisional, settled: hasResult && !provisional }">
            <template v-if="scored">
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
          <div v-if="scored" class="share-cta">
            <ShareMatch variant="button" :match="match" :me="me" />
          </div>
        </template>

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
              <div class="pav" :style="{ background: color(e.user.id), borderColor: MEDALS[slot], boxShadow: `0 0 18px -4px ${MEDALS[slot]}` }"><img v-if="e.user.avatarUrl" class="av-img" :src="e.user.avatarUrl" alt="" ><template v-else>{{ initials(e.user.name) }}</template></div>
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
                <span class="av" :class="{ pitch: isMe(e) }" :style="isMe(e) ? undefined : { background: color(e.user.id) }"><img v-if="e.user.avatarUrl" class="av-img" :src="e.user.avatarUrl" alt="" ><template v-else>{{ initials(e.user.name) }}</template></span>
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
                <span class="av pitch"><img v-if="me.user.avatarUrl" class="av-img" :src="me.user.avatarUrl" alt="" ><template v-else>{{ initials(me.user.name) }}</template></span>
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
        </template>
      </div>

      <div v-show="activeTab === 'chat'" class="lntab">
        <MatchChat
          v-if="poolId"
          :pool-id="poolId"
          :match-id="match.id"
          :active="activeTab === 'chat'"
        />
      </div>
      <div v-show="activeTab === 'escalacao'" class="lntab">
        <MatchLineup :match="match" :active="activeTab === 'escalacao'" />
      </div>
      <div v-show="activeTab === 'tempo'" class="lntab">
        <MatchTimeline :match="match" :active="activeTab === 'tempo'" />
      </div>
      <div v-show="activeTab === 'stats'" class="lntab">
        <MatchStats :match="match" :active="activeTab === 'stats'" />
      </div>
      <div v-show="activeTab === 'info'" class="lntab info-pane">
        <!-- Vitrine do estádio: a foto vira protagonista, com nome/local sobreposto. -->
        <div v-if="hasVenue" class="venue" :class="{ 'has-photo': stadiumPhoto }">
          <template v-if="stadiumPhoto">
            <img class="venue-photo" :src="stadiumPhoto" alt="" aria-hidden="true" >
            <div class="venue-grad" aria-hidden="true" />
          </template>
          <div class="venue-body">
            <span class="venue-kicker"><AppIcon name="stadium" :size="13" :stroke="2" /> Estádio</span>
            <h3 class="venue-name">{{ match.stadium?.name }}</h3>
            <p v-if="stadiumLocation" class="venue-loc">{{ stadiumLocation }}</p>
          </div>
          <a
            v-if="stadiumPhoto && stadiumCredit"
            class="venue-credit"
            :href="match.stadium?.photoSourceUrl || undefined"
            target="_blank"
            rel="noopener nofollow"
            :title="`Foto: ${stadiumCredit}`"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            {{ stadiumCredit }}
          </a>
        </div>
        <!-- Mosaico de fatos — valor grande, rótulo pequeno. Data ocupa a linha toda. -->
        <div class="mosaic">
          <div v-for="r in infoRows" :key="r.label" class="mtile" :class="{ wide: r.label === 'Data' }">
            <span class="mt-lbl"><AppIcon :name="r.icon" :size="13" :stroke="2" class="mt-ic" />{{ r.label }}</span>
            <span class="mt-val">{{ r.value }}</span>
          </div>
        </div>
      </div>
      <div v-show="activeTab === 'classificacao'" class="lntab">
        <slot name="classificacao" />
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
  font-size: var(--fs-sm);
  cursor: pointer;
  padding: 0;
  flex: none;
}
.back:hover {
  color: var(--text);
}
.detail {
  position: relative;
  /* Full width (.main has no side padding now, so no negative margin needed).
     No side radius → nothing to clip, so sticky children work. */
  border-radius: 0;
  overflow: visible;
  /* The screen background already is this surface (body.match-screen), so drop
     the card chrome — otherwise its border/shadow draw a seam where the content
     ends mid-screen. The result-head gradient gives the top enough definition. */
  border: none;
  box-shadow: none;
  /* O board ABRAÇA o conteúdo (sem min-height de viewport). Antes ele "enchia a
     tela" pra não sobrar faixa abaixo quando era a página inteira — mas agora a
     seção SEO ("Sobre a partida" + FAQ) vem logo abaixo, então forçar altura só
     criava uma faixa branca morta entre o board e o SEO quando o conteúdo era
     curto (jogo agendado/deslogado). Sem borda/sombra e mesmo fundo (surface),
     não há emenda visual a esconder. */
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
  /* O documento rola (não há scroll interno); o header global é sticky no topo,
     então colamos logo ABAIXO dele (--header-h = 0 no mobile, 63px no desktop).
     A .thead do shell de torneio entra acima de nós → ver has-thead. */
  top: var(--header-h, 0px);
  z-index: 20;
  background: var(--bg-surface);
  /* opaque space below the chips (padding, not the tab's margin, so it doesn't
     collapse out — otherwise scrolling content shows flush against the chips). */
  padding-bottom: 12px;
}
/* Inside the tournament shell (hideBack → has-thead) the slim 52px .thead sits
   above the score block, so stick below the header *and* that thead. */
.detail.has-thead .msticky {
  top: calc(var(--header-h, 0px) + 52px);
}
.result-head {
  position: relative;
  z-index: 2;
  padding: 16px 20px 20px;
  /* Hero full-bleed encostado no topo: sem quinas arredondadas. overflow:hidden
     para a foto do estádio (absolute inset:0) ficar contida. */
  border-radius: 0;
  overflow: hidden;
  background-image: linear-gradient(135deg, rgba(15, 179, 107, 0.16), rgba(30, 127, 240, 0.14));
}
.rhead-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 4;
}
/* Pílula de contexto (Copa · Grupo · Rodada) — dourada, no topo do hero. */
.ctx-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 14px;
  padding: 5px 11px;
  border-radius: 999px;
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text);
  background: color-mix(in srgb, var(--gold) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--border));
  max-width: 100%;
}
.ctx-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ctx-pill :deep(svg) { flex: none; color: var(--gold); }
.detail.live .result-head {
  background: linear-gradient(135deg, rgba(232, 54, 43, 0.14), rgba(224, 33, 138, 0.1));
}
/* foto do estádio atrás do gradiente do hero, com scrim escuro p/ legibilidade */
.result-head.has-photo { color: #fff; }
/* foto como <img> real (object-position: center → pega o meio, sem depender de
   background-position em camadas). Gradiente colorido + scrim por cima. */
.rh-photo {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.rh-grad {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(135deg, rgba(15, 179, 107, 0.5), rgba(30, 127, 240, 0.46)),
    linear-gradient(180deg, rgba(8, 12, 18, 0.42), rgba(8, 12, 18, 0.76));
}
.detail.live .rh-grad {
  background:
    linear-gradient(135deg, rgba(232, 54, 43, 0.52), rgba(224, 33, 138, 0.44)),
    linear-gradient(180deg, rgba(8, 12, 18, 0.4), rgba(8, 12, 18, 0.74));
}
/* conteúdo acima das camadas de foto/gradiente */
.result-head.has-photo > .ctx-pill,
.result-head.has-photo > .result,
.result-head.has-photo > .rstate {
  position: relative;
  z-index: 2;
}
.result-head.has-photo .ctx-pill { color: #fff; }
.result-head.has-photo .tname { color: #fff; }
.result-head.has-photo .colon { color: rgba(255, 255, 255, 0.6); }
.result-head.has-photo .back { color: rgba(255, 255, 255, 0.82); }
.result-head.has-photo .back:hover { color: #fff; }
.photo-credit {
  position: absolute;
  right: 10px;
  bottom: 5px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 72%;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.58);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.photo-credit svg { flex: none; }
.photo-credit:hover { color: rgba(255, 255, 255, 0.9); }
/* live/status chip centered under the score */
.rstate {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}
.pause-ic {
  flex: none;
}
/* The user's predicted score, now shown at the top of the Bolão tab body. */
/* "Seu palpite" — a defined card so the user's pick reads as a headline, not
   faded floating text. Gold score to make it pop above the points card. */
.rpred {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 18px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 9%, var(--bg-base)), var(--bg-base));
  border: 1px solid color-mix(in srgb, var(--gold) 26%, var(--border));
  border-radius: 14px;
}
.rpred-lbl {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text);
}
.rpred-score {
  font-size: var(--fs-2xl);
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--gold);
}
.state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
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
}
.tname {
  font-size: var(--fs-sm);
  font-weight: 700;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side.win .tname { font-weight: 800; }
.big {
  font-size: 3.5rem;
  line-height: 0.8;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.colon { color: var(--muted); }

.body {
  position: relative;
  z-index: 2;
  /* Sem padding lateral — o conteúdo da aba Bolão ocupa toda a largura. */
  padding: 18px 0 20px;
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
.mp-title { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gold); }
.mp-hint { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
.mp-stepper { display: flex; align-items: center; justify-content: center; gap: 16px; }
.mp-col { display: flex; align-items: center; gap: 10px; }
.mp-step { width: 30px; height: 44px; border-radius: 9px; border: none; background: none; padding: 0; color: var(--muted); cursor: pointer; display: grid; place-items: center; transition: color 0.13s ease, transform 0.05s ease; }
.mp-step:hover { color: var(--text); }
.mp-step:active { transform: scale(0.86); color: var(--emerald); }
.mp-num { font-size: 3rem; line-height: 0.85; min-width: 30px; text-align: center; }
.mp-colon { font-size: 2.5rem; color: var(--muted); }
.mp-save { margin-top: 14px; font-size: var(--fs-sm); padding: 11px; }

/* Convite ao cadastro — substitui o pódio/ranking para quem está deslogado. */
.join {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 8px 4px 4px;
}
.join-badge {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  color: var(--gold);
  background: color-mix(in srgb, var(--gold) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 32%, var(--border));
  margin-bottom: 14px;
}
.join-title {
  font-size: var(--fs-2xl);
  line-height: 1.1;
  font-weight: 700;
  margin: 0 0 8px;
}
.join-lead {
  font-size: var(--fs-sm);
  line-height: 1.5;
  color: var(--muted);
  max-width: 36ch;
  margin: 0 0 18px;
}
.join-lead b { color: var(--text); }
.join-feats {
  list-style: none;
  margin: 0 0 22px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: 100%;
  max-width: 340px;
  text-align: left;
}
.join-feats li {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: var(--fs-sm);
  font-weight: 600;
}
.jf-ic { flex: none; color: var(--emerald); }
.join-cta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 340px;
}
.join-trust {
  margin: 14px 0 0;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
}

/* pontos do palpite — o placar do palpite agora fica junto do resultado acima. */
.pred-vs {
  display: flex;
  align-items: center;
  justify-content: center;
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
.pv-lbl { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.pv-pts { font-size: var(--fs-2xl); line-height: 1; }
.pred-vs.live .pv-pts { animation: ignite 0.5s ease both; }
.pv-wait { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
/* share trigger sits centered under the prediction summary */
.share-cta { display: flex; justify-content: center; margin: -8px 0 20px; }

.nopred {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-base);
  border: 1px dashed var(--border);
  border-radius: 14px;
  padding: 13px 16px;
  margin-bottom: 20px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
}

.tier {
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1.5px solid;
  border-radius: 999px;
  padding: 4px 11px;
}
.tier.ignite { animation: ignite 0.6s ease both; }
.tier.sm { font-size: var(--fs-xs); padding: 3px 8px; border-width: 1px; }

/* ranking */
.mr-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.mr-title { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
.mr-count { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); flex: none; }
.mr-note { font-size: var(--fs-xs); color: var(--scarlet); font-weight: 600; margin-bottom: 14px; }
.locknote { font-size: var(--fs-sm); font-weight: 600; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 12px; padding: 14px; text-align: center; }

.podium { display: flex; align-items: flex-end; justify-content: center; gap: 10px; margin: 8px 0 18px; }
.pcol { flex: 1; max-width: 130px; display: flex; flex-direction: column; align-items: center; }
.pav { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-sm); border: 3px solid; }
.av-img { width: 100%; height: 100%; object-fit: cover; }
.pname { font-size: var(--fs-xs); font-weight: 700; margin-top: 7px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pcol.me .pname { color: var(--gold); }
.pscore { font-size: var(--fs-lg); letter-spacing: 0.04em; }
.ppts { font-size: var(--fs-xs); font-weight: 800; }
.pbar { width: 100%; margin-top: 7px; border-radius: 11px 11px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; }
.prank { font-size: var(--fs-2xl); color: #0a0e14; }

.rows { display: flex; flex-direction: column; gap: 7px; }
.row { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; padding: 9px 12px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 13px; }
.row.me { border-color: var(--gold); background: linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, var(--bg-surface)), var(--bg-surface)); }
.pos { font-size: var(--fs-lg); color: var(--muted); text-align: center; }
.pos.gold { color: var(--gold); }
.who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.av { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; color: #fff; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-xs); flex: 0 0 auto; }
.av.pitch { background: var(--grad-pitch); }
.nm { font-size: var(--fs-sm); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.youtag { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #0a0e14; background: var(--gold); border-radius: 5px; padding: 2px 6px; flex: 0 0 auto; }
.rscore { display: flex; align-items: center; gap: 9px; flex: 0 0 auto; }
.gscore { font-size: var(--fs-lg); letter-spacing: 0.04em; }
.rp { font-size: var(--fs-xs); font-weight: 800; min-width: 36px; text-align: right; }
.rp.gold { color: var(--gold); }
.empty { font-size: var(--fs-xs); color: var(--muted); text-align: center; padding: 14px; }

.sticky { position: sticky; bottom: 14px; margin-top: 12px; z-index: 15; }
.sticky-cap { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); text-align: center; margin-bottom: 6px; }
.row.big { box-shadow: 0 12px 30px -10px rgba(244, 184, 30, 0.5); }

@media (max-width: 420px) {
  .pv-score { font-size: var(--fs-2xl); }
  .pv-pts { font-size: var(--fs-3xl); }
}
/* Mobile: hide the tier tag (ex.: "Não pontuou") in the ranking rows — keep them compact. */
@media (max-width: 560px) {
  .rscore .tier { display: none; }
}

/* Bolão / Escalação tabs — same pill format as the tournament section tabs. */
/* countdown to kickoff — a full-bleed bar flush under the hero. Carries the
   hero's gradient, but a touch more saturated and split off by a hairline, so it
   reads as part of the hero with a subtle distinction. */
.countdown {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 10px 20px;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background-image: linear-gradient(135deg, rgba(15, 179, 107, 0.24), rgba(30, 127, 240, 0.21));
  color: var(--muted);
}
.countdown .cd-ico {
  flex: none;
  color: var(--muted);
}
.cd-label {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.cd-value {
  font-weight: 800;
  font-size: var(--fs-sm);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
/* under a day → the live HH:MM:SS reads larger, in the accent gold */
.countdown.soon .cd-ico {
  color: var(--gold);
}
.countdown.soon .cd-value {
  font-size: var(--fs-lg);
  letter-spacing: 0.02em;
  color: var(--gold);
}

.ttabs {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  /* Full-bleed scroller: side padding (not margin) so the pills rest at 20px but
     scroll all the way to the card edge — no cut-off before the screen edge. */
  margin: 12px 0 0;
  padding: 0 20px;
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
  font-size: var(--fs-sm);
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
/* Aba Informações: sem padding lateral — o info-card ocupa toda a largura. */
.info-pane {
  padding-left: 0;
  padding-right: 0;
}

/* Informações tab — vitrine do estádio + mosaico de tiles. */
.venue {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
  margin-bottom: 14px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--emerald) 18%, var(--bg-base)), color-mix(in srgb, var(--azure) 16%, var(--bg-base)));
  border: 1px solid var(--border);
}
.venue.has-photo { color: #fff; border-color: transparent; }
.venue-photo {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.venue-grad {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(8, 12, 18, 0.08), rgba(8, 12, 18, 0.78));
}
.venue-body { position: relative; z-index: 2; }
.venue-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
  margin-bottom: 5px;
}
.venue.has-photo .venue-kicker { color: rgba(255, 255, 255, 0.85); }
.venue:not(.has-photo) .venue-kicker { color: var(--muted); }
.venue-name {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-2xl);
  line-height: 1;
  text-transform: uppercase;
  margin: 0;
}
.venue-loc { font-size: var(--fs-sm); font-weight: 600; margin: 4px 0 0; }
.venue.has-photo .venue-loc { color: rgba(255, 255, 255, 0.9); }
.venue:not(.has-photo) .venue-loc { color: var(--muted); }
.venue-credit {
  position: absolute;
  right: 9px;
  bottom: 6px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 70%;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.58);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.venue-credit svg { flex: none; }
.venue-credit:hover { color: rgba(255, 255, 255, 0.9); }

.mosaic {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mtile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 13px 14px;
  min-width: 0;
}
.mtile.wide { grid-column: 1 / -1; }
.mt-lbl {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.mt-ic { color: var(--muted); flex: none; }
.mt-val {
  font-family: 'Oswald', sans-serif;
  font-weight: 600;
  font-size: var(--fs-lg);
  line-height: 1.1;
  color: var(--text);
  word-break: break-word;
}
/* No desktop o mosaico ganha mais colunas. */
@media (min-width: 720px) {
  .mosaic { grid-template-columns: repeat(3, 1fr); }
  .mtile.wide { grid-column: span 1; }
}
</style>
