<script setup lang="ts">
import type { Stadium } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const { page, search, data, load } = useAdminList<Stadium>('/stadiums');

const COLS: AdminColumn[] = [
  { key: 'name', label: 'Estádio' },
  { key: 'local', label: 'Local' },
  { key: 'actions', label: 'Ações', align: 'end' },
];

const modalOpen = ref(false);
const editing = ref<Stadium | null>(null);
const form = reactive({ name: '', city: '', state: '', country: '' });
const saving = ref(false);

function openNew() {
  editing.value = null;
  Object.assign(form, { name: '', city: '', state: '', country: '' });
  modalOpen.value = true;
}
function openEdit(s: Stadium) {
  editing.value = s;
  Object.assign(form, { name: s.name, city: s.city, state: s.state ?? '', country: s.country });
  modalOpen.value = true;
}

async function submit() {
  if (!form.name.trim()) return ui.toast('error', 'Informe o nome do estádio');
  if (!form.city.trim() || !form.country.trim()) return ui.toast('error', 'Informe cidade e país');
  saving.value = true;
  const body = { name: form.name, city: form.city, state: form.state || undefined, country: form.country };
  try {
    if (editing.value) {
      await useApi()(`/admin/stadiums/${editing.value.id}`, { method: 'PATCH', body });
      ui.toast('success', 'Estádio atualizado');
    } else {
      await useApi()('/admin/stadiums', { method: 'POST', body });
      ui.toast('success', 'Estádio cadastrado');
    }
    modalOpen.value = false;
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao salvar');
  } finally {
    saving.value = false;
  }
}

async function remove(s: Stadium) {
  const ok = await ui.confirm({ title: 'Excluir estádio', msg: `Excluir "${s.name}"?`, confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  try {
    await useApi()(`/admin/stadiums/${s.id}`, { method: 'DELETE' });
    ui.toast('error', `Estádio "${s.name}" excluído`);
    await load();
  } catch (e) {
    ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro ao excluir');
  }
}

onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader title="Estádios" subtitle="Sedes das partidas — nome, cidade e país.">
      <template #actions>
        <button class="btn btn-primary" @click="openNew"><AppIcon name="plus" :size="16" :stroke="2.4" />Novo estádio</button>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <AdminSearchBar v-model="search" placeholder="Buscar estádio, cidade, país…" class="mb" />

      <AdminTable :columns="COLS" :rows="data?.data" grid="minmax(0,1fr) 1fr auto" empty="Nenhum estádio." empty-icon="stadium">
        <template #col-name="{ row }"><span class="nm">{{ row.name }}</span></template>
        <template #col-local="{ row }">
          <span class="loc">{{ row.city }}<template v-if="row.state">, {{ row.state }}</template> · {{ row.country }}</span>
        </template>
        <template #col-actions="{ row }">
          <div class="acts">
            <IconButton icon="edit" label="Editar" @click="openEdit(row)" />
            <IconButton icon="trash" label="Excluir" tone="danger" @click="remove(row)" />
          </div>
        </template>
      </AdminTable>

      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="modalOpen" :title="editing ? 'Editar estádio' : 'Novo estádio'" @close="modalOpen = false">
      <div class="adm-form">
        <label>Nome</label><input v-model="form.name" class="input" placeholder="Maracanã" />
        <div class="fld2">
          <div><label>Cidade</label><input v-model="form.city" class="input" /></div>
          <div><label>Estado/Região</label><input v-model="form.state" class="input" /></div>
        </div>
        <label>País</label><input v-model="form.country" class="input" placeholder="Brasil" />
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
.nm { font-weight: 700; font-size: 13.5px; }
.loc { font-size: 12.5px; color: var(--muted); font-weight: 600; }
.acts { display: flex; gap: 6px; justify-content: flex-end; }
</style>
