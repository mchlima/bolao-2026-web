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
  flagged: number;
  sources: { total: number; active: number; withError: number };
  tonesActive: number;
  lastIngestAt: string | null;
}

const data = ref<Dashboard | null>(null);
const busy = ref(false);
const cfg = reactive<Config>({ paused: false, dailyBudgetUsd: 1, maxPerDay: 50, generateModel: 'claude-sonnet-4-6', relevanceMin: 0.4 });

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
// Etapas do fluxo, NA ORDEM em que o item caminha (fila → processando → revisão → aprovada).
const FLOW = [
  { key: 'DISCOVERED', label: 'Na fila', tone: 'azure', to: '/admin/content/triagem?tab=DISCOVERED' },
  { key: 'PROCESSING', label: 'Processando', tone: 'azure', to: '/admin/content/triagem?tab=PROCESSING' },
  { key: 'PENDING_REVIEW', label: 'Em revisão', tone: 'gold', to: '/admin/content/revisao?tab=PENDING_REVIEW' },
  { key: 'APPROVED', label: 'Aprovadas', tone: 'emerald', to: '/admin/content/revisao?tab=APPROVED' },
];
// Estados FORA do fluxo direto: terminais ou desviados, mas que você ainda pode mudar (resgatar/rever).
const SIDE = [
  { key: 'FILTERED', label: 'Filtradas', tone: 'neutral', to: '/admin/content/triagem?tab=FILTERED', sub: 'resgatável' },
  { key: 'DUPLICATE', label: 'Duplicadas', tone: 'neutral', to: '/admin/content/triagem?tab=DUPLICATE', sub: 'resgatável' },
  { key: 'REJECTED', label: 'Rejeitadas', tone: 'scarlet', to: '/admin/content/revisao?tab=REJECTED', sub: 'resgatável' },
  { key: 'FAILED', label: 'Falhas', tone: 'scarlet', to: '/admin/content/triagem?tab=FAILED', sub: 'precisa de atenção' },
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
          <br>O volume conta só <strong>matérias geradas</strong>; notícias filtradas custam a extração (entram no teto de US$), mas não consomem o limite de volume.
        </p>
      </section>

      <!-- Atalho p/ configurações -->
      <NuxtLink to="/admin/content/configuracoes" class="card adm-panel cfg-link">
        <div>
          <div class="cfg-title">Limites de gasto e volume</div>
          <div class="cfg-sub">Teto de gasto/dia · máx. matérias/dia · modelo · relevância mínima</div>
        </div>
        <AppIcon name="chevronRight" :size="20" :stroke="2.4" />
      </NuxtLink>

      <!-- Alerta de fidelidade -->
      <NuxtLink v-if="data.flagged > 0" to="/admin/content/revisao?tab=PENDING_REVIEW" class="card adm-panel flag-alert">
        <AppIcon name="shield" :size="18" :stroke="2.2" />
        <span><strong>{{ data.flagged }}</strong> matéria(s) em revisão com <strong>alerta de fidelidade</strong> — a verificação achou afirmações sem lastro. Revise antes de aprovar.</span>
        <AppIcon name="chevronRight" :size="18" :stroke="2.4" class="fa-arrow" />
      </NuxtLink>

      <!-- Fluxo da esteira (em ordem) -->
      <section class="card adm-panel">
        <h3 class="ctitle">Fluxo da esteira</h3>
        <div class="flow">
          <template v-for="(t, i) in FLOW" :key="t.key">
            <NuxtLink :to="t.to" class="flow-step">
              <span class="tile-n" :class="`t-${t.tone}`">{{ nStat(t.key) }}</span>
              <span class="tile-l">{{ t.label }}</span>
            </NuxtLink>
            <AppIcon v-if="i < FLOW.length - 1" name="chevronRight" :size="18" :stroke="2.4" class="flow-arrow" />
          </template>
        </div>
      </section>

      <!-- Estados fora do fluxo (terminais/temporários, podem mudar) -->
      <section class="card adm-panel">
        <h3 class="ctitle">Estados <span class="ctitle-sub">— fora do fluxo direto; ainda dá pra resgatar ou rever</span></h3>
        <div class="tiles side">
          <NuxtLink v-for="t in SIDE" :key="t.key" :to="t.to" class="tile">
            <span class="tile-n" :class="`t-${t.tone}`">{{ nStat(t.key) }}</span>
            <span class="tile-l">{{ t.label }}</span>
            <span class="tile-sub">{{ t.sub }}</span>
          </NuxtLink>
        </div>
      </section>

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
.flag-alert { display: flex; align-items: center; gap: 12px; color: var(--text); border-left: 4px solid var(--gold); font-size: 13px; line-height: 1.45; }
.flag-alert > :first-child { color: var(--gold); flex: none; }
.flag-alert .fa-arrow { color: var(--muted); flex: none; margin-left: auto; }
.flag-alert:hover { border-color: var(--gold); }
.cfg-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text); }
.cfg-link:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
.cfg-link .cfg-title { font-weight: 700; font-size: 14px; }
.cfg-link .cfg-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.cfg-link svg { color: var(--muted); flex: none; }
.ctitle-sub { font-weight: 600; text-transform: none; letter-spacing: 0; opacity: 0.8; }
.flow { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.flow-step { flex: 1 1 0; min-width: 92px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); }
.flow-step:hover { border-color: color-mix(in srgb, var(--azure) 45%, var(--border)); }
.flow-arrow { color: var(--muted); flex: none; opacity: 0.7; }
@media (max-width: 760px) { .flow-arrow { transform: rotate(90deg); } }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 760px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
.tile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px 10px; text-align: center; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-base); }
.tiles.side .tile:hover { border-color: color-mix(in srgb, var(--scarlet) 35%, var(--border)); }
.tile-n { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 30px; line-height: 1; }
.tile-l { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.tile-sub { font-size: 10.5px; font-weight: 600; color: var(--muted); opacity: 0.75; }
.t-gold { color: var(--gold); } .t-azure { color: var(--azure); } .t-emerald { color: var(--emerald); } .t-scarlet { color: var(--scarlet); } .t-neutral { color: var(--text); }
.meta-row { display: flex; gap: 28px; flex-wrap: wrap; }
.meta { display: flex; flex-direction: column; gap: 2px; }
.meta-n { font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 20px; }
.meta-n.sm { font-size: 15px; }
.meta-l { font-size: 12px; color: var(--muted); font-weight: 600; }
.meta-err { color: var(--scarlet); }
</style>
