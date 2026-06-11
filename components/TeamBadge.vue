<script setup lang="ts">
import type { Team } from '~/types/api';

const props = withDefaults(
  defineProps<{ team?: Team | null; placeholder?: string | null; size?: number }>(),
  { size: 50 },
);

const flag = computed(() => teamFlag(props.team));
const abbr = computed(() => teamAbbr(props.team, props.placeholder));
const color = computed(() => teamColor(props.team));
</script>

<template>
  <div
    class="emblem"
    :style="{ width: `${size}px`, height: `${size}px`, background: color }"
  >
    <span class="abbr" :style="{ fontSize: `${Math.round(size * 0.26)}px` }">{{ abbr }}</span>
    <span v-if="flag" class="flag" v-html="flag" />
  </div>
</template>

<style scoped>
.emblem {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 2px solid var(--border);
  flex: 0 0 auto;
}
.abbr {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.flag {
  position: absolute;
  inset: 0;
}
.flag :deep(svg) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
