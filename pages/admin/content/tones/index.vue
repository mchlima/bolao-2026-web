<script setup lang="ts">
import type { NewsTone } from '~/types/api';
import type { MenuItem } from '~/components/KebabMenu.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const { page, data, load } = useAdminList<NewsTone>('/admin/content/tones');

const COLS: AdminColumn[] = [
  { key: 'tone', label: 'Tom' },
  { key: 'version', label: 'Versão', align: 'end', mobileHide: true },
  { key: 'items', label: 'Itens', align: 'end', mobileHide: true },
  { key: 'active', label: 'Ativo' },
  { key: 'actions', label: '', align: 'end' },
];

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function toggleActive(t: NewsTone) {
  try {
    await useApi()(`/admin/content/tones/${t.id}`, { method: 'PATCH', body: { isActive: !t.isActive } });
    ui.toast('info', !t.isActive ? 'Tom ativado.' : 'Tom pausado.');
    await load();
  } catch (e) { err(e); }
}
async function remove(t: NewsTone) {
  const ok = await ui.confirm({
    title: 'Excluir tom',
    msg: `Excluir "${t.name}"? Itens já gerados mantêm o texto.`,
    confirmLabel: 'Excluir', danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/content/tones/${t.id}`, { method: 'DELETE' });
    ui.toast('info', 'Tom excluído.');
    await load();
  } catch (e) { err(e); }
}
function actionsFor(t: NewsTone): MenuItem[] {
  return [
    { key: 'edit', label: 'Editar', icon: 'edit', tone: 'azure', onSelect: () => navigateTo(`/admin/content/tones/${t.id}`) },
    { key: 'del', label: 'Excluir', icon: 'trash', tone: 'danger', onSelect: () => remove(t) },
  ];
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Tons"
      subtitle="As vozes editoriais da reescrita. Ao gerar uma matéria, o robô usa o tom padrão do feed (ou um tom escolhido no próprio item). Editar um tom cria uma nova versão — textos já gerados mantêm a voz antiga. Pause um tom pelo toggle para tirá-lo de uso sem apagar."
    >
      <template #actions>
        <NuxtLink to="/admin/content/tones/new" class="btn btn-primary">
          <AppIcon name="plus" :size="15" :stroke="2.4" /> Novo tom
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <AdminTable
        :columns="COLS"
        :rows="data?.data"
        grid="minmax(0,1.7fr) 90px 80px 64px auto"
        empty="Nenhum tom cadastrado."
        empty-icon="list"
      >
        <template #col-tone="{ row }">
          <div class="tinfo">
            <span class="tname">{{ row.name }}</span>
            <span class="tdesc">{{ row.description ?? '—' }}</span>
          </div>
        </template>
        <template #col-version="{ row }"><span class="muted-txt">v{{ row.version }}</span></template>
        <template #col-items="{ row }"><span class="muted-txt">{{ row._count?.items ?? 0 }}</span></template>
        <template #col-active="{ row }">
          <ToggleSwitch :on="row.isActive" @toggle="toggleActive(row)" />
        </template>
        <template #col-actions="{ row }">
          <div class="acts"><KebabMenu :items="actionsFor(row)" :size="30" /></div>
        </template>
      </AdminTable>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>
  </div>
</template>

<style scoped>
.tinfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tname { font-weight: 700; font-size: 14px; }
.tdesc { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.muted-txt { font-size: 12.5px; color: var(--muted); font-weight: 600; }
.acts { display: flex; justify-content: flex-end; }
</style>
