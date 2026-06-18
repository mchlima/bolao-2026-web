<script setup lang="ts">
// Vertical score stepper: chevron-up on top, the number in the middle, chevron-
// down on the bottom. Shows "–" when the value is null (no palpite yet). Emits a
// delta (+1 / -1); the parent clamps and stores it.
defineProps<{ value: number | null; label?: string }>();
const emit = defineEmits<{ bump: [delta: number] }>();
</script>

<template>
  <div class="stp">
    <button type="button" class="stp-b" :aria-label="`Aumentar ${label ?? ''}`" @click="emit('bump', 1)">
      <AppIcon name="chevronUp" :size="18" :stroke="2.6" />
    </button>
    <span class="stp-n">{{ value ?? '–' }}</span>
    <button type="button" class="stp-b" :aria-label="`Diminuir ${label ?? ''}`" @click="emit('bump', -1)">
      <AppIcon name="chevronDown" :size="18" :stroke="2.6" />
    </button>
  </div>
</template>

<style scoped>
.stp {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
}
.stp-b {
  display: grid;
  place-items: center;
  height: 24px;
  width: 38px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
}
.stp-b:hover {
  color: var(--text);
}
.stp-b:active {
  color: var(--gold);
}
.stp-n {
  width: 38px;
  text-align: center;
  padding: 1px 0;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  font-size: 18px;
  line-height: 1;
}
</style>
