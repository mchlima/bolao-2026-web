<script setup lang="ts">
import type { PostListRow, PostView } from '~/types/api';
import { postStatus } from '~/utils/content';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const tz = useTz();
const route = useRoute();

type PKey = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
const P_KEYS: PKey[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const qTab = route.query.tab as string | undefined;
const statusFilter = ref<PKey>(P_KEYS.includes(qTab as PKey) ? (qTab as PKey) : 'DRAFT');
const { page, search, data, load } = useAdminList<PostListRow>('/admin/posts', () => `status=${statusFilter.value}`);
watch(statusFilter, () => { page.value = 1; load(); });

const TABS = [
  { key: 'DRAFT', label: 'Rascunhos' },
  { key: 'PUBLISHED', label: 'Publicados' },
  { key: 'ARCHIVED', label: 'Arquivados' },
] as const;
const TAB_HELP: Record<string, string> = {
  DRAFT: 'Posts em preparação — vindos da Revisão (esteira) ou criados do zero. Edite e publique quando estiverem prontos. Nada aqui aparece no site.',
  PUBLISHED: 'No ar em cravei.app/noticias. Editar e salvar NÃO muda a versão pública — só ao publicar de novo. O selo “alterações” indica edições ainda não publicadas.',
  ARCHIVED: 'Tirados do ar (não aparecem no site), mas preservados aqui. Publique de novo para reativar.',
};

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
const creating = ref(false);
async function newPost() {
  creating.value = true;
  try {
    const p = await useApi()<PostView>('/admin/posts', { method: 'POST', body: { title: 'Novo post' } });
    navigateTo(`/admin/posts/${p.id}`);
  } catch (e) { err(e); creating.value = false; }
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz.value,
  }).format(new Date(iso));
}

const COLS: AdminColumn[] = [
  { key: 'title', label: 'Post' },
  { key: 'category', label: 'Categoria', mobileHide: true },
  { key: 'tags', label: 'Tags', align: 'end', mobileHide: true },
  { key: 'when', label: 'Atualizado', align: 'end', mobileHide: true },
];
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Posts"
      subtitle="O CMS: onde você gerencia e edita o conteúdo de fato. Posts nascem de uma promoção na Revisão (esteira) ou criados do zero aqui. Editar um post publicado nunca muda o que está no ar — só ao publicar de novo."
    >
      <template #actions>
        <button class="btn btn-primary" :disabled="creating" @click="newPost">
          <AppIcon name="plus" :size="15" :stroke="2.4" /> {{ creating ? 'Criando…' : 'Novo post' }}
        </button>
      </template>
    </AdminPageHeader>

    <div class="seg-tabs">
      <button v-for="t in TABS" :key="t.key" class="seg-t" :class="{ on: statusFilter === t.key }" @click="statusFilter = t.key">
        {{ t.label }}
      </button>
    </div>
    <p class="tab-help">{{ TAB_HELP[statusFilter] }}</p>

    <div class="card adm-panel">
      <AdminSearchBar v-model="search" placeholder="Buscar pelo título…" class="mb" />
      <AdminTable
        :columns="COLS"
        :rows="data?.data"
        grid="minmax(0,2fr) 160px 70px 130px"
        empty="Nenhum post aqui."
        empty-icon="list"
      >
        <template #col-title="{ row }">
          <NuxtLink :to="`/admin/posts/${row.id}`" class="pinfo">
            <span class="ptitle">{{ row.title }}</span>
            <span class="pmeta">
              <StatusPill :label="postStatus(row.status).label" :tone="postStatus(row.status).tone" dot soft />
              <span v-if="row.featured" class="feat"><AppIcon name="star" :size="11" :stroke="2.4" /> manchete</span>
              <span v-if="row.hasPendingChanges" class="pend">alterações não publicadas</span>
              <span v-if="row.fromEngine" class="origin">da esteira</span>
            </span>
          </NuxtLink>
        </template>
        <template #col-category="{ row }"><span class="muted-txt">{{ row.category?.name ?? '—' }}</span></template>
        <template #col-tags="{ row }"><span class="muted-txt">{{ row.tagCount }}</span></template>
        <template #col-when="{ row }"><span class="muted-txt">{{ fmtWhen(row.updatedAt) }}</span></template>
      </AdminTable>
      <AdminPager v-if="data" v-model="page" :pagination="data.pagination" />
    </div>
  </div>
</template>

<style scoped>
.seg-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; width: fit-content; }
.seg-t { padding: 8px 14px; border: none; background: transparent; border-radius: 7px; font-size: var(--fs-sm); font-weight: 700; color: var(--muted); cursor: pointer; }
.seg-t.on { background: var(--grad-pitch); color: #fff; }
.tab-help { font-size: var(--fs-sm); color: var(--muted); line-height: 1.5; margin: -6px 0 16px; max-width: 820px; }
.mb { margin-bottom: 14px; }
.pinfo { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ptitle { font-weight: 700; font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pmeta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pend { font-size: var(--fs-xs); font-weight: 700; color: var(--gold); }
.feat { display: inline-flex; align-items: center; gap: 3px; font-size: var(--fs-xs); font-weight: 800; color: #0a0e14; background: var(--gold); border-radius: 999px; padding: 1px 8px; }
.origin { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
.muted-txt { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; }
</style>
