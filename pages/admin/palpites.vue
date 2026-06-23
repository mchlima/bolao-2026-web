<script setup lang="ts">
import type { Paginated, Tournament, User } from '~/types/api';
import type { PredRow, PredScore } from '~/components/MatchPredictionList.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
// Filters live in the query string so a direct URL pre-applies them (and the
// page is shareable). Hydrated below from route.query; kept in sync via a watcher.
const route = useRoute();
const router = useRouter();
const initialUserId = (route.query.userId as string) || '';

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada', LIVE: 'Ao vivo', FINISHED: 'Encerrada',
  CANCELLED: 'Cancelada', POSTPONED: 'Adiada',
};

// ── Tournament picker ──
const tournaments = ref<Tournament[]>([]);
const seasonId = ref((route.query.seasonId as string) || '');
const seasonName = computed(
  () => tournaments.value.find((t) => t.id === seasonId.value)?.name ?? '',
);

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
const rowFilter = ref((route.query.q as string) || '');
const statusFilter = ref((route.query.status as string) || '');

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

// Reflect the active filters in the URL (replace, not push — no history spam).
watch(
  [() => selectedUser.value?.id, seasonId, rowFilter, statusFilter],
  () => {
    const query: Record<string, string> = {};
    if (selectedUser.value) query.userId = selectedUser.value.id;
    if (seasonId.value) query.seasonId = seasonId.value;
    if (statusFilter.value) query.status = statusFilter.value;
    if (rowFilter.value.trim()) query.q = rowFilter.value.trim();
    router.replace({ query }).catch(() => {});
  },
);

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

// Admin can edit ANY match (no kickoff lock); persist via the admin endpoint.
async function adminSave(r: PredRow, home: number, away: number) {
  return useApi()<{ homeScore: number; awayScore: number; score: PredScore | null }>(
    `/admin/predictions/${selectedUser.value!.id}/${r.match.id}`,
    { method: 'PUT', body: { homeScore: home, awayScore: away } },
  );
}

onMounted(async () => {
  const tt = await useApi()<Paginated<Tournament>>('/seasons?pageSize=100');
  tournaments.value = tt.data;
  // Direct URL: resolve the user from ?userId so the picker shows + rows load.
  if (initialUserId) {
    try {
      selectedUser.value = await useApi()<User>(`/admin/users/${initialUserId}`);
    } catch {
      // stale/invalid id in the URL — just drop it silently
    }
  }
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
        <MatchPredictionList
          :key="(selectedUser?.id ?? '') + ':' + seasonId"
          :rows="filteredRows"
          :loading="loading"
          :season-name="seasonName"
          :row-to="(r) => `/futebol/jogo/${r.match.slug || r.match.id}`"
          :save-fn="adminSave"
          saved-message="Palpite lançado"
        />
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
</style>
