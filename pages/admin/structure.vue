<script setup lang="ts">
import type {
  BracketStage,
  Paginated,
  StageFormat,
  Team,
  Tournament,
} from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const api = useApi();
const helpOpen = ref(false);

// Structure shape returned by GET /seasons/:id/structure (season + stages tree).
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
  rounds: {
    id: string;
    number: number | null;
    name: string | null;
    legs: number;
    order: number;
  }[];
}
interface StructSeason {
  id: string;
  name: string;
  stages: StructStage[];
}

const seasons = ref<Tournament[]>([]);
const teams = ref<Team[]>([]);
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
  await Promise.all([loadSeasons(), loadTeams()]);
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
              <div v-for="(tie, ti) in tiesByRound.get(r.id) ?? []" :key="tie.id" class="tie">
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
.tb-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.tb-field .input { min-width: 280px; }
.tb-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.resolve-wrap { display: inline-flex; align-items: center; gap: 6px; }
.help-btn { display: inline-flex; align-items: center; gap: 6px; }
.help { font-size: 13.5px; line-height: 1.55; color: var(--text); }
.help-lead { margin: 0 0 14px; color: var(--muted); }
.help h4 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; margin: 16px 0 7px; }
.help ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.help li { color: var(--muted); }
.help b { color: var(--text); font-weight: 700; }
.input.sm { height: 38px; font-size: 13.5px; padding: 0 12px; line-height: normal; }
.btn.xs { height: 34px; padding: 0 13px; font-size: 12.5px; }
.primary-ghost { border-color: color-mix(in srgb, var(--emerald) 55%, var(--border)); color: var(--emerald); font-weight: 700; }

/* Empty state */
.empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 48px 24px; }
.empty-ic { width: 64px; height: 64px; border-radius: 18px; display: grid; place-items: center; color: var(--azure); background: color-mix(in srgb, var(--azure) 12%, transparent); }
.empty-t { font-size: 20px; font-weight: 700; text-transform: uppercase; }
.empty-p { color: var(--muted); max-width: 460px; font-size: 14px; line-height: 1.55; }
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
.st-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.st-name { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 19px; background: transparent; border: none; border-bottom: 1px dashed transparent; color: var(--text); padding: 2px 0; width: 100%; }
.st-name:hover { border-bottom-color: var(--border); }
.st-name:focus { outline: none; border-bottom-color: var(--accent); }
.st-controls { display: flex; flex-wrap: wrap; gap: 14px 18px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field.inline { flex-direction: row; align-items: center; gap: 8px; }
.st-controls .field .input.sm { min-width: 165px; }
.field-lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); display: inline-flex; align-items: center; gap: 5px; }
.chk-field .chk { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; height: 34px; }
.st-actions { display: flex; align-items: center; gap: 8px; flex: none; }

/* Section heads */
.body { padding: 16px 18px 18px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
.count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 7px; background: var(--bg-base); border: 1px solid var(--border); font-size: 12px; color: var(--muted); font-weight: 700; }
.hint { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0 0 12px; }
.hint-empty { font-size: 12.5px; color: var(--muted); padding: 14px; background: var(--bg-base); border: 1px dashed var(--border); border-radius: 10px; text-align: center; margin: 0; }

/* Groups */
/* Até 4 grupos por linha — evita linhas lotadas com nomes longos. */
.groups-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 1180px) { .groups-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 860px) { .groups-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .groups-grid { grid-template-columns: 1fr; } }
.group { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; padding: 11px; background: var(--bg-base); }
.g-add { margin-top: auto; padding-top: 2px; }
.g-head { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.g-name { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 14px; text-transform: uppercase; }
.g-count { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: color-mix(in srgb, var(--emerald) 16%, transparent); color: var(--emerald); font-size: 11px; font-weight: 800; }
.g-head .ic { margin-left: auto; }
.team-list { list-style: none; display: flex; flex-direction: column; gap: 5px; margin: 0 0 9px; padding: 0; }
.tchip { display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 4px 6px 4px 7px; }
.tchip-nm { font-size: 12.5px; font-weight: 700; flex: 1; min-width: 0; line-height: 1.25; }
.tchip-x { border: none; background: none; color: var(--muted); cursor: pointer; font-size: 16px; line-height: 1; width: 22px; height: 22px; border-radius: 6px; flex: none; }
.tchip-x:hover { color: var(--scarlet); background: color-mix(in srgb, var(--scarlet) 12%, transparent); }
.g-empty { font-size: 12px; color: var(--muted); padding: 6px 0 9px; }
.add-team { width: 100%; }

/* Rounds & ties */
.round { border: 1px solid var(--border); border-radius: 12px; padding: 13px 13px 14px; margin-bottom: 18px; background: var(--bg-base); }
.round:last-child { margin-bottom: 0; }
.r-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
.r-name { flex: 1; min-width: 160px; font-weight: 700; }
.r-count { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--muted); font-weight: 600; margin-left: auto; }
.ties { display: flex; flex-direction: column; gap: 6px; }
.tie { display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 9px; padding: 6px 8px; }
.tie-n { width: 22px; height: 22px; flex: none; display: grid; place-items: center; border-radius: 6px; background: var(--bg-base); border: 1px solid var(--border); font-size: 11px; font-weight: 800; color: var(--muted); }
.tside { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; min-width: 0; flex: 1; }
.tside.away { justify-content: flex-end; }
.tside.slot { color: var(--muted); font-weight: 600; }
.tside.slot .slot-i { color: var(--gold); }
.tside > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vs { color: var(--muted); font-weight: 800; font-size: 12px; flex: none; }
.ties-empty { font-size: 12px; color: var(--muted); padding: 4px 2px; margin: 0; }
.tie-del { margin-left: 2px; }

/* Add tie */
.tie-add { margin-top: 8px; padding: 11px; border: 1px dashed var(--border); border-radius: 10px; background: var(--bg-surface); }
.ta-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 10px; }
.ta-grid { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.ta-side { display: flex; flex-direction: column; gap: 6px; min-width: 190px; flex: 1; }
.seg2 { display: inline-flex; background: var(--bg-base); border: 1px solid var(--border); border-radius: 8px; padding: 2px; gap: 2px; width: max-content; }
.seg2 button { border: none; background: transparent; color: var(--muted); font: inherit; font-size: 11.5px; font-weight: 700; padding: 4px 12px; border-radius: 6px; cursor: pointer; }
.seg2 button.on { background: var(--accent); color: #fff; }
.ta-grid .vs { align-self: center; padding-bottom: 8px; }
.ta-add { flex: none; }

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
