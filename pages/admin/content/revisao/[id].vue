<script setup lang="ts">
import type { NewsItem, NewsTone, Paginated } from '~/types/api';
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

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function load() {
  loading.value = true;
  try {
    item.value = await useApi()<NewsItem>(`/admin/content/items/${itemId}`);
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

const factEntries = computed<[string, unknown][]>(() => {
  const f = item.value?.facts;
  if (!f) return [];
  return Object.entries(f).filter(([, v]) => v != null && (!Array.isArray(v) || v.length > 0));
});
function factValue(v: unknown): string {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === 'object' && x ? JSON.stringify(x) : String(x))).join(' · ');
  }
  return String(v);
}

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
  busy.value = true;
  try {
    await useApi()(`/admin/content/items/${itemId}/reprocess`, {
      method: 'POST',
      body: { guidance: guidance.value.trim() || undefined, toneId: toneOverride.value || undefined, force },
    });
    ui.toast('success', 'Regerado com a orientação.');
    guidance.value = '';
    await load();
  } catch (e: unknown) {
    const ex = e as { data?: { code?: string; message?: string } };
    if (ex?.data?.code === 'CAP_EXCEEDED') {
      busy.value = false;
      if (await ui.confirm({ title: 'Limite do dia atingido', msg: ex.data.message ?? '', confirmLabel: 'Gerar mesmo assim', danger: true })) {
        await reprocess(true);
      }
      return;
    }
    err(e);
  } finally { busy.value = false; }
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
      <div class="vw-head"><AppIcon name="shield" :size="16" :stroke="2.2" /> A verificação (contra a fonte) encontrou problemas — fidelidade ou derivação</div>
      <ul class="vw-list">
        <li v-for="(line, i) in (item.verifyNotes || '').split('\n').filter(Boolean)" :key="i">{{ line }}</li>
      </ul>
      <p class="vw-hint">Confira esses pontos antes de aprovar — ou use <strong>Regerar</strong> pra corrigir.</p>
    </div>

    <div class="cols">
      <section class="card adm-panel col">
        <h3 class="ctitle">Texto gerado</h3>
        <p class="chint">A matéria reescrita no tom — pronta para publicar.</p>
        <pre v-if="item.generatedText" class="gen">{{ item.generatedText }}</pre>
        <p v-else class="muted-txt">Sem texto. {{ item.error ?? '' }}</p>
      </section>

      <section class="card adm-panel col">
        <h3 class="ctitle">Fatos extraídos</h3>
        <p class="chint">O que o robô apurou da fonte — a ÚNICA base do texto (evita inventar).</p>
        <dl v-if="factEntries.length" class="facts">
          <template v-for="[k, v] in factEntries" :key="k">
            <dt>{{ k }}</dt>
            <dd>{{ factValue(v) }}</dd>
          </template>
        </dl>
        <p v-else class="muted-txt">Sem fatos.</p>
      </section>

      <section class="card adm-panel col">
        <h3 class="ctitle">Fonte original</h3>
        <p class="chint">A notícia de origem. O texto NÃO é copiado — serve só para apurar os fatos.</p>
        <p class="src-title">{{ item.sourceTitle }}</p>
        <div class="src-body">{{ item.sourceText || item.sourceSummary || '—' }}</div>
        <a :href="item.sourceUrl" target="_blank" rel="noopener" class="btn btn-sm">
          <AppIcon name="externalLink" :size="14" :stroke="2" /> Abrir notícia
        </a>
      </section>
    </div>

    <div class="card adm-panel actbar">
      <div class="reproc">
        <label>Reprocessar com orientação</label>
        <textarea v-model="guidance" class="input area" rows="2" placeholder="Ex.: menos ironia, cite o placar no começo…" />
        <div class="reproc-row">
          <select v-model="toneOverride" class="input">
            <option value="">Manter tom ({{ item.tone?.name ?? 'auto' }})</option>
            <option v-for="t in tones" :key="t.id" :value="t.id">Trocar p/ {{ t.name }}</option>
          </select>
          <button class="btn" :disabled="busy" @click="reprocess()">
            <AppIcon name="refresh" :size="14" :stroke="2.2" /> Regerar
          </button>
        </div>
      </div>
      <div class="decide">
        <button class="btn" :disabled="busy" @click="exportText"><AppIcon name="share" :size="14" :stroke="2" /> Copiar texto</button>
        <button class="btn reject-btn" :disabled="busy" @click="reject"><AppIcon name="close" :size="14" :stroke="2.2" /> Rejeitar</button>
        <button class="btn btn-primary" :disabled="busy || item.status === 'APPROVED'" @click="approve">
          <AppIcon name="check" :size="14" :stroke="2.4" /> Aprovar
        </button>
      </div>
    </div>

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
      <h3 class="ctitle">Histórico de gerações</h3>
      <div v-for="r in item.revisions" :key="r.id" class="rev">
        <div class="rev-head">
          <strong>#{{ r.attempt }}</strong>
          <span v-if="r.guidance" class="rev-guid">“{{ r.guidance }}”</span>
          <span v-else class="muted-txt">geração inicial</span>
        </div>
        <pre class="rev-text">{{ r.generatedText }}</pre>
      </div>
    </div>
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
.cols { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 16px; }
@media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
.col { min-height: 120px; }
.ctitle { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 4px; }
.chint { font-size: 11.5px; color: var(--muted); line-height: 1.45; margin: 0 0 12px; opacity: 0.85; }
.gen { white-space: pre-wrap; font: inherit; font-size: 14px; line-height: 1.6; margin: 0; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: 13px; }
.facts dt { font-weight: 700; color: var(--muted); }
.facts dd { margin: 0; }
.src-title { font-weight: 700; font-size: 14px; margin: 0 0 8px; }
.src-body { font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0 0 12px; max-height: 360px; overflow-y: auto; white-space: pre-wrap; }
.muted-txt { font-size: 13px; color: var(--muted); }
.actbar { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; align-items: flex-end; }
.reproc { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 6px; }
.reproc > label { font-size: 12px; font-weight: 700; color: var(--muted); }
.area { resize: vertical; }
.reproc-row { display: flex; gap: 8px; }
.reproc-row .input { flex: 1; }
.decide { display: flex; gap: 8px; align-items: flex-end; }
.reject-btn { color: var(--scarlet); }
.btn-sm { padding: 6px 10px; font-size: 12px; }
.rev { border-top: 1px solid var(--border); padding: 12px 0; }
.rev:first-of-type { border-top: none; }
.rev-head { font-size: 13px; margin-bottom: 6px; }
.rev-guid { color: var(--azure); font-style: italic; margin-left: 6px; }
.rev-text { white-space: pre-wrap; font: inherit; font-size: 13px; color: var(--muted); line-height: 1.5; margin: 0; }
.dups { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.dup-src { display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-right: 6px; }
</style>
