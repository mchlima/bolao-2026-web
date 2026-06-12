<script setup lang="ts">
import type { Team } from '~/types/api';

const props = withDefaults(
  defineProps<{ team?: Team | null; placeholder?: string | null; size?: number }>(),
  { size: 50 },
);

const colorMode = useColorMode();
const flag = computed(() => teamFlag(props.team));
// National teams render the flag; clubs render their real crest (dark variant on
// dark themes); anything else falls back to a colored abbreviation emblem.
const logo = computed(() =>
  flag.value ? null : teamLogo(props.team, colorMode.value === 'dark'),
);
const abbr = computed(() => teamAbbr(props.team, props.placeholder));
const color = computed(() => teamColor(props.team));

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
    borderRadius: logo.value
      ? `${Math.max(4, Math.round(props.size * 0.22))}px`
      : '50%',
    background: logo.value ? 'var(--bg-base)' : color.value,
  };
});
</script>

<template>
  <div class="emblem" :class="{ flagged: !!flag, logoed: !!logo }" :style="box">
    <span v-if="flag" class="flag" v-html="flag" />
    <img
      v-else-if="logo"
      class="logo"
      :src="logo"
      :alt="abbr"
      loading="lazy"
      decoding="async"
    />
    <span
      v-else
      class="abbr"
      :style="{ fontSize: `${Math.round(size * 0.26)}px` }"
      >{{ abbr }}</span
    >
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
.emblem:not(.flagged):not(.logoed) {
  border-width: 2px;
}
.abbr {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.logo {
  width: 78%;
  height: 78%;
  object-fit: contain;
  display: block;
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
