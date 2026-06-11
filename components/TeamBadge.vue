<script setup lang="ts">
import * as flags from 'country-flag-icons/string/3x2';
import type { Team } from '~/types/api';

const props = defineProps<{
  team?: Team | null;
  placeholder?: string | null;
  align?: 'left' | 'right';
}>();

const flagSvg = computed(() => {
  const cc = props.team?.countryCode;
  if (!cc) return null;
  return (flags as unknown as Record<string, string>)[cc] ?? null;
});

const initials = computed(() => {
  const base = props.team?.shortName || props.team?.name || props.placeholder || '?';
  return base.slice(0, 3).toUpperCase();
});

const displayName = computed(
  () => props.team?.name ?? props.placeholder ?? 'A definir',
);
</script>

<template>
  <div class="team" :class="align === 'right' ? 'right' : 'left'">
    <span class="emblem">
      <span v-if="flagSvg" class="flag" v-html="flagSvg" />
      <img
        v-else-if="team?.logoUrl"
        :src="team.logoUrl"
        :alt="displayName"
        class="logo"
      />
      <span v-else class="initials">{{ initials }}</span>
    </span>
    <span class="name">{{ displayName }}</span>
  </div>
</template>

<style scoped>
.team {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.team.right {
  flex-direction: row-reverse;
  text-align: right;
}
.emblem {
  flex: 0 0 auto;
  width: 28px;
  height: 20px;
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.flag :deep(svg),
.logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.initials {
  font-size: 0.62rem;
  font-weight: 800;
  color: var(--muted);
}
.name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
