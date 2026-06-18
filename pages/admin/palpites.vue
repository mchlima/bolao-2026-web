<script setup lang="ts">
import type { Match, Paginated, Tournament, User } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const tz = useTz();

interface Score {
  tier: string;
  points: number;
}
interface PredRow {
  match: Match & { round?: { number: number | null; name: string | null } | null };
  prediction: { homeScore: number; awayScore: number } | null;
  score: Score | null;
}

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

// ── Tournament picker ──
const tournaments = ref<Tournament[]>([]);
const seasonId = ref('');

// ── User picker (search dropdown) ──
const userSearch = ref('');
const userResults = ref<User[]>([]);
const userOpen = ref(false);
const selectedUser = ref<User | null>(null);
let userTimer: ReturnType<typeof setTimeout> | undefined;
watch(userSearch, (q) => {
  if (userTimer) clearTimeout(userTimer);
  if (!q.trim()) { userResults.value = []; return; }
  userTimer = setTimeout(async () => {
    const r = await useApi()<Paginated<User>>(
      `/admin/users?pageSize=8&search=${encodeURIComponent(q.trim())}`,
    );
    userResults.value = r.data;
    userOpen.value = true;
  }, 250);
});
function pickUser(u: User) {
  selectedUser.value = u;
  userSearch.value = '';
  userResults.value = [];
  userOpen.value = false;
}
function clearUser() {
  selectedUser.value = null;
  rows.value = [];
}

// ── Rows ──
const rows = ref<PredRow[]>([]);
const loading = ref(false);
const rowFilter = ref('');
const statusFilter = ref('');

// Desktop = AdminTable; mobile (≤720px) = bespoke cards (the generic label:value
// collapse is awkward for 7 columns + stacked teams + an inline editor).
const isMobile = ref(false);
function scorable(r: PredRow): boolean {
  return r.match.status === 'LIVE' || r.match.status === 'FINISHED';
}

async function loadRows() {
  if (!selectedUser.value || !seasonId.value) { rows.value = []; return; }
  loading.value = true;
  try {
    rows.value = await useApi()<PredRow[]>(
      `/admin/predictions?userId=${selectedUser.value.id}&seasonId=${seasonId.value}`,
    );
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao carregar');
  } finally {
    loading.value = false;
  }
}
watch([selectedUser, seasonId], loadRows);

const filteredRows = computed(() => {
  const q = rowFilter.value.trim().toLowerCase();
  const st = statusFilter.value;
  return rows.value.filter((r) => {
    if (st && r.match.status !== st) return false;
    if (!q) return true;
    const h = `${r.match.homeTeam?.name ?? ''} ${r.match.homeTeam?.shortName ?? ''}`.toLowerCase();
    const a = `${r.match.awayTeam?.name ?? ''} ${r.match.awayTeam?.shortName ?? ''}`.toLowerCase();
    return h.includes(q) || a.includes(q);
  });
});
// Fixed status options (always selectable — "Ao vivo" must be there even when no
// match is live right now, since editing a live game is the main use case).
const statusOptions = ['LIVE', 'SCHEDULED', 'FINISHED', 'POSTPONED', 'CANCELLED'];

// ── Inline edit / save ──
// Local draft per match (null = blank, not yet a palpite — shown as "–").
const draft = reactive<Record<string, { home: number | null; away: number | null }>>({});
function draftFor(r: PredRow) {
  if (!draft[r.match.id]) {
    draft[r.match.id] = {
      home: r.prediction ? r.prediction.homeScore : null,
      away: r.prediction ? r.prediction.awayScore : null,
    };
  }
  return draft[r.match.id];
}
// Stepper: from "–" (null), up lands on 0 then 0..99; down clamps at 0.
function bump(r: PredRow, side: 'home' | 'away', delta: number) {
  const d = draftFor(r);
  d[side] = Math.min(99, Math.max(0, (d[side] ?? -1) + delta));
}
const savingId = ref('');
function dirty(r: PredRow): boolean {
  const d = draft[r.match.id];
  if (!d || d.home === null || d.away === null) return false;
  if (!r.prediction) return true;
  return d.home !== r.prediction.homeScore || d.away !== r.prediction.awayScore;
}

async function save(r: PredRow) {
  const d = draft[r.match.id];
  if (!d || d.home === null || d.away === null) return;
  savingId.value = r.match.id;
  try {
    const res = await useApi()<{ homeScore: number; awayScore: number; score: Score | null }>(
      `/admin/predictions/${selectedUser.value!.id}/${r.match.id}`,
      { method: 'PUT', body: { homeScore: d.home, awayScore: d.away } },
    );
    r.prediction = { homeScore: res.homeScore, awayScore: res.awayScore };
    r.score = res.score;
    ui.toast('success', 'Palpite lançado');
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
function teamName(team: { name?: string } | null | undefined, placeholder?: string | null): string {
  return team?.name ?? placeholder ?? 'A definir';
}

const COLS: AdminColumn[] = [
  { key: 'date', label: 'Data' },
  { key: 'match', label: 'Partida' },
  { key: 'phase', label: 'Fase', mobileHide: true },
  { key: 'status', label: 'Status' },
  { key: 'result', label: 'Resultado' },
  { key: 'guess', label: 'Palpite' },
  { key: 'pts', label: 'Pts', align: 'end' },
];

onMounted(async () => {
  const mq = window.matchMedia('(max-width: 720px)');
  isMobile.value = mq.matches;
  mq.addEventListener('change', (e) => (isMobile.value = e.matches));
  const tt = await useApi()<Paginated<Tournament>>('/seasons?pageSize=100');
  tournaments.value = tt.data;
});
</script>

<template>
  <div>
    <AdminPageHeader
      title="Palpites"
      subtitle="Lance ou ajuste o palpite de um usuário — funciona mesmo com o palpite fechado e o jogo ao vivo ou encerrado. Cada lançamento fica registrado na auditoria."
    />

    <div class="card adm-panel">
      <div class="pick">
        <!-- user picker -->
        <div class="pick-user">
          <label class="pl">Usuário</label>
          <div v-if="selectedUser" class="chosen">
            <span class="cu-name">{{ selectedUser.name }}</span>
            <span class="cu-mail">{{ selectedUser.email }}</span>
            <button class="cu-x" aria-label="Trocar usuário" @click="clearUser">
              <AppIcon name="close" :size="14" :stroke="2.4" />
            </button>
          </div>
          <div v-else class="usearch">
            <input
              v-model="userSearch" class="input" placeholder="Buscar por nome ou e-mail…"
              @focus="userOpen = true"
            />
            <ul v-if="userOpen && userResults.length" class="ures">
              <li v-for="u in userResults" :key="u.id">
                <button type="button" class="ures-opt" @click="pickUser(u)">
                  <span class="ro-name">{{ u.name }}</span>
                  <span class="ro-mail">{{ u.email }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
        <!-- tournament picker -->
        <div class="pick-tour">
          <label class="pl">Torneio</label>
          <select v-model="seasonId" class="input">
            <option value="">Selecione…</option>
            <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
      </div>

      <div v-if="!selectedUser || !seasonId" class="hint">
        Selecione um usuário e um torneio para ver e editar os palpites.
      </div>
      <template v-else>
        <div class="adm-filters mb">
          <input v-model="rowFilter" class="input fsearch" placeholder="Filtrar por seleção/time…" />
          <select v-model="statusFilter" class="input fstatus">
            <option value="">Todos os status</option>
            <option v-for="s in statusOptions" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
          </select>
          <span class="cnt">{{ filteredRows.length }} jogo(s)</span>
        </div>
        <AdminTable
          v-if="!isMobile"
          :columns="COLS" :rows="loading ? undefined : filteredRows"
          :row-class="(r) => (r.match.status === 'LIVE' ? 'live' : undefined)"
          grid="96px 1.5fr 0.9fr 104px 66px 168px 56px" empty="Nenhum jogo." empty-icon="ball"
        >
          <template #col-date="{ row }">
            <span class="dcell">
              <span class="dd">{{ fmtDate(row.match.kickoffAt) }}</span>
              <span class="hh">{{ fmtTime(row.match.kickoffAt) }}</span>
            </span>
          </template>
          <template #col-match="{ row }">
            <div class="mt-v">
              <div class="teams">
                <span class="tline">
                  <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="20" />
                  <span class="tn">{{ teamName(row.match.homeTeam, row.match.homeSourceLabel) }}</span>
                </span>
                <span class="tline">
                  <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="20" />
                  <span class="tn">{{ teamName(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
                </span>
              </div>
            </div>
          </template>
          <template #col-phase="{ row }">
            <span class="phcell">
              <span class="ph-main">{{ row.match.phaseLabel || row.match.round?.name }}</span>
              <span v-if="row.match.groupName" class="ph-sub">Grupo {{ row.match.groupName }}</span>
              <span v-if="row.match.round?.number != null" class="ph-sub">Rodada {{ row.match.round.number }}</span>
            </span>
          </template>
          <template #col-status="{ row }">
            <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
          </template>
          <template #col-result="{ row }">
            <b v-if="row.match.status === 'LIVE' || row.match.status === 'FINISHED'" class="rscore">{{ row.match.homeScore }}–{{ row.match.awayScore }}</b>
            <span v-else class="pts-none">—</span>
          </template>
          <template #col-guess="{ row }">
            <div class="guess">
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
          </template>
          <template #col-pts="{ row }">
            <span v-if="row.score" class="pts" :title="TIER_LABEL[row.score.tier] ?? row.score.tier">
              {{ row.score.points }}
            </span>
            <span v-else class="pts-none">—</span>
          </template>
        </AdminTable>

        <!-- mobile: one card per match -->
        <div v-else-if="loading" class="mloading">Carregando…</div>
        <div v-else-if="!filteredRows.length" class="mempty">Nenhum jogo.</div>
        <ul v-else class="mcards">
          <li v-for="row in filteredRows" :key="row.match.id" class="mcard" :class="{ live: row.match.status === 'LIVE' }">
            <div class="mc-head">
              <span class="mc-when">{{ fmtDate(row.match.kickoffAt) }} · {{ fmtTime(row.match.kickoffAt) }}</span>
              <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
            </div>
            <div class="mc-phase">
              {{ row.match.phaseLabel || row.match.round?.name
              }}<template v-if="row.match.groupName"> · Grupo {{ row.match.groupName }}</template
              ><template v-if="row.match.round?.number != null"> · Rodada {{ row.match.round.number }}</template>
            </div>
            <div class="mc-teams">
              <div class="mc-trow">
                <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="22" />
                <span class="mc-tn">{{ teamName(row.match.homeTeam, row.match.homeSourceLabel) }}</span>
                <b v-if="scorable(row)" class="mc-sc">{{ row.match.homeScore }}</b>
              </div>
              <div class="mc-trow">
                <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="22" />
                <span class="mc-tn">{{ teamName(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
                <b v-if="scorable(row)" class="mc-sc">{{ row.match.awayScore }}</b>
              </div>
            </div>
            <div class="mc-foot">
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
              <span v-if="row.score" class="pts mc-pts" :title="TIER_LABEL[row.score.tier] ?? row.score.tier">{{ row.score.points }} pts</span>
            </div>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pick {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.pick-user { position: relative; flex: 1 1 320px; min-width: 0; }
.pick-tour { flex: 1 1 260px; min-width: 0; }
.pl {
  display: block;
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px;
}
.chosen {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg-surface);
}
.cu-name { font-weight: 700; font-size: 14px; }
.cu-mail { font-size: 12px; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cu-x {
  margin-left: auto; flex: none; display: grid; place-items: center;
  width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border);
  background: var(--bg-base); color: var(--muted); cursor: pointer;
}
.cu-x:hover { color: var(--text); }
.usearch { position: relative; }
.ures {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
  list-style: none; margin: 0; padding: 5px; max-height: 280px; overflow-y: auto;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: var(--shadow);
}
.ures-opt {
  display: flex; flex-direction: column; gap: 1px; width: 100%; text-align: left;
  padding: 8px 9px; border: 0; background: transparent; border-radius: 8px; cursor: pointer;
}
.ures-opt:hover { background: var(--bg-base); }
.ro-name { font-weight: 600; font-size: 13.5px; color: var(--text); }
.ro-mail { font-size: 11.5px; color: var(--muted); }
.hint { padding: 2rem 0; text-align: center; color: var(--muted); font-weight: 600; }
.mb { margin-bottom: 12px; }
.adm-filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.fsearch { flex: 1; min-width: 180px; }
.fstatus { flex: none; width: 170px; }
.cnt { font-size: 12px; color: var(--muted); font-weight: 600; white-space: nowrap; }
.mt-v { display: flex; align-items: center; gap: 8px; min-width: 0; }
.teams { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tline { display: flex; align-items: center; gap: 7px; min-width: 0; }
.tn { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dcell { display: flex; flex-direction: column; line-height: 1.25; }
/* highlight the row of a live match (status shown in the Status column) */
:deep(.atr-row.live) {
  background: color-mix(in srgb, var(--scarlet) 7%, transparent);
  box-shadow: inset 3px 0 0 var(--scarlet);
}
.dd { font-weight: 700; font-size: 12.5px; white-space: nowrap; }
.hh { font-size: 11.5px; color: var(--muted); font-weight: 600; }
.phcell { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3; }
.ph-main { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-sub { font-size: 11px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rscore { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 14px; }
.guess { display: flex; align-items: center; gap: 7px; }
.x { color: var(--muted); font-weight: 700; }
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
  border: 1px solid var(--border); border-radius: 13px;
  background: var(--bg-surface); padding: 12px;
}
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
.mc-phase { font-size: 11.5px; color: var(--muted); font-weight: 600; margin-bottom: 10px; }
.mc-teams { display: flex; flex-direction: column; gap: 7px; }
.mc-trow { display: flex; align-items: center; gap: 9px; }
.mc-tn { flex: 1; min-width: 0; font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc-sc { flex: none; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 17px; }
.mc-foot {
  display: flex; align-items: center; gap: 7px;
  margin-top: 11px; padding-top: 11px; border-top: 1px solid var(--border);
}
.mc-lbl {
  flex: none; font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted);
}
.mc-pts { margin-left: auto; }
</style>
