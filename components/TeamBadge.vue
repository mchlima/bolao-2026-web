<script setup lang="ts">
import type { Team } from '~/types/api';

const props = withDefaults(
  defineProps<{ team?: Team | null; placeholder?: string | null; size?: number }>(),
  { size: 50 },
);

const colorMode = useColorMode();
// Prefer the team's crest image (dark variant on dark themes) for everyone —
// clubs and national teams alike. A national team without a crest falls back to
// its vector flag; anything else to a colored abbreviation emblem.
const logo = computed(() => teamLogo(props.team, colorMode.value === 'dark'));
const flag = computed(() => (logo.value ? null : teamFlag(props.team)));
const abbr = computed(() => teamAbbr(props.team, props.placeholder));
const color = computed(() => teamColor(props.team));

const box = computed(() => {
  // Crest: transparent, borderless, no padding — the image fills the box.
  if (logo.value) {
    return { width: `${props.size}px`, height: `${props.size}px` };
  }
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
  <div class="emblem" :class="{ flagged: !!flag, logoed: !!logo }" :style="box">
    <img
      v-if="logo"
      class="logo"
      :src="logo"
      :alt="abbr"
      loading="lazy"
      decoding="async"
    />
    <span v-else-if="flag" class="flag" v-html="flag" />
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
/* Crest images already have transparent backgrounds — no box chrome. */
.emblem.logoed {
  border: none;
  background: transparent;
}
.abbr {
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.logo {
  width: 100%;
  height: 100%;
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
