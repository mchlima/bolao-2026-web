<script setup lang="ts">
// Small status badge with a tonal color. `live` adds the pulsing ring + dot used
// for in-progress matches; `dot` shows a leading status dot (user access state).
withDefaults(
  defineProps<{
    label: string;
    tone?: 'neutral' | 'azure' | 'emerald' | 'gold' | 'scarlet';
    live?: boolean;
    dot?: boolean;
    soft?: boolean;
  }>(),
  { tone: 'neutral', live: false, dot: false, soft: false },
);
</script>

<template>
  <span class="status-pill" :class="[`t-${tone}`, { live, soft: soft || live }]">
    <span v-if="dot || live" class="dot" />
    {{ label }}
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--muted);
  white-space: nowrap;
}
.t-azure { color: var(--azure); }
.t-emerald { color: var(--emerald); }
.t-gold { color: var(--gold); }
.t-scarlet { color: var(--scarlet); }
.soft {
  border-color: transparent;
  background: color-mix(in srgb, currentColor 13%, transparent);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.live {
  border-color: var(--scarlet);
  animation: livePulse 1.8s infinite;
}
.live .dot {
  animation: liveDot 1.2s infinite;
}
</style>
