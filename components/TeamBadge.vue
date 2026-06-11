<script setup lang="ts">
import type { Team } from '~/types/api';

const props = withDefaults(
  defineProps<{ team?: Team | null; placeholder?: string | null; size?: number }>(),
  { size: 50 },
);

const flag = computed(() => teamFlag(props.team));
const abbr = computed(() => teamAbbr(props.team, props.placeholder));
const color = computed(() => teamColor(props.team));

// Flags render as a standard rectangle (3:2) with lightly rounded corners.
// Clubs / unknown opponents keep the round, colored abbr emblem.
const box = computed(() => {
  if (flag.value) {
    const h = Math.round(props.size * 0.68);
    return {
      width: `${props.size}px`,
      height: `${h}px`,
      borderRadius: `${Math.max(3, Math.round(props.size * 0.1))}px`,
    };
  }
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    borderRadius: '50%',
    background: color.value,
  };
});
</script>

<template>
  <div class="emblem" :class="{ flagged: !!flag }" :style="box">
    <span
      v-if="!flag"
      class="abbr"
      :style="{ fontSize: `${Math.round(size * 0.26)}px` }"
      >{{ abbr }}</span
    >
    <span v-else class="flag" v-html="flag" />
  </div>
</template>

<style scoped>
.emblem {
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  flex: 0 0 auto;
}
.emblem:not(.flagged) {
  border-width: 2px;
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
