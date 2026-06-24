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
const max = computed(() => Math.max(1, ...points.value.map((p) => p.count)));

function barH(count: number): string {
  if (count <= 0) return '0%';
  return `${Math.max(3, Math.round((count / max.value) * 100))}%`;
}

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
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: granularity.value === 'week' ? '2-digit' : undefined });
}
function tip(p: { bucket: string; count: number }): string {
  const d = dt(p.bucket);
  const n = `${p.count} ${p.count === 1 ? 'palpite' : 'palpites'}`;
  if (granularity.value === 'hour') return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${String(d.getHours()).padStart(2, '0')}:00: ${n}`;
  if (granularity.value === 'month') return `${d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}: ${n}`;
  if (granularity.value === 'week') return `Semana de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}: ${n}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}: ${n}`;
}
// Mostra ~12 rótulos no máximo, pra não embolar quando há muitos dias.
const labelStep = computed(() => Math.max(1, Math.ceil(points.value.length / 12)));
const showLabel = (i: number) =>
  i % labelStep.value === 0 || i === points.value.length - 1;
</script>

<template>
  <div class="card chart">
    <div class="ch-head">
      <div class="ch-tt">
        <h3 class="font-display">Palpites</h3>
        <span class="ch-total"><b class="font-numeric">{{ total }}</b> no período</span>
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
    </div>

    <div v-if="pending && !data" class="ch-empty">Carregando…</div>
    <div v-else-if="!total" class="ch-empty">Sem palpites no período.</div>
    <div v-else class="ch-plot" :class="{ loading: pending }">
      <div v-for="(p, i) in points" :key="p.bucket" class="ch-col" :title="tip(p)">
        <div class="ch-bar-wrap">
          <span v-if="p.count > 0" class="ch-val font-numeric">{{ p.count }}</span>
          <div class="ch-bar" :style="{ height: barH(p.count) }" />
        </div>
        <span class="ch-xl" :class="{ show: showLabel(i) }">{{ xlabel(p.bucket) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart { padding: 18px; margin-bottom: 16px; }
.ch-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ch-tt { display: flex; flex-direction: column; gap: 2px; }
.ch-tt h3 { font-weight: 600; font-size: var(--fs-base); text-transform: uppercase; }
.ch-total { font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
.ch-total b { color: var(--text); font-size: var(--fs-base); margin-right: 2px; }

.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--bg-base); }
.seg-b {
  padding: 7px 14px;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.seg-b + .seg-b { border-left: 1px solid var(--border); }
.seg-b:hover { color: var(--text); }
.seg-b.on { background: var(--azure); color: #fff; }
.seg-b:disabled { opacity: 0.34; cursor: not-allowed; }
.seg-b:disabled:hover { color: var(--muted); }

.ch-empty {
  height: 180px;
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: var(--fs-sm);
}
.ch-plot {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 220px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  transition: opacity 0.15s ease;
}
/* Refetch ao trocar de período: mantém o gráfico (esmaecido) em vez de piscar. */
.ch-plot.loading {
  opacity: 0.5;
}
.ch-col {
  flex: 1 0 auto;
  min-width: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ch-bar-wrap {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
}
.ch-val {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 3px;
  opacity: 0;
  transition: opacity 0.12s;
}
.ch-col:hover .ch-val { opacity: 1; }
.ch-bar {
  width: 100%;
  max-width: 34px;
  border-radius: 5px 5px 0 0;
  background: linear-gradient(180deg, var(--azure), color-mix(in srgb, var(--azure) 55%, transparent));
  transition: height 0.18s ease;
}
.ch-col:hover .ch-bar { filter: brightness(1.08); }
.ch-xl {
  margin-top: 7px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  visibility: hidden;
}
.ch-xl.show { visibility: visible; }
</style>
