<script setup lang="ts">
import type { Competition, CompetitionType } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const { page, search, data, load } = useAdminList<Competition & { seasonCount?: number }>(
  '/competitions',
);

const TYPES: { v: CompetitionType; l: string }[] = [
  { v: 'LEAGUE', l: 'Liga (pontos corridos)' },
  { v: 'CUP', l: 'Copa (mata-mata)' },
  { v: 'LEAGUE_CUP', l: 'Grupos + mata-mata' },
];

const COLS: AdminColumn[] = [
  { key: 'name', label: 'Competição' },
  { key: 'type', label: 'Tipo' },
  { key: 'espn', label: 'ESPN slug', mobileHide: true },
  { key: 'seasons', label: 'Edições' },
  { key: 'actions', label: 'Ações', align: 'end' },
];

const modalOpen = ref(false);
const editing = ref<Competition | null>(null);
const form = reactive({
  name: '',
  slug: '',
  type: 'LEAGUE_CUP' as CompetitionType,
  country: '',
  confederation: '',
  espnLeagueSlug: '',
  logoUrl: '',
});
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, {
    name: '', slug: '', type: 'LEAGUE_CUP', country: '', confederation: '',
    espnLeagueSlug: '', logoUrl: '',
  });
  modalOpen.value = true;
}
function openEdit(c: Competition) {
  editing.value = c;
  Object.assign(form, {
    name: c.name, slug: c.slug, type: c.type, country: c.country ?? '',
    confederation: c.confederation ?? '', espnLeagueSlug: c.espnLeagueSlug ?? '',
    logoUrl: c.logoUrl ?? '',
  });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim() || !form.slug.trim())
    return ui.toast('error', 'Nome e slug são obrigatórios');
  saving.value = true;
  const body: Record<string, unknown> = {
    name: form.name,
    slug: form.slug,
    type: form.type,
    country: form.country || undefined,
    confederation: form.confederation || undefined,
    espnLeagueSlug: form.espnLeagueSlug || undefined,
    logoUrl: form.logoUrl || undefined,
  };
  try {
    if (editing.value) {
      await useApi()(`/admin/competitions/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Competição atualizada');
    } else {
      await useApi()('/admin/competitions', { method: 'POST', body });
      ui.toast('success', 'Competição criada');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(c: Competition) {
  const ok = await ui.confirm({
    title: 'Excluir competição',
    msg: `Excluir "${c.name}"? Só é possível se não houver edições (seasons) vinculadas.`,
    confirmLabel: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/competitions/${c.id}`, { method: 'DELETE' });
    ui.toast('error', `Competição "${c.name}" excluída`);
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader title="Competições">
      <template #subtitle>
        A competição é o torneio atemporal (ex.: "Copa do Mundo FIFA", "Brasileirão Série A").
        Guarda o <code>slug</code> e o <code>espnLeagueSlug</code> que o robô usa pra puxar placares.
      </template>
      <template #actions>
        <button class="btn btn-primary" @click="openNew"><AppIcon name="plus" :size="16" :stroke="2.4" />Nova competição</button>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <AdminSearchBar v-model="search" placeholder="Buscar competição…" class="mb" />

      <AdminTable :columns="COLS" :rows="data?.data" grid="minmax(0,1fr) 160px 150px 80px auto" :skeleton="6" empty="Nenhuma competição." empty-icon="trophy">
        <template #col-name="{ row }"><span class="nm">{{ row.name }} <code class="slug">{{ row.slug }}</code></span></template>
        <template #col-type="{ row }"><span class="muted">{{ TYPES.find((t) => t.v === row.type)?.l ?? row.type }}</span></template>
        <template #col-espn="{ row }"><span class="muted mono">{{ row.espnLeagueSlug || '—' }}</span></template>
        <template #col-seasons="{ row }"><span class="muted">{{ row.seasonCount ?? 0 }}</span></template>
        <template #col-actions="{ row }">
          <div class="acts">
            <IconButton icon="edit" label="Editar" @click="openEdit(row)" />
            <IconButton icon="trash" label="Excluir" tone="danger" @click="remove(row)" />
          </div>
        </template>
      </AdminTable>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar competição' : 'Nova competição'" @close="modalOpen = false">
      <div class="adm-form">
        <label>Nome</label>
        <input v-model="form.name" class="input" placeholder="Brasileirão Série A" />
        <label>Slug (chave interna)</label>
        <input v-model="form.slug" class="input mono" placeholder="bra.1" />
        <label>Tipo</label>
        <select v-model="form.type" class="input">
          <option v-for="t in TYPES" :key="t.v" :value="t.v">{{ t.l }}</option>
        </select>
        <div class="fld2">
          <div><label>País</label><input v-model="form.country" class="input" placeholder="Brasil" /></div>
          <div><label>Confederação</label><input v-model="form.confederation" class="input" placeholder="CBF" /></div>
        </div>
        <label>ESPN league slug (robô)</label>
        <input v-model="form.espnLeagueSlug" class="input mono" placeholder="bra.1 / fifa.world / conmebol.libertadores" />
        <label>Logo</label>
        <ImageUploadField v-model="form.logoUrl" prefix="competitions" />
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
.nm { font-weight: 700; font-size: 13.5px; min-width: 0; }
.slug { font-size: 11px; color: var(--muted); background: var(--bg-base); border-radius: 4px; padding: 1px 5px; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.muted { color: var(--muted); font-size: 12.5px; font-weight: 600; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
</style>
