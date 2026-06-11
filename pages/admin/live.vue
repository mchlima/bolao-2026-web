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
  try {
    engagement.value = await useApi()<Engagement>(`/admin/matches/${selected.value.id}/engagement`);
  } catch {
    engagement.value = null;
  }
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
        </div>
        <div class="menu-list">
          <button
            v-for="m in menu"
            :key="m.id"
            class="mitem"
            :class="{ active: selected?.id === m.id }"
            @click="select(m)"
          >
            <span v-if="m.status === 'LIVE'" class="ld" />
            <TeamBadge :team="m.homeTeam" :size="22" />
            <span class="ab">{{ teamAbbr(m.homeTeam) }}</span>
            <span class="sc font-numeric">{{ m.homeScore ?? 0 }} - {{ m.awayScore ?? 0 }}</span>
            <span class="ab">{{ teamAbbr(m.awayTeam) }}</span>
            <TeamBadge :team="m.awayTeam" :size="22" />
          </button>
          <p v-if="!menu.length" class="muted hint">
            Nenhuma partida {{ statusPick === 'LIVE' ? 'ao vivo' : 'agendada' }}. Selecione uma agendada e clique em "Ao vivo" para iniciar.
          </p>
        </div>
      </div>

      <!-- board -->
      <div v-if="selected" class="board">
        <div class="card scoreboard">
          <div class="bmeta">
            <span class="bt">{{ selected.phaseLabel }}<template v-if="selected.groupName"> · Grupo {{ selected.groupName }}</template></span>
            <span v-if="selected.stadium" class="bv">{{ selected.stadium.name }} · {{ selected.stadium.city }}</span>
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
            <button class="sb live" :class="{ on: selected.status === 'LIVE' }" @click="patch({ status: 'LIVE' }, 'Partida ao vivo', 'success')">● Ao vivo</button>
            <button class="sb" :class="{ on: selected.status === 'FINISHED' }" @click="patch({ status: 'FINISHED' }, 'Partida encerrada', 'success')">Encerrar</button>
            <button class="sb danger" :class="{ on: selected.status === 'CANCELLED' }" @click="patch({ status: 'CANCELLED' }, 'Partida cancelada')">Cancelar</button>
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
.menu-list { display: flex; flex-direction: column; gap: 7px; max-height: 70vh; overflow: auto; }
.mitem { display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); cursor: pointer; }
.mitem.active { border: 1.5px solid var(--scarlet); background: color-mix(in srgb, var(--scarlet) 14%, transparent); box-shadow: inset 4px 0 0 0 var(--scarlet); }
.ld { width: 7px; height: 7px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.2s infinite; flex: 0 0 auto; }
.ab { font-size: 12px; font-weight: 700; }
.sc { font-size: 18px; flex: 1; text-align: center; }
.hint { padding: 10px 6px; font-size: 12px; line-height: 1.5; }
.board { display: flex; flex-direction: column; gap: 14px; }
.scoreboard { padding: clamp(16px, 4vw, 28px); border-color: rgba(232, 54, 43, 0.4); background: linear-gradient(180deg, rgba(232, 54, 43, 0.1), transparent), var(--bg-surface); }
.bmeta { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 18px; text-align: center; }
.bt { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold); }
.bv { font-size: 12px; font-weight: 600; color: var(--muted); }
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
