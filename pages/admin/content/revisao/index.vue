<script setup lang="ts">
import type { NewsItem } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const tz = useTz();
const route = useRoute();
type RKey = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
const R_KEYS: RKey[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'];
const rQueryTab = route.query.tab as string | undefined;
const statusFilter = ref<RKey>(R_KEYS.includes(rQueryTab as RKey) ? (rQueryTab as RKey) : 'PENDING_REVIEW');
const { page, data, load } = useAdminList<NewsItem>('/admin/content/items', () => `status=${statusFilter.value}`);
watch(statusFilter, () => { page.value = 1; load(); });

const TABS = [
  { key: 'PENDING_REVIEW', label: 'Em revisão' },
  { key: 'APPROVED', label: 'Aprovados' },
  { key: 'REJECTED', label: 'Rejeitados' },
] as const;

const TAB_HELP: Record<string, string> = {
  PENDING_REVIEW: 'Matérias prontas esperando sua avaliação. Abra uma para comparar o texto gerado com os fatos e a fonte, ajustar com uma orientação (regerar), e então aprovar ou rejeitar.',
  APPROVED: 'Matérias que você aprovou — prontas para copiar/exportar e publicar onde quiser.',
  REJECTED: 'Matérias descartadas na revisão. Ficam aqui como histórico.',
};

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz.value,
  }).format(new Date(iso));
}
function headline(it: NewsItem): string {
  return (it.generatedText || it.sourceTitle).split('\n')[0];
}

const COLS: AdminColumn[] = [
  { key: 'item', label: 'Matéria' },
  { key: 'tone', label: 'Tom', mobileHide: true },
  { key: 'feed', label: 'Feed', mobileHide: true },
  { key: 'when', label: 'Criado', align: 'end', mobileHide: true },
];
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Revisão"
      subtitle="O controle de qualidade da esteira. Nenhum texto sai daqui sem o seu aval: você revisa, ajusta o que precisar e decide o que é aprovado."
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
        grid="minmax(0,2fr) 150px 150px 120px"
        empty="Nada para revisar."
        empty-icon="check"
      >
        <template #col-item="{ row }">
          <NuxtLink :to="`/admin/content/revisao/${row.id}`" class="iinfo">
            <span class="ititle">
              <AppIcon v-if="row.verifyOk === false" name="shield" :size="13" :stroke="2.4" class="iflag" title="Verificação encontrou alertas" />
              {{ headline(row) }}
            </span>
            <span class="isrc">{{ row.sourceTitle }}</span>
          </NuxtLink>
        </template>
        <template #col-tone="{ row }"><span class="muted-txt">{{ row.tone?.name ?? '—' }}</span></template>
        <template #col-feed="{ row }"><span class="muted-txt">{{ row.feed?.name ?? '—' }}</span></template>
        <template #col-when="{ row }"><span class="muted-txt">{{ fmtWhen(row.createdAt) }}</span></template>
      </AdminTable>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>
  </div>
</template>

<style scoped>
.seg-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; width: fit-content; }
.seg-t { padding: 8px 14px; border: none; background: transparent; border-radius: 7px; font-size: 13px; font-weight: 700; color: var(--muted); cursor: pointer; }
.seg-t.on { background: var(--grad-pitch); color: #fff; }
.tab-help { font-size: 13px; color: var(--muted); line-height: 1.5; margin: -6px 0 16px; max-width: 780px; }
.iinfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ititle { font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; gap: 5px; }
.iflag { color: var(--gold); flex: none; }
.isrc { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.muted-txt { font-size: 12.5px; color: var(--muted); font-weight: 600; }
</style>
