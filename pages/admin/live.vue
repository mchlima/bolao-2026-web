<script setup lang="ts">
import type { Match, Paginated, Tournament } from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();

interface Engagement {
  totalPredictions: number;
  distribution: Array<{ homeScore: number; awayScore: number; count: number; percentage: number }>;
}

const tournaments = ref<Tournament[]>([]);
const tournamentId = ref('');
const statusPick = ref<'LIVE' | 'SCHEDULED'>('LIVE');
const menu = ref<Match[]>([]);
const selected = ref<Match | null>(null);
const engagement = ref<Engagement | null>(null);
const tz = useTz();
const leader = ref<{ name: string; points: number } | null>(null);
const participants = ref(0);
const menuSearch = ref('');
const dateFilter = ref(''); // yyyy-mm-dd in account tz; '' = all dates

function localDateKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz.value, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}
function timeOnly(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz.value, hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}
function dayLabel(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz.value, weekday: 'short', day: '2-digit', month: 'short',
  }).format(new Date(iso));
}

// Distinct match dates present in the menu, for the dedicated date picker.
const dates = computed(() => {
  const map = new Map<string, string>();
  for (const m of menu.value) {
    const key = localDateKey(m.kickoffAt);
    if (!map.has(key)) map.set(key, dayLabel(m.kickoffAt));
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, label]) => ({ key, label }));
});

const filteredMenu = computed(() => {
  let list = menu.value;
  if (dateFilter.value) list = list.filter((m) => localDateKey(m.kickoffAt) === dateFilter.value);
  const q = menuSearch.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) =>
    [
      m.homeTeam?.name, m.homeTeam?.shortName, m.awayTeam?.name, m.awayTeam?.shortName,
      m.phaseLabel, m.groupName, m.stadium?.name, m.stadium?.city,
      formatKickoff(m.kickoffAt, tz.value),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
});

async function loadMenu() {
  const q = new URLSearchParams({ pageSize: '100', status: statusPick.value });
  if (tournamentId.value) q.set('tournamentId', tournamentId.value);
  const res = await useApi()<Paginated<Match>>(`/matches?${q.toString()}`);
  menu.value = res.data.filter((m) => m.homeTeam && m.awayTeam);
  // Drop a stale date selection that no longer matches the reloaded list.
  if (dateFilter.value && !menu.value.some((m) => localDateKey(m.kickoffAt) === dateFilter.value)) {
    dateFilter.value = '';
  }
}

async function select(m: Match) {
  selected.value = m;
  await loadEngagement();
}
async function refreshSelected() {
  if (!selected.value) return;
  selected.value = await useApi()<Match>(`/matches/${selected.value.id}`);
  await Promise.all([loadEngagement(), loadMenu()]);
}
async function loadEngagement() {
  if (!selected.value) return;
  const id = selected.value.id;
  try {
    engagement.value = await useApi()<Engagement>(`/admin/matches/${id}/engagement`);
  } catch {
    engagement.value = null;
  }
  const rk = await useApi()<{
    entries: Array<{ user: { name: string }; points: number }>;
    totalParticipants: number;
  }>(`/matches/${id}/ranking`).catch(() => null);
  leader.value = rk?.entries?.[0]
    ? { name: rk.entries[0].user.name, points: rk.entries[0].points }
    : null;
  participants.value = rk?.totalParticipants ?? 0;
}

async function patch(body: Record<string, unknown>, msg: string, type: 'success' | 'info' = 'info') {
  if (!selected.value) return;
  try {
    await useApi()(`/admin/matches/${selected.value.id}`, { method: 'PATCH', body });
    ui.toast(type, msg);
    await refreshSelected();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
  }
}

// Prediction window for the selected match (mirrors backend acceptsPredictions).
const predEffectiveOpen = computed(() => {
  const m = selected.value;
  if (!m) return false;
  if (m.status === 'FINISHED' || m.status === 'CANCELLED') return false;
  const auto = m.status === 'SCHEDULED' && new Date(m.kickoffAt).getTime() > Date.now();
  return m.predictionsOpen ?? auto;
});
const predIsManual = computed(() => selected.value?.predictionsOpen != null);

function setPredictions(open: boolean | null) {
  if (open === null) patch({ predictionsOpen: null }, 'Palpites voltaram ao automático');
  else patch({ predictionsOpen: open }, open ? 'Palpites abertos' : 'Palpites fechados', open ? 'success' : 'info');
}

const clamp = (n: number) => Math.max(0, n);
function bump(side: 'home' | 'away', delta: number) {
  if (!selected.value) return;
  const cur = (side === 'home' ? selected.value.homeScore : selected.value.awayScore) ?? 0;
  const next = clamp(cur + delta);
  patch(
    side === 'home' ? { homeScore: next } : { awayScore: next },
    delta > 0 ? 'Gol! Placar atualizado' : 'Placar ajustado',
  );
}

const maxCount = computed(() =>
  Math.max(1, ...(engagement.value?.distribution ?? []).map((d) => d.count)),
);

watch([tournamentId, statusPick], loadMenu);
onMounted(async () => {
  const tt = await useApi()<Paginated<Tournament>>('/tournaments?pageSize=100');
  tournaments.value = tt.data;
  tournamentId.value = tt.data.find((t) => t.status === 'ONGOING')?.id ?? '';
  await loadMenu();
});
</script>

<template>
  <AdminShell>
    <div class="live-grid">
      <!-- menu -->
      <div class="card menu">
        <div class="menu-head">Partidas</div>
        <div class="picker">
          <select v-model="tournamentId" class="input sm">
            <option value="">Todos os torneios</option>
            <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <div class="seg">
            <button class="seg-b" :class="{ on: statusPick === 'LIVE' }" @click="statusPick = 'LIVE'">Ao vivo</button>
            <button class="seg-b" :class="{ on: statusPick === 'SCHEDULED' }" @click="statusPick = 'SCHEDULED'">Agendadas</button>
          </div>
          <input v-model="menuSearch" class="input sm" placeholder="Buscar time, fase, data…" />
        </div>
        <div v-if="dates.length > 1" class="dates">
          <button class="date-b" :class="{ on: dateFilter === '' }" @click="dateFilter = ''">Todas</button>
          <button
            v-for="d in dates"
            :key="d.key"
            class="date-b"
            :class="{ on: dateFilter === d.key }"
            @click="dateFilter = d.key"
          >{{ d.label }}</button>
        </div>
        <div class="menu-list">
          <button
            v-for="m in filteredMenu"
            :key="m.id"
            class="mitem"
            :class="{ active: selected?.id === m.id }"
            @click="select(m)"
          >
            <div class="mi-meta">
              <span v-if="m.status === 'LIVE'" class="ld" />
              <span class="mi-time font-numeric">{{ timeOnly(m.kickoffAt) }}</span>
              <span class="mi-phase">{{ m.phaseLabel }}<template v-if="m.groupName"> · {{ m.groupName }}</template></span>
              <span class="mi-day">{{ dayLabel(m.kickoffAt) }}</span>
            </div>
            <div class="mi-teams">
              <TeamBadge :team="m.homeTeam" :size="22" />
              <span class="mi-name r">{{ m.homeTeam?.name }}</span>
              <span class="sc font-numeric">{{ m.homeScore ?? 0 }}-{{ m.awayScore ?? 0 }}</span>
              <span class="mi-name l">{{ m.awayTeam?.name }}</span>
              <TeamBadge :team="m.awayTeam" :size="22" />
            </div>
          </button>
          <p v-if="!menu.length" class="muted hint">
            Nenhuma partida {{ statusPick === 'LIVE' ? 'ao vivo' : 'agendada' }}. Selecione uma agendada e clique em "Ao vivo" para iniciar.
          </p>
          <p v-else-if="!filteredMenu.length" class="muted hint">
            Nenhuma partida nesta data ou busca.
          </p>
        </div>
      </div>

      <!-- board -->
      <div v-if="selected" class="board">
        <div class="card scoreboard">
          <div class="bmeta">
            <span class="bt">{{ selected.phaseLabel }}<template v-if="selected.groupName"> · Grupo {{ selected.groupName }}</template></span>
            <span v-if="selected.stadium" class="bv">{{ selected.stadium.name }} · {{ selected.stadium.city }}</span>
            <span class="bstats">
              {{ formatKickoff(selected.kickoffAt, tz) }}
              <template v-if="selected.matchNumber"> · Jogo {{ selected.matchNumber }}</template>
              · {{ participants }} palpite(s)
              <template v-if="leader"> · líder: <b>{{ leader.name }}</b> ({{ leader.points }} pts)</template>
            </span>
          </div>
          <div class="sides">
            <div class="bside">
              <TeamBadge :team="selected.homeTeam" :size="58" />
              <span class="bn">{{ selected.homeTeam?.name }}</span>
              <div class="huge font-numeric">{{ selected.homeScore ?? 0 }}</div>
              <div class="steppers">
                <button class="step minus" @click="bump('home', -1)">−</button>
                <button class="step plus" @click="bump('home', 1)">+</button>
              </div>
            </div>
            <div class="bside">
              <TeamBadge :team="selected.awayTeam" :size="58" />
              <span class="bn">{{ selected.awayTeam?.name }}</span>
              <div class="huge font-numeric">{{ selected.awayScore ?? 0 }}</div>
              <div class="steppers">
                <button class="step minus" @click="bump('away', -1)">−</button>
                <button class="step plus" @click="bump('away', 1)">+</button>
              </div>
            </div>
          </div>
          <div class="statusbtns">
            <button v-if="selected.status !== 'LIVE'" class="sb live" @click="patch({ status: 'LIVE' }, 'Partida ao vivo', 'success')">● Ao vivo</button>
            <button v-else class="sb live on" @click="patch({ status: 'SCHEDULED' }, 'Partida voltou para agendada', 'info')">↩ Tirar do ao vivo</button>
            <button class="sb" :class="{ on: selected.status === 'FINISHED' }" @click="patch({ status: 'FINISHED' }, 'Partida encerrada', 'success')">Encerrar</button>
            <button class="sb danger" :class="{ on: selected.status === 'CANCELLED' }" @click="patch({ status: 'CANCELLED' }, 'Partida cancelada')">Cancelar</button>
          </div>
        </div>

        <div class="card predbox">
          <div class="pb-head">
            <span class="pb-title">Palpites</span>
            <span class="pb-state" :class="predEffectiveOpen ? 'open' : 'closed'">
              <span class="pb-dot" />{{ predEffectiveOpen ? 'Abertos' : 'Fechados' }}
              <span class="pb-src">· {{ predIsManual ? 'manual' : 'automático' }}</span>
            </span>
          </div>
          <p class="pb-note">
            Sobrepõe a regra automática (aberto enquanto agendada e antes do horário). Funciona mesmo com a partida ao vivo.
          </p>
          <div class="pb-btns">
            <button class="pbtn open" :class="{ on: selected.predictionsOpen === true }" @click="setPredictions(true)">Abrir</button>
            <button class="pbtn closed" :class="{ on: selected.predictionsOpen === false }" @click="setPredictions(false)">Fechar</button>
            <button class="pbtn" :class="{ on: selected.predictionsOpen == null }" @click="setPredictions(null)">Automático</button>
          </div>
        </div>

        <div v-if="engagement && engagement.totalPredictions" class="card engage">
          <div class="eh">
            <h4 class="font-display">Engajamento do bolão</h4>
            <span class="et"><b class="font-numeric">{{ engagement.totalPredictions }}</b> palpites</span>
          </div>
          <div class="dist">
            <div v-for="d in engagement.distribution" :key="`${d.homeScore}-${d.awayScore}`" class="drow">
              <span class="dscore font-numeric">{{ d.homeScore }}-{{ d.awayScore }}</span>
              <div class="dbar"><div class="dfill" :style="{ width: `${(d.count / maxCount) * 100}%` }" /></div>
              <span class="dpct">{{ d.percentage }}% · {{ d.count }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="card placeholder">Selecione uma partida ao lado para controlar o placar.</div>
    </div>
  </AdminShell>
</template>

<style scoped>
.live-grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
@media (max-width: 820px) { .live-grid { grid-template-columns: 1fr; } }
.menu { padding: 12px; }
.menu-head { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); padding: 4px 6px 10px; }
.picker { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.input.sm { padding: 9px 11px; font-size: 13px; }
.seg { display: flex; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
.seg-b { flex: 1; padding: 8px; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.seg-b.on { background: var(--bg-surface); color: var(--text); box-shadow: var(--shadow); }
.dates { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 10px; scrollbar-width: thin; }
.date-b { flex: 0 0 auto; padding: 6px 11px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); font-weight: 700; font-size: 11.5px; cursor: pointer; white-space: nowrap; text-transform: capitalize; }
.date-b.on { background: var(--scarlet); color: #fff; border-color: transparent; }
.menu-list { display: flex; flex-direction: column; gap: 7px; max-height: 70vh; overflow: auto; }
.mitem { display: flex; flex-direction: column; gap: 7px; padding: 10px 11px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); cursor: pointer; text-align: left; }
.mitem.active { border: 1.5px solid var(--scarlet); background: color-mix(in srgb, var(--scarlet) 14%, transparent); box-shadow: inset 4px 0 0 0 var(--scarlet); }
.mi-meta { display: flex; align-items: center; gap: 7px; min-width: 0; }
.mi-time { font-size: 12.5px; font-weight: 700; color: var(--text); flex: 0 0 auto; }
.mi-phase { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-day { margin-left: auto; font-size: 10.5px; font-weight: 600; color: var(--muted); white-space: nowrap; text-transform: capitalize; flex: 0 0 auto; }
.mi-teams { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 7px; }
.mi-name { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-name.r { text-align: right; }
.mi-name.l { text-align: left; }
.ld { width: 7px; height: 7px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.2s infinite; flex: 0 0 auto; }
.sc { font-size: 16px; text-align: center; flex: 0 0 auto; }
.hint { padding: 10px 6px; font-size: 12px; line-height: 1.5; }
.board { display: flex; flex-direction: column; gap: 14px; }
.scoreboard { padding: clamp(16px, 4vw, 28px); border-color: rgba(232, 54, 43, 0.4); background: linear-gradient(180deg, rgba(232, 54, 43, 0.1), transparent), var(--bg-surface); }
.bmeta { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 18px; text-align: center; }
.bt { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold); }
.bv { font-size: 12px; font-weight: 600; color: var(--muted); }
.bstats { font-size: 11.5px; font-weight: 600; color: var(--muted); }
.bstats b { color: var(--text); }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 520px; margin: 0 auto; }
.bside { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.bn { font-size: 13px; font-weight: 700; }
.huge { font-size: clamp(64px, 15vw, 104px); line-height: 0.8; }
.steppers { display: flex; gap: 10px; }
.step { width: 52px; height: 52px; border-radius: 15px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-size: 26px; line-height: 1; cursor: pointer; }
.step.plus { border: none; background: var(--emerald); color: #fff; box-shadow: 0 8px 20px -8px var(--emerald); }
.statusbtns { display: flex; flex-wrap: wrap; gap: 10px; max-width: 520px; margin: 22px auto 0; }
.sb { flex: 1; min-width: 120px; padding: 12px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-weight: 700; font-size: 13.5px; cursor: pointer; }
.sb.live.on { background: var(--scarlet); color: #fff; border-color: transparent; }
.sb.on { background: var(--grad-pitch); color: #fff; border-color: transparent; }
.sb.danger.on { background: var(--muted); }
.predbox { padding: 16px 18px; }
.pb-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pb-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
.pb-state { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
.pb-state.open { color: var(--emerald); }
.pb-state.closed { color: var(--scarlet); }
.pb-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.pb-src { color: var(--muted); font-weight: 700; }
.pb-note { font-size: 11.5px; color: var(--muted); line-height: 1.5; margin: 8px 0 12px; }
.pb-btns { display: flex; gap: 8px; }
.pbtn { flex: 1; padding: 11px; border-radius: 11px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-weight: 700; font-size: 13px; cursor: pointer; }
.pbtn.open.on { background: var(--emerald); color: #fff; border-color: transparent; }
.pbtn.closed.on { background: var(--scarlet); color: #fff; border-color: transparent; }
.pbtn.on:not(.open):not(.closed) { background: var(--bg-surface); border-color: var(--azure); color: var(--azure); }
.engage { padding: 18px; }
.eh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.eh h4 { font-weight: 600; font-size: 15px; text-transform: uppercase; }
.et { font-size: 12px; color: var(--muted); font-weight: 700; }
.et b { color: var(--text); font-size: 18px; }
.dist { display: flex; flex-direction: column; gap: 9px; }
.drow { display: flex; align-items: center; gap: 11px; }
.dscore { font-size: 19px; min-width: 46px; }
.dbar { flex: 1; height: 9px; border-radius: 5px; background: var(--bg-base); overflow: hidden; }
.dfill { height: 100%; border-radius: 5px; background: var(--grad-pitch); }
.dpct { font-size: 12px; color: var(--muted); font-weight: 700; min-width: 66px; text-align: right; }
.placeholder { padding: 40px; text-align: center; color: var(--muted); }
</style>
