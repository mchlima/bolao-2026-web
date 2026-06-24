<script setup lang="ts">
import type { Paginated, Team } from '~/types/api';

// Typeahead team picker: type a name / shortName / espnAbbr, query the API, pick.
// Two modes:
//  • v-model (id) — keeps the chosen team shown as a chip (tie sides).
//  • clearOnSelect — fires `select` and resets (group "+ adicionar time").
const props = withDefaults(
  defineProps<{ modelValue?: string | null; placeholder?: string; clearOnSelect?: boolean }>(),
  { modelValue: null, placeholder: 'Buscar time…', clearOnSelect: false },
);
const emit = defineEmits<{ 'update:modelValue': [string | null]; select: [Team] }>();
const api = useApi();

const q = ref('');
const open = ref(false);
const loading = ref(false);
const results = ref<Team[]>([]);
const selected = ref<Team | null>(null);
const box = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(q, (val) => {
  if (timer) clearTimeout(timer);
  const term = val.trim();
  if (!term) { results.value = []; loading.value = false; return; }
  loading.value = true;
  timer = setTimeout(async () => {
    try {
      // Fetch a wider page then rank locally so name/shortName/espnAbbr matches
      // outrank country-only matches (e.g. "turquia" → the national team first,
      // not the Turkish clubs that match by country).
      const res = await api<Paginated<Team>>(`/teams?search=${encodeURIComponent(term)}&pageSize=50`);
      const t = term.toLowerCase();
      const score = (x: Team) => {
        const n = x.name.toLowerCase();
        const s = (x.shortName ?? '').toLowerCase();
        const e = (x.externalIds?.espn?.code ?? '').toLowerCase();
        if (n === t || s === t || e === t) return 0;
        if (n.startsWith(t)) return 1;
        if (n.includes(t) || s.includes(t) || e.includes(t)) return 2;
        return 3; // matched by country only
      };
      results.value = res.data
        .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name, 'pt-BR'))
        .slice(0, 20);
    } catch { results.value = []; } finally { loading.value = false; }
  }, 220);
});

function pick(t: Team) {
  emit('select', t);
  if (props.clearOnSelect) {
    selected.value = null;
    emit('update:modelValue', null);
  } else {
    selected.value = t;
    emit('update:modelValue', t.id);
  }
  q.value = '';
  results.value = [];
  open.value = false;
}
function clear() {
  selected.value = null;
  emit('update:modelValue', null);
  q.value = '';
}
function onDoc(e: MouseEvent) {
  if (box.value && !box.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDoc));
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc);
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div ref="box" class="tp">
    <div v-if="selected && !clearOnSelect" class="tp-sel">
      <TeamBadge :team="selected" :size="16" />
      <span class="tp-sel-nm">{{ selected.name }}</span>
      <button type="button" class="tp-x" title="Trocar" @click="clear">×</button>
    </div>
    <template v-else>
      <input
        v-model="q"
        class="input sm tp-input"
        :placeholder="placeholder"
        @focus="open = true"
        @input="open = true"
      />
      <div v-if="open && (loading || q.trim())" class="tp-menu">
        <div v-if="loading" class="tp-msg">Buscando…</div>
        <button v-for="t in results" :key="t.id" type="button" class="tp-opt" @click="pick(t)">
          <TeamBadge :team="t" :size="16" />
          <span class="tp-nm">{{ t.name }}</span>
          <span class="tp-ab">{{ t.shortName }}<template v-if="t.externalIds?.espn?.code && t.externalIds.espn.code !== t.shortName"> · {{ t.externalIds.espn.code }}</template></span>
        </button>
        <div v-if="!loading && !results.length" class="tp-msg">Nenhum time encontrado.</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tp { position: relative; }
.tp-input { width: 100%; }
.tp-sel { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 6px 0 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-surface); }
.tp-sel-nm { flex: 1; min-width: 0; font-size: var(--fs-sm); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-x { border: none; background: none; color: var(--muted); cursor: pointer; font-size: var(--fs-lg); line-height: 1; width: 24px; height: 24px; border-radius: 6px; flex: none; }
.tp-x:hover { color: var(--scarlet); background: color-mix(in srgb, var(--scarlet) 12%, transparent); }
.tp-menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 40; max-height: 260px; overflow-y: auto; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 11px; box-shadow: var(--shadow); padding: 5px; }
.tp-opt { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: none; background: none; cursor: pointer; padding: 7px 8px; border-radius: 8px; color: var(--text); }
.tp-opt:hover { background: var(--bg-base); }
.tp-nm { flex: 1; min-width: 0; font-size: var(--fs-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-ab { font-size: var(--fs-xs); font-weight: 700; color: var(--muted); flex: none; }
.tp-msg { padding: 9px 10px; font-size: var(--fs-xs); color: var(--muted); }
</style>
