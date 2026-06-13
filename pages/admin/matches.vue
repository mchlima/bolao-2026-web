<script setup lang="ts">
import type { Match, Paginated, Stadium, Team, Tournament } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const route = useRoute();
const tz = useTz();
const tzShort = computed(() =>
  tz.value === 'UTC' ? 'UTC' : (tz.value.split('/').pop() ?? tz.value).replace(/_/g, ' '),
);

const tournamentFilter = ref('');
const statusFilter = ref('');
const { page, search, data, load } = useAdminList<Match>('/matches', () => {
  const parts: string[] = [];
  if (tournamentFilter.value) parts.push(`seasonId=${tournamentFilter.value}`);
  if (statusFilter.value) parts.push(`status=${statusFilter.value}`);
  return parts.join('&');
});
watch([tournamentFilter, statusFilter], () => { page.value = 1; load(); });

// option lists for the form
const tournaments = ref<Tournament[]>([]);
const teams = ref<Team[]>([]);
const stadiums = ref<Stadium[]>([]);
async function loadOptions() {
  const api = useApi();
  const [tt, s1, s2, s3, st] = await Promise.all([
    api<Paginated<Tournament>>('/seasons?pageSize=100'),
    api<Paginated<Team>>('/teams?page=1&pageSize=100'),
    api<Paginated<Team>>('/teams?page=2&pageSize=100'),
    api<Paginated<Team>>('/teams?page=3&pageSize=100'),
    api<Paginated<Stadium>>('/stadiums?pageSize=100'),
  ]);
  tournaments.value = tt.data;
  teams.value = [...s1.data, ...s2.data, ...s3.data].sort((a, b) => a.name.localeCompare(b.name));
  stadiums.value = st.data;
}

const STATUS = ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'] as const;
const STATUS_LABEL: Record<string, string> = { SCHEDULED: 'Agendada', LIVE: 'Ao vivo', FINISHED: 'Encerrada', CANCELLED: 'Cancelada' };
const STATUS_TONE: Record<string, 'azure' | 'scarlet' | 'neutral'> = { SCHEDULED: 'azure', LIVE: 'scarlet', FINISHED: 'neutral', CANCELLED: 'neutral' };

const COLS: AdminColumn[] = [
  { key: 'match', label: 'Partida' },
  { key: 'when', label: 'Fase · Data' },
  { key: 'stadium', label: 'Estádio', mobileHide: true },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Ações', align: 'end' },
];

const modalOpen = ref(false);
const editing = ref<Match | null>(null);
const form = reactive<Record<string, string>>({
  seasonId: '', homeTeamId: '', awayTeamId: '', stadiumId: '',
  kickoffAt: '', phaseLabel: '', groupName: '', matchNumber: '', status: 'SCHEDULED',
  homeScore: '', awayScore: '',
});
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, { seasonId: tournaments.value[0]?.id ?? '', homeTeamId: '', awayTeamId: '', stadiumId: '', kickoffAt: '', phaseLabel: '', groupName: '', matchNumber: '', status: 'SCHEDULED', homeScore: '', awayScore: '' });
  modalOpen.value = true;
}
function openEdit(m: Match) {
  editing.value = m;
  Object.assign(form, {
    seasonId: m.seasonId, homeTeamId: m.homeTeam?.id ?? '', awayTeamId: m.awayTeam?.id ?? '',
    stadiumId: m.stadium?.id ?? '', kickoffAt: utcToZonedInput(m.kickoffAt, tz.value), phaseLabel: m.phaseLabel ?? '',
    groupName: m.groupName ?? '', matchNumber: m.matchNumber?.toString() ?? '', status: m.status,
    homeScore: m.homeScore?.toString() ?? '', awayScore: m.awayScore?.toString() ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.seasonId) return ui.toast('error', 'Selecione o torneio');
  if (!form.kickoffAt) return ui.toast('error', 'Informe a data/hora');
  saving.value = true;
  const body: Record<string, unknown> = {
    seasonId: form.seasonId,
    homeTeamId: form.homeTeamId || undefined,
    awayTeamId: form.awayTeamId || undefined,
    stadiumId: form.stadiumId || undefined,
    kickoffAt: zonedInputToUtc(form.kickoffAt, tz.value),
    phaseLabel: form.phaseLabel || undefined,
    groupName: form.groupName || undefined,
    matchNumber: form.matchNumber ? Number(form.matchNumber) : undefined,
    status: form.status,
    homeScore: form.homeScore === '' ? undefined : Number(form.homeScore),
    awayScore: form.awayScore === '' ? undefined : Number(form.awayScore),
  };
  try {
    if (editing.value) {
      await useApi()(`/admin/matches/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Partida atualizada');
    } else {
      await useApi()('/admin/matches', { method: 'POST', body });
      ui.toast('success', 'Partida cadastrada');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(m: Match) {
  const ok = await ui.confirm({ title: 'Excluir partida', msg: 'Excluir esta partida? Os palpites associados serão removidos.', confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  try {
    await useApi()(`/admin/matches/${m.id}`, { method: 'DELETE' });
    ui.toast('error', 'Partida excluída');
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(async () => {
  await Promise.all([load(), loadOptions()]);
  if (route.query.new) openNew();
});
</script>

<template>
  <div>
    <AdminPageHeader title="Partidas" subtitle="Jogos do torneio — placar, status, estádio e horário.">
      <template #actions>
        <button class="btn btn-primary" @click="openNew"><AppIcon name="plus" :size="16" :stroke="2.4" />Nova partida</button>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <div class="adm-filters mb">
        <select v-model="tournamentFilter" class="input">
          <option value="">Todos os torneios</option>
          <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <select v-model="statusFilter" class="input">
          <option value="">Todos os status</option>
          <option v-for="s in STATUS" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
      </div>

      <AdminTable :columns="COLS" :rows="data?.data" grid="1.2fr 1.4fr 1fr 110px auto" empty="Nenhuma partida." empty-icon="ball">
        <template #col-match="{ row }">
          <span class="mt">
            <TeamBadge :team="row.homeTeam" :placeholder="row.homeSourceLabel" :size="22" />
            <span class="vs">{{ teamAbbr(row.homeTeam, row.homeSourceLabel) }} <b v-if="row.homeScore != null" class="scr">{{ row.homeScore }}-{{ row.awayScore }}</b><template v-else> × </template> {{ teamAbbr(row.awayTeam, row.awaySourceLabel) }}</span>
            <TeamBadge :team="row.awayTeam" :placeholder="row.awaySourceLabel" :size="22" />
          </span>
        </template>
        <template #col-when="{ row }">
          <span class="dt">{{ row.phaseLabel }}<template v-if="row.groupName"> {{ row.groupName }}</template> · {{ formatKickoff(row.kickoffAt, tz) }}</span>
        </template>
        <template #col-stadium="{ row }"><span class="vn">{{ row.stadium?.name ?? '—' }}</span></template>
        <template #col-status="{ row }">
          <NuxtLink v-if="row.status === 'LIVE'" to="/admin/live"><StatusPill :label="STATUS_LABEL[row.status]" tone="scarlet" live /></NuxtLink>
          <StatusPill v-else :label="STATUS_LABEL[row.status]" :tone="STATUS_TONE[row.status]" />
        </template>
        <template #col-actions="{ row }">
          <div class="acts">
            <IconButton icon="edit" label="Editar" :size="30" @click="openEdit(row)" />
            <IconButton icon="trash" label="Excluir" tone="danger" :size="30" @click="remove(row)" />
          </div>
        </template>
      </AdminTable>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar partida' : 'Nova partida'" wide @close="modalOpen = false">
      <div class="adm-form">
        <label>Torneio</label>
        <select v-model="form.seasonId" class="input">
          <option v-for="t in tournaments" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <div class="fld2">
          <div><label>Mandante</label>
            <select v-model="form.homeTeamId" class="input"><option value="">A definir</option><option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option></select>
          </div>
          <div><label>Visitante</label>
            <select v-model="form.awayTeamId" class="input"><option value="">A definir</option><option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option></select>
          </div>
        </div>
        <label>Estádio</label>
        <select v-model="form.stadiumId" class="input"><option value="">—</option><option v-for="s in stadiums" :key="s.id" :value="s.id">{{ s.name }} · {{ s.city }}</option></select>
        <label>Data e hora <span class="tzhint">(fuso: {{ tzShort }})</span></label>
        <input v-model="form.kickoffAt" type="datetime-local" class="input" />
        <div class="fld3">
          <div><label>Fase</label><input v-model="form.phaseLabel" class="input" placeholder="Fase de Grupos" /></div>
          <div><label>Grupo</label><input v-model="form.groupName" class="input" placeholder="A" maxlength="8" /></div>
          <div><label>Nº</label><input v-model="form.matchNumber" type="number" class="input" /></div>
        </div>
        <div class="fld3">
          <div><label>Status</label><select v-model="form.status" class="input"><option v-for="s in STATUS" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option></select></div>
          <div><label>Placar mandante</label><input v-model="form.homeScore" type="number" min="0" class="input" /></div>
          <div><label>Placar visitante</label><input v-model="form.awayScore" type="number" min="0" class="input" /></div>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">{{ editing ? 'Salvar' : 'Criar' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.mb { margin-bottom: 14px; }
.mt { display: flex; align-items: center; gap: 7px; min-width: 0; }
.vs { font-weight: 700; font-size: 12.5px; white-space: nowrap; }
.dt, .vn { font-size: 11.5px; color: var(--muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
.tzhint { font-weight: 600; text-transform: none; color: var(--muted); }
</style>
