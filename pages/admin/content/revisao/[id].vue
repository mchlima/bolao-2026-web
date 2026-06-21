<script setup lang="ts">
import type { NewsItem, NewsItemSeo, NewsTone, Paginated } from '~/types/api';
import { newsStatus } from '~/utils/content';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const route = useRoute();
const ui = useUiStore();
const itemId = route.params.id as string;

const item = ref<NewsItem | null>(null);
const tones = ref<NewsTone[]>([]);
const loading = ref(true);
const busy = ref(false);
const guidance = ref('');
const toneOverride = ref('');
const expandedRev = ref<string | null>(null);
const regenerating = ref(false);
const showRegen = ref(false);
const savingSeo = ref(false);

// Cópia editável do SEO/GEO (a edição vai pro PATCH :id/seo, mesclando no gerado).
const seoForm = reactive({
  slug: '', metaTitle: '', metaDescription: '', dek: '', focusKeyword: '', keywords: '',
});
function syncSeoForm() {
  const s: NewsItemSeo = item.value?.seo ?? {};
  seoForm.slug = s.slug ?? '';
  seoForm.metaTitle = s.metaTitle ?? '';
  seoForm.metaDescription = s.metaDescription ?? '';
  seoForm.dek = s.dek ?? '';
  seoForm.focusKeyword = s.focusKeyword ?? '';
  seoForm.keywords = (s.keywords ?? []).join(', ');
}
const seo = computed<NewsItemSeo>(() => item.value?.seo ?? {});
const hasSeo = computed(() => !!item.value?.seo && Object.keys(item.value.seo).length > 0);
const seoDirty = computed(() => {
  const s = item.value?.seo ?? {};
  return (
    seoForm.slug !== (s.slug ?? '') ||
    seoForm.metaTitle !== (s.metaTitle ?? '') ||
    seoForm.metaDescription !== (s.metaDescription ?? '') ||
    seoForm.dek !== (s.dek ?? '') ||
    seoForm.focusKeyword !== (s.focusKeyword ?? '') ||
    seoForm.keywords !== (s.keywords ?? []).join(', ')
  );
});
// Saúde do comprimento: fora da faixa ideal vira alerta (laranja); vazio fica neutro.
function lenClass(n: number, lo: number, hi: number): string {
  if (!n) return 'cc-muted';
  return n < lo || n > hi ? 'cc-warn' : 'cc-ok';
}

function confirmRegen() {
  showRegen.value = false;
  void reprocess();
}

async function saveSeo() {
  savingSeo.value = true;
  try {
    const list = (v: string) => v.split(',').map((t) => t.trim()).filter(Boolean);
    await useApi()(`/admin/content/items/${itemId}/seo`, {
      method: 'PATCH',
      body: {
        slug: seoForm.slug.trim(),
        metaTitle: seoForm.metaTitle.trim(),
        metaDescription: seoForm.metaDescription.trim(),
        dek: seoForm.dek.trim(),
        focusKeyword: seoForm.focusKeyword.trim(),
        keywords: list(seoForm.keywords),
      },
    });
    await load();
    ui.toast('success', 'SEO salvo.');
  } catch (e) { err(e); } finally { savingSeo.value = false; }
}

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function load() {
  loading.value = true;
  try {
    item.value = await useApi()<NewsItem>(`/admin/content/items/${itemId}`);
    syncSeoForm();
  } catch {
    ui.toast('error', 'Não foi possível carregar o item.');
  } finally {
    loading.value = false;
  }
}
onMounted(async () => {
  await load();
  try {
    const t = await useApi()<Paginated<NewsTone>>('/admin/content/tones?pageSize=100');
    tones.value = t.data;
  } catch { /* ignore */ }
  toneOverride.value = item.value?.toneId ?? '';
});

// Item de fonte generativa (ex.: resumo de jogo): não há prosa-fonte de terceiro —
// os fatos ao lado SÃO a base; a "fonte" é o nosso banco.
const isGenerated = computed(
  () => item.value?.feed?.type === 'MATCH_REPORT' || (item.value?.sourceUrl?.startsWith('match:') ?? false),
);

const factEntries = computed<[string, unknown][]>(() => {
  const f = item.value?.facts;
  if (!f) return [];
  return Object.entries(f).filter(([, v]) => v != null && (!Array.isArray(v) || v.length > 0));
});
const factsData = computed(() => Object.fromEntries(factEntries.value));

// Primeira linha do texto = manchete; resto = corpo.
const genTitle = computed(() => (item.value?.generatedText ?? '').split('\n')[0]?.trim() ?? '');
const genBody = computed(() => (item.value?.generatedText ?? '').split('\n').slice(1).join('\n').trim());
const genParagraphs = computed(() => genBody.value.split(/\n+/).map((s) => s.trim()).filter(Boolean));
function revWhen(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function toggleRev(id: string) { expandedRev.value = expandedRev.value === id ? null : id; }

async function approve() {
  busy.value = true;
  try {
    await useApi()(`/admin/content/items/${itemId}/approve`, { method: 'POST' });
    ui.toast('success', 'Aprovado!');
    await load();
  } catch (e) { err(e); } finally { busy.value = false; }
}
async function reject() {
  const ok = await ui.confirm({ title: 'Rejeitar', msg: 'Descartar esta matéria?', confirmLabel: 'Rejeitar', danger: true });
  if (!ok) return;
  busy.value = true;
  try {
    await useApi()(`/admin/content/items/${itemId}/reject`, { method: 'POST' });
    ui.toast('info', 'Rejeitado.');
    await load();
  } catch (e) { err(e); } finally { busy.value = false; }
}
async function reprocess(force = false) {
  regenerating.value = true;
  busy.value = true;
  try {
    await useApi()(`/admin/content/items/${itemId}/reprocess`, {
      method: 'POST',
      body: { guidance: guidance.value.trim() || undefined, toneId: toneOverride.value || undefined, force },
    });
    await load();
    expandedRev.value = null;
    ui.toast('success', 'Nova versão gerada.');
    guidance.value = '';
  } catch (e: unknown) {
    const ex = e as { data?: { code?: string; message?: string } };
    if (ex?.data?.code === 'CAP_EXCEEDED') {
      regenerating.value = false;
      busy.value = false;
      if (await ui.confirm({ title: 'Limite do dia atingido', msg: ex.data.message ?? '', confirmLabel: 'Gerar mesmo assim', danger: true })) {
        await reprocess(true);
      }
      return;
    }
    err(e);
  } finally { regenerating.value = false; busy.value = false; }
}
async function exportText() {
  try {
    const r = await useApi()<{ filename: string; content: string }>(`/admin/content/items/${itemId}/export`);
    await navigator.clipboard.writeText(r.content);
    ui.toast('success', 'Texto copiado!');
  } catch (e) { err(e); }
}
</script>

<template>
  <div v-if="item">
    <AdminPageHeader :title="item.sourceTitle" :subtitle="`${item.feed?.name ?? ''}  ·  ${item.tone?.name ?? ''}`">
      <template #actions>
        <NuxtLink to="/admin/content/revisao" class="btn">Voltar</NuxtLink>
      </template>
    </AdminPageHeader>

    <div class="status-row">
      <StatusPill :label="newsStatus(item.status).label" :tone="newsStatus(item.status).tone" dot />
      <span v-if="item.model" class="meta">{{ item.model }}</span>
      <span v-if="item.relevanceScore != null" class="meta">relevância {{ Math.round(item.relevanceScore * 100) }}%</span>
      <span v-if="item.verifyOk === true" class="meta verify-ok"><AppIcon name="check" :size="13" :stroke="2.4" /> fidelidade ok</span>
    </div>

    <div v-if="item.verifyOk === false" class="card adm-panel verify-warn">
      <div class="vw-head"><AppIcon name="shield" :size="16" :stroke="2.2" /> {{ isGenerated ? 'A verificação (contra os fatos) encontrou afirmações sem lastro' : 'A verificação (contra a fonte) encontrou problemas — fidelidade ou derivação' }}</div>
      <ul class="vw-list">
        <li v-for="(line, i) in (item.verifyNotes || '').split('\n').filter(Boolean)" :key="i">{{ line }}</li>
      </ul>
      <p class="vw-hint">Confira esses pontos antes de aprovar — ou use <strong>Regerar</strong> pra corrigir.</p>
    </div>

    <!-- Ações acima do texto gerado -->
    <div class="actbar">
      <button class="btn" :disabled="busy" @click="showRegen = true">
        <AppIcon name="refresh" :size="14" :stroke="2.2" :class="{ spin: regenerating }" /> {{ regenerating ? 'Gerando…' : 'Regerar' }}
      </button>
      <div class="act-decide">
        <button class="btn reject-btn" :disabled="busy" @click="reject"><AppIcon name="close" :size="14" :stroke="2.2" /> Rejeitar</button>
        <button class="btn btn-primary" :disabled="busy || item.status === 'APPROVED'" @click="approve">
          <AppIcon name="check" :size="14" :stroke="2.4" /> Aprovar
        </button>
      </div>
    </div>

    <!-- Texto (esquerda) + fatos (direita) -->
    <div class="cols">
    <!-- Texto gerado: protagonista, com manchete em destaque -->
    <section class="card adm-panel gen-card" :class="{ generating: regenerating }">
      <div v-if="regenerating" class="gen-overlay">
        <AppIcon name="refresh" :size="18" :stroke="2.4" class="spin" /> Gerando nova versão…
      </div>
      <button v-if="item.generatedText" class="copy-btn" title="Copiar texto" :disabled="busy" @click="exportText">
        <AppIcon name="copy" :size="15" :stroke="2.2" />
      </button>
      <div class="gen-inner">
        <template v-if="item.generatedText">
          <h2 class="gen-title">{{ genTitle }}</h2>
          <div class="gen-body">
            <p v-for="(p, i) in genParagraphs" :key="i" class="gen-p">{{ p }}</p>
          </div>
        </template>
        <p v-else class="muted-txt">Sem texto. {{ item.error ?? '' }}</p>
      </div>

      <!-- Origem como referência compacta (link/ref, não o conteúdo todo) -->
      <div class="origin">
        <template v-if="isGenerated">
          <AppIcon name="check" :size="13" :stroke="2.4" />
          <span>Gerada do <strong>nosso banco</strong> · {{ item.feed?.name ?? 'Resumo de jogo' }}</span>
        </template>
        <template v-else>
          <span class="origin-label">Origem</span>
          <a :href="item.sourceUrl" target="_blank" rel="noopener" class="origin-link">
            {{ item.feed?.name ?? 'fonte' }} — {{ item.sourceTitle }}
            <AppIcon name="externalLink" :size="12" :stroke="2" />
          </a>
        </template>
      </div>
    </section>

    <!-- Fatos: painel lateral, altura do texto, com scroll interno -->
    <section class="card adm-panel facts-card">
      <div class="facts-scroll">
        <div class="facts-head">
          Fatos extraídos <span class="facts-count">{{ factEntries.length }}</span>
        </div>
        <div class="facts-wrap">
          <p class="chint">A base do texto — {{ isGenerated ? 'montada do nosso banco' : 'apurada da fonte' }}. O gerador só usa isto (evita inventar).</p>
          <FactTree v-if="factEntries.length" :data="factsData" />
          <p v-else class="muted-txt">Sem fatos.</p>
        </div>
      </div>
    </section>
    </div>

    <!-- Categoria & assuntos: o admin seleciona as entidades (cria se não existir) -->
    <section v-if="item.generatedText" class="card adm-panel">
      <h3 class="ctitle">Categoria &amp; assuntos</h3>
      <p class="chint">Onde a matéria entra no site. A IA sugeriu a partir dos fatos — confirme ou ajuste. Categoria é hierárquica (até 3 níveis); tags novas são criadas e reaproveitadas.</p>
      <ItemTaxonomyPicker
        :item-id="itemId"
        :category="item.category ?? null"
        :tags="item.tags ?? []"
        :suggested-category="seo.category"
        :suggested-tags="seo.tags"
        @saved="load"
      />
    </section>

    <!-- SEO & descoberta: gerado junto com a matéria para tráfego orgânico (Google + IA) -->
    <section v-if="item.generatedText" class="card adm-panel seo-card">
      <div class="seo-head">
        <div>
          <h3 class="ctitle">SEO &amp; descoberta</h3>
          <p class="chint">Gerado com a matéria para ser achada no Google e citada por buscadores de IA (GEO). Ajuste antes de publicar.</p>
        </div>
        <button class="btn btn-primary seo-save" :disabled="!seoDirty || savingSeo" @click="saveSeo">
          <AppIcon name="check" :size="14" :stroke="2.4" /> {{ savingSeo ? 'Salvando…' : 'Salvar SEO' }}
        </button>
      </div>

      <template v-if="hasSeo">
        <!-- Prévia de resultado no Google -->
        <div class="serp">
          <div class="serp-url">cravei.app › notícias › <span>{{ seoForm.slug || 'slug-da-materia' }}</span></div>
          <div class="serp-title">{{ seoForm.metaTitle || genTitle }}</div>
          <div class="serp-desc">{{ seoForm.metaDescription || seoForm.dek || '—' }}</div>
        </div>

        <!-- Campos editáveis -->
        <div class="seo-grid">
          <label class="fld">
            <span class="fl">Meta título <em :class="lenClass(seoForm.metaTitle.length, 30, 60)">{{ seoForm.metaTitle.length }}/60</em></span>
            <input v-model="seoForm.metaTitle" class="input" maxlength="90" />
          </label>
          <label class="fld">
            <span class="fl">Slug (URL)</span>
            <input v-model="seoForm.slug" class="input mono" placeholder="brasil-x-marrocos-copa" />
          </label>
          <label class="fld full">
            <span class="fl">Meta descrição <em :class="lenClass(seoForm.metaDescription.length, 120, 155)">{{ seoForm.metaDescription.length }}/155</em></span>
            <textarea v-model="seoForm.metaDescription" class="input area" rows="2" maxlength="220" />
          </label>
          <label class="fld full">
            <span class="fl">Linha-fina (resposta direta — GEO)</span>
            <input v-model="seoForm.dek" class="input" />
          </label>
          <label class="fld full">
            <span class="fl">Palavra-chave</span>
            <input v-model="seoForm.focusKeyword" class="input" />
          </label>
          <label class="fld full">
            <span class="fl">Palavras-chave secundárias <em class="cc-muted">vírgula separa</em></span>
            <input v-model="seoForm.keywords" class="input" />
          </label>
        </div>

        <!-- GEO: resumo extraível + FAQ (gerados; lastro auditado junto com o texto) -->
        <div v-if="(seo.keyTakeaways?.length || seo.faq?.length)" class="geo">
          <div v-if="seo.keyTakeaways?.length" class="geo-col">
            <div class="geo-h">Resumo para buscadores (GEO)</div>
            <ul class="tk">
              <li v-for="(t, i) in seo.keyTakeaways" :key="i">{{ t }}</li>
            </ul>
          </div>
          <div v-if="seo.faq?.length" class="geo-col">
            <div class="geo-h">Perguntas frequentes</div>
            <div v-for="(q, i) in seo.faq" :key="i" class="faq">
              <p class="faq-q">{{ q.question }}</p>
              <p class="faq-a">{{ q.answer }}</p>
            </div>
          </div>
        </div>
        <p v-if="seo.imageAlt" class="alt-line"><strong>Alt da imagem de capa:</strong> {{ seo.imageAlt }}</p>
      </template>
      <p v-else class="muted-txt">Este item foi gerado antes do SEO/GEO. Use <strong>Regerar</strong> para criar o pacote.</p>
    </section>

    <div v-if="item.duplicates && item.duplicates.length" class="card adm-panel">
      <h3 class="ctitle">Outras fontes do mesmo assunto ({{ item.duplicates.length }})</h3>
      <p class="chint">Notícias que o robô identificou como o mesmo acontecimento e suprimiu (não gerou texto delas). Esta é a matéria que prevaleceu.</p>
      <ul class="dups">
        <li v-for="d in item.duplicates" :key="d.id">
          <span class="dup-src">{{ d.feed?.name ?? '—' }}</span>
          {{ d.sourceTitle }}
        </li>
      </ul>
    </div>

    <div v-if="item.revisions && item.revisions.length > 1" class="card adm-panel">
      <h3 class="ctitle">Histórico de gerações ({{ item.revisions.length }})</h3>
      <p class="chint">Cada tentativa e a orientação que a produziu. Clique para ver o texto.</p>
      <ul class="rev-list">
        <li v-for="r in [...item.revisions].reverse()" :key="r.id" class="rev-item">
          <button type="button" class="rev-row" @click="toggleRev(r.id)">
            <AppIcon :name="expandedRev === r.id ? 'chevronDown' : 'chevronRight'" :size="14" :stroke="2.4" />
            <strong class="rev-n">#{{ r.attempt }}</strong>
            <span v-if="r.guidance" class="rev-guid">orientação: “{{ r.guidance }}”</span>
            <span v-else class="rev-init">geração inicial (sem orientação)</span>
            <span class="rev-when">{{ revWhen(r.createdAt) }}</span>
          </button>
          <pre v-if="expandedRev === r.id" class="rev-text">{{ r.generatedText }}</pre>
        </li>
      </ul>
    </div>

    <AppModal v-if="showRegen" title="Regerar matéria" @close="showRegen = false">
      <p class="rg-hint">
        Gera uma <strong>nova versão</strong> a partir dos mesmos fatos. Oriente o ajuste e/ou troque o tom — a versão atual fica no histórico.
      </p>
      <label class="rg-label">Orientação <span class="opt">(opcional)</span></label>
      <textarea v-model="guidance" class="input area" rows="3" placeholder="Ex.: menos ironia, cite o placar no começo, encurte o fecho…" />
      <label class="rg-label">Tom</label>
      <select v-model="toneOverride" class="input">
        <option value="">Manter tom ({{ item.tone?.name ?? 'auto' }})</option>
        <option v-for="t in tones" :key="t.id" :value="t.id">Trocar p/ {{ t.name }}</option>
      </select>
      <template #footer>
        <button class="btn" @click="showRegen = false">Cancelar</button>
        <button class="btn btn-primary" @click="confirmRegen">
          <AppIcon name="refresh" :size="14" :stroke="2.2" /> Gerar nova versão
        </button>
      </template>
    </AppModal>
  </div>
  <div v-else-if="!loading" class="muted-txt">Item não encontrado.</div>
</template>

<style scoped>
.status-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.meta { font-size: 12px; color: var(--muted); font-weight: 600; }
.verify-ok { color: var(--emerald); display: inline-flex; align-items: center; gap: 3px; }
.verify-warn { border-left: 4px solid var(--gold); margin-bottom: 16px; }
.vw-head { font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px; color: var(--gold); }
.vw-list { margin: 8px 0 0; padding-left: 20px; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 4px; }
.vw-hint { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
.ctitle { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 4px; }
.chint { font-size: 11.5px; color: var(--muted); line-height: 1.45; margin: 0 0 12px; opacity: 0.85; }

/* Texto (esquerda) + fatos (direita) — colunas com a MESMA altura (stretch) */
.cols { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(250px, 0.8fr); gap: 16px; align-items: stretch; margin-bottom: 16px; }
@media (max-width: 1000px) { .cols { grid-template-columns: 1fr; } .facts-card { max-height: 70vh; } }

/* Texto gerado — protagonista (quadro de leitura) */
.gen-card { position: relative; padding: 28px 30px; }
.gen-card.generating { opacity: 0.55; pointer-events: none; }
.gen-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--text); background: color-mix(in srgb, var(--bg-surface) 70%, transparent); border-radius: inherit; z-index: 2; }
.copy-btn { position: absolute; top: 20px; right: 20px; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); background: var(--bg-base); color: var(--muted); border-radius: 9px; cursor: pointer; z-index: 1; transition: color 0.15s, border-color 0.15s; }
.copy-btn:hover { color: var(--azure); border-color: var(--azure); }
/* Largura de leitura confortável (medida ~66 caracteres), bloco centralizado no card
   mas com o texto alinhado à esquerda */
.gen-inner { max-width: 660px; margin: 0 auto; }
.gen-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 26px; line-height: 1.2; letter-spacing: -0.01em; margin: 0 0 8px; padding-right: 40px; }
.gen-title::after { content: ''; display: block; width: 48px; height: 3px; border-radius: 3px; background: var(--grad-pitch); margin-top: 14px; }
.gen-body { font-size: 16px; line-height: 1.75; color: var(--text); }
.gen-p { margin: 0 0 16px; }
.gen-p:last-child { margin-bottom: 0; }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Origem como referência compacta */
.origin { display: flex; align-items: center; gap: 6px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 12.5px; color: var(--muted); }
.origin-label { font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
.origin-link { color: var(--azure); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.origin-link:hover { text-decoration: underline; }

/* Fatos: painel lateral à direita, na altura do texto, com scroll interno */
.facts-card { position: relative; overflow: hidden; padding: 0; }
.facts-scroll { position: absolute; inset: 0; overflow-y: auto; padding: 16px; }
.facts-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: var(--text); text-transform: uppercase; letter-spacing: 0.04em; }
.facts-count { background: var(--bg-base); border: 1px solid var(--border); border-radius: 20px; padding: 1px 8px; font-size: 11px; font-weight: 700; color: var(--muted); }
.facts-wrap { margin-top: 12px; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: 13px; }
.facts dt { font-weight: 700; color: var(--muted); }
.facts dd { margin: 0; word-break: break-word; }
.muted-txt { font-size: 13px; color: var(--muted); }
/* Barra de ações acima do texto gerado */
.actbar { margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; }
.act-decide { display: flex; gap: 8px; align-items: center; }
.reject-btn { color: var(--scarlet); }
.area { resize: vertical; }
.rg-hint { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0 0 14px; }
.rg-label { display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin: 12px 0 5px; }
.rg-label .opt { font-weight: 600; opacity: 0.7; }
.rev-list { list-style: none; margin: 8px 0 0; padding: 0; }
.rev-item { border-top: 1px solid var(--border); }
.rev-item:first-child { border-top: none; }
.rev-row { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; padding: 10px 0; cursor: pointer; font-size: 13px; color: var(--text); text-align: left; }
.rev-row:hover { color: var(--azure); }
.rev-n { flex-shrink: 0; }
.rev-guid { color: var(--azure); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rev-init { color: var(--muted); }
.rev-when { margin-left: auto; flex-shrink: 0; font-size: 11.5px; color: var(--muted); }
.rev-text { white-space: pre-wrap; font: inherit; font-size: 13px; color: var(--muted); line-height: 1.55; margin: 0 0 12px; padding: 10px 12px; background: var(--bg-base); border-radius: 8px; }
.dups { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.dup-src { display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-right: 6px; }

/* SEO & descoberta */
.seo-card { margin-bottom: 16px; }
.seo-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.seo-head .chint { margin: 4px 0 0; }
.seo-save { flex-shrink: 0; }
/* Prévia estilo Google */
.serp { border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; background: var(--bg-base); margin-bottom: 18px; max-width: 600px; }
.serp-url { font-size: 12.5px; color: var(--muted); margin-bottom: 3px; }
.serp-url span { color: var(--text); }
.serp-title { font-family: 'Oswald', sans-serif; font-size: 19px; line-height: 1.25; color: var(--azure); margin-bottom: 3px; }
.serp-desc { font-size: 13px; line-height: 1.5; color: var(--text); opacity: 0.82; }
/* Grade de campos */
.seo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.fld { display: flex; flex-direction: column; gap: 5px; }
.fld.full { grid-column: 1 / -1; }
.fl { font-size: 12px; font-weight: 700; color: var(--muted); display: flex; align-items: center; gap: 8px; }
.fl em { font-style: normal; font-weight: 700; font-size: 11px; }
.cc-ok { color: var(--emerald); }
.cc-warn { color: var(--gold); }
.cc-muted { color: var(--muted); opacity: 0.7; font-weight: 600; }
.mono { font-family: ui-monospace, monospace; font-size: 13px; }
@media (max-width: 680px) { .seo-grid { grid-template-columns: 1fr; } }
/* GEO: resumo + FAQ */
.geo { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border); }
@media (max-width: 680px) { .geo { grid-template-columns: 1fr; } }
.geo-h { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 10px; }
.tk { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; font-size: 13.5px; line-height: 1.5; }
.faq { margin-bottom: 12px; }
.faq:last-child { margin-bottom: 0; }
.faq-q { font-weight: 700; font-size: 13.5px; margin: 0 0 2px; }
.faq-a { font-size: 13px; line-height: 1.5; color: var(--text); opacity: 0.85; margin: 0; }
.alt-line { font-size: 12.5px; color: var(--muted); margin: 16px 0 0; padding-top: 14px; border-top: 1px solid var(--border); }
.alt-line strong { color: var(--text); }
</style>
