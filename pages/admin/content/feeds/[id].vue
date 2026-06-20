<script setup lang="ts">
import type { NewsFeed, NewsFeedType, NewsTone, FeedPreview, Paginated } from '~/types/api';

definePageMeta({ layout: 'admin', middleware: 'admin' });
const route = useRoute();
const ui = useUiStore();
const isNew = computed(() => route.params.id === 'new');
const feedId = ref<string | null>(isNew.value ? null : (route.params.id as string));
const loaded = ref(isNew.value);
const saving = ref(false);

const form = reactive({
  name: '',
  url: '',
  type: 'RSS' as NewsFeedType,
  configText: '',
  defaultToneId: '',
  fetchIntervalMin: 15,
  isActive: true,
});

const TYPES: { key: NewsFeedType; label: string }[] = [
  { key: 'RSS', label: 'RSS' },
  { key: 'NEWS_API', label: 'API de notícias' },
  { key: 'PAGE', label: 'Página (crawl)' },
];
const URL_LABEL: Record<NewsFeedType, string> = {
  RSS: 'URL do RSS',
  NEWS_API: 'URL do endpoint da API',
  PAGE: 'URL da página/seção',
};
const CONFIG_PLACEHOLDER: Record<NewsFeedType, string> = {
  RSS: '',
  NEWS_API:
    '{\n  "apiKeyParam": "apikey",\n  "apiKey": "SUA_CHAVE",\n  "itemsPath": "results",\n  "map": {\n    "title": "title", "url": "link", "publishedAt": "pubDate",\n    "summary": "description", "content": "content"\n  }\n}',
  PAGE: '{\n  "linkPattern": "/futebol/.+/noticia/",\n  "limit": 25\n}',
};

const tones = ref<NewsTone[]>([]);
const preview = ref<FeedPreview | null>(null);
const testing = ref(false);

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

onMounted(async () => {
  try {
    const t = await useApi()<Paginated<NewsTone>>('/admin/content/tones?pageSize=100');
    tones.value = t.data;
  } catch { /* ignore */ }
  if (!isNew.value) {
    try {
      const f = await useApi()<NewsFeed>(`/admin/content/feeds/${feedId.value}`);
      form.name = f.name;
      form.url = f.url;
      form.type = f.type;
      form.configText = f.config ? JSON.stringify(f.config, null, 2) : '';
      form.defaultToneId = f.defaultToneId ?? '';
      form.fetchIntervalMin = f.fetchIntervalMin;
      form.isActive = f.isActive;
    } catch {
      ui.toast('error', 'Não foi possível carregar a fonte.');
    }
  }
  loaded.value = true;
});

async function testUrl() {
  if (!form.url) return;
  testing.value = true;
  preview.value = null;
  try {
    preview.value = await useApi()<FeedPreview>('/admin/content/feeds/preview', {
      method: 'POST', body: { url: form.url },
    });
    ui.toast('success', 'RSS válido!');
  } catch (e) {
    err(e);
  } finally {
    testing.value = false;
  }
}

function parseConfig(): Record<string, unknown> | null {
  if (form.type === 'RSS' || !form.configText.trim()) return null;
  return JSON.parse(form.configText) as Record<string, unknown>;
}

async function save() {
  if (!form.name.trim() || !form.url.trim()) {
    ui.toast('error', 'Nome e URL são obrigatórios.');
    return;
  }
  let config: Record<string, unknown> | null;
  try {
    config = parseConfig();
  } catch {
    ui.toast('error', 'A config não é um JSON válido.');
    return;
  }
  saving.value = true;
  const body = {
    name: form.name.trim(),
    url: form.url.trim(),
    type: form.type,
    config,
    defaultToneId: form.defaultToneId || null,
    fetchIntervalMin: form.fetchIntervalMin,
    isActive: form.isActive,
  };
  try {
    if (isNew.value) await useApi()('/admin/content/feeds', { method: 'POST', body });
    else await useApi()(`/admin/content/feeds/${feedId.value}`, { method: 'PATCH', body });
    ui.toast('success', 'Fonte salva.');
    navigateTo('/admin/content/feeds');
  } catch (e) {
    err(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <AdminPageHeader :title="isNew ? 'Nova fonte' : 'Editar fonte'" subtitle="De onde vêm as notícias: RSS, API de notícias ou crawl de página.">
      <template #actions>
        <NuxtLink to="/admin/content/feeds" class="btn">Voltar</NuxtLink>
      </template>
    </AdminPageHeader>

    <div v-if="loaded" class="card adm-panel form-wrap">
      <div class="adm-form">
        <label>Tipo de fonte</label>
        <div class="type-seg">
          <button
            v-for="t in TYPES"
            :key="t.key"
            type="button"
            class="type-btn"
            :class="{ on: form.type === t.key }"
            @click="form.type = t.key"
          >
            {{ t.label }}
          </button>
        </div>

        <label>Nome</label>
        <input v-model="form.name" class="input" maxlength="120" placeholder="Ex.: ge.globo — Futebol" />

        <label>{{ URL_LABEL[form.type] }}</label>
        <div class="url-row">
          <input v-model="form.url" class="input" placeholder="https://…" />
          <button v-if="form.type === 'RSS'" type="button" class="btn" :disabled="testing || !form.url" @click="testUrl">
            <AppIcon name="refresh" :size="14" :stroke="2.2" /> {{ testing ? 'Testando…' : 'Testar' }}
          </button>
        </div>

        <div v-if="preview" class="preview">
          <div class="pv-title"><AppIcon name="check" :size="14" :stroke="2.4" /> {{ preview.title }}</div>
          <ul class="pv-list">
            <li v-for="(it, i) in preview.items" :key="i">{{ it.title }}</li>
          </ul>
        </div>

        <template v-if="form.type !== 'RSS'">
          <label>Config (JSON)</label>
          <textarea
            v-model="form.configText"
            class="input mono"
            rows="9"
            :placeholder="CONFIG_PLACEHOLDER[form.type]"
            spellcheck="false"
          />
          <p class="hint">
            {{ form.type === 'NEWS_API'
              ? 'Mapeie a resposta da API: itemsPath (lista) + map (campos). apiKeyParam/apiKeyHeader p/ a chave. Funciona com APIs abertas ou pagas.'
              : 'linkPattern (regex) define quais links são artigos; o corpo é buscado na hora de processar.' }}
          </p>
        </template>

        <label>Tom padrão</label>
        <select v-model="form.defaultToneId" class="input">
          <option value="">— resolver automaticamente —</option>
          <option v-for="t in tones" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>

        <label>Intervalo de coleta (min)</label>
        <input v-model.number="form.fetchIntervalMin" type="number" min="1" max="1440" class="input" style="max-width: 140px" />

        <label class="check"><input type="checkbox" v-model="form.isActive" /> Ativa</label>
      </div>

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Salvando…' : 'Salvar' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-wrap { max-width: 680px; }
.adm-form { display: flex; flex-direction: column; gap: 6px; }
.adm-form label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 10px; }
.type-seg { display: flex; gap: 4px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 3px; width: fit-content; }
.type-btn { padding: 8px 14px; border: none; background: transparent; border-radius: 7px; font-size: 13px; font-weight: 700; color: var(--muted); cursor: pointer; }
.type-btn.on { background: var(--grad-pitch); color: #fff; }
.url-row { display: flex; gap: 8px; }
.url-row .input { flex: 1; }
.mono { font-family: ui-monospace, monospace; font-size: 12.5px; line-height: 1.5; resize: vertical; }
.preview { margin-top: 8px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--bg-base); }
.pv-title { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; color: var(--emerald); }
.pv-list { margin: 8px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); display: flex; flex-direction: column; gap: 3px; }
.hint { font-size: 12px; color: var(--muted); line-height: 1.45; margin: 6px 0 0; }
.check { display: flex; align-items: center; gap: 8px; flex-direction: row !important; margin-top: 14px; font-weight: 600; color: var(--text); }
.form-actions { margin-top: 18px; display: flex; justify-content: flex-end; }
</style>
