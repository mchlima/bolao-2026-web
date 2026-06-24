<script setup lang="ts">
import type {
  BracketStage,
  Paginated,
  StageFormat,
  Stadium,
  Team,
  Tournament,
} from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const api = useApi();
const tz = useTz();
const helpOpen = ref(false);

// Structure shape returned by GET /seasons/:id/structure (season + stages tree).
interface StructMatch {
  id: string;
  matchNumber: number | null;
  leg: number | null;
  kickoffAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  homeScore: number | null;
  awayScore: number | null;
  groupId: string | null;
  tieId: string | null;
  stadiumId: string | null;
  homeSourceLabel: string | null;
  awaySourceLabel: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  stadium: { name: string; city: string } | null;
}
interface StructRound {
  id: string;
  number: number | null;
  name: string | null;
  legs: number;
  order: number;
  matches: StructMatch[];
}
interface StructStage {
  id: string;
  name: string;
  format: StageFormat;
  order: number;
  tiebreakPreset: string;
  hasThirdPlace: boolean;
  groups: {
    id: string;
    name: string;
    order: number;
    teams: { team: Team }[];
  }[];
  rounds: StructRound[];
}
interface StructSeason {
  id: string;
  name: string;
  stages: StructStage[];
}

const seasons = ref<Tournament[]>([]);
const teams = ref<Team[]>([]);
const stadiums = ref<Stadium[]>([]);
const seasonId = ref('');
const struct = ref<StructSeason | null>(null);
const bracket = ref<BracketStage[]>([]);
const loading = ref(false);

const TIEBREAKS = ['FIFA', 'BRASILEIRAO', 'UEFA', 'CONMEBOL', 'GENERIC'];
const FORMATS: { v: StageFormat; l: string }[] = [
  { v: 'GROUP', l: 'Grupos' },
  { v: 'LEAGUE', l: 'Pontos corridos' },
  { v: 'KNOCKOUT', l: 'Mata-mata' },
];

// Ties indexed by roundId (from the bracket endpoint).
const tiesByRound = computed(() => {
  const map = new Map<string, BracketStage['rounds'][number]['ties']>();
  for (const s of bracket.value)
    for (const r of s.rounds) map.set(r.roundId, r.ties);
  return map;
});

async function loadSeasons() {
  seasons.value = (await api<Paginated<Tournament>>('/seasons?pageSize=100')).data;
  if (!seasonId.value && seasons.value[0]) seasonId.value = seasons.value[0].id;
}
async function loadTeams() {
  // The API caps pageSize at 100 — page through all teams for the pickers.
  const all: Team[] = [];
  let page = 1;
  for (;;) {
    const res = await api<Paginated<Team>>(`/teams?pageSize=100&page=${page}`);
    all.push(...res.data);
    if (res.data.length === 0 || page >= res.pagination.totalPages) break;
    page++;
  }
  teams.value = all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
async function loadStadiums() {
  const all: Stadium[] = [];
  let page = 1;
  for (;;) {
    const res = await api<Paginated<Stadium>>(`/stadiums?pageSize=100&page=${page}`);
    all.push(...res.data);
    if (res.data.length === 0 || page >= res.pagination.totalPages) break;
    page++;
  }
  stadiums.value = all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
async function loadStructure() {
  if (!seasonId.value) return;
  loading.value = true;
  try {
    const [s, b] = await Promise.all([
      api<StructSeason>(`/seasons/${seasonId.value}/structure`),
      api<BracketStage[]>(`/seasons/${seasonId.value}/bracket`),
    ]);
    struct.value = s;
    bracket.value = b;
  } finally {
    loading.value = false;
  }
}
watch(seasonId, loadStructure);
onMounted(async () => {
  await Promise.all([loadSeasons(), loadTeams(), loadStadiums()]);
  await loadStructure();
});

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

// ── Stage ──
async function addStage() {
  const order = (struct.value?.stages.length ?? 0) + 1;
  try {
    await api('/admin/structure/stages', {
      method: 'POST',
      body: { seasonId: seasonId.value, name: 'Nova fase', format: 'GROUP', order },
    });
    await loadStructure();
  } catch (e) { err(e); }
}
async function saveStage(st: StructStage) {
  try {
    await api(`/admin/structure/stages/${st.id}`, {
      method: 'PATCH',
      body: { name: st.name, format: st.format, tiebreakPreset: st.tiebreakPreset, hasThirdPlace: st.hasThirdPlace },
    });
    ui.toast('success', 'Fase salva');
    await loadStructure();
  } catch (e) { err(e); }
}
async function delStage(st: StructStage) {
  if (!(await ui.confirm({ title: 'Excluir fase', msg: `Excluir "${st.name}" e tudo dentro?`, confirmLabel: 'Excluir', danger: true }))) return;
  try { await api(`/admin/structure/stages/${st.id}`, { method: 'DELETE' }); await loadStructure(); } catch (e) { err(e); }
}

// ── Group ──
async function addGroup(st: StructStage) {
  const order = st.groups.length + 1;
  const name = String.fromCharCode(64 + order); // A, B, C…
  try { await api('/admin/structure/groups', { method: 'POST', body: { stageId: st.id, name, order } }); await loadStructure(); } catch (e) { err(e); }
}
async function delGroup(id: string) {
  try { await api(`/admin/structure/groups/${id}`, { method: 'DELETE' }); await loadStructure(); } catch (e) { err(e); }
}
async function addTeamToGroup(groupId: string, current: string[], teamId: string) {
  if (!teamId || current.includes(teamId)) return;
  try {
    await api(`/admin/structure/groups/${groupId}/teams`, { method: 'PUT', body: { teamIds: [...current, teamId] } });
    await loadStructure();
  } catch (e) { err(e); }
}
async function removeTeamFromGroup(groupId: string, current: string[], teamId: string) {
  try {
    await api(`/admin/structure/groups/${groupId}/teams`, { method: 'PUT', body: { teamIds: current.filter((t) => t !== teamId) } });
    await loadStructure();
  } catch (e) { err(e); }
}

// ── Round ──
async function addRound(st: StructStage) {
  const order = st.rounds.length + 1;
  try { await api('/admin/structure/rounds', { method: 'POST', body: { stageId: st.id, name: `Fase ${order}`, legs: 1, order } }); await loadStructure(); } catch (e) { err(e); }
}
async function saveRound(r: StructStage['rounds'][number]) {
  try { await api(`/admin/structure/rounds/${r.id}`, { method: 'PATCH', body: { name: r.name, number: r.number, legs: r.legs } }); ui.toast('success', 'Rodada salva'); await loadStructure(); } catch (e) { err(e); }
}
async function delRound(id: string) {
  try { await api(`/admin/structure/rounds/${id}`, { method: 'DELETE' }); await loadStructure(); } catch (e) { err(e); }
}

// ── Tie ──
type TieMode = 'team' | 'slot';
interface TieDraft {
  home: string;
  away: string;
  homeLabel: string;
  awayLabel: string;
  homeMode: TieMode;
  awayMode: TieMode;
}
const emptyDraft = (): TieDraft => ({
  home: '', away: '', homeLabel: '', awayLabel: '', homeMode: 'slot', awayMode: 'slot',
});
const newTie = reactive<Record<string, TieDraft>>({});
function tieDraft(roundId: string) {
  if (!newTie[roundId]) newTie[roundId] = emptyDraft();
  return newTie[roundId];
}
async function addTie(roundId: string) {
  const d = tieDraft(roundId);
  const order = (tiesByRound.value.get(roundId)?.length ?? 0) + 1;
  try {
    await api('/admin/structure/ties', {
      method: 'POST',
      body: {
        roundId, order,
        homeTeamId: d.homeMode === 'team' ? d.home || undefined : undefined,
        awayTeamId: d.awayMode === 'team' ? d.away || undefined : undefined,
        homeSourceLabel: d.homeMode === 'slot' ? d.homeLabel || undefined : undefined,
        awaySourceLabel: d.awayMode === 'slot' ? d.awayLabel || undefined : undefined,
      },
    });
    newTie[roundId] = emptyDraft();
    await loadStructure();
  } catch (e) { err(e); }
}
async function delTie(id: string) {
  try { await api(`/admin/structure/ties/${id}`, { method: 'DELETE' }); await loadStructure(); } catch (e) { err(e); }
}

async function resolve() {
  try { await api(`/admin/structure/seasons/${seasonId.value}/resolve`, { method: 'POST' }); ui.toast('success', 'Estrutura resolvida'); await loadStructure(); } catch (e) { err(e); }
}

// ── Jogos (matches) — criar/editar/excluir ligados à rodada/grupo/confronto ──
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado', LIVE: 'Ao vivo', FINISHED: 'Encerrado', CANCELLED: 'Cancelado',
};
async function delMatch(m: StructMatch) {
  const home = m.homeTeam?.shortName ?? m.homeSourceLabel ?? '?';
  const away = m.awayTeam?.shortName ?? m.awaySourceLabel ?? '?';
  if (!(await ui.confirm({ title: 'Excluir jogo', msg: `Excluir ${home} × ${away}? Os palpites desse jogo são perdidos.`, confirmLabel: 'Excluir', danger: true }))) return;
  try { await api(`/admin/matches/${m.id}`, { method: 'DELETE' }); await loadStructure(); } catch (e) { err(e); }
}
async function patchKickoff(m: StructMatch, local: string) {
  if (!local) return;
  try { await api(`/admin/matches/${m.id}`, { method: 'PATCH', body: { kickoffAt: zonedInputToUtc(local, tz.value) } }); ui.toast('success', 'Horário salvo'); await loadStructure(); } catch (e) { err(e); }
}
async function patchStadium(m: StructMatch, stadiumId: string) {
  try { await api(`/admin/matches/${m.id}`, { method: 'PATCH', body: { stadiumId: stadiumId || null } }); ui.toast('success', 'Estádio salvo'); await loadStructure(); } catch (e) { err(e); }
}

// Group-stage "add game" draft, keyed by roundId.
interface GMDraft { groupId: string; home: string; away: string; kickoff: string; stadiumId: string; }
const gmDraft = reactive<Record<string, GMDraft>>({});
function gmd(roundId: string): GMDraft {
  if (!gmDraft[roundId]) gmDraft[roundId] = { groupId: '', home: '', away: '', kickoff: '', stadiumId: '' };
  return gmDraft[roundId];
}
function groupOf(st: StructStage, id: string) {
  return st.groups.find((g) => g.id === id) ?? null;
}
async function addGroupMatch(st: StructStage, r: StructRound) {
  const d = gmd(r.id);
  if (!d.groupId || !d.home || !d.away || !d.kickoff) { ui.toast('error', 'Escolha grupo, os dois times e a data.'); return; }
  if (d.home === d.away) { ui.toast('error', 'Os dois times são iguais.'); return; }
  const g = groupOf(st, d.groupId);
  try {
    await api('/admin/matches', {
      method: 'POST',
      body: {
        seasonId: seasonId.value, stageId: st.id, groupId: d.groupId, roundId: r.id,
        homeTeamId: d.home, awayTeamId: d.away,
        stadiumId: d.stadiumId || undefined,
        kickoffAt: zonedInputToUtc(d.kickoff, tz.value),
        phaseLabel: st.name, groupName: g?.name, status: 'SCHEDULED',
      },
    });
    gmDraft[r.id] = { groupId: '', home: '', away: '', kickoff: '', stadiumId: '' };
    await loadStructure();
  } catch (e) { err(e); }
}

// Knockout "add leg" draft, keyed by tieId.
const kmDraft = reactive<Record<string, { kickoff: string; stadiumId: string }>>({});
function kmd(tieId: string) {
  if (!kmDraft[tieId]) kmDraft[tieId] = { kickoff: '', stadiumId: '' };
  return kmDraft[tieId];
}
// Matches of a knockout tie come from the round's match list (filtered by tieId).
function tieMatches(r: StructRound, tieId: string): StructMatch[] {
  return r.matches.filter((m) => m.tieId === tieId).sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
}
async function addTieMatch(st: StructStage, r: StructRound, tie: { id: string; home: { id: string } | null; away: { id: string } | null; homeSourceLabel: string | null; awaySourceLabel: string | null }) {
  const d = kmd(tie.id);
  if (!d.kickoff) { ui.toast('error', 'Informe a data do jogo.'); return; }
  const existing = tieMatches(r, tie.id);
  if (existing.length >= r.legs) { ui.toast('error', `Rodada de ${r.legs} jogo(s) — já há ${existing.length}.`); return; }
  const leg = r.legs >= 2 ? existing.length + 1 : 1;
  try {
    await api('/admin/matches', {
      method: 'POST',
      body: {
        seasonId: seasonId.value, stageId: st.id, roundId: r.id, tieId: tie.id, leg,
        homeTeamId: tie.home?.id, awayTeamId: tie.away?.id,
        homeSourceLabel: tie.home ? undefined : tie.homeSourceLabel || undefined,
        awaySourceLabel: tie.away ? undefined : tie.awaySourceLabel || undefined,
        stadiumId: d.stadiumId || undefined,
        kickoffAt: zonedInputToUtc(d.kickoff, tz.value),
        phaseLabel: r.name || st.name, status: 'SCHEDULED',
      },
    });
    kmDraft[tie.id] = { kickoff: '', stadiumId: '' };
    await loadStructure();
  } catch (e) { err(e); }
}

const teamById = (id: string) => teams.value.find((t) => t.id === id) ?? null;

const FORMAT_META: Record<StageFormat, { label: string; cls: string }> = {
  GROUP: { label: 'Grupos', cls: 'fmt-group' },
  LEAGUE: { label: 'Pontos corridos', cls: 'fmt-league' },
  KNOCKOUT: { label: 'Mata-mata', cls: 'fmt-ko' },
};
const FMT_ICON: Record<StageFormat, string[]> = {
  GROUP: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  LEAGUE: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  KNOCKOUT: ['M5 5v4h6', 'M5 15v4h6', 'M11 7h4v10h-4', 'M15 12h4'],
};
const TIEBREAK_LABEL: Record<string, string> = {
  FIFA: 'FIFA', BRASILEIRAO: 'Brasileirão', UEFA: 'UEFA',
  CONMEBOL: 'Conmebol', GENERIC: 'Genérico',
};
const TRASH = ['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13', 'M10 11v6', 'M14 11v6'];
const SLOT = ['M12 2l8 4.5v9L12 20l-8-4.5v-9z', 'M12 11v9', 'M20 6.5l-8 4.5-8-4.5'];
</script>

<template>
  <div>
    <AdminPageHeader title="Estrutura do torneio">
      <template #subtitle>
        Monte o torneio em camadas: <b>fases</b> → grupos com seus times, ou rodadas de
        mata-mata com confrontos. Escolha o torneio e vá adicionando fases.
      </template>
      <template #actions>
        <button class="btn help-btn" @click="helpOpen = true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7" /><path d="M12 17h.01" /></svg>
          Como usar
        </button>
      </template>
    </AdminPageHeader>

    <!-- Toolbar: contexto (torneio) à esquerda, ações à direita -->
    <div class="toolbar">
      <label class="tb-field">
        <span class="tb-lbl">Torneio</span>
        <select v-model="seasonId" class="input">
          <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
      <div class="tb-actions">
        <span class="resolve-wrap">
          <button class="btn" :disabled="!seasonId" @click="resolve">↻ Resolver slots</button>
          <InfoTip>Preenche os confrontos com <b>rótulo</b> (ex.: "1º Grupo A", "Vencedor Jogo 73") com os times reais, a partir dos resultados já lançados. Rode quando os jogos terminarem.</InfoTip>
        </span>
        <button class="btn btn-primary" :disabled="!seasonId" @click="struct && addStage()">+ Adicionar fase</button>
      </div>
    </div>

    <SkeletonList v-if="loading && !struct" variant="row" :count="4" />

    <!-- Empty -->
    <div v-else-if="!struct?.stages.length" class="card empty">
      <div class="empty-ic">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M3 14h7v7H3z" /><path d="M14 14h7v7h-7z" /></svg>
      </div>
      <h3 class="empty-t font-display">Nenhuma fase ainda</h3>
      <p class="empty-p">Uma fase pode ser <b>Grupos</b>, <b>Pontos corridos</b> ou <b>Mata-mata</b>. Crie a primeira para começar a montar o torneio.</p>
      <button class="btn btn-primary" :disabled="!seasonId" @click="addStage()">+ Criar primeira fase</button>
    </div>

    <!-- Stages -->
    <div v-else class="stages">
      <section v-for="(st, si) in struct.stages" :key="st.id" class="stage" :class="FORMAT_META[st.format].cls">
        <header class="st-head">
          <div class="st-badge">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in FMT_ICON[st.format]" :key="i" :d="d" /></svg>
          </div>
          <div class="st-main">
            <div class="st-row1">
              <span class="st-tag">Fase {{ si + 1 }} · {{ FORMAT_META[st.format].label }}</span>
              <input v-model="st.name" class="st-name" placeholder="Nome da fase (ex.: Fase de Grupos)" />
            </div>
            <div class="st-controls">
              <label class="field">
                <span class="field-lbl">Formato</span>
                <select v-model="st.format" class="input sm">
                  <option v-for="f in FORMATS" :key="f.v" :value="f.v">{{ f.l }}</option>
                </select>
              </label>
              <label v-if="st.format !== 'KNOCKOUT'" class="field">
                <span class="field-lbl">Desempate <InfoTip>Como ordenar times empatados em pontos. Cada preset usa os critérios oficiais (saldo de gols, confronto direto, etc.).</InfoTip></span>
                <select v-model="st.tiebreakPreset" class="input sm">
                  <option v-for="t in TIEBREAKS" :key="t" :value="t">{{ TIEBREAK_LABEL[t] ?? t }}</option>
                </select>
              </label>
              <label v-if="st.format !== 'KNOCKOUT'" class="field chk-field">
                <span class="field-lbl">3º colocados <InfoTip>Considera os melhores terceiros colocados na classificação (ex.: Copa com 48 seleções).</InfoTip></span>
                <span class="chk"><input v-model="st.hasThirdPlace" type="checkbox" /> <span>habilitar</span></span>
              </label>
            </div>
          </div>
          <div class="st-actions">
            <button class="btn xs primary-ghost" @click="saveStage(st)">Salvar fase</button>
            <button class="ic del" title="Excluir fase" @click="delStage(st)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
          </div>
        </header>

        <!-- GROUP / LEAGUE -->
        <div v-if="st.format !== 'KNOCKOUT'" class="body">
          <div class="section-head">
            <h4 class="section-title">Grupos <span class="count">{{ st.groups.length }}</span></h4>
            <button class="btn xs" @click="addGroup(st)">+ Grupo</button>
          </div>
          <p v-if="!st.groups.length" class="hint-empty">Nenhum grupo ainda. Crie grupos (A, B, C…) e distribua os times em cada um.</p>
          <div v-else class="groups-grid">
            <div v-for="g in st.groups" :key="g.id" class="group">
              <div class="g-head">
                <span class="g-name">Grupo {{ g.name }}</span>
                <span class="g-count" :title="`${g.teams.length} time(s)`">{{ g.teams.length }}</span>
                <button class="ic del xs2" title="Excluir grupo" @click="delGroup(g.id)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
              </div>
              <ul v-if="g.teams.length" class="team-list">
                <li v-for="gt in g.teams" :key="gt.team.id" class="tchip">
                  <TeamBadge :team="gt.team" :size="18" />
                  <span class="tchip-nm">{{ gt.team.name }}</span>
                  <button class="tchip-x" title="Remover do grupo" @click="removeTeamFromGroup(g.id, g.teams.map((x) => x.team.id), gt.team.id)">×</button>
                </li>
              </ul>
              <p v-else class="g-empty">Sem times — busque abaixo.</p>
              <div class="g-add">
                <TeamPicker
                  clear-on-select
                  placeholder="+ adicionar time…"
                  @select="(t) => addTeamToGroup(g.id, g.teams.map((x) => x.team.id), t.id)"
                />
              </div>
            </div>
          </div>

          <!-- RODADAS E JOGOS -->
          <div class="rounds-block">
            <div class="section-head">
              <h4 class="section-title">Rodadas e jogos <span class="count">{{ st.rounds.length }}</span></h4>
              <button class="btn xs" @click="addRound(st)">+ Rodada</button>
            </div>
            <p class="hint">
              Cada <b>rodada</b> agrupa os jogos daquela etapa (1ª, 2ª, 3ª…). Adicione os jogos de cada grupo
              na rodada — o <b>placar e o status entram pelo robô</b>. O horário você define aqui.
            </p>
            <p v-if="!st.rounds.length" class="hint-empty">Nenhuma rodada ainda — adicione a primeira (ex.: "Rodada 1").</p>

            <div v-for="r in st.rounds" :key="r.id" class="round">
              <div class="r-head">
                <input v-model="r.name" class="input sm r-name" placeholder="Ex.: Rodada 1" />
                <span class="r-count">{{ r.matches.length }} jogo(s)</span>
                <button class="btn xs primary-ghost" @click="saveRound(r)">Salvar</button>
                <button class="ic del xs2" title="Excluir rodada" @click="delRound(r.id)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
              </div>

              <div class="matches">
                <div v-for="m in r.matches" :key="m.id" class="match">
                  <span v-if="m.groupId" class="m-grp">{{ groupOf(st, m.groupId)?.name }}</span>
                  <span class="m-side r">
                    <TeamBadge v-if="m.homeTeam" :team="m.homeTeam" :size="16" />
                    <span class="m-nm">{{ m.homeTeam?.name ?? m.homeSourceLabel ?? 'A definir' }}</span>
                  </span>
                  <span class="m-sc font-numeric">{{ m.status === 'SCHEDULED' ? '×' : `${m.homeScore ?? 0}-${m.awayScore ?? 0}` }}</span>
                  <span class="m-side l">
                    <TeamBadge v-if="m.awayTeam" :team="m.awayTeam" :size="16" />
                    <span class="m-nm">{{ m.awayTeam?.name ?? m.awaySourceLabel ?? 'A definir' }}</span>
                  </span>
                  <span v-if="m.status !== 'SCHEDULED'" class="m-st" :class="m.status.toLowerCase()">{{ STATUS_LABEL[m.status] }}</span>
                  <input class="input xs m-dt" type="datetime-local" :value="utcToZonedInput(m.kickoffAt, tz)" @change="patchKickoff(m, ($event.target as HTMLInputElement).value)" />
                  <select class="input xs m-stad" title="Estádio" :value="m.stadiumId ?? ''" @change="patchStadium(m, ($event.target as HTMLSelectElement).value)">
                    <option value="">Sem estádio</option>
                    <option v-for="s in stadiums" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                  <button class="ic del xs2" title="Excluir jogo" @click="delMatch(m)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
                </div>
                <p v-if="!r.matches.length" class="ties-empty">Nenhum jogo nesta rodada.</p>
              </div>

              <div class="match-add">
                <div class="ma-title">+ Novo jogo</div>
                <div class="ma-grid">
                  <select v-model="gmd(r.id).groupId" class="input sm">
                    <option value="" disabled>Grupo…</option>
                    <option v-for="g in st.groups" :key="g.id" :value="g.id">Grupo {{ g.name }}</option>
                  </select>
                  <select v-model="gmd(r.id).home" class="input sm" :disabled="!gmd(r.id).groupId">
                    <option value="" disabled>Mandante…</option>
                    <option v-for="gt in (groupOf(st, gmd(r.id).groupId)?.teams ?? [])" :key="gt.team.id" :value="gt.team.id">{{ gt.team.name }}</option>
                  </select>
                  <span class="vs">×</span>
                  <select v-model="gmd(r.id).away" class="input sm" :disabled="!gmd(r.id).groupId">
                    <option value="" disabled>Visitante…</option>
                    <option v-for="gt in (groupOf(st, gmd(r.id).groupId)?.teams ?? [])" :key="gt.team.id" :value="gt.team.id">{{ gt.team.name }}</option>
                  </select>
                  <input v-model="gmd(r.id).kickoff" class="input sm" type="datetime-local" />
                  <select v-model="gmd(r.id).stadiumId" class="input sm">
                    <option value="">Estádio (opcional)…</option>
                    <option v-for="s in stadiums" :key="s.id" :value="s.id">{{ s.name }} · {{ s.city }}</option>
                  </select>
                  <button class="btn xs btn-primary" @click="addGroupMatch(st, r)">+ Adicionar</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- KNOCKOUT -->
        <div v-else class="body">
          <div class="section-head">
            <h4 class="section-title">Rodadas <span class="count">{{ st.rounds.length }}</span></h4>
            <button class="btn xs" @click="addRound(st)">+ Rodada</button>
          </div>
          <p class="hint">
            Cada rodada é uma etapa do mata-mata (16-avos, oitavas, final…). Os confrontos podem usar um
            <b>time</b> direto ou um <b>rótulo</b> — um slot a preencher depois (ex.: "1º Grupo A", "Vencedor Jogo 73").
          </p>
          <p v-if="!st.rounds.length" class="hint-empty">Nenhuma rodada ainda — adicione a primeira (ex.: "Oitavas de final").</p>

          <div v-for="r in st.rounds" :key="r.id" class="round">
            <div class="r-head">
              <input v-model="r.name" class="input sm r-name" placeholder="Ex.: Oitavas de final" />
              <label class="field inline">
                <span class="field-lbl">Jogos <InfoTip>1 = jogo único · 2 = ida e volta (mando duplo).</InfoTip></span>
                <select v-model.number="r.legs" class="input sm">
                  <option :value="1">1 (único)</option>
                  <option :value="2">2 (ida/volta)</option>
                </select>
              </label>
              <span class="r-count">
                {{ (tiesByRound.get(r.id) ?? []).length }} confronto(s)
                <InfoTip>Confrontos com <b>rótulo</b> (ex.: "Vencedor Grupo A") são preenchidos automaticamente pelo botão "Resolver slots" no topo, conforme os resultados saem. Times definidos diretamente já ficam fixos.</InfoTip>
              </span>
              <button class="btn xs primary-ghost" @click="saveRound(r)">Salvar</button>
              <button class="ic del xs2" title="Excluir rodada" @click="delRound(r.id)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
            </div>

            <div class="ties">
              <div v-for="(tie, ti) in tiesByRound.get(r.id) ?? []" :key="tie.id" class="tie-card">
                <div class="tie">
                  <span class="tie-n">{{ ti + 1 }}</span>
                  <span class="tside" :class="{ slot: !tie.home }" :title="!tie.home ? 'Rótulo (slot) — será preenchido pelo Resolver' : undefined">
                    <template v-if="tie.home">
                      <TeamBadge :team="teamById(tie.home.id)" :size="16" />
                      <span :title="tie.home.name">{{ tie.home.name }}</span>
                    </template>
                    <template v-else>
                      <svg class="slot-i" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in SLOT" :key="i" :d="d" /></svg>
                      <span>{{ tie.homeSourceLabel ?? 'A definir' }}</span>
                    </template>
                  </span>
                  <span class="vs">×</span>
                  <span class="tside away" :class="{ slot: !tie.away }" :title="!tie.away ? 'Rótulo (slot) — será preenchido pelo Resolver' : undefined">
                    <template v-if="tie.away">
                      <TeamBadge :team="teamById(tie.away.id)" :size="16" />
                      <span :title="tie.away.name">{{ tie.away.name }}</span>
                    </template>
                    <template v-else>
                      <svg class="slot-i" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in SLOT" :key="i" :d="d" /></svg>
                      <span>{{ tie.awaySourceLabel ?? 'A definir' }}</span>
                    </template>
                  </span>
                  <button class="ic del xs2 tie-del" title="Excluir confronto" @click="delTie(tie.id)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
                </div>

                <!-- jogos do confronto (ida/volta) -->
                <div class="tie-legs">
                  <div v-for="m in tieMatches(r, tie.id)" :key="m.id" class="leg">
                    <span v-if="r.legs >= 2" class="leg-n">{{ m.leg }}º jogo</span>
                    <span class="leg-sc font-numeric">{{ m.status === 'SCHEDULED' ? '–' : `${m.homeScore ?? 0}-${m.awayScore ?? 0}` }}</span>
                    <span v-if="m.status !== 'SCHEDULED'" class="m-st" :class="m.status.toLowerCase()">{{ STATUS_LABEL[m.status] }}</span>
                    <input class="input xs m-dt" type="datetime-local" :value="utcToZonedInput(m.kickoffAt, tz)" @change="patchKickoff(m, ($event.target as HTMLInputElement).value)" />
                    <select class="input xs m-stad" title="Estádio" :value="m.stadiumId ?? ''" @change="patchStadium(m, ($event.target as HTMLSelectElement).value)">
                      <option value="">Sem estádio</option>
                      <option v-for="s in stadiums" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                    <button class="ic del xs2" title="Excluir jogo" @click="delMatch(m)"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path v-for="(d, i) in TRASH" :key="i" :d="d" /></svg></button>
                  </div>
                  <div v-if="tieMatches(r, tie.id).length < r.legs" class="leg-add">
                    <input v-model="kmd(tie.id).kickoff" class="input sm" type="datetime-local" />
                    <select v-model="kmd(tie.id).stadiumId" class="input sm">
                      <option value="">Estádio (opcional)…</option>
                      <option v-for="s in stadiums" :key="s.id" :value="s.id">{{ s.name }} · {{ s.city }}</option>
                    </select>
                    <button class="btn xs btn-primary" @click="addTieMatch(st, r, tie)">+ {{ r.legs >= 2 ? (tieMatches(r, tie.id).length === 0 ? 'Jogo de ida' : 'Jogo de volta') : 'Jogo' }}</button>
                  </div>
                  <p v-else-if="!tieMatches(r, tie.id).length" class="ties-empty">Sem jogo ainda.</p>
                </div>
              </div>
              <p v-if="!(tiesByRound.get(r.id) ?? []).length" class="ties-empty">Nenhum confronto nesta rodada.</p>

              <div class="tie-add">
                <div class="ta-title">+ Novo confronto</div>
                <div class="ta-grid">
                  <div class="ta-side">
                    <div class="seg2">
                      <button type="button" :class="{ on: tieDraft(r.id).homeMode === 'team' }" @click="tieDraft(r.id).homeMode = 'team'">Time</button>
                      <button type="button" :class="{ on: tieDraft(r.id).homeMode === 'slot' }" @click="tieDraft(r.id).homeMode = 'slot'">Rótulo</button>
                    </div>
                    <TeamPicker v-if="tieDraft(r.id).homeMode === 'team'" v-model="tieDraft(r.id).home" placeholder="buscar time…" />
                    <input v-else v-model="tieDraft(r.id).homeLabel" class="input sm" placeholder="ex.: 1º Grupo A" />
                  </div>
                  <span class="vs">×</span>
                  <div class="ta-side">
                    <div class="seg2">
                      <button type="button" :class="{ on: tieDraft(r.id).awayMode === 'team' }" @click="tieDraft(r.id).awayMode = 'team'">Time</button>
                      <button type="button" :class="{ on: tieDraft(r.id).awayMode === 'slot' }" @click="tieDraft(r.id).awayMode = 'slot'">Rótulo</button>
                    </div>
                    <TeamPicker v-if="tieDraft(r.id).awayMode === 'team'" v-model="tieDraft(r.id).away" placeholder="buscar time…" />
                    <input v-else v-model="tieDraft(r.id).awayLabel" class="input sm" placeholder="ex.: 2º Grupo B" />
                  </div>
                  <button class="btn xs btn-primary ta-add" @click="addTie(r.id)">+ Adicionar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <AppModal v-if="helpOpen" title="Como usar a Estrutura" @close="helpOpen = false">
      <div class="help">
        <p class="help-lead">
          Aqui você monta o torneio em camadas: <b>Fases</b> → cada fase é de <b>Grupos</b> /
          <b>Pontos corridos</b> (com times) ou de <b>Mata-mata</b> (com rodadas e confrontos).
        </p>

        <h4>✅ O que é automático</h4>
        <ul>
          <li><b>Placares:</b> o robô (ESPN) atualiza ao vivo e finaliza os jogos — você não digita placar aqui.</li>
          <li><b>Classificação dos grupos:</b> calculada sozinha a partir dos resultados (pontos, saldo, etc.).</li>
          <li><b>Preenchimento das chaves:</b> ao terminar os jogos, o botão <b>“Resolver slots”</b> (também roda sozinho quando um jogo finaliza) troca os <b>rótulos</b> — “Vencedor Jogo 73”, “1º Grupo A” — pelos times reais, em cascata.</li>
          <li><b>Melhores 3º colocados:</b> definidos automaticamente quando <b>toda</b> a fase de grupos terminar (regra do Anexo C da FIFA — 8 dos 12 terceiros).</li>
        </ul>

        <h4>✋ O que é manual</h4>
        <ul>
          <li>Criar / editar / excluir <b>fases</b>, <b>grupos</b>, <b>rodadas</b> e <b>confrontos</b>.</li>
          <li><b>Jogos:</b> cada rodada (e cada confronto do mata-mata) lista seus jogos. Adicione um jogo escolhendo o grupo e os dois times (ou pela ida/volta do confronto) e <b>defina o horário</b> — o placar/status vêm do robô.</li>
          <li>Distribuir os <b>times nos grupos</b> (busque por nome, sigla ou abreviação).</li>
          <li>Definir cada confronto: por <b>time</b> direto ou por <b>rótulo</b> (slot a preencher depois).</li>
          <li><b>Override:</b> se a resolução automática não decidir (empate, jogo pendente), ajuste na mão.</li>
        </ul>

        <h4>💡 Casos específicos</h4>
        <ul>
          <li><b>Rótulo (slot):</b> use quando o time ainda não existe — ex.: “1º Grupo A”, “Vencedor Jogo 73”. O Resolver troca pelo time certo.</li>
          <li><b>Ida e volta:</b> campo <b>“Jogos”</b> da rodada (1 = jogo único, 2 = ida/volta).</li>
          <li><b>Desempate:</b> escolha o preset por fase de grupos (FIFA, UEFA, Conmebol, Brasileirão…).</li>
          <li><b>3º colocados:</b> marque a opção na fase de grupos para considerar os melhores terceiros na classificação.</li>
        </ul>

        <h4>⚠️ Cuidados</h4>
        <ul>
          <li><b>Salve a fase:</b> mudanças de nome, formato, desempate e 3º só valem após “Salvar fase”.</li>
          <li><b>Excluir cascateia:</b> apagar uma fase apaga todos os grupos / rodadas / confrontos dentro dela.</li>
          <li><b>Trocar o formato</b> (Grupos ↔ Mata-mata) muda o corpo da fase — salve para confirmar.</li>
          <li><b>Cartões / disciplinar:</b> não armazenamos cartões. No <b>empate exato</b> entre terceiros (que a FIFA desempata por fair-play), o sistema não decide sozinho — confira e ajuste manualmente.</li>
        </ul>
      </div>
      <template #footer>
        <button class="btn btn-primary" @click="helpOpen = false">Entendi</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; margin-bottom: 18px; }
.tb-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.tb-lbl { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.tb-field .input { min-width: 280px; }
.tb-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.resolve-wrap { display: inline-flex; align-items: center; gap: 6px; }
.help-btn { display: inline-flex; align-items: center; gap: 6px; }
.help { font-size: var(--fs-sm); line-height: 1.55; color: var(--text); }
.help-lead { margin: 0 0 14px; color: var(--muted); }
.help h4 { font-size: var(--fs-sm); font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; margin: 16px 0 7px; }
.help ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.help li { color: var(--muted); }
.help b { color: var(--text); font-weight: 700; }
.input.sm { height: 38px; font-size: var(--fs-sm); padding: 0 12px; line-height: normal; }
.btn.xs { height: 34px; padding: 0 13px; font-size: var(--fs-xs); }
.primary-ghost { border-color: color-mix(in srgb, var(--emerald) 55%, var(--border)); color: var(--emerald); font-weight: 700; }

/* Empty state */
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 48px 24px; }
.empty-ic { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; color: var(--azure); background: color-mix(in srgb, var(--azure) 12%, transparent); }
.empty-t { font-size: var(--fs-xl); font-weight: 700; text-transform: uppercase; }
.empty-p { color: var(--muted); max-width: 460px; font-size: var(--fs-sm); line-height: 1.55; }
.empty-p b, .hint b { color: var(--text); }
.empty .btn { margin-top: 6px; }

/* Stage card */
.stages { display: flex; flex-direction: column; gap: 18px; }
.stage { --accent: var(--muted); background: var(--bg-surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 14px; box-shadow: var(--shadow); }
.fmt-group { --accent: var(--emerald); }
.fmt-league { --accent: var(--azure); }
.fmt-ko { --accent: var(--gold); }

.st-head { display: flex; gap: 14px; align-items: flex-start; padding: 15px 18px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--accent) 5%, var(--bg-surface)); border-radius: 13px 13px 0 0; }
.st-badge { width: 38px; height: 38px; border-radius: 11px; flex: none; display: grid; place-items: center; color: #fff; background: var(--accent); }
.st-main { flex: 1; min-width: 0; }
.st-row1 { display: flex; flex-direction: column; gap: 3px; margin-bottom: 11px; }
.st-tag { font-size: var(--fs-xs); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.st-name { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-xl); background: transparent; border: none; border-bottom: 1px dashed transparent; color: var(--text); padding: 2px 0; width: 100%; }
.st-name:hover { border-bottom-color: var(--border); }
.st-name:focus { outline: none; border-bottom-color: var(--accent); }
.st-controls { display: flex; flex-wrap: wrap; gap: 14px 18px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field.inline { flex-direction: row; align-items: center; gap: 8px; }
.st-controls .field .input.sm { min-width: 165px; }
.field-lbl { font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.chk-field .chk { display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-sm); font-weight: 600; height: 34px; }
.st-actions { display: flex; align-items: center; gap: 8px; flex: none; }

/* Section heads */
.body { padding: 16px 18px 18px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: var(--fs-sm); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
.count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 7px; background: var(--bg-base); border: 1px solid var(--border); font-size: var(--fs-xs); color: var(--muted); font-weight: 700; }
.hint { font-size: var(--fs-xs); color: var(--muted); line-height: 1.5; margin: 0 0 12px; }
.hint-empty { font-size: var(--fs-xs); color: var(--muted); padding: 14px; background: var(--bg-base); border: 1px dashed var(--border); border-radius: 10px; text-align: center; margin: 0; }

/* Groups */
/* Até 4 grupos por linha — evita linhas lotadas com nomes longos. */
.groups-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 1180px) { .groups-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 860px) { .groups-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .groups-grid { grid-template-columns: 1fr; } }
.group { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; padding: 11px; background: var(--bg-base); }
.g-add { margin-top: auto; padding-top: 2px; }
.g-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.g-name { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: var(--fs-sm); text-transform: uppercase; }
.g-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--emerald) 16%, transparent); color: var(--emerald); font-size: var(--fs-xs); font-weight: 800; }
.g-head .ic { margin-left: auto; }
.team-list { list-style: none; display: flex; flex-direction: column; gap: 5px; margin: 0 0 9px; padding: 0; }
.tchip { display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 4px 6px 4px 7px; }
.tchip-nm { font-size: var(--fs-xs); font-weight: 700; flex: 1; min-width: 0; line-height: 1.25; }
.tchip-x { border: none; background: none; color: var(--muted); cursor: pointer; font-size: var(--fs-base); line-height: 1; width: 22px; height: 22px; border-radius: 6px; flex: none; }
.tchip-x:hover { color: var(--scarlet); background: color-mix(in srgb, var(--scarlet) 12%, transparent); }
.g-empty { font-size: var(--fs-xs); color: var(--muted); padding: 6px 0 9px; }
.add-team { width: 100%; }

/* Rounds & ties */
.round { border: 1px solid var(--border); border-radius: 12px; padding: 13px 13px 14px; margin-bottom: 18px; background: var(--bg-base); }
.round:last-child { margin-bottom: 0; }
.r-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
.r-name { flex: 1; min-width: 160px; font-weight: 700; }
.r-count { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-xs); color: var(--muted); font-weight: 600; margin-left: auto; }
.ties { display: flex; flex-direction: column; gap: 6px; }
.tie { display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 6px 8px; }
.tie-n { width: 22px; height: 22px; flex: none; display: grid; place-items: center; border-radius: 6px; background: var(--bg-base); border: 1px solid var(--border); font-size: var(--fs-xs); font-weight: 800; color: var(--muted); }
.tside { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); font-weight: 700; min-width: 0; flex: 1; }
.tside.away { justify-content: flex-end; }
.tside.slot { color: var(--muted); font-weight: 600; }
.tside.slot .slot-i { color: var(--gold); }
.tside > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vs { color: var(--muted); font-weight: 800; font-size: var(--fs-xs); flex: none; }
.ties-empty { font-size: var(--fs-xs); color: var(--muted); padding: 4px 2px; margin: 0; }
.tie-del { margin-left: 2px; }

/* Add tie */
.tie-add { margin-top: 8px; padding: 11px; border: 1px dashed var(--border); border-radius: 10px; background: var(--bg-surface); }
.ta-title { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 10px; }
.ta-grid { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.ta-side { display: flex; flex-direction: column; gap: 6px; min-width: 190px; flex: 1; }
.seg2 { display: inline-flex; background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px; padding: 2px; gap: 2px; width: max-content; }
.seg2 button { border: none; background: transparent; color: var(--muted); font: inherit; font-size: var(--fs-xs); font-weight: 700; padding: 4px 12px; border-radius: 6px; cursor: pointer; }
.seg2 button.on { background: var(--accent); color: #fff; }
.ta-grid .vs { align-self: center; padding-bottom: 8px; }
.ta-add { flex: none; }

/* Rodadas (grupo) + jogos */
.rounds-block { margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--border); }
.matches { display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
.match { display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 6px 8px; flex-wrap: wrap; }
.m-grp { width: 24px; height: 22px; flex: none; display: grid; place-items: center; border-radius: 6px; background: color-mix(in srgb, var(--emerald) 16%, transparent); color: var(--emerald); font-size: var(--fs-xs); font-weight: 800; }
.m-side { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); font-weight: 700; min-width: 0; flex: 1; }
.m-side.l { justify-content: flex-end; }
.m-nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.m-sc { font-size: var(--fs-sm); flex: none; color: var(--muted); min-width: 26px; text-align: center; }
.m-st { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 5px; padding: 2px 6px; flex: none; }
.m-st.live { color: #fff; background: var(--scarlet); }
.m-st.finished { color: var(--muted); border: 1px solid var(--border); }
.m-st.cancelled { color: var(--muted); border: 1px solid var(--border); text-decoration: line-through; }
.input.xs { height: 32px; font-size: var(--fs-xs); padding: 0 8px; width: auto; flex: none; }
.m-stad { max-width: 150px; }
.match-add { margin-top: 6px; padding: 10px; border: 1px dashed var(--border); border-radius: 10px; background: var(--bg-surface); }
.ma-title { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
.ma-grid { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ma-grid .input.sm { flex: 1; min-width: 130px; }
.ma-grid .vs { flex: none; }

/* Confronto (knockout) com jogos */
.tie-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 5px 9px 7px; }
.tie-card .tie { background: none; border: none; border-radius: 0; padding: 2px 0; }
.tie-legs { margin-top: 3px; padding-top: 6px; border-top: 1px dashed var(--border); display: flex; flex-direction: column; gap: 6px; }
.leg { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.leg-n { font-size: var(--fs-xs); font-weight: 800; text-transform: uppercase; color: var(--gold); flex: none; }
.leg-sc { font-size: var(--fs-sm); color: var(--muted); flex: none; min-width: 26px; text-align: center; }
.leg-add { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Icon buttons */
.ic { width: 30px; height: 30px; flex: none; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-surface); color: var(--muted); cursor: pointer; display: grid; place-items: center; }
.ic:hover { color: var(--text); }
.ic.del:hover { color: var(--scarlet); border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
.ic.xs2 { width: 26px; height: 26px; }

@media (max-width: 720px) {
  .st-head { flex-wrap: wrap; }
  .st-actions { width: 100%; justify-content: flex-end; }
  .ta-grid { flex-direction: column; align-items: stretch; }
  .ta-grid .vs { align-self: center; padding: 0; }
}
</style>
