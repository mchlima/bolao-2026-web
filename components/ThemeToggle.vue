<script setup lang="ts">
const colorMode = useColorMode();
const order = ['system', 'light', 'dark'] as const;
const icon = computed(
  () => ({ system: '🖥️', light: '☀️', dark: '🌙' })[colorMode.preference] ?? '🖥️',
);
const labelMap = { system: 'Sistema', light: 'Claro', dark: 'Escuro' } as const;

function cycle() {
  const i = order.indexOf(colorMode.preference as (typeof order)[number]);
  colorMode.preference = order[(i + 1) % order.length];
}
</script>

<template>
  <button
    class="btn theme-toggle"
    :title="`Tema: ${labelMap[colorMode.preference as 'system' | 'light' | 'dark']}`"
    @click="cycle"
  >
    <span aria-hidden="true">{{ icon }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  padding: 0.45rem 0.6rem;
  font-size: 1rem;
  line-height: 1;
}
</style>
