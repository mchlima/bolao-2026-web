<script setup lang="ts">
// Gráfico de LINHA do gasto diário com geração de conteúdo (Claude) na dashboard.
// Recebe o período (from/to) do seletor do header. Busca /admin/dashboard/spend-series
// (série diária em US$, contínua) e desenha curva suave + área (SVG, sem lib externa).
const props = defineProps<{ from: string; to: string }>();

type Gran = 'hour' | 'day' | 'week' | 'month';
interface Series {
  granularity: Gran;
  from: string;
  to: string;
  total: number;
  items: number;
  points: { bucket: string; cost: number; items: number }[];
}

// Seletor de granularidade. 'hour' NÃO se aplica ao gasto (registrado por dia) →
// fica sempre desabilitado; dia/semana/mês seguem o que cabe no período (como Palpites).
const grans: { k: Gran; l: string }[] = [
  { k: 'hour', l: 'Hora' },
  { k: 'day', l: 'Dia' },
  { k: 'week', l: 'Semana' },
  { k: 'month', l: 'Mês' },
];
const ORDER = ['day', 'week', 'month'] as const;
function bucketCounts(from: string, to: string): Record<(typeof ORDER)[number], number> {
  const d = (s: string) => new Date(`${s}T00:00:00`);
  const days = Math.round((d(to).getTime() - d(from).getTime()) / 86400000) + 1;
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const months = ty * 12 + tm - (fy * 12 + fm) + 1;
  return { day: days, week: Math.ceil(days / 7), month: months };
}
const allowed = computed<Set<Gran>>(() => {
  const c = bucketCounts(props.from, props.to);
  const set = new Set<Gran>(ORDER.filter((g) => c[g] >= 2 && c[g] <= 90));
  if (!set.size) set.add('day');
  return set;
});
const preferred = computed<Gran>(() => {
  const c = bucketCounts(props.from, props.to);
  const ok = ORDER.filter((g) => allowed.value.has(g));
  return ok.find((g) => c[g] <= 48) ?? ok[ok.length - 1] ?? 'day';
});
const granularity = ref<Gran>(preferred.value);
watch(
  () => [props.from, props.to],
  () => {
    if (!allowed.value.has(granularity.value)) granularity.value = preferred.value;
  },
  { immediate: true },
);
const disabledTitle = (g: Gran): string =>
  allowed.value.has(g)
    ? ''
    : g === 'hour'
      ? 'O gasto é registrado por dia (sem granularidade horária).'
      : 'Não faz sentido para o período selecionado.';
const peakLabel = computed(() =>
  granularity.value === 'month' ? 'pico/mês' : granularity.value === 'week' ? 'pico/sem' : 'pico/dia',
);

const { data, pending } = useAsyncData(
  'admin-spend-series',
  () =>
    useApi()<Series>(
      `/admin/dashboard/spend-series?from=${props.from}&to=${props.to}&granularity=${granularity.value}`,
    ),
  { lazy: true, watch: [() => props.from, () => props.to, granularity] },
);

const points = computed(() => data.value?.points ?? []);
const total = computed(() => data.value?.total ?? 0);
const items = computed(() => data.value?.items ?? 0);
const hasSpend = computed(() => total.value > 0);
const peak = computed(() => Math.max(0, ...points.value.map((p) => p.cost)));

// ── geometria do SVG (viewBox fixo, estica na horizontal via preserveAspectRatio) ──
const W = 1000;
const H = 240;
const PAD = 18;
// Teto com folga → o pico não encosta na linha de topo.
const geomMax = computed(() => Math.max(...points.value.map((p) => p.cost), 1e-9) * 1.12);
const coords = computed(() => {
  const n = points.value.length;
  return points.value.map((p, i) => {
    // x no CENTRO da célula (i+0.5)/n — alinha com os rótulos do eixo X (células
    // flex) e com o crosshair. Edge-a-edge desalinhava (rótulo no centro da célula,
    // ponto na borda) — visível na visão semanal com poucos pontos.
    const x = n <= 1 ? W / 2 : ((i + 0.5) / n) * W;
    const y = H - PAD - (p.cost / geomMax.value) * (H - 2 * PAD);
    return { x, y, p };
  });
});

// Curva suave MONOTÔNICA (cúbica de Fritsch–Carlson). Diferente da Catmull-Rom,
// nunca passa do intervalo de cada par de pontos → numa subida 0 → 0,4 a linha
// NÃO mergulha abaixo de zero (e não estoura acima). Essencial pra não dar
// impressão errada de gasto negativo entre dias.
function smooth(cs: { x: number; y: number }[]): string {
  const n = cs.length;
  if (!n) return '';
  if (n === 1) return `M ${cs[0].x.toFixed(1)} ${cs[0].y.toFixed(1)}`;
  const xs = cs.map((c) => c.x);
  const ys = cs.map((c) => c.y);
  const dx: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    delta[i] = (ys[i + 1] - ys[i]) / dx[i];
  }
  // tangentes em cada nó
  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }
  // limita as tangentes pra garantir monotonicidade (sem overshoot)
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * delta[i];
      m[i + 1] = tau * b * delta[i];
    }
  }
  // segmentos Bézier cúbicos a partir das tangentes (Hermite → Bézier)
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (m[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}
const linePath = computed(() => smooth(coords.value));
const areaPath = computed(() => {
  const cs = coords.value;
  if (!cs.length) return '';
  return `${smooth(cs)} L ${cs[cs.length - 1].x.toFixed(1)} ${H - PAD} L ${cs[0].x.toFixed(1)} ${H - PAD} Z`;
});

// gridlines + eixo Y (0, metade, topo)
const ylevels = computed(() => {
  const m = geomMax.value;
  return [1, 0.5, 0].map((f) => ({
    f,
    y: H - PAD - f * (H - 2 * PAD),
    label: fmtUsd(m * f, m < 0.1 ? 4 : 2),
  }));
});

const fmtUsd = (n: number, max = 2) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: max });

const dt = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const xlabel = (bucket: string): string => {
  const d = dt(bucket);
  if (granularity.value === 'month') return d.toLocaleDateString('pt-BR', { month: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const tipDate = (bucket: string): string => {
  const d = dt(bucket);
  if (granularity.value === 'month') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (granularity.value === 'week') return `Semana de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
// Mostra TODAS as datas no eixo X (sem intercalar).

// hover: crosshair + tooltip (overlay HTML posicionado em %); sem ponto
const plotRef = ref<HTMLElement | null>(null);
const active = ref(-1);
function onMove(e: MouseEvent): void {
  const el = plotRef.value;
  const n = points.value.length;
  if (!el || n === 0) return;
  const rect = el.getBoundingClientRect();
  const fx = (e.clientX - rect.left) / rect.width;
  // célula (i+0.5)/n → o ponto da posição x é o piso de fx*n (a célula sob o cursor).
  active.value = Math.min(n - 1, Math.max(0, Math.floor(fx * n)));
}
const xPct = (i: number) => (coords.value[i]?.x ?? 0) / W * 100;
// Tooltip ancorado no MESMO x do crosshair (alinhado). Perto das bordas só muda a
// âncora (não a posição) pra não vazar: à direita a borda direita encosta no ponto,
// à esquerda a borda esquerda — em vez de "clampar" e descolar do crosshair.
const tipStyle = computed(() => {
  const x = xPct(active.value);
  const transform = x > 86 ? 'translateX(calc(-100% + 12px))' : x < 14 ? 'translateX(-12px)' : 'translateX(-50%)';
  return { left: `${x}%`, transform };
});
const activePt = computed(() => (active.value >= 0 ? points.value[active.value] : null));
</script>

<template>
  <div class="card chart">
    <header class="ch-head">
      <div class="ch-kpi">
        <span class="ch-eyebrow">Gasto com conteúdo</span>
        <div class="ch-figure">
          <b class="ch-num font-numeric">{{ fmtUsd(total) }}</b>
          <span class="ch-unit">no período</span>
        </div>
        <div v-if="hasSpend" class="ch-meta">
          <span class="ch-chip"><i>{{ peakLabel }}</i> <b class="font-numeric">{{ fmtUsd(peak, 4) }}</b></span>
          <span v-if="items" class="ch-chip"><i>matérias</i> <b class="font-numeric">{{ items }}</b></span>
        </div>
      </div>
      <div class="seg" role="tablist">
        <button
          v-for="g in grans"
          :key="g.k"
          type="button"
          class="seg-b"
          :class="{ on: granularity === g.k }"
          :disabled="!allowed.has(g.k)"
          :title="disabledTitle(g.k)"
          @click="granularity = g.k"
        >
          {{ g.l }}
        </button>
      </div>
    </header>

    <div v-if="pending && !data" class="ch-empty">Carregando…</div>
    <div v-else-if="!hasSpend" class="ch-empty">Sem gasto com conteúdo no período.</div>
    <div v-else class="ch-body">
      <div class="ch-yaxis" aria-hidden="true">
        <span v-for="l in ylevels" :key="l.f" class="ch-yt">{{ l.label }}</span>
      </div>
      <div
        ref="plotRef"
        class="ch-plot"
        :class="{ loading: pending }"
        @mousemove="onMove"
        @mouseleave="active = -1"
      >
        <svg class="ch-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--emerald)" stop-opacity="0.28" />
              <stop offset="60%" stop-color="var(--emerald)" stop-opacity="0.06" />
              <stop offset="100%" stop-color="var(--emerald)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line
            v-for="l in ylevels"
            :key="l.f"
            class="ch-gl"
            :class="{ base: l.f === 0 }"
            x1="0"
            :x2="W"
            :y1="l.y"
            :y2="l.y"
            vector-effect="non-scaling-stroke"
          />
          <path class="ch-area" :d="areaPath" fill="url(#spend-fill)" />
          <path class="ch-line" :d="linePath" vector-effect="non-scaling-stroke" />
        </svg>

        <!-- crosshair + tooltip (overlay HTML, sempre nítido; sem ponto) -->
        <template v-if="activePt">
          <span class="ch-cross" :style="{ left: xPct(active) + '%' }" />
          <div class="ch-tip" :style="tipStyle" role="tooltip">
            <span class="ch-tip-v font-numeric">{{ fmtUsd(activePt.cost, 4) }}</span>
            <span v-if="activePt.items" class="ch-tip-u">{{ activePt.items }} {{ activePt.items === 1 ? 'matéria' : 'matérias' }}</span>
            <span class="ch-tip-d">{{ tipDate(activePt.bucket) }}</span>
          </div>
        </template>

        <div class="ch-xaxis">
          <span v-for="(p, i) in points" :key="p.bucket" class="ch-xl show" :class="{ act: active === i }">
            {{ xlabel(p.bucket) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart { padding: 20px 22px; margin-bottom: 16px; }

/* ── header / KPI ── */
.ch-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
.ch-kpi { display: flex; flex-direction: column; gap: 5px; }
.ch-eyebrow { font-size: var(--fs-2xs); font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
.ch-figure { display: flex; align-items: baseline; gap: 7px; }
.ch-num { font-size: var(--fs-3xl); line-height: 1; font-weight: 800; letter-spacing: -0.02em; }
.ch-unit { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
.ch-meta { display: flex; gap: 6px; margin-top: 1px; flex-wrap: wrap; }
.ch-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 9px; border-radius: 999px;
  background: var(--bg-base); border: 1px solid var(--border); font-size: var(--fs-2xs);
}
.ch-chip i { font-style: normal; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.ch-chip b { color: var(--text); font-weight: 800; }

/* ── segmented control (acento verde, casando com a linha) ── */
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; padding: 2px; background: var(--bg-base); gap: 1px; }
.seg-b {
  padding: 6px 13px; border: 0; border-radius: 8px; background: transparent;
  color: var(--muted); font-size: var(--fs-xs); font-weight: 700; cursor: pointer;
  transition: background 0.14s, color 0.14s, box-shadow 0.14s;
}
.seg-b:hover { color: var(--text); }
.seg-b.on { background: var(--bg-surface); color: var(--emerald); box-shadow: 0 1px 3px rgba(15, 22, 32, 0.1); }
.seg-b:disabled { opacity: 0.3; cursor: not-allowed; }
.seg-b:disabled:hover { color: var(--muted); }

.ch-empty { height: 200px; display: grid; place-items: center; color: var(--muted); font-size: var(--fs-sm); }

/* ── plot ── */
.ch-body { position: relative; padding-left: 52px; }
.ch-yaxis {
  position: absolute;
  left: 0; top: 0;
  width: 48px; height: 240px;
  display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end;
  padding: 14px 8px 14px 0;
}
.ch-yt { font-size: var(--fs-2xs); font-weight: 600; color: var(--muted); opacity: 0.7; line-height: 1; white-space: nowrap; }

.ch-plot { position: relative; transition: opacity 0.15s ease; }
.ch-plot.loading { opacity: 0.5; }
.ch-svg { width: 100%; height: 240px; display: block; overflow: visible; }
.ch-gl { stroke: var(--border); stroke-width: 1; opacity: 0.55; }
.ch-gl.base { stroke: color-mix(in srgb, var(--border) 130%, var(--muted)); stroke-width: 1.5; opacity: 1; }
.ch-area { stroke: none; animation: fadein 0.5s ease both; }
.ch-line {
  fill: none;
  stroke: var(--emerald);
  stroke-width: 2.4;
  stroke-linejoin: round;
  stroke-linecap: round;
  filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--emerald) 35%, transparent));
}
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }

/* crosshair / tooltip (overlay) */
.ch-cross {
  position: absolute; top: 0; bottom: 0; width: 1.5px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--emerald) 55%, transparent), transparent);
  transform: translateX(-50%); pointer-events: none;
}
.ch-tip {
  position: absolute; top: 6px; /* transform vem inline (tipStyle), p/ ancorar nas bordas */
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 7px 11px; background: var(--text); color: var(--bg-surface);
  border-radius: 9px; box-shadow: 0 10px 26px -8px rgba(15, 22, 32, 0.55);
  white-space: nowrap; pointer-events: none; z-index: 5;
  animation: tipin 0.12s ease both;
}
.ch-tip-v { font-size: var(--fs-base); font-weight: 800; line-height: 1; }
.ch-tip-u { font-size: var(--fs-2xs); opacity: 0.75; text-transform: uppercase; letter-spacing: 0.04em; }
.ch-tip-d { font-size: var(--fs-2xs); opacity: 0.85; margin-top: 2px; }
@keyframes tipin { from { opacity: 0; } to { opacity: 1; } }

.ch-xaxis { display: flex; margin-top: 8px; }
.ch-xl { flex: 1 1 0; min-width: 0; text-align: center; font-size: var(--fs-2xs); font-weight: 600; color: var(--muted); white-space: nowrap; visibility: hidden; }
.ch-xl.show { visibility: visible; }
.ch-xl.act { color: var(--text); font-weight: 700; }
</style>
