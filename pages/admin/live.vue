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
type MatchStatusFilter = 'LIVE' | 'SCHEDULED' | 'FINISHED' | 'CANCELLED';
const statusPick = ref<MatchStatusFilter>('LIVE');
const STATUS_TABS: Array<{ v: MatchStatusFilter; label: string; icon: string }> = [
  { v: 'LIVE', label: 'Ao vivo', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8.5"/></svg>' },
  { v: 'SCHEDULED', label: 'Agendadas', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.2l3 1.8"/></svg>' },
  { v: 'FINISHED', label: 'Encerradas', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4.5h13l-2.5 4 2.5 4H5"/></svg>' },
  { v: 'CANCELLED', label: 'Canceladas', icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/></svg>' },
];
const menu = ref<Match[]>([]);
const selected = ref<Match | null>(null);
const engagement = ref<Engagement | null>(null);
const tz = useTz();
const tzShort = computed(() =>
  tz.value === 'UTC' ? 'UTC' : (tz.value.split('/').pop() ?? tz.value).replace(/_/g, ' '),
);
const leader = ref<{ name: string; points: number } | null>(null);
const participants = ref(0);
const menuSearch = ref('');
// Default the range to today (account tz); both bounds remain clearable.
const todayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: tz.value, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const startDate = ref(todayKey); // yyyy-mm-dd; '' = open-ended
const endDate = ref(todayKey);
const settingsOpen = ref(false); // collapsible "Configurações" area

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada', LIVE: 'Ao vivo', FINISHED: 'Encerrada', CANCELLED: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'var(--azure)', LIVE: 'var(--scarlet)', FINISHED: 'var(--muted)', CANCELLED: 'var(--muted)',
};

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

const filteredMenu = computed(() => {
  let list = menu.value;
  // Range filter on the match's local date (yyyy-mm-dd strings compare safely).
  if (startDate.value) list = list.filter((m) => localDateKey(m.kickoffAt) >= startDate.value);
  if (endDate.value) list = list.filter((m) => localDateKey(m.kickoffAt) <= endDate.value);
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

// Score source: when automático, the ESPN robot drives score/status and the
// +/- steppers are hidden; "assumir manual" lets the admin take over.
function setAuto(on: boolean) {
  patch(
    { autoManaged: on },
    on ? 'Placar automático (robô ESPN)' : 'Você assumiu o placar manual',
    on ? 'info' : 'success',
  );
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

useRealtime(
  () => {
    const r: string[] = [];
    if (tournamentId.value) r.push(`tournament:${tournamentId.value}`);
    if (selected.value) r.push(`match:${selected.value.id}`);
    return r;
  },
  () => (selected.value ? refreshSelected() : loadMenu()),
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
            <button
              v-for="t in STATUS_TABS"
              :key="t.v"
              class="seg-b"
              :class="{ on: statusPick === t.v }"
              :title="t.label"
              :aria-label="t.label"
              @click="statusPick = t.v"
            ><span class="seg-ico" v-html="t.icon" /></button>
          </div>
          <input v-model="menuSearch" class="input sm" placeholder="Buscar time, fase…" />
          <div class="drange">
            <label class="dr-f"><span>De</span><input v-model="startDate" type="date" :max="endDate || undefined" class="input sm" /></label>
            <label class="dr-f"><span>Até</span><input v-model="endDate" type="date" :min="startDate || undefined" class="input sm" /></label>
            <button v-if="startDate || endDate" class="dr-clear" title="Limpar datas" @click="startDate = ''; endDate = ''">✕</button>
            <span class="dr-tz" title="Datas e horários no fuso da sua conta">🌐 {{ tzShort }}</span>
          </div>
        </div>
        <div class="menu-list">
          <button
            v-for="m in filteredMenu"
            :key="m.id"
            class="mitem"
            :class="{ active: selected?.id === m.id }"
            @click="select(m)"
          >
            <div v-if="m.tournament" class="mi-tour">{{ m.tournament.name }}</div>
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
            Nenhuma partida {{ STATUS_TABS.find((t) => t.v === statusPick)?.label.toLowerCase() }}.<template v-if="statusPick === 'SCHEDULED'"> Selecione uma e marque "Ao vivo" para iniciar.</template>
          </p>
          <p v-else-if="!filteredMenu.length" class="muted hint">
            Nenhuma partida nesta data ou busca.
          </p>
        </div>
      </div>

      <!-- board -->
      <div v-if="selected" class="board">
        <!-- 1) Configurações — colapsável -->
        <div class="card settings">
          <button class="set-head" @click="settingsOpen = !settingsOpen">
            <span class="set-title">Configurações</span>
            <span v-if="!settingsOpen" class="set-summary">
              <span class="chip" :style="{ color: STATUS_COLOR[selected.status], borderColor: STATUS_COLOR[selected.status] }">{{ STATUS_LABEL[selected.status] }}</span>
              <span class="chip" :class="predEffectiveOpen ? 'ok' : 'no'">Palpites {{ predEffectiveOpen ? 'abertos' : 'fechados' }}</span>
              <span class="chip" :class="selected.autoManaged ? 'ok' : 'no'">Placar {{ selected.autoManaged ? 'auto' : 'manual' }}</span>
            </span>
            <span class="set-chev">{{ settingsOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="settingsOpen" class="set-body">
            <div class="set-group">
              <div class="set-lbl">Status da partida</div>
              <div class="set-actions">
                <button v-if="selected.status !== 'LIVE'" class="sb live" @click="patch({ status: 'LIVE' }, 'Partida ao vivo', 'success')">● Ao vivo</button>
                <button v-else class="sb live on" @click="patch({ status: 'SCHEDULED' }, 'Partida voltou para agendada', 'info')">↩ Tirar do ao vivo</button>
                <button class="sb" :class="{ on: selected.status === 'FINISHED' }" @click="patch({ status: 'FINISHED' }, 'Partida encerrada', 'success')">Encerrar</button>
                <button class="sb danger" :class="{ on: selected.status === 'CANCELLED' }" @click="patch({ status: 'CANCELLED' }, 'Partida cancelada')">Cancelar</button>
              </div>
            </div>
            <div class="set-group">
              <div class="set-lbl">Placar <span class="set-sub">{{ selected.autoManaged ? '· o robô ESPN atualiza' : '· você controla nos botões +/−' }}</span></div>
              <div class="set-actions">
                <button class="sb" :class="{ on: selected.autoManaged }" @click="setAuto(true)">Automático</button>
                <button class="sb" :class="{ on: !selected.autoManaged }" @click="setAuto(false)">Manual</button>
              </div>
            </div>
            <div class="set-group">
              <div class="set-lbl">Palpites <span class="set-sub">· {{ predEffectiveOpen ? 'abertos' : 'fechados' }} ({{ predIsManual ? 'manual' : 'automático' }})</span></div>
              <div class="set-actions">
                <button class="sb ok" :class="{ on: selected.predictionsOpen === true }" @click="setPredictions(true)">Abrir</button>
                <button class="sb danger" :class="{ on: selected.predictionsOpen === false }" @click="setPredictions(false)">Fechar</button>
                <button class="sb" :class="{ on: selected.predictionsOpen == null }" @click="setPredictions(null)">Automático</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2) Informações -->
        <div class="card infocard">
          <div class="ic-head">
            <span v-if="selected.tournament" class="ic-tour">{{ selected.tournament.name }}</span>
            <span class="ic-phase">{{ selected.phaseLabel }}<template v-if="selected.groupName"> · Grupo {{ selected.groupName }}</template></span>
          </div>
          <div class="ic-rows">
            <div class="ic-row"><span class="ic-k">Data</span><span class="ic-v">{{ formatKickoff(selected.kickoffAt, tz) }}<template v-if="selected.matchNumber"> · Jogo {{ selected.matchNumber }}</template></span></div>
            <div v-if="selected.stadium" class="ic-row"><span class="ic-k">Estádio</span><span class="ic-v">{{ selected.stadium.name }} · {{ selected.stadium.city }}</span></div>
            <div class="ic-row"><span class="ic-k">Palpites</span><span class="ic-v">{{ participants }}<template v-if="leader"> · líder <b>{{ leader.name }}</b> ({{ leader.points }} pts)</template></span></div>
          </div>
        </div>

        <!-- 3) Placar -->
        <div class="card scoreboard">
          <div class="sides">
            <div class="bside">
              <TeamBadge :team="selected.homeTeam" :size="58" />
              <span class="bn">{{ selected.homeTeam?.name }}</span>
              <div class="huge font-numeric">{{ selected.homeScore ?? 0 }}</div>
              <div v-if="!selected.autoManaged" class="steppers">
                <button class="step minus" @click="bump('home', -1)">−</button>
                <button class="step plus" @click="bump('home', 1)">+</button>
              </div>
            </div>
            <div class="bside">
              <TeamBadge :team="selected.awayTeam" :size="58" />
              <span class="bn">{{ selected.awayTeam?.name }}</span>
              <div class="huge font-numeric">{{ selected.awayScore ?? 0 }}</div>
              <div v-if="!selected.autoManaged" class="steppers">
                <button class="step minus" @click="bump('away', -1)">−</button>
                <button class="step plus" @click="bump('away', 1)">+</button>
              </div>
            </div>
          </div>
          <p v-if="selected.autoManaged" class="auto-note">Placar automático — atualizado pelo robô ESPN. Em <b>Configurações → Placar → Manual</b> você assume o controle.</p>
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
.seg { display: flex; gap: 2px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
.seg-b { flex: 1; display: grid; place-items: center; padding: 8px; border: none; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; }
.seg-ico { display: inline-flex; }
.seg-ico :deep(svg) { display: block; }
.seg-b.on { background: var(--bg-surface); color: var(--text); box-shadow: var(--shadow); }
.drange { display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; }
.dr-tz { font-size: 10.5px; font-weight: 700; color: var(--muted); align-self: center; white-space: nowrap; }
.dr-f { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dr-f span { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding-left: 2px; }
.dr-f .input.sm { width: 100%; }
.dr-clear { flex: 0 0 auto; height: 34px; width: 32px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; font-size: 12px; }
.menu-list { display: flex; flex-direction: column; gap: 7px; max-height: 70vh; overflow: auto; }
.mitem { display: flex; flex-direction: column; gap: 7px; padding: 10px 11px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); cursor: pointer; text-align: left; }
.mitem.active { border: 1.5px solid var(--scarlet); background: color-mix(in srgb, var(--scarlet) 14%, transparent); box-shadow: inset 4px 0 0 0 var(--scarlet); }
.mi-tour { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--azure); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
.infocard { padding: 16px 18px; }
.ic-head { display: flex; flex-direction: column; gap: 3px; margin-bottom: 12px; }
.ic-tour { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); }
.ic-phase { font-size: 13px; font-weight: 800; }
.ic-rows { display: flex; flex-direction: column; gap: 7px; }
.ic-row { display: grid; grid-template-columns: 72px 1fr; gap: 10px; align-items: baseline; }
.ic-k { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.ic-v { font-size: 12.5px; font-weight: 600; color: var(--text); min-width: 0; }
.ic-v b { font-weight: 800; }
.bmeta { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 18px; text-align: center; }
.bt { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold); }
.bv { font-size: 12px; font-weight: 600; color: var(--muted); }
.bstats { font-size: 11.5px; font-weight: 600; color: var(--muted); }
.bstats b { color: var(--text); }
.settings { padding: 0; overflow: hidden; }
.set-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 16px; background: none; border: none; cursor: pointer; color: var(--text); text-align: left; }
.set-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); flex: 0 0 auto; }
.set-summary { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 0; }
.chip { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; border: 1px solid var(--border); border-radius: 999px; padding: 3px 9px; color: var(--muted); white-space: nowrap; }
.chip.ok { color: var(--emerald); border-color: color-mix(in srgb, var(--emerald) 45%, var(--border)); }
.chip.no { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }
.set-chev { margin-left: auto; font-size: 10px; color: var(--muted); flex: 0 0 auto; }
.set-body { display: flex; flex-direction: column; gap: 15px; padding: 2px 16px 16px; border-top: 1px solid var(--border); }
.set-group { display: flex; flex-direction: column; gap: 8px; }
.set-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.set-sub { font-weight: 600; text-transform: none; letter-spacing: 0; }
.set-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 520px; margin: 0 auto; }
.bside { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.bn { font-size: 13px; font-weight: 700; }
.huge { font-size: clamp(64px, 15vw, 104px); line-height: 0.8; }
.steppers { display: flex; gap: 10px; }
.step { width: 52px; height: 52px; border-radius: 15px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-size: 26px; line-height: 1; cursor: pointer; }
.step.plus { border: none; background: var(--emerald); color: #fff; box-shadow: 0 8px 20px -8px var(--emerald); }
.sb { flex: 1; min-width: 108px; padding: 11px; border-radius: 11px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-weight: 700; font-size: 13px; cursor: pointer; }
.sb.live.on { background: var(--scarlet); color: #fff; border-color: transparent; }
.sb.on { background: var(--grad-pitch); color: #fff; border-color: transparent; }
.sb.ok.on { background: var(--emerald); color: #fff; border-color: transparent; }
.sb.danger.on { background: var(--scarlet); color: #fff; border-color: transparent; }
.auto-note { max-width: 520px; margin: 18px auto 0; text-align: center; font-size: 11.5px; line-height: 1.5; color: var(--muted); }
.auto-note b { color: var(--text); }
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
