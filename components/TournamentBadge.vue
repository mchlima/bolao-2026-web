<script setup lang="ts">
// Tournament/competition identity badge: shows the league logo (light + dark
// variants, swapped by theme) when available, else the name initials over the
// pitch gradient (the previous look). `size` is the square side in px.
const props = withDefaults(
  defineProps<{
    name: string;
    logoUrl?: string | null;
    logoUrlDark?: string | null;
    size?: number;
  }>(),
  { logoUrl: null, logoUrlDark: null, size: 40 },
);

const initials = computed(() => {
  const w = props.name.split(/\s+/).filter((x) => x.length > 2 && !/^fifa$/i.test(x) && !/^\d+$/.test(x));
  return ((w[0]?.[0] ?? props.name[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
});
</script>

<template>
  <span class="tb" :class="{ 'has-logo': logoUrl }" :style="{ '--tb-size': size + 'px' }">
    <template v-if="logoUrl">
      <img class="tb-img tb-lt" :src="logoUrl" :alt="name" loading="lazy" />
      <img class="tb-img tb-dk" :src="logoUrlDark || logoUrl" :alt="name" loading="lazy" />
    </template>
    <span v-else class="tb-txt font-display">{{ initials }}</span>
  </span>
</template>

<style scoped>
.tb {
  flex: none;
  width: var(--tb-size);
  height: var(--tb-size);
  border-radius: calc(var(--tb-size) * 0.28);
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--grad-pitch);
  color: #fff;
}
.tb.has-logo {
  background: var(--bg-surface);
  border: 1px solid var(--border);
}
.tb-txt {
  font-weight: 700;
  font-size: calc(var(--tb-size) * 0.36);
}
.tb-img {
  grid-area: 1 / 1;
  width: 78%;
  height: 78%;
  object-fit: contain;
}
.tb-dk {
  display: none;
}
html[data-theme='dark'] .tb-lt {
  display: none;
}
html[data-theme='dark'] .tb-dk {
  display: block;
}
</style>
