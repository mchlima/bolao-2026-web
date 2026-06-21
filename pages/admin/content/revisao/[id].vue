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
const expandedRev = ref<string | null>(null);
const regenerating = ref(false);
const showRegen = ref(false);

function confirmRegen() {
  showRegen.value = false;
  void reprocess();
}

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
/* Largura de leitura confortável (medida ~66 caracteres) */
.gen-inner { max-width: 660px; }
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
</style>
