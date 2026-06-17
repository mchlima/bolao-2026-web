<script setup lang="ts">
// Searchable IANA-timezone select. The option list comes straight from the
// runtime (Intl.supportedValuesOf) so it stays current without a hardcoded
// table; each row shows the live UTC offset to make the choice unambiguous.
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const open = ref(false);
const search = ref('');
const root = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);

const FALLBACK = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Noronha',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'UTC',
];

const zones = computed<string[]>(() => {
  const sv = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  return typeof sv === 'function' ? sv('timeZone') : FALLBACK;
});

function offsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

const pretty = (tz: string) => tz.replace(/_/g, ' ');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase().replace(/\s+/g, '_');
  const list = zones.value;
  return (q ? list.filter((z) => z.toLowerCase().includes(q)) : list).slice(
    0,
    120,
  );
});

function selectZone(tz: string) {
  emit('update:modelValue', tz);
  open.value = false;
  search.value = '';
}

watch(open, (v) => {
  if (v) nextTick(() => searchInput.value?.focus());
});

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div ref="root" class="tzp">
    <button type="button" class="tzp-sel input" @click="open = !open">
      <span class="tzp-val">{{ pretty(modelValue) }}</span>
      <span class="tzp-off">{{ offsetLabel(modelValue) }}</span>
      <AppIcon name="chevronDown" :size="16" />
    </button>

    <div v-if="open" class="tzp-menu card">
      <div class="tzp-search">
        <AppIcon name="search" :size="15" />
        <input
          ref="searchInput"
          v-model="search"
          class="tzp-input"
          placeholder="Buscar fuso (ex.: São Paulo, Lisbon)"
        />
      </div>
      <ul class="tzp-list">
        <li v-for="z in filtered" :key="z">
          <button
            type="button"
            class="tzp-item"
            :class="{ on: z === modelValue }"
            @click="selectZone(z)"
          >
            <span class="tzp-name">{{ pretty(z) }}</span>
            <span class="tzp-off">{{ offsetLabel(z) }}</span>
          </button>
        </li>
        <li v-if="!filtered.length" class="tzp-empty">Nenhum fuso encontrado</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.tzp {
  position: relative;
}
.tzp-sel {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
}
.tzp-val {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.tzp-off {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  flex: none;
}
.tzp-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  padding: 8px;
}
.tzp-search {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-base);
  color: var(--muted);
}
.tzp-input {
  flex: 1;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 13.5px;
  padding: 10px 0;
  outline: none;
}
.tzp-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
}
.tzp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
}
.tzp-item:hover {
  background: var(--bg-base);
}
.tzp-item.on {
  color: var(--emerald);
  font-weight: 700;
}
.tzp-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tzp-empty {
  padding: 14px 10px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
</style>
