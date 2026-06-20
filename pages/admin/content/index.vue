<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();
const tz = useTz();

interface Config {
  paused: boolean;
  dailyBudgetUsd: number;
  maxPerDay: number;
  generateModel: string;
  relevanceMin: number;
}
interface Dashboard {
  config: Config;
  today: { items: number; costUsd: number };
  status: Record<string, number>;
  sources: { total: number; active: number; withError: number };
  tonesActive: number;
  lastIngestAt: string | null;
}

const data = ref<Dashboard | null>(null);
const busy = ref(false);
const cfg = reactive<Config>({ paused: false, dailyBudgetUsd: 1, maxPerDay: 50, generateModel: 'claude-sonnet-4-6', relevanceMin: 0.4 });

const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — mais barato (~$1/$5 por 1M)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — equilíbrio (~$3/$15)' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 — premium (~$5/$25)' },
];

function err(e: unknown) {
  ui.toast('error', (e as { data?: { message?: string } })?.data?.message ?? 'Erro');
}
async function load() {
  try {
    const d = await useApi()<Dashboard>('/admin/content/dashboard');
    data.value = d;
    Object.assign(cfg, d.config);
  } catch (e) { err(e); }
}
async function patch(body: Partial<Config>, msg?: string) {
  busy.value = true;
  try {
    const c = await useApi()<Config>('/admin/content/settings', { method: 'PATCH', body });
    if (data.value) data.value.config = c;
    Object.assign(cfg, c);
    if (msg) ui.toast('success', msg);
  } catch (e) { err(e); } finally { busy.value = false; }
}
const togglePaused = () => patch({ paused: !cfg.paused }, cfg.paused ? 'Robô religado.' : 'Robô pausado.');
const saveLimits = () => patch({
  dailyBudgetUsd: Number(cfg.dailyBudgetUsd) || 0,
  maxPerDay: Number(cfg.maxPerDay) || 0,
  generateModel: cfg.generateModel,
  relevanceMin: Number(cfg.relevanceMin) || 0,
}, 'Limites salvos.');

function nStat(k: string) { return data.value?.status[k] ?? 0; }
function usd(x: number) { return '$' + x.toFixed(x < 1 ? 3 : 2); }
const budgetPct = computed(() => {
  if (!data.value || cfg.dailyBudgetUsd <= 0) return 0;
  return Math.min(100, (data.value.today.costUsd / cfg.dailyBudgetUsd) * 100);
});
const volPct = computed(() => {
  if (!data.value || cfg.maxPerDay <= 0) return 0;
  return Math.min(100, (data.value.today.items / cfg.maxPerDay) * 100);
});
const budgetOver = computed(() =>
  data.value && cfg.dailyBudgetUsd > 0 ? data.value.today.costUsd - cfg.dailyBudgetUsd : 0,
);
const volOver = computed(() =>
  data.value && cfg.maxPerDay > 0 ? data.value.today.items - cfg.maxPerDay : 0,
);
const TILES = [
  { key: 'PENDING_REVIEW', label: 'Em revisão', tone: 'gold', to: '/admin/content/revisao' },
  { key: 'DISCOVERED', label: 'Na fila', tone: 'azure', to: '/admin/content/triagem' },
  { key: 'APPROVED', label: 'Aprovadas', tone: 'emerald', to: '/admin/content/revisao' },
  { key: 'FILTERED', label: 'Filtradas', tone: 'neutral', to: '/admin/content/triagem' },
  { key: 'FAILED', label: 'Falhas', tone: 'scarlet', to: '/admin/content/triagem' },
];
function fmt(iso: string | null) {
  if (!iso) return 'nunca';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz.value }).format(new Date(iso));
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader title="Conteúdo" subtitle="Painel da esteira: liga/desliga o robô, controla gastos e acompanha a fila." />

    <div v-if="data" class="grid">
      <!-- Robô + gasto -->
      <section class="card adm-panel robot-card" :class="{ off: cfg.paused }">
        <div class="robot-head">
          <span class="robot-dot" :class="{ off: cfg.paused }" />
          <div>
            <div class="robot-title">{{ cfg.paused ? 'Robô pausado' : 'Robô ligado' }}</div>
            <div class="robot-sub">{{ cfg.paused ? 'Não coleta nem gera (zero gasto).' : 'Coletando e gerando dentro dos limites abaixo.' }}</div>
          </div>
        </div>
        <button class="btn" :class="cfg.paused ? 'btn-primary' : 'btn-stop'" :disabled="busy" @click="togglePaused">
          <AppIcon :name="cfg.paused ? 'power' : 'pause'" :size="15" :stroke="2.2" />
          {{ cfg.paused ? 'Ligar robô' : 'Pausar robô' }}
        </button>
      </section>

      <!-- Gasto de hoje -->
      <section class="card adm-panel">
        <h3 class="ctitle">Gasto de hoje</h3>
        <div class="gauge">
          <div class="gauge-row">
            <span>{{ usd(data.today.costUsd) }}<span class="cap"> / {{ cfg.dailyBudgetUsd > 0 ? usd(cfg.dailyBudgetUsd) : '∞' }}</span></span>
            <span v-if="budgetOver > 0" class="over-badge">+{{ usd(budgetOver) }} acima do teto</span>
            <span v-else class="gauge-l">teto de gasto</span>
          </div>
          <div class="bar"><span :style="{ width: budgetPct + '%' }" :class="{ hot: budgetPct >= 90, over: budgetOver > 0 }" /></div>
        </div>
        <div class="gauge">
          <div class="gauge-row">
            <span>{{ data.today.items }}<span class="cap"> / {{ cfg.maxPerDay > 0 ? cfg.maxPerDay : '∞' }}</span></span>
            <span v-if="volOver > 0" class="over-badge">+{{ volOver }} acima do limite</span>
            <span v-else class="gauge-l">matérias geradas</span>
          </div>
          <div class="bar"><span :style="{ width: volPct + '%' }" :class="{ hot: volPct >= 90, over: volOver > 0 }" /></div>
        </div>
        <p class="hint">
          O robô automático para ao bater qualquer teto (reseta à meia-noite UTC). O <strong>excedente</strong> acima vem de gerações manuais forçadas (Regerar/Resgatar confirmados).
        </p>
      </section>

      <!-- Limites -->
      <section class="card adm-panel">
        <h3 class="ctitle">Limites de gasto</h3>
        <div class="limits">
          <label>Teto de gasto/dia (US$) <span class="lh">0 = sem teto</span></label>
          <input v-model.number="cfg.dailyBudgetUsd" type="number" min="0" step="0.5" class="input" />
          <label>Máx. matérias/dia <span class="lh">0 = sem limite</span></label>
          <input v-model.number="cfg.maxPerDay" type="number" min="0" step="10" class="input" />
          <label>Modelo de geração</label>
          <select v-model="cfg.generateModel" class="input">
            <option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
          <label>Relevância mínima <span class="lh">filtra mais = gera menos (0–1)</span></label>
          <input v-model.number="cfg.relevanceMin" type="number" min="0" max="1" step="0.05" class="input" />
        </div>
        <div class="save-row"><button class="btn btn-primary" :disabled="busy" @click="saveLimits">Salvar limites</button></div>
      </section>

      <!-- Fila -->
      <div class="tiles">
        <NuxtLink v-for="t in TILES" :key="t.key" :to="t.to" class="card adm-panel tile">
          <span class="tile-n" :class="`t-${t.tone}`">{{ nStat(t.key) }}</span>
          <span class="tile-l">{{ t.label }}</span>
        </NuxtLink>
      </div>

      <section class="card adm-panel meta-row">
        <NuxtLink to="/admin/content/feeds" class="meta">
          <span class="meta-n">{{ data.sources.active }}/{{ data.sources.total }}</span>
          <span class="meta-l">Fontes ativas<span v-if="data.sources.withError" class="meta-err"> · {{ data.sources.withError }} c/ erro</span></span>
        </NuxtLink>
        <NuxtLink to="/admin/content/tones" class="meta">
          <span class="meta-n">{{ data.tonesActive }}</span><span class="meta-l">Tons ativos</span>
        </NuxtLink>
        <div class="meta"><span class="meta-n sm">{{ fmt(data.lastIngestAt) }}</span><span class="meta-l">Última coleta</span></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.grid { display: flex; flex-direction: column; gap: 16px; }
.ctitle { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 12px; }
.robot-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-left: 4px solid var(--emerald); }
.robot-card.off { border-left-color: var(--scarlet); }
.robot-head { display: flex; align-items: center; gap: 14px; }
.robot-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 0 4px color-mix(in srgb, var(--emerald) 22%, transparent); flex: none; }
.robot-dot.off { background: var(--scarlet); box-shadow: 0 0 0 4px color-mix(in srgb, var(--scarlet) 22%, transparent); }
.robot-title { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 17px; text-transform: uppercase; }
.robot-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
.btn-stop { color: var(--scarlet); border-color: color-mix(in srgb, var(--scarlet) 40%, var(--border)); }
.gauge { margin-bottom: 12px; }
.gauge-row { display: flex; justify-content: space-between; align-items: baseline; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 18px; }
.cap { color: var(--muted); font-size: 14px; }
.gauge-l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.bar { height: 8px; border-radius: 999px; background: var(--bg-base); border: 1px solid var(--border); overflow: hidden; margin-top: 5px; }
.bar span { display: block; height: 100%; background: var(--emerald); }
.bar span.hot { background: var(--scarlet); }
.bar span.over { background: var(--scarlet); box-shadow: 0 0 8px var(--scarlet); }
.over-badge { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--scarlet); }
.hint { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
.limits { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.limits label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 8px; }
.limits .lh { font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--muted); opacity: 0.8; }
.save-row { margin-top: 14px; display: flex; justify-content: flex-end; }
.tiles { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
@media (max-width: 760px) { .tiles { grid-template-columns: repeat(2, 1fr); } .limits { grid-template-columns: 1fr; } }
.tile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 10px; text-align: center; }
.tile-n { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; line-height: 1; }
.tile-l { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.t-gold { color: var(--gold); } .t-azure { color: var(--azure); } .t-emerald { color: var(--emerald); } .t-scarlet { color: var(--scarlet); } .t-neutral { color: var(--text); }
.meta-row { display: flex; gap: 28px; flex-wrap: wrap; }
.meta { display: flex; flex-direction: column; gap: 2px; }
.meta-n { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 20px; }
.meta-n.sm { font-size: 15px; }
.meta-l { font-size: 12px; color: var(--muted); font-weight: 600; }
.meta-err { color: var(--scarlet); }
</style>
