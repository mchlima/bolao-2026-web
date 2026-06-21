<script setup lang="ts">
import type { CategoryNode } from '~/types/api';
import type { MenuItem } from '~/components/KebabMenu.vue';
import { emptyTermSeoForm, toTermSeoForm, fromTermSeoForm, type TermSeoForm } from '~/utils/termSeo';

const ui = useUiStore();
const MAX_DEPTH = 3;
const rows = ref<CategoryNode[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    rows.value = await useApi()<CategoryNode[]>('/admin/content/categories');
  } catch (e) { err(e); } finally { loading.value = false; }
}

const showForm = ref(false);
const editing = ref<CategoryNode | null>(null);
const form = reactive({ name: '', description: '', parentId: '' });
const seoForm = ref<TermSeoForm>(emptyTermSeoForm());
const saving = ref(false);

// Pais elegíveis: nós com profundidade < 3 (p/ filho não passar de 3). Na edição,
// exclui o próprio nó e seus descendentes (evita ciclo); a API revalida.
const parentOptions = computed(() => {
  const banned = new Set<string>();
  if (editing.value) {
    banned.add(editing.value.id);
    // descendentes: quem tem o editing no caminho (pathLabel inclui o nome — usamos parentId via varredura)
    const descend = (id: string) => {
      for (const r of rows.value) if (r.parentId === id) { banned.add(r.id); descend(r.id); }
    };
    descend(editing.value.id);
  }
  return rows.value.filter((r) => r.depth < MAX_DEPTH && !banned.has(r.id));
});

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
function openNew() {
  editing.value = null;
  form.name = ''; form.description = ''; form.parentId = '';
  seoForm.value = emptyTermSeoForm();
  showForm.value = true;
}
function openEdit(c: CategoryNode) {
  editing.value = c;
  form.name = c.name; form.description = c.description ?? ''; form.parentId = c.parentId ?? '';
  seoForm.value = toTermSeoForm(c.seo);
  showForm.value = true;
}
async function save() {
  if (!form.name.trim()) { ui.toast('error', 'Informe um nome.'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await useApi()(`/admin/content/categories/${editing.value.id}`, {
        method: 'PATCH',
        body: { name: form.name.trim(), description: form.description.trim() || null, parentId: form.parentId || null, seo: fromTermSeoForm(seoForm.value) },
      });
    } else {
      await useApi()('/admin/content/categories', {
        method: 'POST',
        body: { name: form.name.trim(), description: form.description.trim() || undefined, parentId: form.parentId || undefined, seo: fromTermSeoForm(seoForm.value) },
      });
    }
    ui.toast('success', 'Salvo.');
    showForm.value = false;
    await load();
  } catch (e) { err(e); } finally { saving.value = false; }
}
async function remove(c: CategoryNode) {
  const ok = await ui.confirm({
    title: 'Excluir categoria',
    msg: `Excluir "${c.name}"? As filhas viram raiz e as matérias ficam sem categoria.`,
    confirmLabel: 'Excluir', danger: true,
  });
  if (!ok) return;
  try {
    await useApi()(`/admin/content/categories/${c.id}`, { method: 'DELETE' });
    ui.toast('info', 'Excluído.');
    await load();
  } catch (e) { err(e); }
}
function actionsFor(c: CategoryNode): MenuItem[] {
  const a: MenuItem[] = [
    { key: 'edit', label: 'Editar', icon: 'edit', tone: 'azure', onSelect: () => openEdit(c) },
    { key: 'del', label: 'Excluir', icon: 'trash', tone: 'danger', onSelect: () => remove(c) },
  ];
  if (c.depth < MAX_DEPTH) a.splice(1, 0, { key: 'sub', label: 'Nova subcategoria', icon: 'plus', tone: 'emerald', onSelect: () => { openNew(); form.parentId = c.id; } });
  return a;
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Categorias"
      subtitle="A seção de cada matéria (1 por matéria), HIERÁRQUICA até 3 níveis (ex.: Futebol › Copa do Mundo › 2026). Surgem ao publicar (como raiz) e você organiza a árvore aqui. Cada categoria tem página pública que agrega suas matérias e as das subcategorias. Renomear não muda a URL; excluir só desvincula."
    >
      <template #actions>
        <button class="btn btn-primary" @click="openNew">
          <AppIcon name="plus" :size="15" :stroke="2.4" /> Nova categoria
        </button>
      </template>
    </AdminPageHeader>

    <div class="card adm-panel">
      <div v-if="!loading && !rows.length" class="empty">Nenhuma categoria ainda. Elas surgem ao publicar — ou crie aqui.</div>
      <ul v-else class="ctree">
        <li v-for="c in rows" :key="c.id" class="crow" :style="{ paddingLeft: `${(c.depth - 1) * 22 + 4}px` }">
          <span class="cguide" :class="{ child: c.depth > 1 }" />
          <div class="cinfo">
            <span class="cname">{{ c.name }}</span>
            <span v-if="c.description" class="cdesc">{{ c.description }}</span>
          </div>
          <code class="cslug">{{ c.slug }}</code>
          <span class="ccount">{{ c.items }}</span>
          <KebabMenu :items="actionsFor(c)" :size="30" />
        </li>
      </ul>
    </div>

    <AppModal v-if="showForm" :title="editing ? 'Editar categoria' : 'Nova categoria'" @close="showForm = false">
      <label class="fl">Nome</label>
      <input v-model="form.name" class="input" placeholder="Ex.: Copa do Mundo" @keyup.enter="save" />
      <label class="fl">Categoria-pai <span class="opt">(opcional — define o nível)</span></label>
      <select v-model="form.parentId" class="input">
        <option value="">— Raiz (1º nível) —</option>
        <option v-for="p in parentOptions" :key="p.id" :value="p.id">{{ p.pathLabel.join(' › ') }}</option>
      </select>
      <label class="fl">Descrição <span class="opt">(opcional — resumo curto, aparece na página pública)</span></label>
      <textarea v-model="form.description" class="input area" rows="2" />
      <p v-if="editing" class="slug-note">Slug: <code>{{ editing.slug }}</code> — fixo (não muda a URL).</p>

      <div class="seo-sep"><span>SEO &amp; GEO da página</span></div>
      <AdminTermSeoFields :model="seoForm" :name="form.name.trim() || 'Categoria'" kind="categoria" />

      <template #footer>
        <button class="btn" @click="showForm = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Salvando…' : 'Salvar' }}</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.empty { padding: 40px 20px; text-align: center; color: var(--muted); font-size: 13px; }
.ctree { list-style: none; margin: 0; padding: 0; }
.crow { display: flex; align-items: center; gap: 12px; padding: 11px 4px; border-top: 1px solid var(--border); }
.crow:first-child { border-top: none; }
.cguide { width: 0; }
.cguide.child { width: 10px; border-left: 2px solid var(--border); border-bottom: 2px solid var(--border); height: 10px; margin-right: -4px; border-bottom-left-radius: 4px; }
.cinfo { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.cname { font-weight: 700; font-size: 14px; }
.cdesc { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cslug { font-size: 12px; color: var(--muted); font-family: ui-monospace, monospace; }
.ccount { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 1px 8px; min-width: 22px; text-align: center; }
.fl { display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin: 12px 0 5px; }
.fl:first-child { margin-top: 0; }
.fl .opt { font-weight: 600; opacity: 0.7; }
.area { resize: vertical; }
.slug-note { font-size: 12px; color: var(--muted); margin: 10px 0 0; }
.slug-note code { font-family: ui-monospace, monospace; }
.seo-sep { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--azure); }
.seo-sep::after { content: ''; flex: 1; height: 1px; background: var(--border); }
</style>
