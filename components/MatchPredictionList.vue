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
    loginTo: '/login',
    rowTo: () => null,
    savedMessage: 'Palpite salvo ✓',
  },
);
const emit = defineEmits<{ saved: [{ matchId: string; homeScore: number; awayScore: number; score: PredScore | null }] }>();

const ui = useUiStore();
const tz = useTz();

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada', LIVE: 'Ao vivo', FINISHED: 'Encerrada',
  CANCELLED: 'Cancelada', POSTPONED: 'Adiada',
};
const STATUS_TONE: Record<string, 'azure' | 'scarlet' | 'neutral'> = {
  SCHEDULED: 'azure', LIVE: 'scarlet', FINISHED: 'neutral',
  CANCELLED: 'neutral', POSTPONED: 'neutral',
};
const TIER_LABEL: Record<string, string> = {
  EXACT: 'Cravou', WINNER_GOALS: 'Vencedor + gols', GOAL_DIFF: 'Saldo',
  LOSER_GOALS: 'Gols do perdedor', OUTCOME: 'Resultado', NONE: 'Errou',
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
}
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
  savingId.value = r.match.id;
  try {
    const res = await props.saveFn(r, d.home, d.away);
    savedLocal[r.match.id] = { homeScore: res.homeScore, awayScore: res.awayScore, score: res.score };
    emit('saved', { matchId: r.match.id, homeScore: res.homeScore, awayScore: res.awayScore, score: res.score });
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
  { key: 'guess', label: 'Palpite' },
  { key: 'pts', label: 'Pts', align: 'end' },
];
</script>

<template>
  <AdminTable
    v-if="!isMobile"
    hide-head
    :columns="COLS" :rows="loading ? undefined : rows"
    :row-key="(r) => r.match.id"
    :row-class="(r) => (r.match.status === 'LIVE' ? 'live' : undefined)"
    :row-to="(r) => rowTo(r) ?? undefined"
    :row-label="(r) => `Acompanhar ${teamName(r.match.homeTeam, r.match.homeSourceLabel)} x ${teamName(r.match.awayTeam, r.match.awaySourceLabel)}`"
    grid="minmax(0, 250px) 0.85fr 1fr 150px 46px" empty="Nenhum jogo." empty-icon="ball"
  >
    <template #col-match="{ row }">
      <div class="when">
        <span class="dt">
          <span class="dd">{{ fmtDate(row.match.kickoffAt) }}</span>
          <span class="dot">·</span>
          <span class="hh">{{ row.match.status === 'POSTPONED' ? 'a definir' : fmtTime(row.match.kickoffAt) }}</span>
        </span>
        <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
      </div>
      <div class="teams">
        <span class="tline">
          <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="20" />
          <span class="tn">{{ teamName(row.match.homeTeam, row.match.homeSourceLabel) }}</span>
          <b class="tsc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.homeScore : '–' }}</b>
        </span>
        <span class="tline">
          <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="20" />
          <span class="tn">{{ teamName(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
          <b class="tsc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.awayScore : '–' }}</b>
        </span>
      </div>
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
    <template #col-guess="{ row }">
      <!-- editable: stepper editor -->
      <div v-if="editable(row)" class="guess">
        <ScoreStepper :value="draftFor(row).home" label="placar do mandante" @bump="(d) => bump(row, 'home', d)" />
        <span class="x">×</span>
        <ScoreStepper :value="draftFor(row).away" label="placar do visitante" @bump="(d) => bump(row, 'away', d)" />
        <button
          v-if="dirty(row)" class="btn btn-primary save" :disabled="savingId === row.match.id"
          aria-label="Salvar palpite" @click="save(row)"
        >
          <span v-if="savingId === row.match.id" class="spin" />
          <AppIcon v-else name="check" :size="16" :stroke="2.8" />
        </button>
      </div>
      <!-- locked, has a guess: same look as the editor, minus the chevrons -->
      <div v-else-if="predOf(row)" class="gline">
        <ScoreStepper :value="predOf(row)!.homeScore" readonly />
        <span class="x">×</span>
        <ScoreStepper :value="predOf(row)!.awayScore" readonly />
      </div>
      <!-- open, logged out -->
      <NuxtLink v-else-if="loginPrompt(row)" :to="loginTo" class="cta">
        Palpitar <AppIcon name="arrowRight" :size="13" :stroke="2.4" />
      </NuxtLink>
      <!-- no guess: same look, just empty ( – × – ) -->
      <div v-else class="gline">
        <ScoreStepper :value="null" readonly />
        <span class="x">×</span>
        <ScoreStepper :value="null" readonly />
      </div>
    </template>
    <template #col-pts="{ row }">
      <span v-if="scoreOf(row)" class="pts" :title="TIER_LABEL[scoreOf(row)!.tier] ?? scoreOf(row)!.tier">
        {{ scoreOf(row)!.points }}
      </span>
      <span v-else class="pts-none">—</span>
    </template>
  </AdminTable>

  <!-- mobile: one card per match -->
  <div v-else-if="loading" class="mloading">Carregando…</div>
  <div v-else-if="!rows.length" class="mempty">Nenhum jogo.</div>
  <ul v-else class="mcards">
    <li v-for="row in rows" :key="row.match.id" class="mcard" :class="{ live: row.match.status === 'LIVE' }">
      <NuxtLink
        v-if="rowTo(row)" :to="rowTo(row)!" class="mc-link"
        :aria-label="`Acompanhar ${teamName(row.match.homeTeam, row.match.homeSourceLabel)} x ${teamName(row.match.awayTeam, row.match.awaySourceLabel)}`"
      />
      <div class="mc-head">
        <span class="mc-when">{{ fmtDate(row.match.kickoffAt) }} · {{ row.match.status === 'POSTPONED' ? 'a definir' : fmtTime(row.match.kickoffAt) }}</span>
        <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
      </div>
      <div class="mc-teams">
        <div class="mc-trow">
          <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="22" />
          <span class="mc-tn">{{ teamName(row.match.homeTeam, row.match.homeSourceLabel) }}</span>
          <b class="mc-sc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.homeScore : '-' }}</b>
        </div>
        <div class="mc-trow">
          <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="22" />
          <span class="mc-tn">{{ teamName(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
          <b class="mc-sc" :class="{ none: !scorable(row) }">{{ scorable(row) ? row.match.awayScore : '-' }}</b>
        </div>
      </div>
      <div class="mc-meta">
        <div v-if="showSeason && seasonOf(row)" class="mc-season">{{ seasonOf(row) }}</div>
        <div class="mc-phase">
          {{ row.match.phaseLabel || row.match.round?.name
          }}<template v-if="row.match.groupName"> · Grupo {{ row.match.groupName }}</template
          ><template v-if="row.match.round?.number != null"> · Rodada {{ row.match.round.number }}</template>
        </div>
      </div>
      <div class="mc-foot">
        <!-- editable: stepper editor -->
        <template v-if="editable(row)">
          <span class="mc-lbl">Palpite</span>
          <ScoreStepper :value="draftFor(row).home" label="placar do mandante" @bump="(d) => bump(row, 'home', d)" />
          <span class="x">×</span>
          <ScoreStepper :value="draftFor(row).away" label="placar do visitante" @bump="(d) => bump(row, 'away', d)" />
          <button
            v-if="dirty(row)" class="btn btn-primary save" :disabled="savingId === row.match.id"
            aria-label="Salvar palpite" @click="save(row)"
          >
            <span v-if="savingId === row.match.id" class="spin" />
            <AppIcon v-else name="check" :size="16" :stroke="2.8" />
          </button>
        </template>
        <!-- locked, has a guess: same look as the editor, minus the chevrons -->
        <template v-else-if="predOf(row)">
          <span class="mc-lbl">Palpite</span>
          <ScoreStepper :value="predOf(row)!.homeScore" readonly />
          <span class="x">×</span>
          <ScoreStepper :value="predOf(row)!.awayScore" readonly />
        </template>
        <!-- open, logged out -->
        <NuxtLink v-else-if="loginPrompt(row)" :to="loginTo" class="cta">
          Entre para palpitar <AppIcon name="arrowRight" :size="13" :stroke="2.4" />
        </NuxtLink>
        <!-- no guess: same look, just empty ( – × – ) -->
        <template v-else>
          <span class="mc-lbl">Palpite</span>
          <ScoreStepper :value="null" readonly />
          <span class="x">×</span>
          <ScoreStepper :value="null" readonly />
        </template>
        <span v-if="scoreOf(row)" class="pts mc-pts" :title="TIER_LABEL[scoreOf(row)!.tier] ?? scoreOf(row)!.tier">{{ scoreOf(row)!.points }} pts</span>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.teams { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tline { display: flex; align-items: center; gap: 7px; min-width: 0; }
.tn { flex: 1; font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tsc { flex: none; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 15px; line-height: 1; }
.tsc.none { color: var(--muted); }
/* date+time (left) + status chip (right) above the teams, within the Partida column */
.when { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.dt { display: inline-flex; align-items: baseline; gap: 5px; min-width: 0; }
.dot { color: var(--muted); }
/* more breathing room between columns */
:deep(.atr-row) { gap: 32px; }
/* Fase + Estádio (the mobile-hidden columns) align to the top of the row so their
   first lines line up, instead of the shorter Estádio floating in the middle. */
:deep(.atr-cell.m-hide) { align-self: flex-start; }
/* highlight the row of a live match (status shown in the Status column) */
:deep(.atr-row.live) {
  background: color-mix(in srgb, var(--scarlet) 7%, transparent);
  box-shadow: inset 3px 0 0 var(--scarlet);
}
.dd { font-weight: 700; font-size: 12.5px; white-space: nowrap; }
.hh { font-weight: 700; font-size: 12.5px; white-space: nowrap; }
.phcell { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.ph-season {
  font-size: 12px; font-weight: 700; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ph-main { font-size: 11px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-sub { font-size: 11px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stcell { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.st-name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-loc { font-size: 11px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* raised above the row link so the stepper/save stay clickable */
.guess { display: flex; align-items: center; gap: 7px; position: relative; z-index: 2; }
/* read-only guess (locked / empty): same flex, but NOT raised so a click still
   falls through to the row link */
.gline { display: flex; align-items: center; gap: 7px; }
.x { color: var(--muted); font-weight: 700; }
.cta {
  position: relative; z-index: 2;
  display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--gold);
}
.save {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
}
.spin {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, #fff 45%, transparent);
  border-top-color: #fff;
  animation: pl-spin 0.7s linear infinite;
}
@keyframes pl-spin {
  to { transform: rotate(360deg); }
}
.pts {
  display: inline-grid; place-items: center; min-width: 30px; padding: 3px 8px;
  border-radius: 999px; background: color-mix(in srgb, var(--emerald) 16%, transparent);
  color: var(--emerald); font-weight: 800; font-size: 13px;
}
.pts-none { color: var(--muted); }

/* ── mobile cards ── */
.mloading, .mempty { padding: 2rem 0; text-align: center; color: var(--muted); font-weight: 600; }
.mcards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.mcard {
  position: relative;
  border: 1px solid var(--border); border-radius: 13px;
  background: var(--bg-surface); padding: 12px;
  transition: border-color 0.15s ease;
}
.mcard:hover { border-color: color-mix(in srgb, var(--text) 22%, var(--border)); }
.mc-link { position: absolute; inset: 0; z-index: 1; border-radius: inherit; }
.mcard.live {
  border-color: color-mix(in srgb, var(--scarlet) 45%, var(--border));
  box-shadow: inset 3px 0 0 var(--scarlet);
  background: color-mix(in srgb, var(--scarlet) 6%, var(--bg-surface));
}
.mc-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-bottom: 6px;
}
.mc-when { font-size: 12.5px; font-weight: 700; }
.mc-meta { margin-top: 10px; }
.mc-season { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
.mc-phase { font-size: 11.5px; color: var(--muted); font-weight: 600; }
.mc-teams { display: flex; flex-direction: column; gap: 7px; }
.mc-trow { display: flex; align-items: center; gap: 9px; }
.mc-tn { flex: 1; min-width: 0; font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc-sc { flex: none; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 17px; }
.mc-sc.none { color: var(--muted); }
.mc-foot {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 7px;
  margin-top: 11px; padding-top: 11px; border-top: 1px solid var(--border);
}
.mc-lbl {
  flex: none; font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted);
}
.mc-pts { margin-left: auto; }
</style>
