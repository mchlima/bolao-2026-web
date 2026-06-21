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
const categoryId = ref(props.category?.slug ? findIdBySlug(props.category.slug) : '');
const selTags = ref<{ id: string; name: string; slug: string }[]>([...props.tags]);
const tagInput = ref('');
const tagMatches = ref<Taxonomy[]>([]); // resultados da busca no servidor (autocomplete)
const tagFocused = ref(false);
const saving = ref(false);

// slug canônico (mesma regra do back): p/ casar nome digitado com tag existente.
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function findIdBySlug(slug: string): string {
  return tree.value.find((c) => c.slug === slug)?.id ?? '';
}
function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

async function load() {
  try {
    // Categorias são poucas (árvore) → carrega tudo. Tags podem ser muitas (por
    // entidade) → NUNCA carregar todas; busca no servidor conforme digita.
    tree.value = await useApi()<CategoryNode[]>('/admin/content/categories');
    if (props.category?.slug && !categoryId.value) categoryId.value = findIdBySlug(props.category.slug);
  } catch (e) { err(e); }
}
onMounted(load);

/** Busca tags por texto (servidor). pageSize ≤ 100 respeita o teto da API. */
async function searchTags(q: string): Promise<Taxonomy[]> {
  const res = await useApi()<Paginated<Taxonomy>>(`/admin/content/tags?q=${encodeURIComponent(q)}&pageSize=10`);
  return res.data;
}

// sugestões de tag (do SEO) ainda não selecionadas
const tagSuggestions = computed(() => {
  const have = new Set(selTags.value.map((t) => t.slug));
  return (props.suggestedTags ?? []).filter((s) => !have.has(norm(s)));
});

// autocomplete server-side, com debounce e descarte de resposta obsoleta.
let searchSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;

/** Tags ainda não selecionadas que batem com `q` ('' = lista inicial p/ navegar). */
async function fetchMatches(q: string) {
  const seq = ++searchSeq;
  try {
    const res = await searchTags(q);
    if (seq !== searchSeq) return; // chegou fora de ordem: ignora
    const have = new Set(selTags.value.map((t) => t.id));
    tagMatches.value = res.filter((t) => !have.has(t.id)).slice(0, 8);
  } catch { tagMatches.value = []; }
}

watch(tagInput, (val) => {
  const q = val.trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  // sem texto: mostra a lista inicial enquanto o campo está focado.
  if (!q) { if (tagFocused.value) void fetchMatches(''); else tagMatches.value = []; return; }
  debounceTimer = setTimeout(() => void fetchMatches(q), 220);
});

function onTagFocus() {
  if (blurTimer) clearTimeout(blurTimer);
  tagFocused.value = true;
  if (!tagInput.value.trim()) void fetchMatches('');
}
function onTagBlur() {
  // atrasa p/ o clique numa opção (mousedown) chegar antes de esconder.
  blurTimer = setTimeout(() => { tagFocused.value = false; }, 150);
}

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
  if (!selTags.value.some((s) => s.id === t.id)) selTags.value.push({ id: t.id, name: t.name, slug: t.slug });
  tagInput.value = '';
  tagMatches.value = [];
  // se o campo segue focado, repõe a lista inicial p/ continuar escolhendo.
  if (tagFocused.value) void fetchMatches('');
  void save();
}
function removeTag(id: string) {
  selTags.value = selTags.value.filter((t) => t.id !== id);
  void save();
}
/**
 * Adiciona uma tag pelo nome: REUSA a existente (busca por slug no servidor) ou cria.
 * Confere no servidor antes de POSTar — evita criar "brasil-2" quando "Brasil" já existe
 * mas não estava no autocomplete visível.
 */
async function resolveOrCreateTag(name: string) {
  const n = name.trim();
  if (!n) return;
  try {
    const slug = norm(n);
    const found = await searchTags(n);
    const exact = found.find((t) => t.slug === slug);
    if (exact) { addExistingTag(exact); return; }
    const created = await useApi()<Taxonomy>('/admin/content/tags', { method: 'POST', body: { name: n } });
    addExistingTag(created);
  } catch (e) { err(e); }
}
function onTagEnter() {
  const slug = norm(tagInput.value);
  const exact = tagMatches.value.find((t) => t.slug === slug);
  if (exact) addExistingTag(exact);
  else void resolveOrCreateTag(tagInput.value);
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
          v-model="tagInput" class="input" placeholder="Busque uma tag ou digite para criar…"
          autocomplete="off"
          @focus="onTagFocus" @blur="onTagBlur" @keyup.enter="onTagEnter"
        />
        <ul v-if="tagFocused && (tagMatches.length || tagInput.trim())" class="ac">
          <li v-for="t in tagMatches" :key="t.id">
            <button type="button" @mousedown.prevent="addExistingTag(t)">
              {{ t.name }}<span v-if="t._count?.items" class="ac-count">{{ t._count.items }}</span>
            </button>
          </li>
          <li v-if="tagInput.trim() && !tagMatches.some(m => m.slug === norm(tagInput))" class="ac-new">
            <button type="button" @mousedown.prevent="resolveOrCreateTag(tagInput)">criar “{{ tagInput.trim() }}”</button>
          </li>
          <li v-else-if="!tagMatches.length && !tagInput.trim()" class="ac-empty">Nenhuma tag ainda — digite para criar.</li>
        </ul>
      </div>
      <div v-if="tagSuggestions.length" class="sugs">
        <span class="sugs-label">Sugeridas:</span>
        <button v-for="s in tagSuggestions" :key="s" class="sug-chip" @click="resolveOrCreateTag(s)">+ {{ s }}</button>
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
.ac li button { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ac-count { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 0 7px; }
.ac li button:hover .ac-count { background: var(--bg-surface); }
.ac-new button { color: var(--azure); font-weight: 600; }
.ac-empty { padding: 8px 10px; font-size: 12.5px; color: var(--muted); }
.sugs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
.sugs-label { font-size: 11.5px; color: var(--muted); font-weight: 600; }
.sug-chip { font-size: 12px; font-weight: 600; color: var(--azure); background: none; border: 1px dashed var(--azure); border-radius: 20px; padding: 2px 10px; cursor: pointer; }
.sug-chip:hover { background: color-mix(in srgb, var(--azure) 12%, transparent); }
.muted-txt { font-size: 12.5px; color: var(--muted); }
</style>
