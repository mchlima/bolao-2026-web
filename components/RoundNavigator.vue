<script setup lang="ts">
// Rodada stepper: ‹ Rodada N › with a scrollable strip. Used by league/group
// fixtures views to page through matchdays. v-model is the selected round id.
interface RoundOpt {
  id: string;
  number: number | null;
  name: string | null;
}

const props = defineProps<{ rounds: RoundOpt[]; modelValue: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const index = computed(() =>
  Math.max(0, props.rounds.findIndex((r) => r.id === props.modelValue)),
);
const label = (r: RoundOpt) => r.name ?? (r.number != null ? `Rodada ${r.number}` : '—');

function step(delta: number) {
  const next = props.rounds[index.value + delta];
  if (next) emit('update:modelValue', next.id);
}
</script>

<template>
  <div class="nav">
    <button class="arrow" :disabled="index <= 0" aria-label="Rodada anterior" @click="step(-1)">‹</button>
    <div class="strip">
      <button
        v-for="r in rounds"
        :key="r.id"
        class="chip"
        :class="{ on: r.id === modelValue }"
        @click="emit('update:modelValue', r.id)"
      >
        {{ label(r) }}
      </button>
    </div>
    <button
      class="arrow"
      :disabled="index >= rounds.length - 1"
      aria-label="Próxima rodada"
      @click="step(1)"
    >
      ›
    </button>
  </div>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.arrow {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  font-size: var(--fs-xl);
  font-weight: 700;
  cursor: pointer;
}
.arrow:disabled {
  opacity: 0.4;
  cursor: default;
}
.strip {
  flex: 1;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.strip::-webkit-scrollbar {
  display: none;
}
.chip {
  flex: 0 0 auto;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--muted);
  font-weight: 700;
  font-size: var(--fs-sm);
  white-space: nowrap;
  cursor: pointer;
}
.chip.on {
  background: var(--grad-pitch);
  color: #fff;
  border-color: transparent;
}
</style>
