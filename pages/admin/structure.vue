<script setup lang="ts">
import type {
  BracketStage,
  Paginated,
  StageFormat,
  Team,
  Tournament,
} from '~/types/api';

definePageMeta({ middleware: 'admin' });
const ui = useUiStore();
const api = useApi();

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
  teams.value = (await api<Paginated<Team>>('/teams?pageSize=2000')).data;
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
const newTie = reactive<Record<string, { home: string; away: string; homeLabel: string; awayLabel: string }>>({});
function tieDraft(roundId: string) {
  if (!newTie[roundId]) newTie[roundId] = { home: '', away: '', homeLabel: '', awayLabel: '' };
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
        homeTeamId: d.home || undefined,
        awayTeamId: d.away || undefined,
        homeSourceLabel: d.homeLabel || undefined,
        awaySourceLabel: d.awayLabel || undefined,
      },
    });
    newTie[roundId] = { home: '', away: '', homeLabel: '', awayLabel: '' };
    await loadStructure();
  } catch (e) { err(e); }
}
async function delTie(id: string) {
  try { await api(`/admin/structure/ties/${id}`, { method: 'DELETE' }); await loadStructure(); } catch (e) { err(e); }
}

async function resolve() {
  try { await api(`/admin/structure/seasons/${seasonId.value}/resolve`, { method: 'POST' }); ui.toast('success', 'Estrutura resolvida'); await loadStructure(); } catch (e) { err(e); }
}

const teamName = (id: string) => teams.value.find((t) => t.id === id)?.shortName ?? id;
</script>

<template>
  <AdminShell>
    <div class="card panel">
      <div class="p-head">
        <h3 class="font-display">Estrutura do torneio</h3>
        <div class="head-actions">
          <select v-model="seasonId" class="input sel">
            <option v-for="s in seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <button class="btn" :disabled="!seasonId" @click="resolve">↻ Resolver</button>
          <button class="btn btn-primary" :disabled="!seasonId" @click="struct && addStage()">+ Fase</button>
        </div>
      </div>
      <p class="hint">
        Monte a estrutura: fases (grupos / pontos corridos / mata-mata), grupos e seus times,
        rodadas e confrontos. "Resolver" preenche os slots TBD a partir dos resultados.
      </p>

      <SkeletonList v-if="loading && !struct" variant="row" :count="4" />
      <p v-else-if="!struct?.stages.length" class="muted empty">
        Nenhuma fase ainda. Clique em "+ Fase" para começar.
      </p>

      <div v-else class="stages">
        <section v-for="st in struct.stages" :key="st.id" class="stage">
          <header class="st-head">
            <input v-model="st.name" class="input nm" />
            <select v-model="st.format" class="input sm">
              <option v-for="f in FORMATS" :key="f.v" :value="f.v">{{ f.l }}</option>
            </select>
            <select v-model="st.tiebreakPreset" class="input sm" title="Critério de desempate">
              <option v-for="t in TIEBREAKS" :key="t" :value="t">{{ t }}</option>
            </select>
            <label class="chk"><input v-model="st.hasThirdPlace" type="checkbox" /> 3º lugar</label>
            <button class="btn xs" @click="saveStage(st)">Salvar</button>
            <button class="ic del" title="Excluir fase" @click="delStage(st)">🗑</button>
          </header>

          <!-- GROUP / LEAGUE: groups + teams -->
          <div v-if="st.format !== 'KNOCKOUT'" class="block">
            <div class="block-head">
              <span>Grupos</span>
              <button class="btn xs" @click="addGroup(st)">+ Grupo</button>
            </div>
            <div class="groups">
              <div v-for="g in st.groups" :key="g.id" class="group">
                <div class="g-head">
                  <b>Grupo {{ g.name }}</b>
                  <button class="ic del sm" @click="delGroup(g.id)">🗑</button>
                </div>
                <div class="chips">
                  <span v-for="gt in g.teams" :key="gt.team.id" class="chip">
                    {{ gt.team.shortName }}
                    <button @click="removeTeamFromGroup(g.id, g.teams.map((x) => x.team.id), gt.team.id)">×</button>
                  </span>
                </div>
                <select
                  class="input sm add-team"
                  @change="(e) => { addTeamToGroup(g.id, g.teams.map((x) => x.team.id), (e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }"
                >
                  <option value="">+ adicionar time…</option>
                  <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- KNOCKOUT: rounds + ties -->
          <div v-else class="block">
            <div class="block-head">
              <span>Fases (rodadas)</span>
              <button class="btn xs" @click="addRound(st)">+ Rodada</button>
            </div>
            <div v-for="r in st.rounds" :key="r.id" class="round">
              <div class="r-head">
                <input v-model="r.name" class="input sm" placeholder="Oitavas de final" />
                <label class="legs">Jogos:
                  <select v-model.number="r.legs" class="input xs2">
                    <option :value="1">1 (jogo único)</option>
                    <option :value="2">2 (ida/volta)</option>
                  </select>
                </label>
                <button class="btn xs" @click="saveRound(r)">Salvar</button>
                <button class="ic del sm" @click="delRound(r.id)">🗑</button>
              </div>
              <div class="ties">
                <div v-for="tie in tiesByRound.get(r.id) ?? []" :key="tie.id" class="tie-row">
                  <span class="ts">{{ tie.home?.shortName ?? tie.homeSourceLabel ?? '?' }}</span>
                  <span class="x">×</span>
                  <span class="ts">{{ tie.away?.shortName ?? tie.awaySourceLabel ?? '?' }}</span>
                  <button class="ic del sm" @click="delTie(tie.id)">🗑</button>
                </div>
                <div class="tie-add">
                  <select v-model="tieDraft(r.id).home" class="input xs2">
                    <option value="">time mandante…</option>
                    <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.shortName }}</option>
                  </select>
                  <input v-model="tieDraft(r.id).homeLabel" class="input xs2" placeholder="ou rótulo (Venc. Jogo X)" />
                  <span class="x">×</span>
                  <select v-model="tieDraft(r.id).away" class="input xs2">
                    <option value="">time visitante…</option>
                    <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.shortName }}</option>
                  </select>
                  <input v-model="tieDraft(r.id).awayLabel" class="input xs2" placeholder="ou rótulo" />
                  <button class="btn xs" @click="addTie(r.id)">+ Confronto</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </AdminShell>
</template>

<style scoped>
.panel { padding: 16px; }
.p-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.p-head h3 { font-weight: 600; font-size: 17px; text-transform: uppercase; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.sel { min-width: 200px; }
.hint { font-size: 12.5px; color: var(--muted); margin: 0 0 16px; }
.empty { padding: 24px; text-align: center; }
.stages { display: flex; flex-direction: column; gap: 16px; }
.stage { border: 1px solid var(--border); border-radius: 13px; padding: 12px; }
.st-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.st-head .nm { flex: 1; min-width: 160px; font-weight: 700; }
.input.sm { height: 34px; font-size: 13px; }
.input.xs2 { height: 32px; font-size: 12.5px; padding: 0 8px; min-width: 120px; }
.chk { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.btn.xs { height: 32px; padding: 0 12px; font-size: 12.5px; }
.block { border-top: 1px dashed var(--border); padding-top: 10px; }
.block-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 800; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; letter-spacing: 0.04em; }
.groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 10px; }
.group { border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
.g-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; min-height: 4px; }
.chip { display: inline-flex; align-items: center; gap: 5px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 999px; padding: 2px 4px 2px 9px; font-size: 12px; font-weight: 600; }
.chip button { border: none; background: none; color: var(--scarlet); cursor: pointer; font-size: 14px; line-height: 1; }
.add-team { width: 100%; }
.round { border: 1px solid var(--border); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
.r-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
.legs { font-size: 12px; color: var(--muted); font-weight: 600; display: flex; align-items: center; gap: 5px; }
.ties { display: flex; flex-direction: column; gap: 6px; }
.tie-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.tie-row .ts { font-weight: 600; min-width: 60px; }
.tie-add { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding-top: 6px; border-top: 1px dashed var(--border); }
.x { color: var(--muted); font-weight: 700; }
.ic { width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); cursor: pointer; }
.ic.del { color: var(--scarlet); }
.ic.sm { width: 26px; height: 26px; font-size: 12px; }
</style>
