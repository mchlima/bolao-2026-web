<script setup lang="ts">
import type { EntityRef, PostView } from '~/types/api';
import { postStatus } from '~/utils/content';
import type { MenuItem } from '~/components/KebabMenu.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const route = useRoute();
const ui = useUiStore();
const postId = route.params.id as string;
const siteUrl = String(useRuntimeConfig().public.siteUrl);

const post = ref<PostView | null>(null);
const loading = ref(true);
const busy = ref(false);

const form = reactive({
  title: '', slug: '', dek: '', body: '',
  metaTitle: '', metaDescription: '', focusKeyword: '', imageAlt: '',
  keywords: '', keyTakeaways: '',
  faq: [] as { question: string; answer: string }[],
});
const categoryId = ref('');
const tags = ref<EntityRef[]>([]);
const snapshot = ref('');

function snap() {
  return JSON.stringify({ ...form, categoryId: categoryId.value, tagIds: tags.value.map((t) => t.id) });
}
const dirty = computed(() => snapshot.value !== snap());

function fill(p: PostView) {
  const s = p.seo ?? {};
  form.title = p.title;
  form.slug = p.slug;
  form.dek = p.dek ?? '';
  form.body = p.body;
  form.metaTitle = s.metaTitle ?? '';
  form.metaDescription = s.metaDescription ?? '';
  form.focusKeyword = s.focusKeyword ?? '';
  form.imageAlt = s.imageAlt ?? '';
  form.keywords = (s.keywords ?? []).join(', ');
  form.keyTakeaways = (s.keyTakeaways ?? []).join('\n');
  form.faq = (s.faq ?? []).map((q) => ({ ...q }));
  categoryId.value = p.categoryId ?? '';
  tags.value = [...p.tags];
  snapshot.value = snap();
}

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function load() {
  loading.value = true;
  try {
    post.value = await useApi()<PostView>(`/admin/posts/${postId}`);
    fill(post.value);
  } catch {
    ui.toast('error', 'Não foi possível carregar o post.');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function payload() {
  const list = (v: string) => v.split(/[\n,]/).map((t) => t.trim()).filter(Boolean);
  return {
    title: form.title.trim(),
    slug: form.slug.trim(),
    dek: form.dek.trim() || null,
    body: form.body,
    categoryId: categoryId.value || null,
    tagIds: tags.value.map((t) => t.id),
    seo: {
      metaTitle: form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
      focusKeyword: form.focusKeyword.trim(),
      imageAlt: form.imageAlt.trim(),
      keywords: list(form.keywords),
      keyTakeaways: list(form.keyTakeaways),
      faq: form.faq.map((q) => ({ question: q.question.trim(), answer: q.answer.trim() })).filter((q) => q.question && q.answer),
    },
  };
}

async function save(): Promise<boolean> {
  if (!form.title.trim()) { ui.toast('error', 'O post precisa de um título.'); return false; }
  busy.value = true;
  try {
    post.value = await useApi()<PostView>(`/admin/posts/${postId}`, { method: 'PATCH', body: payload() });
    fill(post.value);
    return true;
  } catch (e) { err(e); return false; } finally { busy.value = false; }
}
async function saveAndToast() {
  if (await save()) ui.toast('success', post.value?.status === 'PUBLISHED' ? 'Rascunho salvo (não afeta o que está no ar).' : 'Salvo.');
}
async function publish() {
  // Salva as edições do formulário antes de publicar, pra publicar o que está na tela.
  if (dirty.value && !(await save())) return;
  busy.value = true;
  try {
    post.value = await useApi()<PostView>(`/admin/posts/${postId}/publish`, { method: 'POST' });
    fill(post.value);
    ui.toast('success', 'Publicado!');
  } catch (e) { err(e); } finally { busy.value = false; }
}
async function archive() {
  const ok = await ui.confirm({ title: 'Arquivar', msg: 'Tirar este post do ar? Ele some do site, mas fica salvo aqui.', confirmLabel: 'Arquivar', danger: true });
  if (!ok) return;
  busy.value = true;
  try { post.value = await useApi()<PostView>(`/admin/posts/${postId}/archive`, { method: 'POST' }); fill(post.value); ui.toast('info', 'Arquivado.'); }
  catch (e) { err(e); } finally { busy.value = false; }
}
// Destaque = manchete (hero) da home + topo de /noticias. Grava a coluna direto
// (fora do overlay draft), então não mexe no formulário/edições pendentes.
async function toggleFeatured() {
  if (!post.value) return;
  busy.value = true;
  try {
    const updated = await useApi()<PostView>(`/admin/posts/${postId}/featured`, { method: 'PATCH', body: { featured: !post.value.featured } });
    post.value = { ...post.value, featured: updated.featured };
    ui.toast('success', updated.featured ? 'Definido como manchete (destaque).' : 'Destaque removido.');
  } catch (e) { err(e); } finally { busy.value = false; }
}
// (Re)gera a capa do jogo (escudos + placar). Só funciona em matéria vinculada a
// um jogo (da esteira MATCH_REPORT). Não mexe no formulário.
async function regenCover() {
  if (!post.value) return;
  busy.value = true;
  try {
    const updated = await useApi()<PostView>(`/admin/posts/${postId}/cover`, { method: 'POST' });
    post.value = { ...post.value, coverUrl: updated.coverUrl };
    ui.toast('success', 'Capa gerada!');
  } catch (e) { err(e); } finally { busy.value = false; }
}
async function discardDraft() {
  const ok = await ui.confirm({ title: 'Descartar alterações', msg: 'Voltar a exibir a versão publicada e descartar as edições não publicadas?', confirmLabel: 'Descartar', danger: true });
  if (!ok) return;
  busy.value = true;
  try { post.value = await useApi()<PostView>(`/admin/posts/${postId}/discard-draft`, { method: 'POST' }); fill(post.value); ui.toast('info', 'Alterações descartadas.'); }
  catch (e) { err(e); } finally { busy.value = false; }
}
async function remove() {
  const ok = await ui.confirm({ title: 'Excluir post', msg: 'Excluir definitivamente? Não dá pra desfazer.', confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  try { await useApi()(`/admin/posts/${postId}`, { method: 'DELETE' }); ui.toast('info', 'Post excluído.'); navigateTo('/admin/posts'); }
  catch (e) { err(e); }
}

function addFaq() { form.faq.push({ question: '', answer: '' }); }
function removeFaq(i: number) { form.faq.splice(i, 1); }

const publicUrl = computed(() => (post.value?.publishedSlug ? `${siteUrl}/noticias/${post.value.publishedSlug}` : null));
const secondary = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [];
  if (publicUrl.value) items.push({ key: 'view', label: 'Ver no site', icon: 'externalLink', onSelect: () => window.open(publicUrl.value!, '_blank') });
  if (post.value?.fromEngine) items.push({ key: 'cover', label: 'Gerar capa do jogo', icon: 'refresh', onSelect: regenCover });
  if (post.value?.hasPendingChanges) items.push({ key: 'discard', label: 'Descartar alterações', icon: 'refresh', tone: 'azure', onSelect: discardDraft });
  if (post.value?.status === 'PUBLISHED') items.push({ key: 'archive', label: 'Arquivar (tirar do ar)', icon: 'inbox', onSelect: archive });
  items.push({ key: 'del', label: 'Excluir', icon: 'trash', tone: 'danger', onSelect: remove });
  return items;
});
</script>

<template>
  <div v-if="post">
    <AdminPageHeader :title="form.title || 'Post'" subtitle="Editor do CMS">
      <template #actions>
        <NuxtLink to="/admin/posts" class="btn">Voltar</NuxtLink>
        <button class="btn" :disabled="busy || !dirty" @click="saveAndToast">
          <AppIcon name="check" :size="14" :stroke="2.4" /> Salvar
        </button>
        <button class="btn btn-primary" :disabled="busy" @click="publish">
          <AppIcon name="check" :size="14" :stroke="2.4" /> {{ post.status === 'PUBLISHED' ? 'Publicar alterações' : 'Publicar' }}
        </button>
        <KebabMenu :items="secondary" :size="34" />
      </template>
    </AdminPageHeader>

    <div class="status-row">
      <StatusPill :label="postStatus(post.status).label" :tone="postStatus(post.status).tone" dot />
      <button
        v-if="post.status === 'PUBLISHED'"
        class="feat-toggle"
        :class="{ on: post.featured }"
        :disabled="busy"
        :title="post.featured ? 'É a manchete em destaque — clique para remover' : 'Destacar como manchete da home e topo das notícias'"
        @click="toggleFeatured"
      >
        <AppIcon name="star" :size="13" :stroke="2.2" /> {{ post.featured ? 'Manchete' : 'Destacar' }}
      </button>
      <span v-if="post.hasPendingChanges" class="pend"><AppIcon name="edit" :size="13" :stroke="2.2" /> alterações não publicadas</span>
      <span v-if="post.fromEngine" class="meta">origem: esteira</span>
      <a v-if="publicUrl" :href="publicUrl" target="_blank" rel="noopener" class="meta vlink">ver no site <AppIcon name="externalLink" :size="12" :stroke="2" /></a>
    </div>

    <figure v-if="post.coverUrl" class="cover-prev">
      <img :src="post.coverUrl" alt="Capa do jogo" />
    </figure>

    <div v-if="post.status === 'PUBLISHED'" class="iso-note">
      <AppIcon name="shield" :size="15" :stroke="2.2" /> Editar e <strong>Salvar</strong> não muda o que está no ar. Só <strong>Publicar alterações</strong> aplica.
    </div>

    <!-- Conteúdo -->
    <section class="card adm-panel ed-card">
      <h3 class="ctitle">Conteúdo</h3>
      <label class="fld full">
        <span class="fl">Título</span>
        <input v-model="form.title" class="input big" placeholder="Manchete do post" />
      </label>
      <div class="seo-grid">
        <label class="fld">
          <span class="fl">Slug (URL)</span>
          <input v-model="form.slug" class="input mono" placeholder="titulo-do-post" />
        </label>
        <label class="fld">
          <span class="fl">Linha-fina (dek)</span>
          <input v-model="form.dek" class="input" placeholder="Subtítulo / resposta direta" />
        </label>
      </div>
      <label class="fld full">
        <span class="fl">Corpo</span>
        <textarea v-model="form.body" class="input area body" rows="16" placeholder="Texto do post (parágrafos separados por linha em branco)" />
      </label>
    </section>

    <!-- Categoria & assuntos -->
    <section class="card adm-panel ed-card">
      <h3 class="ctitle">Categoria &amp; assuntos</h3>
      <p class="chint">Onde o post entra no site. Categoria é hierárquica (até 3 níveis); tags são criadas e reaproveitadas.</p>
      <PostTaxonomyFields v-model:category-id="categoryId" v-model:tags="tags" />
    </section>

    <!-- SEO & descoberta -->
    <section class="card adm-panel ed-card">
      <h3 class="ctitle">SEO &amp; descoberta</h3>
      <p class="chint">Metadados para Google e buscadores de IA (GEO). A prévia abaixo mostra como aparece no Google.</p>
      <div class="serp">
        <div class="serp-url">cravei.app › notícias › <span>{{ form.slug || 'slug-do-post' }}</span></div>
        <div class="serp-title">{{ form.metaTitle || form.title }}</div>
        <div class="serp-desc">{{ form.metaDescription || form.dek || '—' }}</div>
      </div>
      <div class="seo-grid">
        <label class="fld">
          <span class="fl">Meta título</span>
          <input v-model="form.metaTitle" class="input" maxlength="90" />
        </label>
        <label class="fld">
          <span class="fl">Palavra-chave</span>
          <input v-model="form.focusKeyword" class="input" />
        </label>
        <label class="fld full">
          <span class="fl">Meta descrição</span>
          <textarea v-model="form.metaDescription" class="input area" rows="2" maxlength="220" />
        </label>
        <label class="fld full">
          <span class="fl">Palavras-chave secundárias <em class="cc-muted">vírgula separa</em></span>
          <input v-model="form.keywords" class="input" />
        </label>
        <label class="fld full">
          <span class="fl">Alt da imagem de capa</span>
          <input v-model="form.imageAlt" class="input" />
        </label>
        <label class="fld full">
          <span class="fl">Resumo para buscadores (GEO) <em class="cc-muted">uma por linha</em></span>
          <textarea v-model="form.keyTakeaways" class="input area" rows="3" />
        </label>
      </div>

      <div class="faq-ed">
        <div class="faq-head">
          <span class="fl">Perguntas frequentes</span>
          <button class="btn btn-sm" type="button" @click="addFaq"><AppIcon name="plus" :size="13" :stroke="2.4" /> Adicionar</button>
        </div>
        <div v-for="(q, i) in form.faq" :key="i" class="faq-row">
          <input v-model="q.question" class="input" placeholder="Pergunta" />
          <textarea v-model="q.answer" class="input area" rows="2" placeholder="Resposta" />
          <button class="faq-x" type="button" title="Remover" @click="removeFaq(i)"><AppIcon name="close" :size="14" :stroke="2.2" /></button>
        </div>
        <p v-if="!form.faq.length" class="muted-txt">Nenhuma pergunta. Boas para aparecer em buscadores de IA.</p>
      </div>
    </section>
  </div>
  <div v-else-if="!loading" class="muted-txt">Post não encontrado.</div>
</template>

<style scoped>
.status-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.meta { font-size: 12px; color: var(--muted); font-weight: 600; }
.pend { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--gold); }
.feat-toggle { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--muted); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 11px; cursor: pointer; transition: color 0.15s, border-color 0.15s, background 0.15s; }
.feat-toggle:hover:not(:disabled) { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, var(--border)); }
.feat-toggle.on { color: #0a0e14; background: var(--gold); border-color: var(--gold); }
.feat-toggle:disabled { opacity: 0.55; cursor: not-allowed; }
.cover-prev { margin: 0 0 16px; max-width: 480px; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 12px; border: 1px solid var(--border); }
.cover-prev img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vlink { color: var(--azure); text-decoration: none; display: inline-flex; align-items: center; gap: 3px; }
.vlink:hover { text-decoration: underline; }
.iso-note { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text); background: color-mix(in srgb, var(--azure) 8%, transparent); border: 1px solid color-mix(in srgb, var(--azure) 30%, var(--border)); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; }
.ed-card { margin-bottom: 16px; }
.ctitle { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 4px; }
.chint { font-size: 11.5px; color: var(--muted); line-height: 1.45; margin: 0 0 14px; opacity: 0.85; }
.fld { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.fld.full { grid-column: 1 / -1; }
.fl { font-size: 12px; font-weight: 700; color: var(--muted); display: flex; align-items: center; gap: 8px; }
.fl em { font-style: normal; font-size: 11px; }
.cc-muted { color: var(--muted); opacity: 0.7; font-weight: 600; }
.big { font-size: 17px; font-weight: 700; }
.mono { font-family: ui-monospace, monospace; font-size: 13px; }
.area { resize: vertical; }
.body { font-size: 14.5px; line-height: 1.7; }
.seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
@media (max-width: 680px) { .seo-grid { grid-template-columns: 1fr; } }
.serp { border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; background: var(--bg-base); margin-bottom: 18px; max-width: 600px; }
.serp-url { font-size: 12.5px; color: var(--muted); margin-bottom: 3px; }
.serp-url span { color: var(--text); }
.serp-title { font-family: 'Oswald', sans-serif; font-size: 19px; line-height: 1.25; color: var(--azure); margin-bottom: 3px; }
.serp-desc { font-size: 13px; line-height: 1.5; color: var(--text); opacity: 0.82; }
.faq-ed { margin-top: 8px; border-top: 1px solid var(--border); padding-top: 16px; }
.faq-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.btn-sm { padding: 5px 10px; font-size: 12.5px; }
.faq-row { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 8px; align-items: start; margin-bottom: 8px; }
.faq-x { flex: none; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); border-radius: 8px; cursor: pointer; }
.faq-x:hover { color: #fff; background: var(--scarlet); border-color: var(--scarlet); }
@media (max-width: 680px) { .faq-row { grid-template-columns: 1fr auto; } }
.muted-txt { font-size: 13px; color: var(--muted); }
</style>
