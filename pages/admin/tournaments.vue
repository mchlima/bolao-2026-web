<script setup lang="ts">
import type { Competition, Paginated, SeasonFormat, Tournament } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const route = useRoute();
const { page, search, data, load } = useAdminList<Tournament>('/seasons');

// Competitions to bind a season to (a season is one edition of a competition).
const competitions = ref<Competition[]>([]);
onMounted(async () => {
  competitions.value = (
    await useApi()<Paginated<Competition>>('/competitions?pageSize=100')
  ).data;
});

const STATUS = ['DRAFT', 'UPCOMING', 'ONGOING', 'FINISHED'] as const;
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  UPCOMING: 'Em breve',
  ONGOING: 'Em andamento',
  FINISHED: 'Encerrado',
};
const FORMATS: { v: SeasonFormat; l: string }[] = [
  { v: 'LEAGUE', l: 'Pontos corridos' },
  { v: 'GROUPS', l: 'Apenas grupos' },
  { v: 'KNOCKOUT', l: 'Apenas mata-mata' },
  { v: 'GROUPS_KNOCKOUT', l: 'Grupos + mata-mata' },
];

function badge(name: string): string {
  const w = name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
}

const COLS: AdminColumn[] = [
  { key: 'name', label: 'Torneio' },
  { key: 'period', label: 'Período' },
  { key: 'matches', label: 'Partidas' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Ações', align: 'end' },
];
const STATUS_TONE: Record<string, 'neutral' | 'azure' | 'emerald' | 'gold'> = {
  DRAFT: 'neutral', UPCOMING: 'azure', ONGOING: 'emerald', FINISHED: 'gold',
};

const modalOpen = ref(false);
const editing = ref<Tournament | null>(null);
const form = reactive({
  competitionId: '',
  name: '',
  seasonLabel: '',
  format: 'GROUPS_KNOCKOUT' as SeasonFormat,
  status: 'DRAFT' as string,
  startDate: '',
  endDate: '',
  logoUrl: '',
});
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, {
    competitionId: competitions.value[0]?.id ?? '', name: '', seasonLabel: '',
    format: 'GROUPS_KNOCKOUT', status: 'DRAFT', startDate: '', endDate: '', logoUrl: '',
  });
  modalOpen.value = true;
}
function openEdit(t: Tournament) {
  editing.value = t;
  Object.assign(form, {
    competitionId: t.competition?.id ?? '',
    name: t.name,
    seasonLabel: t.seasonLabel ?? '',
    format: t.format ?? 'GROUPS_KNOCKOUT',
    status: t.status,
    startDate: t.startDate?.slice(0, 10) ?? '',
    endDate: t.endDate?.slice(0, 10) ?? '',
    logoUrl: t.logoUrl ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) return ui.toast('error', 'Informe o nome do torneio');
  if (!form.competitionId) return ui.toast('error', 'Selecione a competição');
  saving.value = true;
  const body: Record<string, unknown> = {
    competitionId: form.competitionId,
    name: form.name,
    seasonLabel: form.seasonLabel || undefined,
    format: form.format,
    status: form.status,
    logoUrl: form.logoUrl || undefined,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
  };
  try {
    if (editing.value) {
      await useApi()(`/admin/seasons/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Torneio atualizado');
    } else {
      await useApi()('/admin/seasons', { method: 'POST', body });
      ui.toast('success', 'Torneio criado com sucesso');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(t: Tournament) {
  const ok = await ui.confirm({
    title: 'Excluir torneio',
    msg: `Excluir "${t.name}"? Partidas e palpites associados serão removidos.`,
    confirmLabel: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/seasons/${t.id}`, { method: 'DELETE' });
    ui.toast('error', `Torneio "${t.name}" excluído`);
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(() => {
  load();
  if (route.query.new) openNew();
});
</script>

<template>
  <div>
    <AdminPageHeader title="Torneios" subtitle="Edições (temporadas) de uma competição — ex.: Copa do Mundo FIFA 2026.">
      <template #actions>
        <button class="btn btn-primary" @click="openNew"><AppIcon name="plus" :size="16" :stroke="2.4" />Novo torneio</button>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <AdminSearchBar v-model="search" placeholder="Buscar torneio…" class="mb" />

      <AdminTable :columns="COLS" :rows="data?.data" grid="minmax(0,1fr) 200px 130px 120px auto" empty="Nenhum torneio." empty-icon="calendar">
        <template #col-name="{ row }">
          <span class="tn">
            <span class="logo">
              <img v-if="row.logoUrl" :src="row.logoUrl" :alt="row.name" />
              <span v-else class="logo-fb font-display">{{ badge(row.name) }}</span>
            </span>
            <span class="nm">{{ row.name }}</span>
          </span>
        </template>
        <template #col-period="{ row }">
          <span class="dt">{{ row.startDate ? formatDate(row.startDate, 'UTC') : '—' }}<template v-if="row.endDate"> → {{ formatDate(row.endDate, 'UTC') }}</template></span>
        </template>
        <template #col-matches="{ row }"><span class="mc"><b class="font-numeric">{{ row.matchCount ?? 0 }}</b> partida(s)</span></template>
        <template #col-status="{ row }"><StatusPill :label="STATUS_LABEL[row.status] ?? row.status" :tone="STATUS_TONE[row.status] ?? 'neutral'" soft /></template>
        <template #col-actions="{ row }">
          <div class="acts">
            <IconButton icon="edit" label="Editar" @click="openEdit(row)" />
            <IconButton icon="trash" label="Excluir" tone="danger" @click="remove(row)" />
          </div>
        </template>
      </AdminTable>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar torneio' : 'Novo torneio'" @close="modalOpen = false">
      <div class="adm-form">
        <label>Competição</label>
        <select v-model="form.competitionId" class="input">
          <option value="" disabled>Selecione…</option>
          <option v-for="c in competitions" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <label>Nome (edição)</label>
        <input v-model="form.name" class="input" placeholder="Copa do Mundo FIFA 2026" />
        <div class="fld2">
          <div><label>Rótulo da edição</label><input v-model="form.seasonLabel" class="input" placeholder="2026" /></div>
          <div>
            <label>Formato</label>
            <select v-model="form.format" class="input">
              <option v-for="f in FORMATS" :key="f.v" :value="f.v">{{ f.l }}</option>
            </select>
          </div>
        </div>
        <label>Status</label>
        <select v-model="form.status" class="input">
          <option v-for="s in STATUS" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
        </select>
        <div class="fld2">
          <div><label>Início</label><input v-model="form.startDate" type="date" class="input" /></div>
          <div><label>Fim</label><input v-model="form.endDate" type="date" class="input" /></div>
        </div>
        <label>Logo</label>
        <ImageUploadField v-model="form.logoUrl" prefix="tournaments" />
      </div>
      <template #footer>
        <button class="btn" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit">{{ editing ? 'Salvar' : 'Criar' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.mb {
  margin-bottom: 14px;
}
.tn {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}
.logo {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  flex: 0 0 auto;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--bg-base);
  border: 1px solid var(--border);
}
.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.logo-fb {
  font-weight: 700;
  font-size: 12px;
  color: var(--muted);
}
.nm {
  font-weight: 700;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dt {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.mc {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.mc b {
  color: var(--text);
  font-size: 14px;
  margin-right: 3px;
}
.acts {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}
</style>
