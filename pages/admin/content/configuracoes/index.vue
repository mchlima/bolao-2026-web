<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' });
const ui = useUiStore();

interface Config {
  paused: boolean;
  dailyBudgetUsd: number;
  maxPerDay: number;
  generateModel: string;
  relevanceMin: number;
}

const cfg = reactive<Config>({ paused: true, dailyBudgetUsd: 1, maxPerDay: 50, generateModel: 'claude-sonnet-4-6', relevanceMin: 0.4 });
const loaded = ref(false);
const busy = ref(false);

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
    const c = await useApi()<Config>('/admin/content/settings');
    Object.assign(cfg, c);
  } catch (e) { err(e); } finally { loaded.value = true; }
}
async function save() {
  busy.value = true;
  try {
    const c = await useApi()<Config>('/admin/content/settings', {
      method: 'PATCH',
      body: {
        dailyBudgetUsd: Number(cfg.dailyBudgetUsd) || 0,
        maxPerDay: Number(cfg.maxPerDay) || 0,
        generateModel: cfg.generateModel,
        relevanceMin: Number(cfg.relevanceMin) || 0,
      },
    });
    Object.assign(cfg, c);
    ui.toast('success', 'Configurações salvas.');
  } catch (e) { err(e); } finally { busy.value = false; }
}
onMounted(load);
</script>

<template>
  <div>
    <AdminPageHeader
      title="Configurações"
      subtitle="Limites de gasto e de volume da esteira. Liga/desliga e o status do robô ficam no Painel."
    >
      <template #actions>
        <NuxtLink to="/admin/content" class="btn">Voltar ao Painel</NuxtLink>
      </template>
    </AdminPageHeader>

    <section v-if="loaded" class="card adm-panel form-wrap">
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
      <p class="hint">
        O robô para automaticamente ao bater o teto de gasto OU o de volume (o que vier primeiro), resetando à meia-noite UTC.
        O volume conta só matérias geradas; filtradas custam a extração (entram no teto de US$), mas não consomem o limite de volume.
      </p>
      <div class="save-row"><button class="btn btn-primary" :disabled="busy" @click="save">{{ busy ? 'Salvando…' : 'Salvar configurações' }}</button></div>
    </section>
  </div>
</template>

<style scoped>
.form-wrap { max-width: 680px; }
.ctitle { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 0 0 12px; }
.limits { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.limits label { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 8px; }
.limits .lh { font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--muted); opacity: 0.8; }
.hint { font-size: 12px; color: var(--muted); line-height: 1.5; margin: 14px 0 0; }
.save-row { margin-top: 16px; display: flex; justify-content: flex-end; }
@media (max-width: 760px) { .limits { grid-template-columns: 1fr; } }
</style>
