<script setup lang="ts">
import type { Taxonomy } from '~/types/api';
import type { MenuItem } from '~/components/KebabMenu.vue';

const props = defineProps<{
  endpoint: string; // ex.: '/admin/content/tags'
  title: string;
  subtitle: string;
  singular: string; // ex.: 'tag'
}>();

const ui = useUiStore();
const { page, data, load } = useAdminList<Taxonomy>(props.endpoint);

const COLS: AdminColumn[] = [
  { key: 'name', label: props.singular === 'categoria' ? 'Categoria' : 'Tag' },
  { key: 'slug', label: 'Slug', mobileHide: true },
  { key: 'items', label: 'Matérias', align: 'end', mobileHide: true },
  { key: 'actions', label: '', align: 'end' },
];

const showForm = ref(false);
const editing = ref<Taxonomy | null>(null);
const form = reactive({ name: '', description: '' });
const saving = ref(false);

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
function openNew() {
  editing.value = null;
  form.name = '';
  form.description = '';
  showForm.value = true;
}
function openEdit(t: Taxonomy) {
  editing.value = t;
  form.name = t.name;
  form.description = t.description ?? '';
  showForm.value = true;
}
async function save() {
  if (!form.name.trim()) { ui.toast('error', 'Informe um nome.'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await useApi()(`${props.endpoint}/${editing.value.id}`, {
        method: 'PATCH',
        body: { name: form.name.trim(), description: form.description.trim() || null },
      });
      ui.toast('success', 'Salvo.');
    } else {
      await useApi()(props.endpoint, {
        method: 'POST',
        body: { name: form.name.trim(), description: form.description.trim() || undefined },
      });
      ui.toast('success', `${props.singular === 'categoria' ? 'Categoria criada' : 'Tag criada'}.`);
    }
    showForm.value = false;
    await load();
  } catch (e) { err(e); } finally { saving.value = false; }
}
async function remove(t: Taxonomy) {
  const n = t._count?.items ?? 0;
  const ok = await ui.confirm({
    title: `Excluir ${props.singular}`,
    msg: n
      ? `"${t.name}" está em ${n} matéria(s). Excluir só remove o vínculo — as matérias continuam.`
      : `Excluir "${t.name}"?`,
    confirmLabel: 'Excluir', danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`${props.endpoint}/${t.id}`, { method: 'DELETE' });
    ui.toast('info', 'Excluído.');
    await load();
  } catch (e) { err(e); }
}
function actionsFor(t: Taxonomy): MenuItem[] {
  return [
    { key: 'edit', label: 'Editar', icon: 'edit', tone: 'azure', onSelect: () => openEdit(t) },
    { key: 'del', label: 'Excluir', icon: 'trash', tone: 'danger', onSelect: () => remove(t) },
  ];
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader :title="title" :subtitle="subtitle">
      <template #actions>
        <button class="btn btn-primary" @click="openNew">
          <AppIcon name="plus" :size="15" :stroke="2.4" /> {{ singular === 'categoria' ? 'Nova categoria' : 'Nova tag' }}
        </button>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <AdminTable
        :columns="COLS"
        :rows="data?.data"
        grid="minmax(0,1.4fr) minmax(0,1fr) 90px auto"
        :empty="`Nenhuma ${singular} ainda. Elas surgem ao publicar matérias — ou crie aqui.`"
        empty-icon="list"
      >
        <template #col-name="{ row }">
          <div class="tx-info">
            <span class="tx-name">{{ row.name }}</span>
            <span v-if="row.description" class="tx-desc">{{ row.description }}</span>
          </div>
        </template>
        <template #col-slug="{ row }"><code class="tx-slug">{{ row.slug }}</code></template>
        <template #col-items="{ row }"><span class="muted-txt">{{ row._count?.items ?? 0 }}</span></template>
        <template #col-actions="{ row }">
          <div class="acts"><KebabMenu :items="actionsFor(row)" :size="30" /></div>
        </template>
      </AdminTable>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>

    <AppModal v-if="showForm" :title="editing ? `Editar ${singular}` : `Nova ${singular}`" @close="showForm = false">
      <label class="fl">Nome</label>
      <input v-model="form.name" class="input" :placeholder="singular === 'categoria' ? 'Ex.: Copa do Mundo' : 'Ex.: Neymar'" @keyup.enter="save" />
      <label class="fl">Descrição <span class="opt">(opcional — aparece na página pública)</span></label>
      <textarea v-model="form.description" class="input area" rows="2" />
      <p v-if="editing" class="slug-note">Slug: <code>{{ editing.slug }}</code> — fixo (não muda a URL pública).</p>
      <template #footer>
        <button class="btn" @click="showForm = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Salvando…' : 'Salvar' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.tx-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tx-name { font-weight: 700; font-size: 14px; }
.tx-desc { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-slug { font-size: 12px; color: var(--muted); font-family: ui-monospace, monospace; }
.muted-txt { font-size: 12.5px; color: var(--muted); font-weight: 600; }
.acts { display: flex; justify-content: flex-end; }
.fl { display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin: 12px 0 5px; }
.fl:first-child { margin-top: 0; }
.fl .opt { font-weight: 600; opacity: 0.7; }
.area { resize: vertical; }
.slug-note { font-size: 12px; color: var(--muted); margin: 10px 0 0; }
.slug-note code { font-family: ui-monospace, monospace; }
</style>
