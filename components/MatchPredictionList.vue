<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import type { Match } from '~/types/api';

// The shared match table (desktop) + card (mobile) used by BOTH the admin
// "Palpites" screen and the public match lists. Layout is identical; callers
// only vary the prediction behaviour: who can edit (`editable`), how a save is
// persisted (`saveFn`), the row link (`rowTo`) and the logged-out prompt.
export interface PredScore {
  tier: string;
  points: number;
}
export interface PredRow {
  match: Match & { round?: { number: number | null; name: string | null } | null };
  prediction: { homeScore: number; awayScore: number } | null;
  score: PredScore | null;
}

const props = withDefaults(
  defineProps<{
    rows: PredRow[];
    loading?: boolean;
    /** fallback tournament label when the match has no embedded season */
    seasonName?: string;
    /** show the tournament line (hide on single-tournament lists to avoid repeating it) */
    showSeason?: boolean;
    /** can this row's palpite be edited right now? (admin: always; public: open + logged in) */
    editable?: (row: PredRow) => boolean;
    /** show a "log in to predict" CTA instead of the editor (public, logged out) */
    loginPrompt?: (row: PredRow) => boolean;
    loginTo?: RouteLocationRaw;
    /** whole-row/card link target */
    rowTo?: (row: PredRow) => string | null | undefined;
    /** persists a palpite; resolves with the stored guess + its score */
    saveFn: (row: PredRow, home: number, away: number) => Promise<{ homeScore: number; awayScore: number; score: PredScore | null }>;
    savedMessage?: string;
  }>(),
  {
    loading: false,
    seasonName: '',
    showSeason: true,
    editable: () => true,
    loginPrompt: () => false,
    loginTo: '/entrar',
    rowTo: () => null,
    savedMessage: 'Palpite salvo ✓',
  },
);
const emit = defineEmits<{ saved: [{ matchId: string; homeScore: number; awayScore: number; score: PredScore | null }] }>();

const ui = useUiStore();
const tz = useTz();
const { track } = useTrack();

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada', LIVE: 'Ao vivo', FINISHED: 'Encerrada',
  CANCELLED: 'Cancelada', POSTPONED: 'Adiada',
};
const STATUS_TONE: Record<string, 'azure' | 'scarlet' | 'neutral'> = {
  SCHEDULED: 'azure', LIVE: 'scarlet', FINISHED: 'neutral',
  CANCELLED: 'neutral', POSTPONED: 'neutral',
};

// Desktop = AdminTable; mobile (≤720px) = cards (same split as the admin screen).
const isMobile = ref(false);
onMounted(() => {
  const mq = window.matchMedia('(max-width: 720px)');
  isMobile.value = mq.matches;
  mq.addEventListener('change', (e) => (isMobile.value = e.matches));
});

function scorable(r: PredRow): boolean {
  return r.match.status === 'LIVE' || r.match.status === 'FINISHED';
}
function teamName(team: { name?: string } | null | undefined, placeholder?: string | null): string {
  return team?.name ?? placeholder ?? 'A definir';
}
function seasonOf(r: PredRow): string {
  return r.match.season?.name ?? props.seasonName;
}

// ── inline edit / save (draft per match; null = blank "–") ──
// Optimistic local copy so the cell settles immediately after a save, regardless
// of whether the parent feeds the new prediction back through `rows`.
const savedLocal = reactive<Record<string, { homeScore: number; awayScore: number; score: PredScore | null }>>({});
function predOf(r: PredRow): { homeScore: number; awayScore: number } | null {
  const s = savedLocal[r.match.id];
  return s ? { homeScore: s.homeScore, awayScore: s.awayScore } : r.prediction;
}
function scoreOf(r: PredRow): PredScore | null {
  const s = savedLocal[r.match.id];
  return s ? s.score : r.score;
}
// Which palpite UI a row shows: editable stepper, read-only guess, a login CTA
// (open + logged out), or empty steppers (locked, no guess). Mirrors the v-if
// chain so the mobile card can render home/away steppers on their own lines.
function predMode(r: PredRow): 'edit' | 'view' | 'login' | 'empty' {
  if (props.editable(r)) return 'edit';
  if (predOf(r)) return 'view';
  if (props.loginPrompt(r)) return 'login';
  return 'empty';
}
// Points chip text: "0" when none, "+10" for a positive score.
function fmtPts(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
// Highlight a card when the match is still open and the user hasn't palpitado yet
// (a nudge to predict before kickoff).
function needsPrediction(r: PredRow): boolean {
  return props.editable(r) && !predOf(r);
}
// Single winning highlight class (by priority) — shared by the card and the
// desktop table row: live > não palpitada > agendada / adiada / encerrada.
function highlight(r: PredRow): string | undefined {
  if (r.match.status === 'LIVE') return 'live';
  if (needsPrediction(r)) return 'needs';
  if (r.match.status === 'SCHEDULED') return 'scheduled';
  if (r.match.status === 'POSTPONED') return 'postponed';
  if (r.match.status === 'FINISHED') return 'finished';
  return undefined;
}
// Suggestive label for the accuracy chip — uses the app-wide tierLabel (e.g.
// OUTCOME → "Acertou o vencedor", or "Acertou o empate" on a draw), with the
// punchier "Errou" for a no-score guess.
function tierChip(r: PredRow): string {
  const tier = scoreOf(r)?.tier;
  if (!tier) return '';
  if (tier === 'NONE') return 'Errou';
  const m = r.match;
  const isDraw = scorable(r) && (m.homeScore ?? 0) === (m.awayScore ?? 0);
  return tierLabel(tier, isDraw);
}

const draft = reactive<Record<string, { home: number | null; away: number | null }>>({});
function draftFor(r: PredRow) {
  if (!draft[r.match.id]) {
    const p = predOf(r);
    draft[r.match.id] = { home: p ? p.homeScore : null, away: p ? p.awayScore : null };
  }
  return draft[r.match.id];
}
function bump(r: PredRow, side: 'home' | 'away', delta: number) {
  const d = draftFor(r);
  d[side] = Math.min(99, Math.max(0, (d[side] ?? -1) + delta));
  scheduleSave(r);
}
// Auto-save: no save button — a palpite persists 500ms after the last bump
// (per-match debounce, so editing several rows doesn't cross wires).
const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
function scheduleSave(r: PredRow) {
  const id = r.match.id;
  if (saveTimers[id]) clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => {
    delete saveTimers[id];
    if (dirty(r)) save(r);
  }, 500);
}
onBeforeUnmount(() => {
  for (const id in saveTimers) clearTimeout(saveTimers[id]);
});
const savingId = ref('');
function dirty(r: PredRow): boolean {
  const d = draft[r.match.id];
  if (!d || d.home === null || d.away === null) return false;
  const p = predOf(r);
  if (!p) return true;
  return d.home !== p.homeScore || d.away !== p.awayScore;
}
async function save(r: PredRow) {
  const d = draft[r.match.id];
  if (!d || d.home === null || d.away === null) return;
  const novo = !predOf(r); // 1º palpite deste jogo (não é ajuste do auto-save)
  savingId.value = r.match.id;
  try {
    const res = await props.saveFn(r, d.home, d.away);
    savedLocal[r.match.id] = { homeScore: res.homeScore, awayScore: res.awayScore, score: res.score };
    emit('saved', { matchId: r.match.id, homeScore: res.homeScore, awayScore: res.awayScore, score: res.score });
    if (novo) track('palpite', { match_id: r.match.id });
    ui.toast('success', props.savedMessage);
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    savingId.value = '';
  }
}

// Date split into "dd/MM/yyyy" (top) and "HH:mm" (bottom), in the user's tz.
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz.value,
  }).format(new Date(iso));
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: tz.value,
  }).format(new Date(iso));
}
function stadiumLoc(s: { city: string; state: string | null; country: string }): string {
  const second = s.state && s.state !== s.city ? s.state : s.country !== s.city ? s.country : '';
  return [s.city, second].filter(Boolean).join(', ');
}

const COLS: AdminColumn[] = [
  { key: 'match', label: 'Partida' },
  { key: 'phase', label: 'Fase', mobileHide: true },
  { key: 'stadium', label: 'Estádio', mobileHide: true },
  { key: 'pts', label: 'Pts', align: 'end' },
];
</script>

<template>
  <AdminTable
    v-if="!isMobile"
    :columns="COLS" :rows="loading ? undefined : rows"
    :row-key="(r) => r.match.id"
    :row-class="(r) => highlight(r)"
    :row-to="(r) => rowTo(r) ?? undefined"
    :row-label="(r) => `Acompanhar ${teamName(r.match.homeTeam, r.match.homeSourceLabel)} x ${teamName(r.match.awayTeam, r.match.awaySourceLabel)}`"
    grid="minmax(0, 300px) 0.85fr 1fr 46px" empty="Nenhum jogo." empty-icon="ball"
  >
    <template #col-match="{ row }">
      <div class="when">
        <span class="dt">
          <span class="dd">{{ fmtDate(row.match.kickoffAt) }}</span>
          <span class="dot">·</span>
          <span class="hh">{{ row.match.status === 'POSTPONED' ? 'a definir' : fmtTime(row.match.kickoffAt) }}</span>
        </span>
        <span class="when-r">
          <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
          <MatchNotifyBell :match="row.match" :size="16" />
        </span>
      </div>
      <div class="teams">
        <span class="tline">
          <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="24" />
          <span class="tn">{{ teamName(row.match.homeTeam, row.match.homeSourceLabel) }}</span>
          <b class="tsc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.homeScore : '–' }}</b>
          <span v-if="predMode(row) !== 'login'" class="tpred" :class="{ raise: predMode(row) === 'edit' }">
            <ScoreStepper v-if="predMode(row) === 'edit'" horizontal :value="draftFor(row).home" label="placar do mandante" @bump="(d) => bump(row, 'home', d)" />
            <ScoreStepper v-else-if="predMode(row) === 'view'" horizontal readonly :value="predOf(row)!.homeScore" />
            <ScoreStepper v-else horizontal readonly :value="null" />
          </span>
        </span>
        <span class="tline">
          <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="24" />
          <span class="tn">{{ teamName(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
          <b class="tsc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.awayScore : '–' }}</b>
          <span v-if="predMode(row) !== 'login'" class="tpred" :class="{ raise: predMode(row) === 'edit' }">
            <ScoreStepper v-if="predMode(row) === 'edit'" horizontal :value="draftFor(row).away" label="placar do visitante" @bump="(d) => bump(row, 'away', d)" />
            <ScoreStepper v-else-if="predMode(row) === 'view'" horizontal readonly :value="predOf(row)!.awayScore" />
            <ScoreStepper v-else horizontal readonly :value="null" />
          </span>
        </span>
      </div>
      <NuxtLink v-if="predMode(row) === 'login'" :to="loginTo" class="cta mt-cta">
        Palpitar <AppIcon name="arrowRight" :size="13" :stroke="2.4" />
      </NuxtLink>
    </template>
    <template #col-phase="{ row }">
      <span class="phcell">
        <span v-if="showSeason && seasonOf(row)" class="ph-season">{{ seasonOf(row) }}</span>
        <span class="ph-main">{{ row.match.phaseLabel || row.match.round?.name }}</span>
        <span v-if="row.match.groupName" class="ph-sub">Grupo {{ row.match.groupName }}</span>
        <span v-if="row.match.round?.number != null" class="ph-sub">Rodada {{ row.match.round.number }}</span>
      </span>
    </template>
    <template #col-stadium="{ row }">
      <span v-if="row.match.stadium" class="stcell">
        <span class="st-name">{{ row.match.stadium.name }}</span>
        <span class="st-loc">{{ stadiumLoc(row.match.stadium) }}</span>
      </span>
      <span v-else class="pts-none">—</span>
    </template>
    <template #col-pts="{ row }">
      <span v-if="scoreOf(row)" class="pts" :title="tierChip(row)">
        {{ scoreOf(row)!.points }}
      </span>
      <span v-else class="pts-none">—</span>
    </template>
  </AdminTable>

  <!-- mobile: one card per match -->
  <div v-else-if="loading" class="mloading">Carregando…</div>
  <div v-else-if="!rows.length" class="mempty">Nenhum jogo.</div>
  <ul v-else class="mcards">
    <li v-for="row in rows" :key="row.match.id" class="mcard" :class="highlight(row)">
      <NuxtLink
        v-if="rowTo(row)" :to="rowTo(row)!" class="mc-link"
        :aria-label="`Acompanhar ${teamName(row.match.homeTeam, row.match.homeSourceLabel)} x ${teamName(row.match.awayTeam, row.match.awaySourceLabel)}`"
      />
      <div class="mc-head">
        <span class="mc-when">{{ fmtDate(row.match.kickoffAt) }} · {{ row.match.status === 'POSTPONED' ? 'a definir' : fmtTime(row.match.kickoffAt) }}</span>
        <span class="mc-head-r">
          <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
          <MatchNotifyBell :match="row.match" :size="18" />
        </span>
      </div>
      <!-- time (esquerda) + palpite (direita): uma linha por time, pra que cada
           placar do palpite fique alinhado com o seu time. -->
      <div class="mc-body" :class="{ login: predMode(row) === 'login' }">
        <span v-if="predMode(row) !== 'login'" class="b-cap b-cap-s">Placar</span>
        <span v-if="predMode(row) !== 'login'" class="b-cap b-cap-p">Palpite</span>

        <div class="b-team home mc-trow">
          <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="30" />
          <span class="mc-tn">{{ teamName(row.match.homeTeam, row.match.homeSourceLabel) }}</span>
          <b class="mc-sc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.homeScore : '–' }}</b>
        </div>
        <div v-if="predMode(row) !== 'login'" class="b-pred home">
          <ScoreStepper
            v-if="predMode(row) === 'edit'" horizontal :value="draftFor(row).home"
            label="placar do mandante" @bump="(d) => bump(row, 'home', d)"
          />
          <ScoreStepper v-else-if="predMode(row) === 'view'" horizontal readonly :value="predOf(row)!.homeScore" />
          <ScoreStepper v-else horizontal readonly :value="null" />
        </div>

        <div class="b-team away mc-trow">
          <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="30" />
          <span class="mc-tn">{{ teamName(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
          <b class="mc-sc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.awayScore : '–' }}</b>
        </div>
        <div v-if="predMode(row) !== 'login'" class="b-pred away">
          <ScoreStepper
            v-if="predMode(row) === 'edit'" horizontal :value="draftFor(row).away"
            label="placar do visitante" @bump="(d) => bump(row, 'away', d)"
          />
          <ScoreStepper v-else-if="predMode(row) === 'view'" horizontal readonly :value="predOf(row)!.awayScore" />
          <ScoreStepper v-else horizontal readonly :value="null" />
        </div>

        <div v-if="predMode(row) === 'login'" class="b-foot">
          <NuxtLink :to="loginTo" class="cta">
            Entre para palpitar <AppIcon name="arrowRight" :size="13" :stroke="2.4" />
          </NuxtLink>
        </div>
      </div>
      <div class="mc-meta">
        <div class="mc-meta-info">
          <div v-if="showSeason && seasonOf(row)" class="mc-season">{{ seasonOf(row) }}</div>
          <div class="mc-phase">
            {{ row.match.phaseLabel || row.match.round?.name
            }}<template v-if="row.match.groupName"> · Grupo {{ row.match.groupName }}</template
            ><template v-if="row.match.round?.number != null"> · Rodada {{ row.match.round.number }}</template>
          </div>
        </div>
        <div v-if="scoreOf(row)" class="mc-score" :style="{ '--c': tierColor(scoreOf(row)!.tier) }">
          <span class="mc-ptschip font-numeric">{{ fmtPts(scoreOf(row)!.points) }}</span>
          <span class="mc-tierchip">{{ tierChip(row) }}</span>
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.teams { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tline { display: flex; align-items: center; gap: 7px; min-width: 0; }
.tn { flex: 1; font-weight: 700; font-size: var(--fs-base); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tsc { flex: none; width: 18px; text-align: center; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-base); line-height: 1; }
.tsc.none { color: var(--muted); }
/* date+time (left) + status chip (right) above the teams, within the Partida column */
.when { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.when-r { display: inline-flex; align-items: center; gap: 4px; }
.dt { display: inline-flex; align-items: baseline; gap: 5px; min-width: 0; }
.dot { color: var(--muted); }
/* breathing room comes from each cell's right padding, not a grid gap */
:deep(.atr-row) { gap: 0; }
:deep(.atr-cell) { padding-right: 32px; }
:deep(.atr-cell:last-child) { padding-right: 0; }
/* Fase + Estádio (the mobile-hidden columns) align to the top of the row so their
   first lines line up, instead of the shorter Estádio floating in the middle. */
:deep(.atr-cell.m-hide) { align-self: flex-start; }
/* Destaque da linha por estado — mesma semântica do card (highlight() já resolve
   a prioridade, então só uma classe chega por linha). */
:deep(.atr-row.finished) {
  background: color-mix(in srgb, var(--muted) 6%, transparent);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--muted) 70%, transparent);
}
:deep(.atr-row.scheduled) {
  background: color-mix(in srgb, var(--azure) 7%, transparent);
  box-shadow: inset 3px 0 0 var(--azure);
}
:deep(.atr-row.postponed) {
  background: color-mix(in srgb, var(--magenta) 7%, transparent);
  box-shadow: inset 3px 0 0 var(--magenta);
}
:deep(.atr-row.needs) {
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  box-shadow: inset 3px 0 0 var(--gold);
}
:deep(.atr-row.live) {
  background: color-mix(in srgb, var(--scarlet) 7%, transparent);
  box-shadow: inset 3px 0 0 var(--scarlet);
}
.dd { font-weight: 700; font-size: var(--fs-xs); white-space: nowrap; }
.hh { font-weight: 700; font-size: var(--fs-xs); white-space: nowrap; }
.phcell { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.ph-season {
  font-size: var(--fs-xs); font-weight: 700; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ph-main { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-sub { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stcell { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.st-name { font-size: var(--fs-xs); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-loc { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* palpite na linha do time (mesma orientação do card): placar real + stepper.
   Editável é elevado acima do link da linha pra os chevrons continuarem clicáveis;
   o read-only NÃO é elevado, então o clique cai no link da partida. */
.tpred { flex: none; display: inline-flex; align-items: center; margin-left: 2px; }
.tpred.raise { position: relative; z-index: 2; }
/* CTA abaixo dos times (deslogado) */
.mt-cta { margin-top: 7px; }
.cta {
  position: relative; z-index: 2;
  display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-xs); font-weight: 700; color: var(--gold);
}
.pts {
  display: inline-grid; place-items: center; min-width: 30px; padding: 3px 8px;
  border-radius: 999px; background: color-mix(in srgb, var(--emerald) 16%, transparent);
  color: var(--emerald); font-weight: 800; font-size: var(--fs-sm);
}
.pts-none { color: var(--muted); }

/* ── mobile cards ── */
.mloading, .mempty { padding: 2rem 0; text-align: center; color: var(--muted); font-weight: 600; }
.mcards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.mcard {
  position: relative;
  border: 1px solid var(--border); border-radius: 13px;
  background: var(--bg-surface); padding: 18px 18px;
  transition: border-color 0.15s ease;
}
.mcard:hover { border-color: color-mix(in srgb, var(--text) 22%, var(--border)); }
.mc-link { position: absolute; inset: 0; z-index: 1; border-radius: inherit; }
/* Destaques por estado, em ordem de prioridade (mesma especificidade → a última
   regra vence): encerrada (cinza) / agendada (azul) / adiada (magenta) < não
   palpitada (amarelo) < ao vivo (vermelho). */
.mcard.finished {
  border-color: color-mix(in srgb, var(--muted) 35%, var(--border));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--muted) 70%, transparent);
  background: color-mix(in srgb, var(--muted) 5%, var(--bg-surface));
}
.mcard.scheduled {
  border-color: color-mix(in srgb, var(--azure) 45%, var(--border));
  box-shadow: inset 3px 0 0 var(--azure);
  background: color-mix(in srgb, var(--azure) 6%, var(--bg-surface));
}
.mcard.postponed {
  border-color: color-mix(in srgb, var(--magenta) 45%, var(--border));
  box-shadow: inset 3px 0 0 var(--magenta);
  background: color-mix(in srgb, var(--magenta) 6%, var(--bg-surface));
}
/* jogo aberto que o usuário ainda não palpitou — destaque amarelo (nudge) */
.mcard.needs {
  border-color: color-mix(in srgb, var(--gold) 50%, var(--border));
  box-shadow: inset 3px 0 0 var(--gold);
  background: color-mix(in srgb, var(--gold) 7%, var(--bg-surface));
}
.mcard.live {
  border-color: color-mix(in srgb, var(--scarlet) 45%, var(--border));
  box-shadow: inset 3px 0 0 var(--scarlet);
  background: color-mix(in srgb, var(--scarlet) 6%, var(--bg-surface));
}
.mc-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-bottom: 12px;
}
.mc-when { font-size: var(--fs-xs); font-weight: 700; }
.mc-head-r { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 4px; }
/* season/fase à esquerda; pontos (cima) + tipo de acerto (baixo) à direita */
.mc-meta { margin-top: 12px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mc-meta-info { min-width: 0; }
.mc-season { font-size: var(--fs-sm); font-weight: 700; color: var(--text); margin-bottom: 2px; }
.mc-phase { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; }
.mc-score { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.mc-ptschip {
  display: inline-grid; place-items: center; min-width: 34px; padding: 3px 10px;
  border-radius: 999px; font-weight: 800; font-size: var(--fs-sm); line-height: 1;
  color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent);
}
.mc-tierchip {
  font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent); border-radius: 999px;
  padding: 2px 8px; color: var(--c); white-space: nowrap;
}
/* time (esquerda) + palpite (direita): grid de 2 colunas, uma linha por time,
   pra que cada placar do palpite fique na mesma linha do seu time. */
.mc-body {
  position: relative; z-index: 2;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    "capS  capP"
    "homeT homeP"
    "awayT awayP"
    "foot  foot";
  align-items: center;
  column-gap: 14px;
  row-gap: 8px;
}
.b-cap {
  font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted);
}
/* "PLACAR" alinhado à direita, sobre o placar real (fim da linha do time) */
.b-cap-s { grid-area: capS; justify-self: end; }
.b-cap-p { grid-area: capP; justify-self: center; }
.b-team.home { grid-area: homeT; }
.b-team.away { grid-area: awayT; }
.b-pred { grid-area: homeP; justify-self: center; }
.b-pred.away { grid-area: awayP; }
.b-foot {
  grid-area: foot;
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
}
.mc-body.login .b-foot { justify-content: center; }
.mc-trow { display: flex; align-items: center; gap: 9px; min-width: 0; }
.mc-tn { flex: 1; min-width: 0; font-weight: 700; font-size: var(--fs-lg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* placar real com a mesma caixa do número do palpite (ScoreStepper horizontal):
   Oswald 18px, 22px de largura centralizada, pra alinhar e combinar visualmente. */
.mc-sc {
  flex: none;
  width: 22px;
  text-align: center;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: var(--fs-lg);
  line-height: 1;
}
.mc-sc.none { color: var(--muted); }
</style>
