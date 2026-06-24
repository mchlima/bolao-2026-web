<script setup lang="ts">
import type { NewsItem } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const route = useRoute();
type TKey = 'FILTERED' | 'DUPLICATE' | 'DISCOVERED' | 'PROCESSING' | 'FAILED';
const TAB_KEYS: TKey[] = ['FILTERED', 'DUPLICATE', 'DISCOVERED', 'PROCESSING', 'FAILED'];
const queryTab = route.query.tab as string | undefined;
const statusFilter = ref<TKey>(TAB_KEYS.includes(queryTab as TKey) ? (queryTab as TKey) : 'FILTERED');
const { page, data, load } = useAdminList<NewsItem>('/admin/content/items', () => `status=${statusFilter.value}`);
watch(statusFilter, () => { page.value = 1; load(); });

const TABS = [
  { key: 'FILTERED', label: 'Filtrados' },
  { key: 'DUPLICATE', label: 'Duplicadas' },
  { key: 'DISCOVERED', label: 'Na fila' },
  { key: 'PROCESSING', label: 'Processando' },
  { key: 'FAILED', label: 'Com erro' },
] as const;

const TAB_HELP: Record<string, string> = {
  FILTERED: 'O filtro automático achou estas notícias pouco relevantes (nota baixa ou fora de esporte) e não gerou texto. Reveja e clique em Resgatar para forçar a geração mesmo assim.',
  DUPLICATE: 'Notícias sobre o MESMO acontecimento que já virou matéria por outra fonte — o robô suprimiu antes de gerar (não pagou o texto). Cada uma mostra a matéria original; Resgatar gera assim mesmo como matéria separada.',
  DISCOVERED: 'Notícias recém-coletadas dos feeds, na fila para o robô processar (buscar o artigo, extrair os fatos e gerar o texto). Elas saem daqui sozinhas conforme o robô avança.',
  PROCESSING: 'Notícias sendo trabalhadas pelo robô neste momento.',
  FAILED: 'Notícias que deram erro no processamento — passe o mouse para ver o motivo.',
};

const COLS: AdminColumn[] = [
  { key: 'item', label: 'Notícia' },
  { key: 'feed', label: 'Feed', mobileHide: true },
  { key: 'score', label: 'Relevância', align: 'end', mobileHide: true },
  { key: 'actions', label: '', align: 'end' },
];

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function rescue(it: NewsItem, force = false) {
  try {
    await useApi()(`/admin/content/items/${it.id}/rescue${force ? '?force=true' : ''}`, { method: 'POST' });
    ui.toast('success', 'Resgatado — gerando texto.');
    await load();
  } catch (e: unknown) {
    const ex = e as { data?: { code?: string; message?: string } };
    if (ex?.data?.code === 'CAP_EXCEEDED') {
      if (await ui.confirm({ title: 'Limite do dia atingido', msg: ex.data.message ?? '', confirmLabel: 'Gerar mesmo assim', danger: true })) {
        await rescue(it, true);
      }
      return;
    }
    err(e);
  }
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Triagem"
      subtitle="A porta de entrada da esteira. Aqui você acompanha as notícias coletadas dos feeds enquanto o robô decide o que vira matéria — e pode intervir quando ele erra a mão."
    />

    <div class="seg-tabs">
      <button v-for="t in TABS" :key="t.key" class="seg-t" :class="{ on: statusFilter === t.key }" @click="statusFilter = t.key">
        {{ t.label }}
      </button>
    </div>
    <p class="tab-help">{{ TAB_HELP[statusFilter] }}</p>

    <div class="card adm-panel">
      <AdminTable
        :columns="COLS"
        :rows="data?.data"
        grid="minmax(0,1.8fr) 150px 110px auto"
        empty="Nada por aqui."
        empty-icon="filter"
      >
        <template #col-item="{ row }">
          <div class="iinfo">
            <span class="ititle">{{ row.sourceTitle }}</span>
            <NuxtLink v-if="row.duplicateOf" :to="`/admin/content/revisao/${row.duplicateOf.id}`" class="idup">
              <AppIcon name="externalLink" :size="12" :stroke="2" /> matéria original: {{ row.duplicateOf.sourceTitle }}
            </NuxtLink>
            <span v-else-if="row.relevanceReason" class="ireason">{{ row.relevanceReason }}</span>
            <span v-else-if="row.error" class="ierror">{{ row.error }}</span>
          </div>
        </template>
        <template #col-feed="{ row }"><span class="muted-txt">{{ row.feed?.name ?? '—' }}</span></template>
        <template #col-score="{ row }">
          <span class="muted-txt">{{ row.relevanceScore != null ? Math.round(row.relevanceScore * 100) + '%' : '—' }}</span>
        </template>
        <template #col-actions="{ row }">
          <div class="acts">
            <a :href="row.sourceUrl" target="_blank" rel="noopener" class="icon-link" title="Abrir fonte">
              <AppIcon name="externalLink" :size="15" :stroke="2" />
            </a>
            <button v-if="row.status === 'FILTERED' || row.status === 'DUPLICATE'" class="btn btn-sm" @click="rescue(row)">
              <AppIcon name="refresh" :size="13" :stroke="2.2" /> Resgatar
            </button>
          </div>
        </template>
      </AdminTable>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>
  </div>
</template>

<style scoped>
.seg-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; width: fit-content; }
.seg-t { padding: 8px 14px; border: none; background: transparent; border-radius: 7px; font-size: var(--fs-sm); font-weight: 700; color: var(--muted); cursor: pointer; }
.seg-t.on { background: var(--grad-pitch); color: #fff; }
.tab-help { font-size: var(--fs-sm); color: var(--muted); line-height: 1.5; margin: -6px 0 16px; max-width: 780px; }
.iinfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ititle { font-weight: 700; font-size: var(--fs-sm); }
.ireason { font-size: var(--fs-xs); color: var(--muted); }
.idup { font-size: var(--fs-xs); color: var(--azure); display: inline-flex; align-items: center; gap: 4px; width: fit-content; }
.idup:hover { text-decoration: underline; }
.ierror { font-size: var(--fs-xs); color: var(--scarlet); }
.muted-txt { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; }
.acts { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.icon-link { color: var(--muted); display: grid; place-items: center; }
.icon-link:hover { color: var(--text); }
.btn-sm { padding: 6px 10px; font-size: var(--fs-xs); }
</style>
