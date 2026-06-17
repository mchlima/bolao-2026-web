<script setup lang="ts">
// One source of truth for "user face": the profile photo when present, the
// name initials otherwise. Used in the header, bottom nav, account menu and the
// profile page so the fallback stays consistent everywhere.
const props = withDefaults(
  defineProps<{ name?: string | null; src?: string | null; size?: number }>(),
  { size: 38 },
);

const initials = computed(() => {
  const n = props.name?.trim();
  if (!n) return 'VC';
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
});
</script>

<template>
  <span
    class="uav"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.34)}px`,
    }"
  >
    <img v-if="src" :src="src" alt="" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<style scoped>
.uav {
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  flex: none;
  background: var(--grad-pitch);
  color: #fff;
  font-family: 'Oswald', sans-serif;
  font-weight: 700;
  line-height: 1;
}
.uav img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
