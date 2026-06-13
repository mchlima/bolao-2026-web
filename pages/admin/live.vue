<script setup lang="ts">
import type { Match, Paginated, Tournament } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();

interface Engagement {
  totalPredictions: number;
  distribution: Array<{ homeScore: number; awayScore: number; count: number; percentage: number }>;
}

const tournaments = ref<Tournament[]>([]);
const tournamentId = ref('');
const allMatches = ref<Match[]>([]); // every match of the tournament(s); grouped client-side
const selected = ref<Match | null>(null);
const engagement = ref<Engagement | null>(null);
const tz = useTz();
const now = useNow(30000); // ticks → "Hoje" and the default day roll over at midnight
const leader = ref<{ name: string; points: number } | null>(null);
const participants = ref(0);
const menuSearch = ref('');
const settingsOpen = ref(false); // gear popover with the match controls
const settingsWrap = ref<HTMLElement | null>(null);
function onDocClick(e: MouseEvent) {
  if (settingsOpen.value && settingsWrap.value && !settingsWrap.value.contains(e.target as Node)) {
    settingsOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendada', LIVE: 'Ao vivo', FINISHED: 'Encerrada', CANCELLED: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'var(--azure)', LIVE: 'var(--scarlet)', FINISHED: 'var(--muted)', CANCELLED: 'var(--muted)',
};

// ---- date helpers (account tz) ----
/** "YYYY-MM-DD" of an instant as seen in the account tz (en-CA → ISO order). */
function dayKey(d: string | number | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz.value, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(d));
}
/** Calendar ±n days on a YYYY-MM-DD string (DST-safe — pure date math). */
function shiftKey(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
function timeOnly(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz.value, hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}
const byKick = (a: Match, b: Match) =>
  new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();

const selectedDay = ref(dayKey(Date.now())); // YYYY-MM-DD of the day being operated
const todayKey = computed(() => dayKey(now.value));
const isToday = computed(() => selectedDay.value === todayKey.value);
const dayTitle = computed(() => {
  const lbl = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz.value, weekday: 'short', day: '2-digit', month: 'short',
  }).format(new Date(`${selectedDay.value}T12:00:00Z`));
  if (selectedDay.value === todayKey.value) return `Hoje · ${lbl}`;
  if (selectedDay.value === shiftKey(todayKey.value, 1)) return `Amanhã · ${lbl}`;
  if (selectedDay.value === shiftKey(todayKey.value, -1)) return `Ontem · ${lbl}`;
  return lbl;
});

// ---- search + grouping ----
function matchesSearch(m: Match): boolean {
  const q = menuSearch.value.trim().toLowerCase();
  if (!q) return true;
  return [
    m.homeTeam?.name, m.homeTeam?.shortName, m.awayTeam?.name, m.awayTeam?.shortName,
    m.phaseLabel, m.groupName, m.stadium?.name, m.stadium?.city,
    formatKickoff(m.kickoffAt, tz.value),
  ]
    .filter(Boolean).join(' ').toLowerCase().includes(q);
}
const filtered = computed(() => allMatches.value.filter(matchesSearch));

// Live is shown regardless of the selected day (live is live). The day groups are
// scoped to selectedDay so the operator works one match-day at a time.
const liveGroup = computed(() => filtered.value.filter((m) => m.status === 'LIVE').sort(byKick));
const dayMatches = computed(() => filtered.value.filter((m) => dayKey(m.kickoffAt) === selectedDay.value));
const dayScheduled = computed(() => dayMatches.value.filter((m) => m.status === 'SCHEDULED').sort(byKick));
const dayFinished = computed(() => dayMatches.value.filter((m) => m.status === 'FINISHED').sort(byKick));
const dayCancelled = computed(() => dayMatches.value.filter((m) => m.status === 'CANCELLED').sort(byKick));

interface Group { key: string; title: string; muted?: boolean; matches: Match[]; }
const dayGroups = computed<Group[]>(() => {
  const g: Group[] = [];
  if (dayScheduled.value.length) g.push({ key: 'sched', title: 'Agendadas', matches: dayScheduled.value });
  if (dayFinished.value.length) g.push({ key: 'fin', title: 'Encerradas', muted: true, matches: dayFinished.value });
  if (dayCancelled.value.length) g.push({ key: 'canc', title: 'Canceladas', muted: true, matches: dayCancelled.value });
  return g;
});
const dayCount = computed(() => dayMatches.value.length);

// ---- data ----
async function loadMenu() {
  // Fetch every match of the tournament so we can group by day/status client-side
  // (the API caps pageSize at 100 and has no date filter, so page through).
  const api = useApi();
  const url = (page: number) => {
    const q = new URLSearchParams({ pageSize: '100', page: String(page) });
    if (tournamentId.value) q.set('seasonId', tournamentId.value);
    return `/matches?${q.toString()}`;
  };
  const first = await api<Paginated<Match>>(url(1));
  let all = first.data;
  const totalPages = first.pagination.totalPages;
  for (let p = 2; p <= totalPages && p <= 20; p++) {
    const next = await api<Paginated<Match>>(url(p));
    all = all.concat(next.data);
  }
  allMatches.value = all.filter((m) => m.homeTeam && m.awayTeam);
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

// Auto-focus the action: prefer a live match, else the next scheduled today.
function autoSelect() {
  if (selected.value) return;
  const first = liveGroup.value[0] ?? dayScheduled.value[0] ?? null;
  if (first) select(first);
}

useRealtime(
  () => {
    const r: string[] = [];
    if (tournamentId.value) r.push(`tournament:${tournamentId.value}`);
    if (selected.value) r.push(`match:${selected.value.id}`);
    return r;
  },
  () => (selected.value ? refreshSelected() : loadMenu()),
);

watch(tournamentId, async () => {
  await loadMenu();
});
onMounted(async () => {
  const tt = await useApi()<Paginated<Tournament>>('/seasons?pageSize=100');
  tournaments.value = tt.data;
  tournamentId.value = tt.data.find((t) => t.status === 'ONGOING')?.id ?? '';
  await loadMenu();
  autoSelect();
});
</script>

<template>
  <div>
    <AdminPageHeader title="Controle ao vivo" subtitle="Acompanhe as partidas ao vivo e as do dia, e atualize placar e status em tempo real." />
    <div class="live-grid">
      <!-- menu -->
      <div class="card menu">
        <div class="picker">
          <select v-model="tournamentId" class="input sm">
            <option value="">Todos os torneios</option>
            <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <input v-model="menuSearch" class="input sm" placeholder="Buscar time, fase, estádio…" />
          <div class="daynav">
            <button class="dn-arrow" title="Dia anterior" aria-label="Dia anterior" @click="selectedDay = shiftKey(selectedDay, -1)">‹</button>
            <button class="dn-day" :class="{ today: isToday }" @click="selectedDay = todayKey">
              <span class="dn-title">{{ dayTitle }}</span>
              <span class="dn-count">{{ dayCount }} {{ dayCount === 1 ? 'jogo' : 'jogos' }}</span>
            </button>
            <button class="dn-arrow" title="Próximo dia" aria-label="Próximo dia" @click="selectedDay = shiftKey(selectedDay, 1)">›</button>
          </div>
          <button v-if="!isToday" class="dn-today" @click="selectedDay = todayKey">↩ Voltar para hoje</button>
        </div>

        <div class="menu-list">
          <!-- LIVE — sticky so it's always one click away while browsing the day -->
          <div v-if="liveGroup.length" class="grp grp-live">
            <div class="grp-head live">
              <span class="ld" /> Ao vivo agora
              <span class="grp-count live">{{ liveGroup.length }}</span>
            </div>
            <button
              v-for="m in liveGroup"
              :key="m.id"
              class="mitem live"
              :class="{ active: selected?.id === m.id }"
              @click="select(m)"
            >
              <div class="mi-meta">
                <span class="mi-live"><span class="ld" />AO VIVO</span>
                <span v-if="m.season && !tournamentId" class="mi-tour">{{ m.season.name }}</span>
                <span class="mi-phase">{{ m.phaseLabel }}<template v-if="m.groupName"> · {{ m.groupName }}</template></span>
              </div>
              <div class="mi-teams">
                <TeamBadge :team="m.homeTeam" :size="22" />
                <span class="mi-name r">{{ m.homeTeam?.shortName ?? m.homeTeam?.name }}</span>
                <span class="sc font-numeric">{{ m.homeScore ?? 0 }}-{{ m.awayScore ?? 0 }}</span>
                <span class="mi-name l">{{ m.awayTeam?.shortName ?? m.awayTeam?.name }}</span>
                <TeamBadge :team="m.awayTeam" :size="22" />
              </div>
            </button>
          </div>

          <!-- DAY GROUPS -->
          <div v-for="g in dayGroups" :key="g.key" class="grp">
            <div class="grp-head" :class="{ muted: g.muted }">
              {{ g.title }}<span class="grp-count">{{ g.matches.length }}</span>
            </div>
            <button
              v-for="m in g.matches"
              :key="m.id"
              class="mitem"
              :class="{ active: selected?.id === m.id, dim: g.muted }"
              @click="select(m)"
            >
              <div class="mi-meta">
                <span class="mi-time font-numeric">{{ timeOnly(m.kickoffAt) }}</span>
                <span v-if="m.season && !tournamentId" class="mi-tour">{{ m.season.name }}</span>
                <span class="mi-phase">{{ m.phaseLabel }}<template v-if="m.groupName"> · {{ m.groupName }}</template></span>
                <span v-if="m.status === 'FINISHED'" class="mi-tag">FIM</span>
                <span v-else-if="m.status === 'CANCELLED'" class="mi-tag">CANC</span>
              </div>
              <div class="mi-teams">
                <TeamBadge :team="m.homeTeam" :size="22" />
                <span class="mi-name r">{{ m.homeTeam?.shortName ?? m.homeTeam?.name }}</span>
                <span class="sc font-numeric">{{ m.homeScore ?? 0 }}-{{ m.awayScore ?? 0 }}</span>
                <span class="mi-name l">{{ m.awayTeam?.shortName ?? m.awayTeam?.name }}</span>
                <TeamBadge :team="m.awayTeam" :size="22" />
              </div>
            </button>
          </div>

          <p v-if="!liveGroup.length && !dayGroups.length" class="muted hint">
            <template v-if="menuSearch">Nenhuma partida para “{{ menuSearch }}”.</template>
            <template v-else>Nenhuma partida ao vivo nem agendada para este dia. Use ‹ › para mudar de dia.</template>
          </p>
        </div>
      </div>

      <!-- board -->
      <div v-if="selected" class="board">
        <!-- PLACAR — a informação principal -->
        <div class="card scoreboard" :class="{ islive: selected.status === 'LIVE' }">
          <div class="sbh">
            <div class="sbh-meta">
              <span v-if="selected.season" class="sbh-tour">{{ selected.season.name }}</span>
              <span class="sbh-phase">{{ selected.phaseLabel }}<template v-if="selected.groupName"> · Grupo {{ selected.groupName }}</template><template v-if="selected.matchNumber"> · Jogo {{ selected.matchNumber }}</template></span>
            </div>
            <div class="sbh-right">
              <span class="chip status" :style="{ color: STATUS_COLOR[selected.status], borderColor: STATUS_COLOR[selected.status] }">
                <span v-if="selected.status === 'LIVE'" class="ld" />{{ STATUS_LABEL[selected.status] }}
              </span>
              <div ref="settingsWrap" class="gearwrap">
                <button class="gear" :class="{ on: settingsOpen }" title="Configurações" aria-label="Configurações" @click="settingsOpen = !settingsOpen">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
                </button>
                <!-- Settings popover — tucked away, opens from the gear -->
                <div v-if="settingsOpen" class="set-pop">
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
            </div>
          </div>

          <div class="sides">
            <div class="bside">
              <TeamBadge :team="selected.homeTeam" :size="54" />
              <span class="bn">{{ selected.homeTeam?.name }}</span>
              <div class="huge font-numeric">{{ selected.homeScore ?? 0 }}</div>
              <div v-if="!selected.autoManaged" class="steppers">
                <button class="step minus" @click="bump('home', -1)">−</button>
                <button class="step plus" @click="bump('home', 1)">+</button>
              </div>
            </div>
            <span class="sep font-numeric">:</span>
            <div class="bside">
              <TeamBadge :team="selected.awayTeam" :size="54" />
              <span class="bn">{{ selected.awayTeam?.name }}</span>
              <div class="huge font-numeric">{{ selected.awayScore ?? 0 }}</div>
              <div v-if="!selected.autoManaged" class="steppers">
                <button class="step minus" @click="bump('away', -1)">−</button>
                <button class="step plus" @click="bump('away', 1)">+</button>
              </div>
            </div>
          </div>

          <div class="sb-flags">
            <span class="chip" :class="predEffectiveOpen ? 'ok' : 'no'">Palpites {{ predEffectiveOpen ? 'abertos' : 'fechados' }}</span>
            <span class="chip" :class="selected.autoManaged ? 'ok' : 'no'">Placar {{ selected.autoManaged ? 'automático' : 'manual' }}</span>
            <span v-if="selected.autoManaged" class="flag-hint">robô ESPN no comando · ⚙ para assumir</span>
          </div>
        </div>

        <!-- INFORMAÇÕES — faixa leve -->
        <div class="infostrip">
          <div class="tile">
            <span class="tk">Data</span>
            <span class="tv">{{ formatKickoff(selected.kickoffAt, tz) }}</span>
          </div>
          <div class="tile">
            <span class="tk">Estádio</span>
            <span class="tv">{{ selected.stadium ? `${selected.stadium.name} · ${selected.stadium.city}` : '—' }}</span>
          </div>
          <div class="tile">
            <span class="tk">Palpites</span>
            <span class="tv"><b class="font-numeric">{{ participants }}</b><template v-if="leader"> · líder {{ leader.name }} ({{ leader.points }} pts)</template></span>
          </div>
        </div>

        <!-- ENGAJAMENTO + FEED (futuro) -->
        <div class="board-bottom">
          <div class="card engage">
            <div class="eh">
              <h4 class="font-display">Engajamento do bolão</h4>
              <span v-if="engagement && engagement.totalPredictions" class="et"><b class="font-numeric">{{ engagement.totalPredictions }}</b> palpites</span>
            </div>
            <div v-if="engagement && engagement.totalPredictions" class="dist">
              <div v-for="d in engagement.distribution" :key="`${d.homeScore}-${d.awayScore}`" class="drow">
                <span class="dscore font-numeric">{{ d.homeScore }}-{{ d.awayScore }}</span>
                <div class="dbar"><div class="dfill" :style="{ width: `${(d.count / maxCount) * 100}%` }" /></div>
                <span class="dpct">{{ d.percentage }}% · {{ d.count }}</span>
              </div>
            </div>
            <p v-else class="muted soft">Ainda sem palpites nesta partida.</p>
          </div>

          <div class="card feedph">
            <div class="fp-head">
              <h4 class="font-display">Feed do jogo</h4>
              <span class="soon-tag">Em breve</span>
            </div>
            <div class="fp-body">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"/></svg>
              <p>Lances e eventos da partida em tempo real vão aparecer aqui.</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="card placeholder">Selecione uma partida ao lado para controlar o placar.</div>
    </div>
  </div>
</template>

<style scoped>
.live-grid { display: grid; grid-template-columns: 340px 1fr; gap: 16px; align-items: start; }
@media (max-width: 820px) { .live-grid { grid-template-columns: 1fr; } }
.menu { padding: 12px; }
.picker { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
.input.sm { padding: 9px 11px; font-size: 13px; }

/* day navigator */
.daynav { display: flex; align-items: stretch; gap: 6px; }
.dn-arrow { flex: 0 0 auto; width: 36px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-size: 20px; line-height: 1; cursor: pointer; }
.dn-arrow:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
.dn-day { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding: 6px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-base); cursor: pointer; }
.dn-day.today { border-color: color-mix(in srgb, var(--azure) 50%, var(--border)); background: color-mix(in srgb, var(--azure) 8%, var(--bg-base)); }
.dn-title { font-size: 12.5px; font-weight: 800; text-transform: capitalize; color: var(--text); }
.dn-count { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.dn-today { padding: 7px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-base); color: var(--azure); font-weight: 700; font-size: 12px; cursor: pointer; }

/* grouped list */
.menu-list { display: flex; flex-direction: column; gap: 4px; max-height: 74vh; overflow: auto; padding-right: 2px; }
.grp { display: flex; flex-direction: column; gap: 6px; }
.grp + .grp { margin-top: 10px; }
.grp-head { display: flex; align-items: center; gap: 7px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text); padding: 4px 4px 2px; }
.grp-head.muted { color: var(--muted); }
.grp-head.live { color: var(--scarlet); }
.grp-count { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px; font-size: 10.5px; font-weight: 800; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); }
.grp-count.live { color: #fff; background: var(--scarlet); border-color: var(--scarlet); }

/* keep the live group pinned while the day list scrolls */
.grp-live { position: sticky; top: 0; z-index: 3; background: var(--bg-surface); padding-bottom: 8px; margin-bottom: 4px; border-bottom: 1px solid var(--border); }

.mitem { display: flex; flex-direction: column; gap: 7px; padding: 9px 11px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); cursor: pointer; text-align: left; transition: border-color 0.12s, background 0.12s; }
.mitem:hover { border-color: color-mix(in srgb, var(--azure) 40%, var(--border)); }
.mitem.dim { opacity: 0.72; }
.mitem.live { border-color: color-mix(in srgb, var(--scarlet) 38%, var(--border)); background: color-mix(in srgb, var(--scarlet) 7%, var(--bg-base)); }
.mitem.active { border: 1.5px solid var(--scarlet); background: color-mix(in srgb, var(--scarlet) 14%, transparent); box-shadow: inset 4px 0 0 0 var(--scarlet); opacity: 1; }
.mi-meta { display: flex; align-items: center; gap: 7px; min-width: 0; }
.mi-live { display: inline-flex; align-items: center; gap: 5px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; color: var(--scarlet); flex: 0 0 auto; }
.mi-time { font-size: 12.5px; font-weight: 800; color: var(--text); flex: 0 0 auto; }
.mi-tour { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--azure); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-phase { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-tag { margin-left: auto; font-size: 9.5px; font-weight: 800; letter-spacing: 0.04em; color: var(--muted); border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px; flex: 0 0 auto; }
.mi-teams { display: grid; grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto; align-items: center; gap: 7px; }
.mi-name { font-size: 12.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-name.r { text-align: right; }
.mi-name.l { text-align: left; }
.ld { width: 7px; height: 7px; border-radius: 50%; background: var(--scarlet); animation: liveDot 1.2s infinite; flex: 0 0 auto; }
.sc { font-size: 16px; text-align: center; flex: 0 0 auto; }
.hint { padding: 14px 8px; font-size: 12.5px; line-height: 1.5; }

.board { display: flex; flex-direction: column; gap: 14px; }

/* ---- PLACAR (hero) ---- */
.scoreboard { padding: clamp(18px, 3.5vw, 26px); }
.scoreboard.islive { border-color: rgba(232, 54, 43, 0.4); background: linear-gradient(180deg, rgba(232, 54, 43, 0.1), transparent 55%), var(--bg-surface); }
.sbh { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.sbh-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sbh-tour { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sbh-phase { font-size: 12px; font-weight: 800; color: var(--text); }
.sbh-right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; color: var(--muted); white-space: nowrap; }
.chip.ok { color: var(--emerald); border-color: color-mix(in srgb, var(--emerald) 45%, var(--border)); }
.chip.no { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }

/* gear + settings popover */
.gearwrap { position: relative; }
.gear { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; transition: color 0.12s, border-color 0.12s; }
.gear:hover { color: var(--text); border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
.gear.on { color: var(--text); border-color: var(--azure); background: color-mix(in srgb, var(--azure) 10%, var(--bg-base)); }
.set-pop { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; width: min(320px, 86vw); display: flex; flex-direction: column; gap: 14px; padding: 15px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-elevated); box-shadow: var(--shadow); }
.set-pop::before { content: ''; position: absolute; top: -6px; right: 12px; width: 11px; height: 11px; background: var(--bg-elevated); border-left: 1px solid var(--border); border-top: 1px solid var(--border); transform: rotate(45deg); }
.set-group { display: flex; flex-direction: column; gap: 8px; }
.set-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.set-sub { font-weight: 600; text-transform: none; letter-spacing: 0; }
.set-actions { display: flex; flex-wrap: wrap; gap: 7px; }

/* score */
.sides { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; max-width: 480px; margin: 6px auto 0; }
.bside { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.bn { font-size: 13px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.huge { font-size: clamp(58px, 13vw, 92px); line-height: 0.8; }
.sep { font-size: clamp(34px, 7vw, 52px); color: var(--muted); align-self: start; margin-top: clamp(36px, 9vw, 64px); }
.steppers { display: flex; gap: 9px; margin-top: 2px; }
.step { width: 48px; height: 48px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-size: 24px; line-height: 1; cursor: pointer; }
.step.plus { border: none; background: var(--emerald); color: #fff; box-shadow: 0 8px 20px -8px var(--emerald); }
.sb { flex: 1; min-width: 92px; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg-base); color: var(--text); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.sb.live.on { background: var(--scarlet); color: #fff; border-color: transparent; }
.sb.on { background: var(--grad-pitch); color: #fff; border-color: transparent; }
.sb.ok.on { background: var(--emerald); color: #fff; border-color: transparent; }
.sb.danger.on { background: var(--scarlet); color: #fff; border-color: transparent; }

.sb-flags { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }
.flag-hint { font-size: 11px; font-weight: 600; color: var(--muted); }

/* ---- INFORMAÇÕES (faixa leve) ---- */
.infostrip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.tile { display: flex; flex-direction: column; gap: 3px; padding: 11px 13px; border-radius: 13px; border: 1px solid var(--border); background: var(--bg-surface); min-width: 0; }
.tk { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.tv { font-size: 12.5px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; }
.tv b { font-weight: 800; }
@media (max-width: 640px) { .infostrip { grid-template-columns: 1fr; } }

/* ---- ENGAJAMENTO + FEED ---- */
.board-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
@media (max-width: 720px) { .board-bottom { grid-template-columns: 1fr; } }
.engage { padding: 18px; }
.soft { font-size: 13px; }
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

/* feed placeholder (futuro) */
.feedph { padding: 18px; display: flex; flex-direction: column; }
.fp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
.fp-head h4 { font-weight: 600; font-size: 15px; text-transform: uppercase; }
.soon-tag { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--azure); border: 1px solid color-mix(in srgb, var(--azure) 45%, var(--border)); border-radius: 999px; padding: 3px 9px; }
.fp-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; color: var(--muted); padding: 18px 8px; border: 1px dashed var(--border); border-radius: 12px; margin-top: 4px; }
.fp-body p { font-size: 12.5px; line-height: 1.5; max-width: 240px; }
.placeholder { padding: 40px; text-align: center; color: var(--muted); }
</style>
