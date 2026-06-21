<script setup lang="ts">
import type { NewsFeed } from '~/types/api';
import type { MenuItem } from '~/components/KebabMenu.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const tz = useTz();
const { page, data, load } = useAdminList<NewsFeed>('/admin/content/feeds');

const COLS: AdminColumn[] = [
  { key: 'feed', label: 'Fonte' },
  { key: 'type', label: 'Tipo', mobileHide: true },
  { key: 'tone', label: 'Tom padrão', mobileHide: true },
  { key: 'health', label: 'Saúde' },
  { key: 'active', label: 'Ativo' },
  { key: 'items', label: 'Itens', align: 'end', mobileHide: true },
  { key: 'actions', label: '', align: 'end' },
];

const TYPE_LABEL: Record<string, string> = { RSS: 'RSS', NEWS_API: 'API', PAGE: 'Página', TOPIC: 'Pauta' };

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
function fmtWhen(iso: string | null): string {
  if (!iso) return 'nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz.value,
  }).format(new Date(iso));
}

async function fetchNow(f: NewsFeed) {
  try {
    const r = await useApi()<{ inserted: number }>(`/admin/content/feeds/${f.id}/fetch`, { method: 'POST' });
    if (r.inserted) ui.toast('success', `${r.inserted} novo(s) item(ns).`);
    else if (f.type === 'TOPIC') ui.toast('info', 'Busca feita, mas sem artigo novo/fresco — tente um assunto mais específico e domínios de notícia.');
    else ui.toast('info', 'Sem novidades agora.');
    await load();
  } catch (e) { err(e); }
}
async function remove(f: NewsFeed) {
  const ok = await ui.confirm({
    title: 'Excluir feed',
    msg: `Excluir "${f.name}"? Os itens já gerados continuam.`,
    confirmLabel: 'Excluir', danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/content/feeds/${f.id}`, { method: 'DELETE' });
    ui.toast('info', 'Feed excluído.');
    await load();
  } catch (e) { err(e); }
}
async function toggleActive(f: NewsFeed) {
  try {
    await useApi()(`/admin/content/feeds/${f.id}`, { method: 'PATCH', body: { isActive: !f.isActive } });
    ui.toast('info', !f.isActive ? 'Feed ativado.' : 'Feed pausado.');
    await load();
  } catch (e) { err(e); }
}
function actionsFor(f: NewsFeed): MenuItem[] {
  return [
    { key: 'edit', label: 'Editar', icon: 'edit', tone: 'azure', onSelect: () => navigateTo(`/admin/content/feeds/${f.id}`) },
    { key: 'fetch', label: 'Buscar agora', icon: 'refresh', tone: 'emerald', onSelect: () => fetchNow(f) },
    { key: 'del', label: 'Excluir', icon: 'trash', tone: 'danger', onSelect: () => remove(f) },
  ];
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Fontes"
      subtitle="De onde vêm as notícias: RSS, API de notícias ou crawl de página. O robô lê cada fonte ativa automaticamente (varre a cada ~5 min, respeitando o intervalo de cada uma), descarta o que for antigo e joga as novas na Triagem. Pause uma fonte pelo toggle, sem excluí-la."
    >
      <template #actions>
        <NuxtLink to="/admin/content/feeds/new" class="btn btn-primary">
          <AppIcon name="plus" :size="15" :stroke="2.4" /> Nova fonte
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <AdminTable
        :columns="COLS"
        :rows="data?.data"
        grid="minmax(0,1.4fr) 90px 140px 150px 64px 56px auto"
        empty="Nenhuma fonte cadastrada."
        empty-icon="list"
      >
        <template #col-feed="{ row }">
          <div class="finfo">
            <span class="fname">{{ row.name }}</span>
            <span class="furl">{{ row.url }}</span>
          </div>
        </template>
        <template #col-type="{ row }">
          <span class="type-badge">{{ TYPE_LABEL[row.type] ?? row.type }}</span>
        </template>
        <template #col-tone="{ row }">
          <span class="muted-txt">{{ row.defaultTone?.name ?? '—' }}</span>
        </template>
        <template #col-health="{ row }">
          <div class="health">
            <StatusPill
              :label="row.lastStatus === 'OK' ? 'OK' : row.lastStatus === 'ERROR' ? 'Erro' : 'Sem coleta'"
              :tone="row.lastStatus === 'OK' ? 'emerald' : row.lastStatus === 'ERROR' ? 'scarlet' : 'neutral'"
              dot
            />
            <span class="hwhen" :title="row.lastError ?? ''">{{ fmtWhen(row.lastFetchedAt) }}</span>
          </div>
        </template>
        <template #col-active="{ row }">
          <ToggleSwitch :on="row.isActive" @toggle="toggleActive(row)" />
        </template>
        <template #col-items="{ row }">
          <span class="muted-txt">{{ row._count?.items ?? 0 }}</span>
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
.finfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fname { font-weight: 700; font-size: 14px; }
.off { font-size: 11px; color: var(--muted); font-weight: 600; }
.furl { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.muted-txt { font-size: 12.5px; color: var(--muted); font-weight: 600; }
.type-badge { font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; }
.health { display: flex; align-items: center; gap: 8px; }
.hwhen { font-size: 11.5px; color: var(--muted); }
.acts { display: flex; justify-content: flex-end; }
</style>
