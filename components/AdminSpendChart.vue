<script setup lang="ts">
// Gráfico de LINHA do gasto diário com geração de conteúdo (Claude) na dashboard.
// Recebe o período (from/to) do seletor do header. Busca /admin/dashboard/spend-series
// (série diária em US$, contínua) e desenha linha + área (SVG, sem lib externa).
const props = defineProps<{ from: string; to: string }>();

interface Series {
  from: string;
  to: string;
  total: number;
  items: number;
  points: { bucket: string; cost: number; items: number }[];
}

const { data, pending } = useAsyncData(
  'admin-spend-series',
  () => useApi()<Series>(`/admin/dashboard/spend-series?from=${props.from}&to=${props.to}`),
  { lazy: true, watch: [() => props.from, () => props.to] },
);

const points = computed(() => data.value?.points ?? []);
const total = computed(() => data.value?.total ?? 0);
const items = computed(() => data.value?.items ?? 0);
const hasSpend = computed(() => total.value > 0);

// ── geometria do SVG (viewBox fixo, estica na horizontal via preserveAspectRatio) ──
const W = 1000;
const H = 240;
const PAD = 16;
const maxCost = computed(() => Math.max(...points.value.map((p) => p.cost), 1e-9));
const coords = computed(() => {
  const n = points.value.length;
  return points.value.map((p, i) => {
    const x = n <= 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1);
    const y = H - PAD - (p.cost / maxCost.value) * (H - 2 * PAD);
    return { x, y, p };
  });
});
const linePath = computed(() =>
  coords.value.map((c, i) => `${i ? 'L' : 'M'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' '),
);
const areaPath = computed(() => {
  const cs = coords.value;
  if (!cs.length) return '';
  const top = cs.map((c, i) => `${i ? 'L' : 'M'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  return `${top} L ${cs[cs.length - 1].x.toFixed(1)} ${H - PAD} L ${cs[0].x.toFixed(1)} ${H - PAD} Z`;
});

const fmtUsd = (n: number, max = 2) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: max });

const dt = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const xlabel = (bucket: string) => dt(bucket).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const tip = (p: { bucket: string; cost: number; items: number }) =>
  `${dt(p.bucket).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}: ${fmtUsd(p.cost, 4)}${p.items ? ` · ${p.items} ${p.items === 1 ? 'matéria' : 'matérias'}` : ''}`;
// ~12 rótulos no máximo pra não embolar.
const labelStep = computed(() => Math.max(1, Math.ceil(points.value.length / 12)));
const showLabel = (i: number) => i % labelStep.value === 0 || i === points.value.length - 1;
</script>

<template>
  <div class="card chart">
    <div class="ch-head">
      <div class="ch-tt">
        <h3 class="font-display">Gasto com conteúdo</h3>
        <span class="ch-total">
          <b class="font-numeric">{{ fmtUsd(total) }}</b> no período
          <span v-if="items" class="ch-sub">· {{ items }} {{ items === 1 ? 'matéria' : 'matérias' }}</span>
        </span>
      </div>
    </div>

    <div v-if="pending && !data" class="ch-empty">Carregando…</div>
    <div v-else-if="!hasSpend" class="ch-empty">Sem gasto com conteúdo no período.</div>
    <div v-else class="ch-plot" :class="{ loading: pending }">
      <svg class="ch-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <path class="ch-area" :d="areaPath" />
        <path class="ch-line" :d="linePath" vector-effect="non-scaling-stroke" />
        <circle
          v-for="(c, i) in coords"
          :key="i"
          class="ch-dot"
          :cx="c.x"
          :cy="c.y"
          r="3"
          vector-effect="non-scaling-stroke"
        >
          <title>{{ tip(c.p) }}</title>
        </circle>
      </svg>
      <div class="ch-xaxis">
        <span v-for="(p, i) in points" :key="p.bucket" class="ch-xl" :class="{ show: showLabel(i) }">
          {{ xlabel(p.bucket) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart { padding: 18px; margin-bottom: 16px; }
.ch-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.ch-tt { display: flex; flex-direction: column; gap: 2px; }
.ch-tt h3 { font-weight: 600; font-size: var(--fs-base); text-transform: uppercase; }
.ch-total { font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
.ch-total b { color: var(--text); font-size: var(--fs-base); margin-right: 2px; }
.ch-sub { opacity: 0.8; }

.ch-empty { height: 180px; display: grid; place-items: center; color: var(--muted); font-size: var(--fs-sm); }
.ch-plot { transition: opacity 0.15s ease; }
.ch-plot.loading { opacity: 0.5; }

.ch-svg { width: 100%; height: 220px; display: block; overflow: visible; }
.ch-area { fill: color-mix(in srgb, var(--emerald) 14%, transparent); stroke: none; }
.ch-line { fill: none; stroke: var(--emerald); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.ch-dot { fill: var(--bg-surface); stroke: var(--emerald); stroke-width: 2; }
.ch-dot:hover { fill: var(--emerald); }

.ch-xaxis { display: flex; margin-top: 7px; }
.ch-xl { flex: 1 1 0; min-width: 0; text-align: center; font-size: var(--fs-xs); font-weight: 600; color: var(--muted); white-space: nowrap; visibility: hidden; }
.ch-xl.show { visibility: visible; }
</style>
