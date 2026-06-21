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
  // Campos da Pauta (TOPIC) — viram config { query, allowedDomains, maxSearches, maxResults }.
  topicQuery: '',
  topicDomains: '',
  topicMaxSearches: 2,
  topicMaxResults: 12,
  // Campos do Resumo de jogo (MATCH_REPORT) — viram config { seasonIds, blocks, notableCap, delayMinutes }.
  mrSeasonIds: [] as string[],
  mrNotableCap: 4,
  mrDelayMinutes: 20,
  mrBlocks: {
    identificacao: true, gols: true, cartoes: true, substituicoes: true, escalacoes: true,
    estatisticas: true, lancesNotaveis: true, classificacao: true, proximaRodada: true,
  } as Record<string, boolean>,
  focus: '',
  defaultToneId: '',
  fetchIntervalMin: 15,
  maxAgeHours: 48,
  isActive: true,
});

// Blocos de dado do resumo de jogo (o que entra no pacote de fatos). O objetivo da
// fonte = quais blocos + tom (flash curto = só os primeiros; análise = todos).
const BLOCK_DEFS: { key: string; label: string; hint: string }[] = [
  { key: 'identificacao', label: 'Identificação', hint: 'competição, fase, rodada, estádio, público, árbitro' },
  { key: 'gols', label: 'Gols', hint: 'autores, minutos, assistências' },
  { key: 'cartoes', label: 'Cartões', hint: 'amarelos e vermelhos' },
  { key: 'substituicoes', label: 'Substituições', hint: 'quem entrou/saiu' },
  { key: 'escalacoes', label: 'Escalações', hint: 'titulares + formação' },
  { key: 'estatisticas', label: 'Estatísticas', hint: 'posse, finalizações, defesas…' },
  { key: 'lancesNotaveis', label: 'Lances notáveis', hint: 'defesas, trave, VAR (limitado pelo teto)' },
  { key: 'classificacao', label: 'Classificação', hint: 'tabela do grupo após o jogo' },
  { key: 'proximaRodada', label: 'Próxima rodada', hint: 'o que vem na sequência' },
];

interface SeasonOpt { id: string; name: string; seasonLabel: string | null; competition?: { name: string } | null }
const seasons = ref<SeasonOpt[]>([]);
function seasonLabel(s: SeasonOpt): string {
  const comp = s.competition?.name;
  return comp && !s.name.includes(comp) ? `${comp} — ${s.name}` : s.name;
}

const TYPES: { key: NewsFeedType; label: string }[] = [
  { key: 'RSS', label: 'RSS' },
  { key: 'NEWS_API', label: 'API de notícias' },
  { key: 'PAGE', label: 'Página (crawl)' },
  { key: 'TOPIC', label: 'Pauta (busca)' },
  { key: 'MATCH_REPORT', label: 'Resumo de jogo' },
];
const URL_LABEL: Record<NewsFeedType, string> = {
  RSS: 'URL do RSS',
  NEWS_API: 'URL do endpoint da API',
  PAGE: 'URL da página/seção',
  TOPIC: '',
  MATCH_REPORT: '',
};
const CONFIG_PLACEHOLDER: Record<NewsFeedType, string> = {
  RSS: '',
  NEWS_API:
    '{\n  "apiKeyParam": "apikey",\n  "apiKey": "SUA_CHAVE",\n  "itemsPath": "results",\n  "map": {\n    "title": "title", "url": "link", "publishedAt": "pubDate",\n    "summary": "description", "content": "content"\n  }\n}',
  PAGE: '{\n  "linkPattern": "/futebol/.+/noticia/",\n  "limit": 25\n}',
  TOPIC:
    '{\n  "query": "Copa do Mundo 2026: resultados, lesões, convocações",\n  "allowedDomains": ["ge.globo.com", "espn.com.br"],\n  "maxSearches": 2,\n  "maxResults": 12\n}',
  MATCH_REPORT: '',
};

// Fontes generativas escondem a URL (leem o banco) — como a Pauta.
const URLLESS_TYPES: NewsFeedType[] = ['TOPIC', 'MATCH_REPORT'];

const tones = ref<NewsTone[]>([]);
const preview = ref<FeedPreview | null>(null);
const testing = ref(false);

// ── Estimativa de custo da Pauta (recalcula ao vivo) ──
const genModel = ref('claude-sonnet-4-6'); // modelo de geração (vem das Configurações)
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-4-8': { in: 5, out: 25 },
};
const MODEL_SHORT: Record<string, string> = {
  'claude-haiku-4-5': 'Haiku', 'claude-sonnet-4-6': 'Sonnet', 'claude-opus-4-8': 'Opus',
};
// Custos médios aproximados (token shapes típicos observados nos testes).
function perSearchCost() { return 0.01 + (11000 / 1e6) * 1; } // taxa US$0,01 + ~11k tokens no Haiku
function perArticleCost(model: string) {
  const p = PRICES[model] ?? PRICES['claude-sonnet-4-6'];
  const extract = (2000 / 1e6) * 1 + (400 / 1e6) * 5; // extração no Haiku
  const generate = (1000 / 1e6) * p.in + (800 / 1e6) * p.out; // geração no modelo escolhido
  return extract + generate;
}
const topicEstimate = computed(() => {
  const searches = Math.max(1, Number(form.topicMaxSearches) || 1);
  const results = Math.max(1, Number(form.topicMaxResults) || 1);
  const discovery = searches * perSearchCost();
  const processing = results * perArticleCost(genModel.value);
  return { discovery, processing, total: discovery + processing };
});
function usd(x: number) { return '$' + x.toFixed(x < 1 ? 3 : 2); }

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}

onMounted(async () => {
  try {
    const t = await useApi()<Paginated<NewsTone>>('/admin/content/tones?pageSize=100');
    tones.value = t.data;
  } catch { /* ignore */ }
  try {
    const s = await useApi()<{ generateModel: string }>('/admin/content/settings');
    if (s.generateModel) genModel.value = s.generateModel;
  } catch { /* ignore */ }
  try {
    const s = await useApi()<Paginated<SeasonOpt>>('/seasons?pageSize=100');
    seasons.value = s.data;
  } catch { /* ignore */ }
  if (!isNew.value) {
    try {
      const f = await useApi()<NewsFeed>(`/admin/content/feeds/${feedId.value}`);
      form.name = f.name;
      form.url = f.url;
      form.type = f.type;
      if (f.type === 'TOPIC') {
        const c = (f.config ?? {}) as { query?: string; allowedDomains?: string[]; maxSearches?: number; maxResults?: number };
        form.topicQuery = c.query ?? '';
        form.topicDomains = (c.allowedDomains ?? []).join(', ');
        form.topicMaxSearches = c.maxSearches ?? 2;
        form.topicMaxResults = c.maxResults ?? 12;
      } else if (f.type === 'MATCH_REPORT') {
        const c = (f.config ?? {}) as {
          seasonIds?: string[]; blocks?: Record<string, boolean>; notableCap?: number; delayMinutes?: number;
        };
        form.mrSeasonIds = Array.isArray(c.seasonIds) ? c.seasonIds : [];
        form.mrNotableCap = c.notableCap ?? 4;
        form.mrDelayMinutes = c.delayMinutes ?? 20;
        if (c.blocks) for (const k of Object.keys(form.mrBlocks)) form.mrBlocks[k] = c.blocks[k] !== false;
      } else {
        form.configText = f.config ? JSON.stringify(f.config, null, 2) : '';
      }
      form.focus = f.focus ?? '';
      form.defaultToneId = f.defaultToneId ?? '';
      form.fetchIntervalMin = f.fetchIntervalMin;
      form.maxAgeHours = f.maxAgeHours ?? 48;
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
  // RSS não tem config; TOPIC/MATCH_REPORT montam a config dos campos no save().
  if (URLLESS_TYPES.includes(form.type) || form.type === 'RSS' || !form.configText.trim()) return null;
  return JSON.parse(form.configText) as Record<string, unknown>;
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function save() {
  if (!form.name.trim()) {
    ui.toast('error', 'O nome é obrigatório.');
    return;
  }
  let config: Record<string, unknown> | null;
  try {
    config = parseConfig();
  } catch {
    ui.toast('error', 'A config não é um JSON válido.');
    return;
  }
  // Pauta não tem URL: monta a config dos campos e usa um id sintético do assunto.
  let url = form.url.trim();
  if (form.type === 'TOPIC') {
    const q = form.topicQuery.trim();
    if (!q) {
      ui.toast('error', 'Informe o assunto da pauta.');
      return;
    }
    const domains = form.topicDomains.split(',').map((s) => s.trim()).filter(Boolean);
    config = {
      query: q,
      ...(domains.length ? { allowedDomains: domains } : {}),
      maxSearches: Number(form.topicMaxSearches) || 2,
      maxResults: Number(form.topicMaxResults) || 12,
    };
    url = 'pauta:' + slug(q);
  } else if (form.type === 'MATCH_REPORT') {
    if (!form.mrSeasonIds.length) {
      ui.toast('error', 'Escolha ao menos uma temporada (escopo da fonte).');
      return;
    }
    config = {
      seasonIds: form.mrSeasonIds,
      blocks: { ...form.mrBlocks },
      notableCap: Number(form.mrNotableCap) || 0,
      delayMinutes: Number(form.mrDelayMinutes) || 0,
    };
    url = 'match-report:' + (slug(form.name) || 'fonte');
  } else if (!url) {
    ui.toast('error', 'A URL é obrigatória.');
    return;
  }
  saving.value = true;
  const body = {
    name: form.name.trim(),
    url,
    type: form.type,
    config,
    focus: form.focus.trim() || null,
    defaultToneId: form.defaultToneId || null,
    fetchIntervalMin: form.fetchIntervalMin,
    maxAgeHours: Number(form.maxAgeHours) || 48,
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
    <AdminPageHeader :title="isNew ? 'Nova fonte' : 'Editar fonte'" subtitle="De onde vêm as notícias: RSS, API de notícias, crawl de página ou pauta (busca por assunto).">
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

        <template v-if="!URLLESS_TYPES.includes(form.type)">
          <label>{{ URL_LABEL[form.type] }}</label>
          <div class="url-row">
            <input v-model="form.url" class="input" placeholder="https://…" />
            <button v-if="form.type === 'RSS'" type="button" class="btn" :disabled="testing || !form.url" @click="testUrl">
              <AppIcon name="refresh" :size="14" :stroke="2.2" /> {{ testing ? 'Testando…' : 'Testar' }}
            </button>
          </div>
        </template>

        <div v-if="preview" class="preview">
          <div class="pv-title"><AppIcon name="check" :size="14" :stroke="2.4" /> {{ preview.title }}</div>
          <ul class="pv-list">
            <li v-for="(it, i) in preview.items" :key="i">{{ it.title }}</li>
          </ul>
        </div>

        <!-- Pauta: campos dedicados -->
        <template v-if="form.type === 'TOPIC'">
          <label>Assunto da pauta</label>
          <textarea
            v-model="form.topicQuery"
            class="input"
            rows="2"
            maxlength="600"
            placeholder="Ex.: Copa do Mundo 2026 — resultados, lesões e convocações da seleção brasileira"
          />
          <p class="hint">O robô pesquisa isto na web (busca ao vivo) e descobre artigos reais e datados. Quanto mais específico em <strong>notícia recente</strong>, melhor o resultado.</p>

          <label>Domínios confiáveis <span class="opt">(opcional, separados por vírgula)</span></label>
          <input
            v-model="form.topicDomains"
            class="input"
            placeholder="ge.globo.com, espn.com.br, gazetaesportiva.com"
          />
          <p class="hint">Restringe a busca a estes veículos. Em branco, busca na web aberta (mais ruído: tabelas, estatísticas).</p>

          <div class="topic-nums">
            <div>
              <label>Máx. buscas / rodada</label>
              <input v-model.number="form.topicMaxSearches" type="number" min="1" max="10" class="input" />
            </div>
            <div>
              <label>Máx. resultados / rodada</label>
              <input v-model.number="form.topicMaxResults" type="number" min="1" max="30" class="input" />
            </div>
          </div>
          <p class="hint">Controlam o custo: cada busca ~US$0,01 + tokens, somado ao teto de gasto. Frescor de 48h e dedup valem igual. Use um intervalo de coleta maior p/ não pesquisar com muita frequência.</p>

          <div class="cost-est">
            <div class="ce-row">
              <span>Descoberta — {{ form.topicMaxSearches }} busca(s)</span>
              <strong>~{{ usd(topicEstimate.discovery) }}</strong>
            </div>
            <div class="ce-row">
              <span>Se as {{ form.topicMaxResults }} virarem matéria ({{ MODEL_SHORT[genModel] ?? genModel }})</span>
              <strong>~{{ usd(topicEstimate.processing) }}</strong>
            </div>
            <div class="ce-row total">
              <span>Pior caso por rodada</span>
              <strong>~{{ usd(topicEstimate.total) }}</strong>
            </div>
            <p class="ce-note">Estimativa por rodada de busca. Na prática costuma ser <strong>bem menos</strong> — relevância e dedup barram boa parte antes de gerar. Seu teto de gasto/dia trava em qualquer cenário.</p>
          </div>
        </template>

        <!-- Resumo de jogo: lê o nosso banco, sem URL -->
        <template v-else-if="form.type === 'MATCH_REPORT'">
          <p class="mr-intro">
            Esta fonte não busca na web — ela lê o <strong>nosso banco</strong> e gera o resumo de cada
            jogo encerrado no escopo, a partir dos dados estruturados (original por construção). Defina
            o que ela cobre e quais blocos entram na matéria.
          </p>

          <label>Temporadas cobertas <span class="opt">(escopo)</span></label>
          <div v-if="seasons.length" class="season-list">
            <label v-for="s in seasons" :key="s.id" class="season-opt">
              <input type="checkbox" :value="s.id" v-model="form.mrSeasonIds" />
              <span>{{ seasonLabel(s) }}</span>
            </label>
          </div>
          <p v-else class="hint">Nenhuma temporada encontrada.</p>
          <p class="hint">A fonte gera resumo só dos jogos encerrados destas temporadas. Sem escopo, não gera nada.</p>

          <label>Blocos de dado na matéria</label>
          <div class="block-grid">
            <label v-for="b in BLOCK_DEFS" :key="b.key" class="block-opt" :title="b.hint">
              <input type="checkbox" v-model="form.mrBlocks[b.key]" />
              <span>{{ b.label }}</span>
            </label>
          </div>
          <p class="hint">O objetivo da fonte = quais blocos + tom. Flash curto = só os primeiros; análise completa = todos. Crie várias fontes com objetivos diferentes sobre os mesmos jogos.</p>

          <div class="mr-nums">
            <div>
              <label>Teto de lances notáveis</label>
              <input v-model.number="form.mrNotableCap" type="number" min="0" max="20" class="input" />
              <p class="hint">Quantas defesas/quase-gols nomear (trave/VAR entram sempre). Evita virar lista.</p>
            </div>
            <div>
              <label>Atraso após o apito (min)</label>
              <input v-model.number="form.mrDelayMinutes" type="number" min="0" max="1440" class="input" />
              <p class="hint">Só gera X min após o jogo acabar — janela p/ dados atrasados (escalação/stats) chegarem.</p>
            </div>
          </div>
        </template>

        <!-- API/Página: config JSON livre -->
        <template v-else-if="form.type !== 'RSS'">
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

        <label>{{ form.type === 'MATCH_REPORT' ? 'Direcionamento editorial' : 'Foco desta fonte' }} <span class="opt">(opcional)</span></label>
        <textarea
          v-model="form.focus"
          class="input"
          rows="3"
          maxlength="600"
          :placeholder="form.type === 'MATCH_REPORT'
            ? 'Ex.: destaque sempre as defesas e o desempenho do goleiro, e o que o resultado muda na classificação do grupo.'
            : 'Ex.: só mercado da bola (contratações, renovações, sondagens) e seleção brasileira. Ignore vôlei, F1, e-sports e colunas de opinião.'"
        />
        <p class="hint">
          <template v-if="form.type === 'MATCH_REPORT'">
            Um ângulo fixo aplicado a <strong>toda matéria desta fonte</strong> — entra como orientação ao gerador, junto com o tom. Em branco, sem direcionamento.
          </template>
          <template v-else>
            O robô pontua a relevância de cada notícia desta fonte <strong>em relação a este foco</strong> — o que fica fora cai em
            <em>Triagem → Filtrados</em> (e pode ser resgatado). Em branco, usa relevância geral de futebol. Não gera custo extra.
          </template>
        </p>

        <label>Tom padrão</label>
        <select v-model="form.defaultToneId" class="input">
          <option value="">— resolver automaticamente —</option>
          <option v-for="t in tones" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>

        <label>Intervalo de coleta (min)</label>
        <input v-model.number="form.fetchIntervalMin" type="number" min="1" max="1440" class="input" style="max-width: 140px" />

        <label>{{ form.type === 'MATCH_REPORT' ? 'Retroatividade (horas)' : 'Janela de frescor (horas)' }}</label>
        <input v-model.number="form.maxAgeHours" type="number" min="1" max="8760" class="input" style="max-width: 140px" />
        <p class="hint">
          <template v-if="form.type === 'MATCH_REPORT'">
            Ao ligar a fonte, cobre só jogos encerrados nas últimas <strong>{{ form.maxAgeHours }}h</strong> — evita gerar o histórico inteiro de uma vez. Padrão 48h.
          </template>
          <template v-else>
            Notícia mais antiga que isto é descartada (não vira matéria). Padrão <strong>48h</strong>.
            <template v-if="form.type === 'TOPIC'"> Em pauta de tema mais "morno", aumente (ex.: 168 = 7 dias) p/ render mais.</template>
          </template>
        </p>

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
.topic-nums { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.topic-nums label { display: block; }
@media (max-width: 560px) { .topic-nums { grid-template-columns: 1fr; } }
.mr-intro { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 6px 0 4px; background: var(--bg-base); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
.season-list { display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: var(--bg-base); }
.season-opt { display: flex !important; flex-direction: row !important; align-items: center; gap: 8px; margin: 0 !important; font-size: 13px; font-weight: 600; color: var(--text); cursor: pointer; padding: 3px 0; }
.season-opt input { width: auto; }
.block-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 12px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--bg-base); }
.block-opt { display: flex !important; flex-direction: row !important; align-items: center; gap: 8px; margin: 0 !important; font-size: 13px; font-weight: 600; color: var(--text); cursor: pointer; padding: 3px 0; }
.block-opt input { width: auto; }
.mr-nums { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 4px; }
.mr-nums label { display: block; }
@media (max-width: 640px) { .block-grid { grid-template-columns: 1fr 1fr; } .mr-nums { grid-template-columns: 1fr; } }
.cost-est { margin-top: 12px; border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; background: var(--bg-base); }
.ce-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; padding: 3px 0; }
.ce-row span { color: var(--muted); }
.ce-row strong { font-family: 'Oswald', sans-serif; font-weight: 700; }
.ce-row.total { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px; }
.ce-row.total span { color: var(--text); font-weight: 700; }
.ce-row.total strong { font-size: 16px; color: var(--gold); }
.ce-note { font-size: 11.5px; color: var(--muted); line-height: 1.45; margin: 8px 0 0; opacity: 0.9; }
.preview { margin-top: 8px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--bg-base); }
.pv-title { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; color: var(--emerald); }
.pv-list { margin: 8px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); display: flex; flex-direction: column; gap: 3px; }
.hint { font-size: 12px; color: var(--muted); line-height: 1.45; margin: 6px 0 0; }
.opt { font-weight: 600; opacity: 0.7; text-transform: none; }
.check { display: flex; align-items: center; gap: 8px; flex-direction: row !important; margin-top: 14px; font-weight: 600; color: var(--text); }
.form-actions { margin-top: 18px; display: flex; justify-content: flex-end; }
</style>
