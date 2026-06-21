<script setup lang="ts">
import type { CategoryNode, EntityRef, Paginated, Taxonomy } from '~/types/api';

// Controlado (v-model) — NÃO salva sozinho. O editor do post envia tudo num PATCH só.
const categoryId = defineModel<string>('categoryId', { default: '' });
const tags = defineModel<EntityRef[]>('tags', { default: () => [] });

const ui = useUiStore();
const tree = ref<CategoryNode[]>([]);
const tagInput = ref('');
const tagMatches = ref<Taxonomy[]>([]);
const tagFocused = ref(false);

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function load() {
  try {
    tree.value = await useApi()<CategoryNode[]>('/admin/content/categories');
  } catch (e) { err(e); }
}
onMounted(load);

async function searchTags(q: string): Promise<Taxonomy[]> {
  const res = await useApi()<Paginated<Taxonomy>>(`/admin/content/tags?q=${encodeURIComponent(q)}&pageSize=10`);
  return res.data;
}

let searchSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let blurTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchMatches(q: string) {
  const seq = ++searchSeq;
  try {
    const res = await searchTags(q);
    if (seq !== searchSeq) return;
    const have = new Set(tags.value.map((t) => t.id));
    tagMatches.value = res.filter((t) => !have.has(t.id)).slice(0, 8);
  } catch { tagMatches.value = []; }
}

watch(tagInput, (val) => {
  const q = val.trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q) { if (tagFocused.value) void fetchMatches(''); else tagMatches.value = []; return; }
  debounceTimer = setTimeout(() => void fetchMatches(q), 220);
});

function onTagFocus() {
  if (blurTimer) clearTimeout(blurTimer);
  tagFocused.value = true;
  if (!tagInput.value.trim()) void fetchMatches('');
}
function onTagBlur() {
  blurTimer = setTimeout(() => { tagFocused.value = false; }, 150);
}

function addExistingTag(t: Taxonomy | EntityRef) {
  if (!tags.value.some((s) => s.id === t.id)) tags.value = [...tags.value, { id: t.id, name: t.name, slug: t.slug }];
  tagInput.value = '';
  tagMatches.value = [];
  if (tagFocused.value) void fetchMatches('');
}
function removeTag(id: string) {
  tags.value = tags.value.filter((t) => t.id !== id);
}
/** Adiciona pelo nome: reusa a existente (busca por slug) ou cria. */
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
</script>

<template>
  <div class="tax">
    <div class="tax-block">
      <div class="tax-head">Categoria</div>
      <select v-model="categoryId" class="input">
        <option value="">— Sem categoria —</option>
        <option v-for="c in tree" :key="c.id" :value="c.id">{{ c.pathLabel.join(' › ') }}</option>
      </select>
      <NuxtLink to="/admin/content/categorias" class="manage">organizar árvore de categorias →</NuxtLink>
    </div>

    <div class="tax-block">
      <div class="tax-head">Tags (assuntos)</div>
      <div class="chips">
        <span v-for="t in tags" :key="t.id" class="chip">
          {{ t.name }}
          <button type="button" class="chip-x" @click="removeTag(t.id)"><AppIcon name="close" :size="11" :stroke="2.6" /></button>
        </span>
        <span v-if="!tags.length" class="muted-txt">Nenhuma tag ainda.</span>
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
    </div>
  </div>
</template>

<style scoped>
.tax { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 680px) { .tax { grid-template-columns: 1fr; } }
.tax-head { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 7px; }
.manage { display: inline-block; margin-top: 6px; font-size: 11.5px; color: var(--azure); text-decoration: none; }
.manage:hover { text-decoration: underline; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 3px 6px 3px 11px; }
.chip-x { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border: none; border-radius: 50%; background: var(--border); color: var(--text); cursor: pointer; }
.chip-x:hover { background: var(--scarlet); color: #fff; }
.tag-add { position: relative; }
.ac { position: absolute; z-index: 5; top: calc(100% + 2px); left: 0; right: 0; list-style: none; margin: 0; padding: 4px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
.ac li button { width: 100%; text-align: left; background: none; border: none; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: var(--text); display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ac li button:hover { background: var(--bg-base); }
.ac-count { font-size: 11px; font-weight: 700; color: var(--muted); background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 0 7px; }
.ac-new button { color: var(--azure); font-weight: 600; }
.ac-empty { padding: 8px 10px; font-size: 12.5px; color: var(--muted); }
.muted-txt { font-size: 12.5px; color: var(--muted); }
</style>
