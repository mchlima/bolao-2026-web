<script setup lang="ts">
defineProps<{ on: boolean; disabled?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="sw"
    :class="{ on }"
    :disabled="disabled"
    :aria-pressed="on"
    @click.stop.prevent="emit('toggle')"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.sw {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-base);
  position: relative;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, border-color 0.15s;
  flex: none;
}
.sw.on { background: var(--emerald); border-color: var(--emerald); }
.sw .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.sw.on .knob { transform: translateX(16px); }
.sw:disabled { opacity: 0.5; cursor: default; }
</style>
