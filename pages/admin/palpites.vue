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
  match: Match;
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
// Local draft per match so typing doesn't mutate the loaded row until saved.
const draft = reactive<Record<string, { home: string; away: string }>>({});
function draftFor(r: PredRow) {
  if (!draft[r.match.id]) {
    draft[r.match.id] = {
      home: r.prediction ? String(r.prediction.homeScore) : '',
      away: r.prediction ? String(r.prediction.awayScore) : '',
    };
  }
  return draft[r.match.id];
}
const savingId = ref('');
function dirty(r: PredRow): boolean {
  const d = draft[r.match.id];
  if (!d || d.home === '' || d.away === '') return false;
  if (!r.prediction) return true;
  return Number(d.home) !== r.prediction.homeScore || Number(d.away) !== r.prediction.awayScore;
}

async function save(r: PredRow) {
  const d = draft[r.match.id];
  if (!d || d.home === '' || d.away === '') return ui.toast('error', 'Informe os dois placares');
  const home = Number(d.home), away = Number(d.away);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99)
    return ui.toast('error', 'Placar inválido (0–99)');
  savingId.value = r.match.id;
  try {
    const res = await useApi()<{ homeScore: number; awayScore: number; score: Score | null }>(
      `/admin/predictions/${selectedUser.value!.id}/${r.match.id}`,
      { method: 'PUT', body: { homeScore: home, awayScore: away } },
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

const COLS: AdminColumn[] = [
  { key: 'match', label: 'Partida' },
  { key: 'when', label: 'Fase · Data', mobileHide: true },
  { key: 'result', label: 'Resultado' },
  { key: 'guess', label: 'Palpite do usuário' },
  { key: 'pts', label: 'Pts', align: 'end' },
];

onMounted(async () => {
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
          :columns="COLS" :rows="loading ? undefined : filteredRows"
          grid="1.4fr 1.1fr 124px 210px 64px" empty="Nenhum jogo." empty-icon="ball"
        >
          <template #col-match="{ row }">
            <span class="mt">
              <TeamBadge :team="row.match.homeTeam" :placeholder="row.match.homeSourceLabel" :size="22" />
              <span class="vs">{{ teamAbbr(row.match.homeTeam, row.match.homeSourceLabel) }} × {{ teamAbbr(row.match.awayTeam, row.match.awaySourceLabel) }}</span>
              <TeamBadge :team="row.match.awayTeam" :placeholder="row.match.awaySourceLabel" :size="22" />
            </span>
          </template>
          <template #col-when="{ row }">
            <span class="dt">{{ row.match.phaseLabel }}<template v-if="row.match.groupName"> {{ row.match.groupName }}</template> · {{ formatKickoff(row.match.kickoffAt, tz) }}</span>
          </template>
          <template #col-result="{ row }">
            <div class="res">
              <StatusPill :label="STATUS_LABEL[row.match.status]" :tone="STATUS_TONE[row.match.status]" :live="row.match.status === 'LIVE'" />
              <b v-if="row.match.status === 'LIVE' || row.match.status === 'FINISHED'" class="rscore">{{ row.match.homeScore }}–{{ row.match.awayScore }}</b>
            </div>
          </template>
          <template #col-guess="{ row }">
            <div class="guess">
              <input v-model="draftFor(row).home" type="number" min="0" max="99" class="sc" inputmode="numeric" />
              <span class="x">×</span>
              <input v-model="draftFor(row).away" type="number" min="0" max="99" class="sc" inputmode="numeric" />
              <button
                class="btn btn-primary save" :disabled="!dirty(row) || savingId === row.match.id"
                @click="save(row)"
              >
                {{ savingId === row.match.id ? '…' : 'Salvar' }}
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
.mt { display: flex; align-items: center; gap: 7px; min-width: 0; }
.vs { font-weight: 700; font-size: 12.5px; white-space: nowrap; }
/* display:block so the ellipsis actually clamps inside the grid cell (an inline
   span ignores overflow/text-overflow and would spill over the next column). */
.dt { display: block; min-width: 0; font-size: 11.5px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.res { display: flex; align-items: center; gap: 7px; min-width: 0; }
.rscore { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 14px; }
.guess { display: flex; align-items: center; gap: 6px; }
.sc {
  width: 46px; text-align: center; padding: 6px 4px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-base);
  color: var(--text); font: inherit; font-weight: 700;
}
.x { color: var(--muted); font-weight: 700; }
.save { padding: 7px 12px; font-size: 12.5px; }
.pts {
  display: inline-grid; place-items: center; min-width: 30px; padding: 3px 8px;
  border-radius: 999px; background: color-mix(in srgb, var(--emerald) 16%, transparent);
  color: var(--emerald); font-weight: 800; font-size: 13px;
}
.pts-none { color: var(--muted); }
</style>
