<script setup lang="ts">
// Gráfico de palpites ao longo do tempo na dashboard do admin. Recebe o período
// (from/to) do seletor do header e tem alternância de granularidade dia/semana/mês.
// Busca /admin/dashboard/predictions-series e desenha barras (sem lib externa).
const props = defineProps<{ from: string; to: string }>();

type Gran = 'hour' | 'day' | 'week' | 'month';
interface Series {
  granularity: Gran;
  from: string;
  to: string;
  total: number;
  points: { bucket: string; count: number }[];
}

const grans: { k: Gran; l: string }[] = [
  { k: 'hour', l: 'Hora' },
  { k: 'day', l: 'Dia' },
  { k: 'week', l: 'Semana' },
  { k: 'month', l: 'Mês' },
];
const ORDER: Gran[] = ['hour', 'day', 'week', 'month'];

// Quantos buckets cada granularidade geraria no período — base pra decidir o que
// "faz sentido". Granularidade só é permitida com 2..90 barras; a preferida é a
// MAIS FINA que cabe (≤48 barras), senão a mais grossa disponível.
function bucketCounts(from: string, to: string): Record<Gran, number> {
  const d = (s: string) => new Date(`${s}T00:00:00`);
  const days = Math.round((d(to).getTime() - d(from).getTime()) / 86400000) + 1;
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const months = (ty * 12 + tm) - (fy * 12 + fm) + 1;
  return { hour: days * 24, day: days, week: Math.ceil(days / 7), month: months };
}
const allowed = computed<Set<Gran>>(() => {
  const c = bucketCounts(props.from, props.to);
  const set = new Set<Gran>(ORDER.filter((g) => c[g] >= 2 && c[g] <= 90));
  if (!set.size) set.add('month'); // período enorme: ao menos mês
  return set;
});
const preferred = computed<Gran>(() => {
  const c = bucketCounts(props.from, props.to);
  const ok = ORDER.filter((g) => allowed.value.has(g));
  return ok.find((g) => c[g] <= 48) ?? ok[ok.length - 1] ?? 'day';
});

const granularity = ref<Gran>(preferred.value);
// Quando o período muda e a granularidade atual deixa de fazer sentido, força a
// preferida automaticamente (ex.: "Hoje" não combina com "Dia" → vira "Hora").
watch(
  () => [props.from, props.to],
  () => {
    if (!allowed.value.has(granularity.value)) granularity.value = preferred.value;
  },
  { immediate: true },
);

const { data, pending } = useAsyncData(
  'admin-pred-series',
  () =>
    useApi()<Series>(
      `/admin/dashboard/predictions-series?from=${props.from}&to=${props.to}&granularity=${granularity.value}`,
    ),
  { lazy: true, watch: [() => props.from, () => props.to, granularity] },
);

const points = computed(() => data.value?.points ?? []);
const total = computed(() => data.value?.total ?? 0);
const peak = computed(() => Math.max(0, ...points.value.map((p) => p.count)));
const avg = computed(() =>
  points.value.length ? Math.round(total.value / points.value.length) : 0,
);

// Topo "redondo" do eixo Y → barras nunca encostam no teto e os rótulos do eixo
// ficam em números limpos (padrão de dashboard).
function niceCeil(n: number): number {
  if (n <= 5) return Math.max(1, n);
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const step = pow / 2;
  return Math.ceil(n / step) * step;
}
const top = computed(() => niceCeil(peak.value || 1));
const yticks = computed(() => {
  const t = top.value;
  return [1, 0.75, 0.5, 0.25, 0].map((f) => ({
    pct: f * 100,
    label: f === 0 ? '0' : String(Math.round(t * f)),
  }));
});

function barH(count: number): string {
  if (count <= 0) return '0%';
  return `${Math.max(2.5, (count / top.value) * 100)}%`;
}

// hover (crosshair + tooltip)
const active = ref(-1);

const dt = (s: string) => {
  const [datePart, timePart] = s.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const hh = timePart ? Number(timePart.slice(0, 2)) : 0;
  return new Date(y, m - 1, d, hh);
};
function xlabel(bucket: string): string {
  const d = dt(bucket);
  if (granularity.value === 'hour') return `${String(d.getHours()).padStart(2, '0')}h`;
  if (granularity.value === 'month') return d.toLocaleDateString('pt-BR', { month: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function tipLabel(bucket: string): string {
  const d = dt(bucket);
  if (granularity.value === 'hour') return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${String(d.getHours()).padStart(2, '0')}:00`;
  if (granularity.value === 'month') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  if (granularity.value === 'week') return `Semana de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
// Mostra TODAS as datas no eixo X (sem intercalar).
</script>

<template>
  <div class="card chart">
    <header class="ch-head">
      <div class="ch-kpi">
        <span class="ch-eyebrow">Palpites</span>
        <div class="ch-figure">
          <b class="ch-num font-numeric">{{ total.toLocaleString('pt-BR') }}</b>
          <span class="ch-unit">no período</span>
        </div>
        <div v-if="total" class="ch-meta">
          <span class="ch-chip"><i>pico</i> <b class="font-numeric">{{ peak }}</b></span>
          <span class="ch-chip"><i>média</i> <b class="font-numeric">{{ avg }}</b></span>
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
          :title="allowed.has(g.k) ? '' : 'Não faz sentido para o período selecionado'"
          @click="granularity = g.k"
        >
          {{ g.l }}
        </button>
      </div>
    </header>

    <div v-if="pending && !data" class="ch-empty">Carregando…</div>
    <div v-else-if="!total" class="ch-empty">Sem palpites no período.</div>
    <div v-else class="ch-body">
      <div class="ch-yaxis" aria-hidden="true">
        <span v-for="t in yticks" :key="t.pct" class="ch-yt">{{ t.label }}</span>
      </div>
      <div class="ch-grid" aria-hidden="true">
        <span v-for="t in yticks" :key="t.pct" class="ch-gl" :style="{ bottom: t.pct + '%' }" />
      </div>
      <div class="ch-plot" :class="{ loading: pending }" @mouseleave="active = -1">
        <div
          v-for="(p, i) in points"
          :key="p.bucket"
          class="ch-col"
          :class="{ act: active === i, dim: active !== -1 && active !== i }"
          @mouseenter="active = i"
        >
          <div class="ch-track">
            <div class="ch-bar" :style="{ height: barH(p.count) }" />
          </div>
          <div v-if="active === i" class="ch-tip" role="tooltip">
            <span class="ch-tip-v font-numeric">{{ p.count }}</span>
            <span class="ch-tip-u">{{ p.count === 1 ? 'palpite' : 'palpites' }}</span>
            <span class="ch-tip-d">{{ tipLabel(p.bucket) }}</span>
          </div>
        </div>
      </div>
      <div class="ch-xaxis">
        <span
          v-for="(p, i) in points"
          :key="p.bucket"
          class="ch-xl show"
          :class="{ act: active === i }"
        >{{ xlabel(p.bucket) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart { padding: 20px 22px; margin-bottom: 16px; }

/* ── header / KPI ── */
.ch-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.ch-kpi { display: flex; flex-direction: column; gap: 5px; }
.ch-eyebrow {
  font-size: var(--fs-2xs);
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--muted);
}
.ch-figure { display: flex; align-items: baseline; gap: 7px; }
.ch-num { font-size: var(--fs-3xl); line-height: 1; font-weight: 800; letter-spacing: -0.02em; }
.ch-unit { font-size: var(--fs-xs); font-weight: 600; color: var(--muted); }
.ch-meta { display: flex; gap: 6px; margin-top: 1px; }
.ch-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--bg-base);
  border: 1px solid var(--border);
  font-size: var(--fs-2xs);
}
.ch-chip i { font-style: normal; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.ch-chip b { color: var(--text); font-weight: 800; }

/* ── segmented control ── */
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; padding: 2px; background: var(--bg-base); gap: 1px; }
.seg-b {
  padding: 6px 13px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.14s, color 0.14s, box-shadow 0.14s;
}
.seg-b:hover { color: var(--text); }
.seg-b.on { background: var(--bg-surface); color: var(--azure); box-shadow: 0 1px 3px rgba(15, 22, 32, 0.1); }
.seg-b:disabled { opacity: 0.3; cursor: not-allowed; }
.seg-b:disabled:hover { color: var(--muted); }

.ch-empty { height: 200px; display: grid; place-items: center; color: var(--muted); font-size: var(--fs-sm); }

/* ── plot ── */
.ch-body { position: relative; padding-left: 30px; }
.ch-yaxis {
  position: absolute;
  left: 0;
  top: 0;
  height: 240px;
  width: 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  padding-right: 6px;
}
.ch-yt { font-size: var(--fs-2xs); font-weight: 600; color: var(--muted); opacity: 0.7; line-height: 1; }
.ch-grid { position: absolute; left: 30px; right: 0; top: 0; height: 240px; pointer-events: none; }
.ch-gl { position: absolute; left: 0; right: 0; height: 1px; background: var(--border); opacity: 0.55; }
.ch-gl:first-child { opacity: 0; }            /* topo limpo */
.ch-gl:last-child { opacity: 1; height: 1.5px; background: color-mix(in srgb, var(--border) 130%, var(--muted)); }

.ch-plot {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 4px;
  height: 240px;
  transition: opacity 0.15s ease;
}
.ch-plot.loading { opacity: 0.5; }
.ch-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: opacity 0.14s;
}
.ch-col.dim { opacity: 0.42; }
.ch-track {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.14s;
}
.ch-col.act .ch-track { background: color-mix(in srgb, var(--azure) 8%, transparent); }
.ch-bar {
  width: 100%;
  max-width: 30px;
  border-radius: 5px 5px 2px 2px;
  background: linear-gradient(180deg, var(--azure), color-mix(in srgb, var(--azure) 38%, transparent));
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent);
  transition: height 0.4s cubic-bezier(0.22, 1, 0.36, 1), filter 0.14s;
  animation: bargrow 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.ch-col.act .ch-bar { filter: brightness(1.06) saturate(1.1); }
@keyframes bargrow { from { transform: scaleY(0.001); } to { transform: scaleY(1); } }
.ch-bar { transform-origin: bottom; }

/* eixo X abaixo do plot (igual ao gráfico de gasto): "dd/mm" embaixo, fora da barra */
.ch-xaxis { display: flex; margin-top: 8px; }
.ch-xl {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
  font-size: var(--fs-2xs);
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  visibility: hidden;
}
.ch-xl.show { visibility: visible; }
.ch-xl.act { color: var(--text); font-weight: 700; }

/* ── tooltip (fixo no topo do plot p/ nunca cortar mesmo com barra alta) ── */
.ch-tip {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 7px 11px;
  background: var(--text);
  color: var(--bg-surface);
  border-radius: 9px;
  box-shadow: 0 10px 26px -8px rgba(15, 22, 32, 0.55);
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  animation: tipin 0.12s ease both;
}
.ch-tip-v { font-size: var(--fs-lg); font-weight: 800; line-height: 1; }
.ch-tip-u { font-size: var(--fs-2xs); opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }
.ch-tip-d { font-size: var(--fs-2xs); opacity: 0.85; margin-top: 2px; }
@keyframes tipin { from { opacity: 0; transform: translate(-50%, -4px); } to { opacity: 1; transform: translate(-50%, 0); } }
</style>
