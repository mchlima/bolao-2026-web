<script setup lang="ts">
import type { CategoryNode, EntityRef, Paginated, Taxonomy } from '~/types/api';

const props = defineProps<{
  itemId: string;
  category: EntityRef | null;
  tags: EntityRef[];
  suggestedCategory?: string;
  suggestedTags?: string[];
}>();
const emit = defineEmits<{ saved: [] }>();

const ui = useUiStore();
const tree = ref<CategoryNode[]>([]);
const allTags = ref<Taxonomy[]>([]);
const categoryId = ref(props.category?.slug ? findIdBySlug(props.category.slug) : '');
const selTags = ref<{ id: string; name: string; slug: string }[]>([...props.tags]);
const tagInput = ref('');
const saving = ref(false);

function findIdBySlug(slug: string): string {
  return tree.value.find((c) => c.slug === slug)?.id ?? '';
}
function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

async function load() {
  try {
    const [t, tg] = await Promise.all([
      useApi()<CategoryNode[]>('/admin/content/categories'),
      useApi()<Paginated<Taxonomy>>('/admin/content/tags?pageSize=200'),
    ]);
    tree.value = t;
    allTags.value = tg.data;
    // re-resolve o id da categoria atual agora que a árvore carregou
    if (props.category?.slug && !categoryId.value) categoryId.value = findIdBySlug(props.category.slug);
  } catch (e) { err(e); }
}
onMounted(load);

// sugestões de tag (do SEO) ainda não selecionadas
const tagSuggestions = computed(() => {
  const have = new Set(selTags.value.map((t) => t.slug));
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (props.suggestedTags ?? []).filter((s) => !have.has(norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')));
});
// autocomplete: tags existentes que batem com o que está digitando
const tagMatches = computed(() => {
  const q = tagInput.value.trim().toLowerCase();
  if (!q) return [];
  const have = new Set(selTags.value.map((t) => t.id));
  return allTags.value.filter((t) => !have.has(t.id) && t.name.toLowerCase().includes(q)).slice(0, 6);
});

async function save() {
  saving.value = true;
  try {
    await useApi()(`/admin/content/items/${props.itemId}/taxonomy`, {
      method: 'PUT',
      body: { categoryId: categoryId.value || null, tagIds: selTags.value.map((t) => t.id) },
    });
    emit('saved');
  } catch (e) { err(e); } finally { saving.value = false; }
}

function onCategoryChange() { void save(); }

function addExistingTag(t: Taxonomy) {
  selTags.value.push({ id: t.id, name: t.name, slug: t.slug });
  tagInput.value = '';
  void save();
}
function removeTag(id: string) {
  selTags.value = selTags.value.filter((t) => t.id !== id);
  void save();
}
/** Cria a tag (valida-existe-no-servidor por slug) e adiciona. */
async function createAndAddTag(name: string) {
  const n = name.trim();
  if (!n) return;
  try {
    const created = await useApi()<Taxonomy>('/admin/content/tags', { method: 'POST', body: { name: n } });
    if (!allTags.value.some((t) => t.id === created.id)) allTags.value.push(created);
    if (!selTags.value.some((t) => t.id === created.id)) selTags.value.push({ id: created.id, name: created.name, slug: created.slug });
    tagInput.value = '';
    void save();
  } catch (e) { err(e); }
}
function onTagEnter() {
  const exact = allTags.value.find((t) => t.name.toLowerCase() === tagInput.value.trim().toLowerCase());
  if (exact) addExistingTag(exact);
  else void createAndAddTag(tagInput.value);
}
/** Aplica a categoria sugerida pelo SEO: usa a existente (por nome) ou cria como raiz. */
async function applySuggestedCategory() {
  const name = (props.suggestedCategory ?? '').trim();
  if (!name) return;
  const existing = tree.value.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) { categoryId.value = existing.id; void save(); return; }
  try {
    const created = await useApi()<Taxonomy>('/admin/content/categories', { method: 'POST', body: { name } });
    await load();
    categoryId.value = created.id;
    void save();
  } catch (e) { err(e); }
}
</script>

<template>
  <div class="tax">
    <div class="tax-block">
      <div class="tax-head">
        Categoria
        <button v-if="suggestedCategory && !categoryId" class="sug" @click="applySuggestedCategory">
          usar sugestão: <strong>{{ suggestedCategory }}</strong>
        </button>
      </div>
      <select v-model="categoryId" class="input" :disabled="saving" @change="onCategoryChange">
        <option value="">— Sem categoria —</option>
        <option v-for="c in tree" :key="c.id" :value="c.id">{{ c.pathLabel.join(' › ') }}</option>
      </select>
      <NuxtLink to="/admin/content/categorias" class="manage">organizar árvore de categorias →</NuxtLink>
    </div>

    <div class="tax-block">
      <div class="tax-head">Tags (assuntos)</div>
      <div class="chips">
        <span v-for="t in selTags" :key="t.id" class="chip">
          {{ t.name }}
          <button class="chip-x" :disabled="saving" @click="removeTag(t.id)"><AppIcon name="close" :size="11" :stroke="2.6" /></button>
        </span>
        <span v-if="!selTags.length" class="muted-txt">Nenhuma tag ainda.</span>
      </div>
      <div class="tag-add">
        <input
          v-model="tagInput" class="input" placeholder="Digite e Enter para adicionar/criar…"
          @keyup.enter="onTagEnter"
        />
        <ul v-if="tagMatches.length" class="ac">
          <li v-for="t in tagMatches" :key="t.id"><button @click="addExistingTag(t)">{{ t.name }}</button></li>
          <li v-if="tagInput.trim() && !tagMatches.some(m => m.name.toLowerCase() === tagInput.trim().toLowerCase())" class="ac-new">
            <button @click="createAndAddTag(tagInput)">criar “{{ tagInput.trim() }}”</button>
          </li>
        </ul>
      </div>
      <div v-if="tagSuggestions.length" class="sugs">
        <span class="sugs-label">Sugeridas:</span>
        <button v-for="s in tagSuggestions" :key="s" class="sug-chip" @click="createAndAddTag(s)">+ {{ s }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tax { display: flex; flex-direction: column; gap: 18px; }
.tax-head { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 7px; display: flex; align-items: center; gap: 10px; }
.sug { background: none; border: none; cursor: pointer; font-size: 11px; font-weight: 600; color: var(--azure); text-transform: none; letter-spacing: 0; }
.sug:hover { text-decoration: underline; }
.manage { display: inline-block; margin-top: 6px; font-size: 11.5px; color: var(--azure); text-decoration: none; }
.manage:hover { text-decoration: underline; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 3px 6px 3px 11px; }
.chip-x { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border: none; border-radius: 50%; background: var(--border); color: var(--text); cursor: pointer; }
.chip-x:hover { background: var(--scarlet); color: #fff; }
.tag-add { position: relative; }
.ac { position: absolute; z-index: 5; top: calc(100% + 2px); left: 0; right: 0; list-style: none; margin: 0; padding: 4px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
.ac li button { width: 100%; text-align: left; background: none; border: none; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text); }
.ac li button:hover { background: var(--bg-base); }
.ac-new button { color: var(--azure); font-weight: 600; }
.sugs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
.sugs-label { font-size: 11.5px; color: var(--muted); font-weight: 600; }
.sug-chip { font-size: 12px; font-weight: 600; color: var(--azure); background: none; border: 1px dashed var(--azure); border-radius: 20px; padding: 2px 10px; cursor: pointer; }
.sug-chip:hover { background: color-mix(in srgb, var(--azure) 12%, transparent); }
.muted-txt { font-size: 12.5px; color: var(--muted); }
</style>
