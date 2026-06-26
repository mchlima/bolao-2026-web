<script setup lang="ts">
// Seletor de período do admin (header da dashboard). Botão com o intervalo atual
// que abre um painel com presets (Hoje, Últimos 7 dias, Este mês…) + intervalo
// personalizado. v-model = { from, to } em 'YYYY-MM-DD'. Versão enxuta de um
// date-range picker — o foco é facilitar a vida do admin, não cobrir todo caso.
const props = defineProps<{ modelValue: { from: string; to: string } }>();
const emit = defineEmits<{ 'update:modelValue': [{ from: string; to: string }] }>();

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

interface Preset {
  key: string;
  label: string;
  range: () => { from: string; to: string };
}
const presets = computed<Preset[]>(() => {
  // "hoje" no fuso de NEGÓCIO (não no do runtime/navegador) p/ os presets baterem
  // com os buckets do backend e não virar o dia às 21h SP — ver businessTz.
  const now = nowInBusinessTz();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    { key: 'today', label: 'Hoje', range: () => ({ from: ymd(today), to: ymd(today) }) },
    { key: 'yesterday', label: 'Ontem', range: () => ({ from: ymd(addDays(today, -1)), to: ymd(addDays(today, -1)) }) },
    { key: '7d', label: 'Últimos 7 dias', range: () => ({ from: ymd(addDays(today, -6)), to: ymd(today) }) },
    { key: '30d', label: 'Últimos 30 dias', range: () => ({ from: ymd(addDays(today, -29)), to: ymd(today) }) },
    { key: 'month', label: 'Este mês', range: () => ({ from: ymd(firstThisMonth), to: ymd(today) }) },
    { key: 'lastmonth', label: 'Mês passado', range: () => ({ from: ymd(firstLastMonth), to: ymd(lastLastMonth) }) },
    { key: 'year', label: 'Este ano', range: () => ({ from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(today) }) },
    { key: 'lastyear', label: 'Ano passado', range: () => ({ from: ymd(new Date(now.getFullYear() - 1, 0, 1)), to: ymd(new Date(now.getFullYear() - 1, 11, 31)) }) },
  ];
});

// Qual preset bate com o intervalo atual (pra acender e rotular).
const activeKey = computed(() => {
  const { from, to } = props.modelValue;
  return presets.value.find((p) => {
    const r = p.range();
    return r.from === from && r.to === to;
  })?.key;
});

const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const buttonLabel = computed(() => {
  const active = presets.value.find((p) => p.key === activeKey.value);
  if (active) return active.label;
  const { from, to } = props.modelValue;
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
});

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const customFrom = ref(props.modelValue.from);
const customTo = ref(props.modelValue.to);

function toggle() {
  if (!open.value) {
    customFrom.value = props.modelValue.from;
    customTo.value = props.modelValue.to;
  }
  open.value = !open.value;
}

// Mantém o intervalo coerente: se preencher só um campo, o outro (vazio) assume a
// mesma data; e "De" nunca passa de "Até" nem "Até" fica antes de "De". Junto com
// o min/max nativo, é impossível montar um intervalo vazio-pela-metade ou invertido.
watch(customFrom, (v) => {
  if (!v) return;
  if (!customTo.value || v > customTo.value) customTo.value = v;
});
watch(customTo, (v) => {
  if (!v) return;
  if (!customFrom.value || v < customFrom.value) customFrom.value = v;
});
function pick(p: Preset) {
  emit('update:modelValue', p.range());
  open.value = false;
}
function applyCustom() {
  if (!customFrom.value || !customTo.value) return;
  const from = customFrom.value <= customTo.value ? customFrom.value : customTo.value;
  const to = customFrom.value <= customTo.value ? customTo.value : customFrom.value;
  emit('update:modelValue', { from, to });
  open.value = false;
}
function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div ref="root" class="dr">
    <button type="button" class="dr-btn" :class="{ on: open }" @click="toggle">
      <AppIcon name="calendar" :size="16" />
      <span class="dr-lbl">{{ buttonLabel }}</span>
      <AppIcon name="chevronDown" :size="14" :stroke="2.4" class="dr-car" :class="{ on: open }" />
    </button>

    <div v-if="open" class="dr-panel">
      <ul class="dr-presets">
        <li v-for="p in presets" :key="p.key">
          <button type="button" class="dr-preset" :class="{ on: activeKey === p.key }" @click="pick(p)">
            {{ p.label }}
          </button>
        </li>
      </ul>
      <div class="dr-custom">
        <span class="dr-ctitle">Personalizado</span>
        <div class="dr-fields">
          <label>De<input v-model="customFrom" type="date" :max="customTo || undefined" /></label>
          <label>Até<input v-model="customTo" type="date" :min="customFrom || undefined" /></label>
        </div>
        <button type="button" class="dr-apply" @click="applyCustom">Aplicar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dr { position: relative; }
.dr-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-base);
  color: var(--text);
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.13s;
}
.dr-btn:hover,
.dr-btn.on { border-color: var(--muted); }
.dr-lbl { white-space: nowrap; }
.dr-car { color: var(--muted); transition: transform 0.16s; }
.dr-car.on { transform: rotate(180deg); }

.dr-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  width: 320px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg, 0 12px 32px rgba(8, 12, 18, 0.18));
}
.dr-presets { list-style: none; margin: 0 0 8px; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; }
.dr-preset {
  width: 100%;
  text-align: left;
  padding: 9px 11px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
}
.dr-preset:hover { background: var(--bg-surface); }
.dr-preset.on { color: var(--azure); background: color-mix(in srgb, var(--azure) 12%, transparent); }

.dr-custom { border-top: 1px solid var(--border); padding-top: 10px; }
.dr-ctitle {
  display: block;
  font-size: var(--fs-xs);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 8px;
}
.dr-fields { display: flex; gap: 8px; margin-bottom: 8px; }
.dr-fields label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--muted);
}
.dr-fields input {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: var(--fs-xs);
  background: var(--bg-base);
  color: var(--text);
  font-family: inherit;
}
.dr-apply {
  width: 100%;
  padding: 9px;
  border: 0;
  border-radius: 9px;
  background: var(--azure);
  color: #fff;
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
}
.dr-apply:hover { filter: brightness(1.05); }
</style>
